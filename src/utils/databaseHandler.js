// src/utils/databaseHandler.js

// Validation function to check modal data completeness
const validateModalData = (modalData, isModalView = false) => {
  const requiredFields = {
    name: "string",
    retailerId: "number",
    externalId: "string",
    urlPath: "string",
  };

  // Only require ingredients for modal view
  if (isModalView) {
    requiredFields.ingredients = "string";
  }

  const optionalFields = {
    priceAmount: "number",
    priceUnit: "string",
    imageUrl: "string",
    nutrition: "object",
    ingredients: "string", // Optional for list view
  };

  const validationErrors = [];
  const validatedData = {};

  // Check required fields
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!modalData[field]) {
      validationErrors.push(`Missing required field: ${field}`);
      continue;
    }

    if (typeof modalData[field] !== type) {
      validationErrors.push(`Invalid type for ${field}: expected ${type}, got ${typeof modalData[field]}`);
      continue;
    }

    // Additional validation for empty strings
    if (type === "string" && modalData[field].trim() === "") {
      validationErrors.push(`Field ${field} cannot be empty`);
      continue;
    }

    validatedData[field] = modalData[field];
  }

  // Check optional fields
  for (const [field, type] of Object.entries(optionalFields)) {
    if (modalData[field] !== undefined) {
      if (typeof modalData[field] !== type) {
        validationErrors.push(`Invalid type for ${field}: expected ${type}, got ${typeof modalData[field]}`);
        continue;
      }
      validatedData[field] = modalData[field];
    }
  }

  // Special validation for retailerId
  if (validatedData.retailerId && (!Number.isInteger(validatedData.retailerId) || validatedData.retailerId <= 0)) {
    validationErrors.push("retailerId must be a positive integer");
  }

  // Parse ingredients if it's valid
  if (validatedData.ingredients && typeof validatedData.ingredients === "string") {
    validatedData.ingredients = validatedData.ingredients.trim();
    if (validatedData.ingredients.length === 0) {
      validationErrors.push("Ingredients string cannot be empty");
    }
  }

  return {
    isValid: validationErrors.length === 0,
    errors: validationErrors,
    data: validationErrors.length === 0 ? validatedData : null,
  };
};

