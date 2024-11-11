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
    attributes: "array",
    ingredients: "string", // Optional for list view
    // baseUnit: "string",
    // size: "string",
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
      if (type === "array" && !Array.isArray(modalData[field])) {
        validationErrors.push(`Invalid type for ${field}: expected array, got ${typeof modalData[field]}`);
        continue;
      } else if (type !== "array" && typeof modalData[field] !== type) {
        validationErrors.push(`Invalid type for ${field}: expected ${type}, got ${typeof modalData[field]}`);
        continue;
      }
      validatedData[field] = modalData[field];
    }
  }

  // Special validation for attributes if present
  if (modalData.attributes) {
    const invalidAttributes = modalData.attributes.filter(
      (attr) => !attr.key || !attr.value || typeof attr.key !== "string" || typeof attr.value !== "string"
    );

    if (invalidAttributes.length > 0) {
      validationErrors.push("Invalid attributes format. Each attribute must have string key and value");
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
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error("Database configuration missing. Ensure environment variables are set.");
    }

    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_KEY;
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
      // Return empty object for non-JSON responses that are successful
      return {};
    }

    try {
      const data = await response.json();
      if (!data) {
        return {}; // Return empty object for null/undefined data
      }
      return data;
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      throw new Error("Failed to parse response: " + error.message);
    }
  }

  async saveProductListing(productData) {
    try {
      console.log("Saving product data:", JSON.stringify(productData, null, 2));

      // Determine if this is modal data by checking for ingredients
      const isModalView = "ingredients" in productData;

      // Validate the data first
      const validation = validateModalData(productData, isModalView);
      if (!validation.isValid) {
        throw new Error(`Invalid product data: ${validation.errors.join(", ")}`);
      }

      // Step 1: Find or create product group
      const productGroup = await this.findOrCreateProductGroup({
        brand: productData.brand || "",
        baseName: productData.baseName || productData.name,
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

      // Step 5: Save attributes if provided
      if (productData.attributes?.length > 0) {
        await this.saveAttributes(product.id, productData.retailerId, productData.attributes);
        console.log("Attributes saved successfully");
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

      // If not found, create new product group with ON CONFLICT DO NOTHING
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

      // If creation failed due to conflict, try to find the existing one again
      if (!newGroup || !newGroup.id) {
        const retryResponse = await fetch(
          `${this.supabaseUrl}/rest/v1/product_groups?brand=eq.${encodeURIComponent(
            brand
          )}&base_name=eq.${encodeURIComponent(baseName)}`,
          {
            headers: this.getHeaders(),
          }
        );

        const retryGroups = await this.handleResponse(retryResponse, "Failed to retry search for product group");
        if (retryGroups && retryGroups.length > 0) {
          console.log("Found product group after conflict:", retryGroups[0]);
          return retryGroups[0];
        }
      }

      console.log("Created new product group:", newGroup);
      return Array.isArray(newGroup) ? newGroup[0] : newGroup;
    } catch (error) {
      console.error("Error in findOrCreateProductGroup:", error);
      throw error;
    }
  }

  async findOrCreateProduct({ productGroupId, name, baseUnit, size }) {
    try {
      // Validate required fields
      if (!productGroupId) {
        throw new Error("Product group ID is required");
      }
      if (!name || name.trim() === "") {
        throw new Error("Product name is required");
      }

      console.log("Finding/creating product:", { productGroupId, name, baseUnit, size });

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
        if (existingProducts[0].base_unit !== baseUnit || existingProducts[0].size !== size) {
          const updateResponse = await fetch(`${this.supabaseUrl}/rest/v1/products?id=eq.${existingProducts[0].id}`, {
            method: "PATCH",
            headers: this.getHeaders("return=representation"),
            body: JSON.stringify({
              base_unit: baseUnit,
              size: size,
              updated_at: new Date().toISOString(),
            }),
          });
          const data = await this.handleResponse(updateResponse, "Failed to update product");
          return Array.isArray(data) ? data[0] : data;
        }
        return existingProducts[0];
      }

      // If not found, create new product with ON CONFLICT DO NOTHING
      const createResponse = await fetch(`${this.supabaseUrl}/rest/v1/products`, {
        method: "POST",
        headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
        body: JSON.stringify({
          product_group_id: productGroupId,
          name,
          base_unit: baseUnit,
          size: size,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      const newProduct = await this.handleResponse(createResponse, "Failed to create product");

      // If creation failed due to conflict, try to find the existing one again
      if (!newProduct || !newProduct.id) {
        const retryResponse = await fetch(
          `${this.supabaseUrl}/rest/v1/products?product_group_id=eq.${productGroupId}&name=eq.${encodeURIComponent(
            name
          )}`,
          {
            headers: this.getHeaders(),
          }
        );

        const retryProducts = await this.handleResponse(retryResponse, "Failed to retry search for product");
        if (retryProducts && retryProducts.length > 0) {
          console.log("Found product after conflict:", retryProducts[0]);
          return retryProducts[0];
        }
      }

      console.log("Created new product:", newProduct);
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

      // First, try to find existing listing by both retailer_id and external_id
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

      // If not found, create new listing with ON CONFLICT DO NOTHING
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

      // If creation failed due to conflict, try to find the existing one again
      if (!newListing || !newListing.id) {
        const retryResponse = await fetch(
          `${
            this.supabaseUrl
          }/rest/v1/product_listings?retailer_id=eq.${retailerId}&external_id=eq.${encodeURIComponent(externalId)}`,
          {
            headers: this.getHeaders(),
          }
        );

        const retryListings = await this.handleResponse(retryResponse, "Failed to retry search for product listing");
        if (retryListings && retryListings.length > 0) {
          console.log("Found product listing after conflict:", retryListings[0]);
          return retryListings[0];
        }
      }

      console.log("Created new product listing:", newListing);
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
        `${this.supabaseUrl}/rest/v1/product_group_ingredients?product_group_id=eq.${productGroupId}`,
        {
          method: "PATCH",
          headers: this.getHeaders("return=representation"),
          body: JSON.stringify({ is_current: false }),
        }
      );

      await this.handleResponse(updateResponse, "Failed to update existing ingredients");

      // Then insert new ingredients with ON CONFLICT DO NOTHING
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

  async saveAttributes(productId, retailerId, attributes) {
    try {
      console.log("Saving attributes:", { productId, retailerId, attributes });

      // Mark existing attributes as not current
      const updateResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/product_attributes?product_id=eq.${productId}&retailer_id=eq.${retailerId}`,
        {
          method: "PATCH",
          headers: this.getHeaders("return=representation"),
          body: JSON.stringify({ is_current: false }),
        }
      );

      await this.handleResponse(updateResponse, "Failed to update existing attributes");

      // Insert new attributes with ON CONFLICT DO NOTHING
      for (const attr of attributes) {
        const insertResponse = await fetch(`${this.supabaseUrl}/rest/v1/product_attributes`, {
          method: "POST",
          headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
          body: JSON.stringify({
            product_id: productId,
            retailer_id: retailerId,
            key: attr.key,
            value: attr.value,
            is_current: true,
            found_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }),
        });

        await this.handleResponse(insertResponse, `Failed to save attribute ${attr.key}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Error in saveAttributes:", error);
      throw error;
    }
  }

  async createIngredientVerification(productGroupId, ingredients, retailerId) {
    if (!productGroupId || !ingredients || !retailerId) {
      throw new Error("Missing required parameters for ingredient verification");
    }

    // Validate retailerId
    if (!Number.isInteger(retailerId) || retailerId <= 0) {
      throw new Error("Invalid retailerId: must be a positive integer");
    }

    try {
      console.log("Creating ingredient verification:", { productGroupId, retailerId });

      // First check if retailer exists
      const retailerResponse = await fetch(`${this.supabaseUrl}/rest/v1/retailers?id=eq.${retailerId}&select=id`, {
        headers: this.getHeaders(),
      });

      const retailers = await this.handleResponse(retailerResponse, "Failed to verify retailer");
      if (!Array.isArray(retailers) || retailers.length === 0) {
        throw new Error(`Retailer with ID ${retailerId} does not exist`);
      }

      // Create verification record with ON CONFLICT DO NOTHING
      const verificationResponse = await fetch(`${this.supabaseUrl}/rest/v1/ingredient_verifications`, {
        method: "POST",
        headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
        body: JSON.stringify({
          product_group_id: productGroupId,
          retailer_id: retailerId,
          hash: this.generateIngredientsHash(ingredients),
          verified_at: new Date().toISOString(),
        }),
      });

      return await this.handleResponse(verificationResponse, "Failed to create ingredient verification");
    } catch (error) {
      console.error("Error creating ingredient verification:", error);
      throw error;
    }
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
      headers["Prefer"] = prefer;
    }

    return headers;
  }

  // Utility methods for retrieving data
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
      return Array.isArray(data) ? data[0]?.ingredients : null;
    } catch (error) {
      console.error("Error in getProductIngredients:", error);
      throw error;
    }
  }

  async getProductAttributes(productId, retailerId) {
    try {
      console.log("Getting product attributes:", { productId, retailerId });

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/product_attributes?product_id=eq.${productId}&retailer_id=eq.${retailerId}&is_current=eq.true`,
        {
          headers: this.getHeaders(),
        }
      );

      return await this.handleResponse(response, "Failed to fetch attributes");
    } catch (error) {
      console.error("Error in getProductAttributes:", error);
      throw error;
    }
  }

  async testModalDataProcessing(modalData) {
    console.log("Testing modal data processing...");
    console.log("Input data:", JSON.stringify(modalData, null, 2));

    // Validate the data
    const validation = validateModalData(modalData, true); // Pass true to indicate modal view

    if (!validation.isValid) {
      console.error("Validation failed:", validation.errors);
      return {
        success: false,
        errors: validation.errors,
      };
    }

    console.log("Validation passed. Validated data:", validation.data);

    // At this point you could call saveProductListing
    // but for testing we'll just return the validated data
    return {
      success: true,
      data: validation.data,
    };
  }
}

export default DatabaseHandler;
