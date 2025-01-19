// src/utils/databaseHandler.js

import { OverlayManager } from "./overlayManager";

// Validation function to check product data completeness
const validateProductData = (productData, isModalView = false) => {
  const requiredFields = {
    retailer_id: "number",
    external_id: "string",
    url_path: "string",
  };

  // Only require ingredients for modal view
  if (isModalView) {
    requiredFields.ingredients = "string";
  }

  const optionalFields = {
    price_amount: "number",
    price_unit: "string",
    image_url: "string",
    ingredients: "string", // Optional for list view
  };

  const validationErrors = [];
  const validatedData = {};

  // Check required fields
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!productData[field]) {
      validationErrors.push(`Missing required field: ${field}`);
      continue;
    }

    if (typeof productData[field] !== type) {
      validationErrors.push(`Invalid type for ${field}: expected ${type}, got ${typeof productData[field]}`);
      continue;
    }

    // Additional validation for empty strings
    if (type === "string" && productData[field].trim() === "") {
      validationErrors.push(`Field ${field} cannot be empty`);
      continue;
    }

    validatedData[field] = productData[field];
  }

  // Check optional fields
  for (const [field, type] of Object.entries(optionalFields)) {
    if (productData[field] !== undefined) {
      if (typeof productData[field] !== type) {
        validationErrors.push(`Invalid type for ${field}: expected ${type}, got ${typeof productData[field]}`);
        continue;
      }
      validatedData[field] = productData[field];
    }
  }

  // Special validation for retailer_id
  if (validatedData.retailer_id && (!Number.isInteger(validatedData.retailer_id) || validatedData.retailer_id <= 0)) {
    validationErrors.push("retailer_id must be a positive integer");
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
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_KEY;
    this.overlayManager = new OverlayManager();

    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error("Database configuration missing. Using environment variables:", {
        url: this.supabaseUrl ? "set" : "missing",
        key: this.supabaseKey ? "set" : "missing",
      });
    }
  }

  async getCurrentProductIngredients(externalIds) {
    try {
      if (!Array.isArray(externalIds) || externalIds.length === 0) {
        throw new Error("External IDs must be provided as a non-empty array");
      }
      // Format array for Supabase's in operator
      const externalIdsQuery = `(${externalIds.map((id) => `"${id}"`).join(",")})`;

      // Use the current_product_ingredients view with in operator
      const url = `${this.supabaseUrl}/rest/v1/current_product_ingredients?external_id=in.${encodeURIComponent(
        externalIdsQuery
      )}`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      const results = await this.handleResponse(response, "Failed to fetch current product ingredients");

      // Process and format the results
      const productIngredients = {};
      results.forEach((result) => {
        productIngredients[result.external_id] = {
          ingredients: result.ingredients || null,
          toxin_flags: result.toxin_flags || null,
        };
      });

      return productIngredients;
    } catch (error) {
      console.error("Error in getCurrentProductIngredients:", error);
      throw error;
    }
  }

  async findOrCreateProductGroup(ingredients) {
    let ingredientsHash;
    try {
      if (!ingredients || ingredients.trim() === "") {
        throw new Error("Ingredients are required for product grouping");
      }

      // Generate hash for searching
      ingredientsHash = await this.generateIngredientsHash(ingredients);

      // First try to find existing group by ingredients hash
      const existingGroup = await this.findGroupByIngredientsHash(ingredientsHash);

      if (existingGroup) {
        // Update verification count for existing group
        await fetch(
          `${this.supabaseUrl}/rest/v1/product_group_ingredients?id=eq.${existingGroup.current_ingredients_id}`,
          {
            method: "PATCH",
            headers: this.getHeaders(),
            body: JSON.stringify({
              verification_count: existingGroup.verification_count + 1,
              found_at: new Date().toISOString(),
            }),
          }
        );
        return existingGroup;
      }

      // Find toxic ingredients
      const toxinFlags = this.overlayManager.findToxicIngredients(ingredients);

      // Try to create new group with ingredients atomically
      // Note: We don't pass the hash - let the database generate it
      const rpcResponse = await fetch(`${this.supabaseUrl}/rest/v1/rpc/find_or_create_product_group`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          p_ingredients: ingredients,
          p_toxin_flags: toxinFlags === null ? null : toxinFlags.length > 0 ? toxinFlags : [],
        }),
      });

      const results = await this.handleResponse(rpcResponse, "Failed to find or create product group");

      // Handle array response from RPC
      const result = Array.isArray(results) ? results[0] : results;

      if (!result || !result.product_group_id) {
        throw new Error("Failed to get product group ID from database");
      }

      return {
        id: result.product_group_id,
        current_ingredients_id: result.ingredients_id,
      };
    } catch (error) {
      // If we hit a unique constraint, try one more time to find the group
      if (error.message && error.message.includes("duplicate key value violates unique constraint")) {
        const retryGroup = await this.findGroupByIngredientsHash(ingredientsHash);
        if (retryGroup) {
          return retryGroup;
        }
      }
      console.error("Error in findOrCreateProductGroup:", error);
      throw error;
    }
  }

  async generateIngredientsHash(ingredients) {
    // Normalize ingredients string
    const normalizedIngredients = ingredients.toLowerCase().replace(/\s+/g, " ").trim();

    // Convert string to UTF-8 bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedIngredients);

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    // Convert to hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async findGroupByIngredientsHash(ingredientsHash) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/product_group_ingredients?ingredients_hash=eq.${ingredientsHash}&is_current=eq.true&select=product_group_id,id,verification_count`,
        {
          headers: this.getHeaders(),
        }
      );

      const results = await this.handleResponse(response, "Failed to find group by ingredients hash");
      if (results && results.length > 0) {
        return {
          id: results[0].product_group_id,
          current_ingredients_id: results[0].id,
          verification_count: results[0].verification_count,
        };
      }
      return null;
    } catch (error) {
      console.error("Error in findGroupByIngredientsHash:", error);
      throw error;
    }
  }

  async saveProductListing(productData) {
    try {
      const isModalView = productData.ingredients !== undefined && productData.ingredients.trim() !== "";
      const validation = validateProductData(productData, isModalView);

      if (!validation.isValid) {
        throw new Error(`Invalid product data: ${validation.errors.join(", ")}`);
      }

      // Step 1: Find or create product group based on ingredients
      if (!productData.ingredients) {
        throw new Error("Ingredients are required for product grouping");
      }

      const productGroup = await this.findOrCreateProductGroup(productData.ingredients);

      if (!productGroup || !productGroup.id) {
        throw new Error("Failed to create product group");
      }

      // Step 2: Create/update product listing
      const listing = await this.upsertProductListing({
        product_group_id: productGroup.id,
        retailer_id: productData.retailer_id,
        external_id: productData.external_id,
        url_path: productData.url_path,
        price_amount: productData.price_amount,
        price_unit: productData.price_unit,
        image_url: productData.image_url,
      });

      if (!listing) {
        throw new Error("Failed to create/update product listing");
      }

      return {
        success: true,
        product_group_id: productGroup.id,
        listing_id: listing.id,
      };
    } catch (error) {
      // If it's a duplicate key error from upsertProductListing, we can ignore it
      if (error.message?.includes("duplicate key value")) {
        console.log("Product already exists in database, skipping save");
        return { success: true };
      }
      console.error("Error saving product data:", error);
      throw error;
    }
  }

  async upsertProductListing({
    product_group_id,
    retailer_id,
    external_id,
    url_path,
    price_amount,
    price_unit,
    image_url,
  }) {
    try {
      // First, try to find existing listing
      const searchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/product_listings?retailer_id=eq.${retailer_id}&external_id=eq.${encodeURIComponent(
          external_id
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
              product_group_id,
              url_path,
              price_amount,
              price_unit,
              image_url,
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
        headers: this.getHeaders("return=representation"),
        body: JSON.stringify({
          product_group_id,
          retailer_id,
          external_id,
          url_path,
          price_amount,
          price_unit,
          image_url,
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      try {
        const newListing = await this.handleResponse(createResponse, "Failed to create product listing");
        return Array.isArray(newListing) ? newListing[0] : newListing;
      } catch (error) {
        // If it's a duplicate key error, try to fetch the existing record
        if (error.message?.includes("duplicate key value")) {
          const retryResponse = await fetch(
            `${
              this.supabaseUrl
            }/rest/v1/product_listings?retailer_id=eq.${retailer_id}&external_id=eq.${encodeURIComponent(external_id)}`,
            {
              headers: this.getHeaders(),
            }
          );
          const existingListing = await this.handleResponse(retryResponse, "Failed to fetch existing listing");
          return Array.isArray(existingListing) ? existingListing[0] : existingListing;
        }
        throw error;
      }
    } catch (error) {
      if (error.message?.includes("duplicate key value")) {
        console.log("Product listing already exists, returning existing record");
        const searchResponse = await fetch(
          `${
            this.supabaseUrl
          }/rest/v1/product_listings?retailer_id=eq.${retailer_id}&external_id=eq.${encodeURIComponent(external_id)}`,
          {
            headers: this.getHeaders(),
          }
        );
        const existingListing = await this.handleResponse(searchResponse, "Failed to fetch existing listing");
        return Array.isArray(existingListing) ? existingListing[0] : existingListing;
      }
      console.error("Error in upsertProductListing:", error);
      throw error;
    }
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