class DatabaseHandler {
  constructor() {
    // Access environment variables through webpack's process.env
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_KEY;

    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error("Database configuration missing. Using environment variables:", {
        url: this.supabaseUrl ? "set" : "missing",
        key: this.supabaseKey ? "set" : "missing",
      });
    }
  }

  // Normalize product name for better matching
  normalizeProductName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  }

  // Extract brand and base name from product name
  extractProductInfo(name) {
    const normalized = this.normalizeProductName(name);
    const parts = normalized.split(" ");

    // Assume first word is brand if it's a known brand
    const knownBrands = ["doritos", "tostitos", "lindt", "ghirardelli", "bugles", "minute", "tree"];
    const brand = knownBrands.find((b) => parts[0].includes(b)) || "";

    // Remove brand from base name if found
    const baseName = brand ? normalized.replace(brand, "").trim() : normalized;

    return { brand, baseName };
  }

  async handleResponse(response, errorMessage) {
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${errorMessage}:`, errorText);
      throw new Error(`${errorMessage}: ${errorText}`);
    }

    // For 204 No Content responses, return an empty object
    if (response.status === 204) {
      return {};
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Unexpected response type:", contentType);
      return {};
    }

    try {
      const data = await response.json();
      return data || {};
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      throw new Error("Failed to parse response: " + error.message);
    }
  }

  async findRetailer(name, website) {
    try {
      console.log("Finding retailer:", { name, website });

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/retailers?name=eq.${encodeURIComponent(name)}&website=eq.${encodeURIComponent(
          website
        )}`,
        {
          headers: this.getHeaders(),
        }
      );

      const retailers = await this.handleResponse(response, "Failed to find retailer");
      return retailers && retailers.length > 0 ? retailers[0] : null;
    } catch (error) {
      console.error("Error in findRetailer:", error);
      throw error;
    }
  }

  async getOrCreateRetailer(name, website) {
    try {
      const existingRetailer = await this.findRetailer(name, website);
      if (existingRetailer) {
        return existingRetailer;
      }

      const createResponse = await fetch(`${this.supabaseUrl}/rest/v1/retailers`, {
        method: "POST",
        headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
        body: JSON.stringify({
          name,
          website,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      const newRetailer = await this.handleResponse(createResponse, "Failed to create retailer");
      return Array.isArray(newRetailer) ? newRetailer[0] : newRetailer;
    } catch (error) {
      console.error("Error in getOrCreateRetailer:", error);
      throw error;
    }
  }

  async saveProductListing(productData) {
    try {
      console.log("Saving product data:", JSON.stringify(productData, null, 2));

      const isModalView = "ingredients" in productData;
      const validation = validateModalData(productData, isModalView);

      if (!validation.isValid) {
        throw new Error(`Invalid product data: ${validation.errors.join(", ")}`);
      }

      // Extract product info using normalized name
      const { brand, baseName } = this.extractProductInfo(productData.name);

      // Step 1: Find or create product group
      const productGroup = await this.findOrCreateProductGroup({
        brand,
        baseName,
      });

      if (!productGroup) {
        throw new Error("Failed to create product group");
      }

      console.log("Product group created/found:", productGroup);

      // Step 2: Find or create product variant
      const product = await this.findOrCreateProduct({
        productGroupId: productGroup.id,
        name: productData.name,
        baseUnit: productData.baseUnit,
        size: productData.size,
        nutrition: productData.nutrition,
      });

      if (!product) {
        throw new Error("Failed to create product");
      }

      console.log("Product variant created/found:", product);

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

      if (!listing) {
        throw new Error("Failed to create/update product listing");
      }

      console.log("Product listing created/updated:", listing);

      // Step 4: Save ingredients if provided
      if (productData.ingredients) {
        await this.saveIngredients(productGroup.id, productData.ingredients);
        console.log("Ingredients saved successfully");
      }

      return {
        success: true,
        productGroupId: productGroup.id,
        productId: product.id,
        listingId: listing.id,
      };
    } catch (error) {
      console.error("Error saving product data:", error);
      throw error;
    }
  }

  async findOrCreateProductGroup({ brand, baseName }) {
    try {
      if (!baseName || baseName.trim() === "") {
        throw new Error("Base name is required for product group");
      }

      console.log("Finding/creating product group:", { brand, baseName });

      // First try to find existing product group with exact match
      const searchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/product_groups?brand=eq.${encodeURIComponent(
          brand
        )}&base_name=eq.${encodeURIComponent(baseName)}`,
        {
          headers: this.getHeaders(),
        }
      );

      const existingGroups = await this.handleResponse(searchResponse, "Failed to search for product group");

      if (existingGroups && existingGroups.length > 0) {
        console.log("Found existing product group:", existingGroups[0]);
        return existingGroups[0];
      }

      // If not found, create new product group
      const createResponse = await fetch(`${this.supabaseUrl}/rest/v1/product_groups`, {
        method: "POST",
        headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
        body: JSON.stringify({
          brand,
          base_name: baseName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      const newGroup = await this.handleResponse(createResponse, "Failed to create product group");
      return Array.isArray(newGroup) ? newGroup[0] : newGroup;
    } catch (error) {
      console.error("Error in findOrCreateProductGroup:", error);
      throw error;
    }
  }

  async findOrCreateProduct({ productGroupId, name, baseUnit, size, nutrition }) {
    try {
      if (!productGroupId || !name || name.trim() === "") {
        throw new Error("Product group ID and name are required");
      }

      console.log("Finding/creating product:", { productGroupId, name, baseUnit, size, nutrition });

      // First try to find existing product
      const searchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/products?product_group_id=eq.${productGroupId}&name=eq.${encodeURIComponent(
          name
        )}`,
        {
          headers: this.getHeaders(),
        }
      );

      const existingProducts = await this.handleResponse(searchResponse, "Failed to search for product");

      if (existingProducts && existingProducts.length > 0) {
        // Update existing product if needed
        if (
          existingProducts[0].base_unit !== baseUnit ||
          existingProducts[0].size !== size ||
          JSON.stringify(existingProducts[0].nutrition) !== JSON.stringify(nutrition)
        ) {
          const updateResponse = await fetch(`${this.supabaseUrl}/rest/v1/products?id=eq.${existingProducts[0].id}`, {
            method: "PATCH",
            headers: this.getHeaders("return=representation"),
            body: JSON.stringify({
              base_unit: baseUnit,
              size: size,
              nutrition: nutrition,
              updated_at: new Date().toISOString(),
            }),
          });
          const data = await this.handleResponse(updateResponse, "Failed to update product");
          return Array.isArray(data) ? data[0] : data;
        }
        return existingProducts[0];
      }

      // If not found, create new product
      const createResponse = await fetch(`${this.supabaseUrl}/rest/v1/products`, {
        method: "POST",
        headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
        body: JSON.stringify({
          product_group_id: productGroupId,
          name,
          base_unit: baseUnit,
          size: size,
          nutrition: nutrition,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      const newProduct = await this.handleResponse(createResponse, "Failed to create product");
      return Array.isArray(newProduct) ? newProduct[0] : newProduct;
    } catch (error) {
      console.error("Error in findOrCreateProduct:", error);
      throw error;
    }
  }

  async upsertProductListing({ productId, retailerId, externalId, urlPath, priceAmount, priceUnit, imageUrl }) {
    try {
      console.log("Upserting product listing:", {
        productId,
        retailerId,
        externalId,
        urlPath,
        priceAmount,
        priceUnit,
        imageUrl,
      });

      // First, try to find existing listing
      const searchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/product_listings?retailer_id=eq.${retailerId}&external_id=eq.${encodeURIComponent(
          externalId
        )}`,
        {
          headers: this.getHeaders(),
        }
      );

      const existingListings = await this.handleResponse(searchResponse, "Failed to search for product listing");

      if (existingListings && existingListings.length > 0) {
        // Update existing listing
        const updateResponse = await fetch(
          `${this.supabaseUrl}/rest/v1/product_listings?id=eq.${existingListings[0].id}`,
          {
            method: "PATCH",
            headers: this.getHeaders("return=representation"),
            body: JSON.stringify({
              product_id: productId,
              url_path: urlPath,
              price_amount: priceAmount,
              price_unit: priceUnit,
              image_url: imageUrl,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
          }
        );

        const data = await this.handleResponse(updateResponse, "Failed to update product listing");
        return Array.isArray(data) ? data[0] : data;
      }

      // If not found, create new listing
      const createResponse = await fetch(`${this.supabaseUrl}/rest/v1/product_listings`, {
        method: "POST",
        headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
        body: JSON.stringify({
          product_id: productId,
          retailer_id: retailerId,
          external_id: externalId,
          url_path: urlPath,
          price_amount: priceAmount,
          price_unit: priceUnit,
          image_url: imageUrl,
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      const newListing = await this.handleResponse(createResponse, "Failed to create product listing");
      return Array.isArray(newListing) ? newListing[0] : newListing;
    } catch (error) {
      console.error("Error in upsertProductListing:", error);
      throw error;
    }
  }

  async saveIngredients(productGroupId, ingredients) {
    try {
      console.log("Saving ingredients:", { productGroupId, ingredients });

      // First, mark existing ingredients as not current
      const updateResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/product_group_ingredients?product_group_id=eq.${productGroupId}&is_current=eq.true`,
        {
          method: "PATCH",
          headers: this.getHeaders("return=representation"),
          body: JSON.stringify({ is_current: false }),
        }
      );

      await this.handleResponse(updateResponse, "Failed to update existing ingredients");

      // Then insert new ingredients
      const insertResponse = await fetch(`${this.supabaseUrl}/rest/v1/product_group_ingredients`, {
        method: "POST",
        headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
        body: JSON.stringify({
          product_group_id: productGroupId,
          ingredients,
          is_current: true,
          verification_count: 1,
          found_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }),
      });

      return await this.handleResponse(insertResponse, "Failed to save ingredients");
    } catch (error) {
      console.error("Error in saveIngredients:", error);
      throw error;
    }
  }

  async getProductIngredients(productGroupId) {
    try {
      console.log("Getting product ingredients:", { productGroupId });

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/product_group_ingredients?product_group_id=eq.${productGroupId}&is_current=eq.true`,
        {
          headers: this.getHeaders(),
        }
      );

      const data = await this.handleResponse(response, "Failed to fetch ingredients");
      return Array.isArray(data) && data.length > 0 ? data[0].ingredients : null;
    } catch (error) {
      console.error("Error in getProductIngredients:", error);
      throw error;
    }
  }

  async testModalDataProcessing(modalData) {
    console.log("Testing modal data processing...");
    console.log("Input data:", JSON.stringify(modalData, null, 2));

    const validation = validateModalData(modalData, true);

    if (!validation.isValid) {
      console.error("Validation failed:", validation.errors);
      return {
        success: false,
        errors: validation.errors,
      };
    }

    console.log("Validation passed. Validated data:", validation.data);

    return {
      success: true,
      data: validation.data,
    };
  }

  getHeaders(prefer = null) {
    const headers = {
      apikey: this.supabaseKey,
      Authorization: `Bearer ${this.supabaseKey}`,
      "Content-Type": "application/json",
    };

    if (prefer) {
      headers["Prefer"] = prefer;
    }

    return headers;
  }
}

export default DatabaseHandler;
