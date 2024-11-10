// src/utils/databaseHandler.js

class DatabaseHandler {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error("Database configuration missing. Ensure environment variables are set.");
    }

    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_KEY;
  }

  async saveProductListing(productData) {
    try {
      // Step 1: Find or create product group
      const productGroup = await this.findOrCreateProductGroup({
        brand: productData.brand,
        baseName: productData.baseName,
      });

      // Step 2: Find or create product variant
      const product = await this.findOrCreateProduct({
        productGroupId: productGroup.id,
        name: productData.name,
        baseUnit: productData.baseUnit,
        size: productData.size,
      });

      // Step 3: Create/update product listing
      const listing = await this.upsertProductListing({
        productId: product.id,
        retailerId: productData.retailerId,
        externalId: productData.externalId,
        urlPath: productData.urlPath,
        priceAmount: productData.priceAmount,
        priceUnit: productData.priceUnit,
        imageUrl: productData.imageUrl,
      });

      // Step 4: Save ingredients if provided
      if (productData.ingredients) {
        await this.saveIngredients(productGroup.id, productData.ingredients);
      }

      // Step 5: Save attributes if provided
      if (productData.attributes?.length > 0) {
        await this.saveAttributes(product.id, productData.retailerId, productData.attributes);
      }

      return {
        success: true,
        productGroupId: productGroup.id,
        productId: product.id,
        listingId: listing.id,
      };
    } catch (error) {
      console.error("Error saving product data:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async findOrCreateProductGroup({ brand, baseName }) {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/product_groups`, {
      method: "POST",
      headers: this.getHeaders("merge-duplicates"),
      body: JSON.stringify({
        brand,
        base_name: baseName,
      }),
    });

    if (!response.ok) throw new Error("Failed to create product group");
    return response.json().then((data) => data[0]);
  }

  async findOrCreateProduct({ productGroupId, name, baseUnit, size }) {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/products`, {
      method: "POST",
      headers: this.getHeaders("merge-duplicates"),
      body: JSON.stringify({
        product_group_id: productGroupId,
        name,
        base_unit: baseUnit,
        size,
      }),
    });

    if (!response.ok) throw new Error("Failed to create product");
    return response.json().then((data) => data[0]);
  }

  async upsertProductListing({ productId, retailerId, externalId, urlPath, priceAmount, priceUnit, imageUrl }) {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/product_listings`, {
      method: "POST",
      headers: this.getHeaders("merge-duplicates"),
      body: JSON.stringify({
        product_id: productId,
        retailer_id: retailerId,
        external_id: externalId,
        url_path: urlPath,
        price_amount: priceAmount,
        price_unit: priceUnit,
        image_url: imageUrl,
        last_seen_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) throw new Error("Failed to create/update product listing");
    return response.json().then((data) => data[0]);
  }

  async saveIngredients(productGroupId, ingredients) {
    // First, mark existing ingredients as not current
    await fetch(`${this.supabaseUrl}/rest/v1/product_group_ingredients?product_group_id=eq.${productGroupId}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({ is_current: false }),
    });

    // Then insert new ingredients
    const response = await fetch(`${this.supabaseUrl}/rest/v1/product_group_ingredients`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        product_group_id: productGroupId,
        ingredients,
        is_current: true,
        verification_count: 1,
      }),
    });

    if (!response.ok) throw new Error("Failed to save ingredients");

    // Create verification record
    await this.createIngredientVerification(productGroupId, ingredients);
  }

  async saveAttributes(productId, retailerId, attributes) {
    // Mark existing attributes as not current
    await fetch(
      `${this.supabaseUrl}/rest/v1/product_attributes?product_id=eq.${productId}&retailer_id=eq.${retailerId}`,
      {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({ is_current: false }),
      }
    );

    // Insert new attributes
    for (const attr of attributes) {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/product_attributes`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          product_id: productId,
          retailer_id: retailerId,
          key: attr.key,
          value: attr.value,
          is_current: true,
        }),
      });

      if (!response.ok) throw new Error(`Failed to save attribute: ${attr.key}`);
    }
  }

  async createIngredientVerification(productGroupId, ingredients) {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/ingredient_verifications`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        product_group_id: productGroupId,
        retailer_id: 1, // Walmart from initial data
        hash: this.generateIngredientsHash(ingredients),
      }),
    });

    if (!response.ok) throw new Error("Failed to create ingredient verification");
  }

  generateIngredientsHash(ingredients) {
    return Array.from(ingredients)
      .reduce((hash, char) => {
        return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
      }, 0)
      .toString(16);
  }

  getHeaders(prefer = null) {
    const headers = {
      apikey: this.supabaseKey,
      Authorization: `Bearer ${this.supabaseKey}`,
      "Content-Type": "application/json",
    };

    if (prefer) {
      headers["Prefer"] = `resolution=${prefer}`;
    }

    return headers;
  }

  // Utility methods for retrieving data
  async getProductIngredients(productGroupId) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/product_group_ingredients?product_group_id=eq.${productGroupId}&is_current=eq.true`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) throw new Error("Failed to fetch ingredients");
    const data = await response.json();
    return data[0]?.ingredients || null;
  }

  async getProductAttributes(productId, retailerId) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/product_attributes?product_id=eq.${productId}&retailer_id=eq.${retailerId}&is_current=eq.true`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) throw new Error("Failed to fetch attributes");
    return response.json();
  }
}

export default DatabaseHandler;
