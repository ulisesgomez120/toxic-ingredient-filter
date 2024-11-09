// src/utils/databaseHandler.js

// These would be injected during build from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

class DatabaseHandler {
  constructor() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Database configuration missing. Ensure environment variables are set.");
    }

    this.supabaseUrl = SUPABASE_URL;
    this.supabaseKey = SUPABASE_KEY;
  }

  async saveProductIngredients(productData) {
    try {
      // First, try to find or create product group
      const groupResponse = await fetch(`${this.supabaseUrl}/rest/v1/product_groups`, {
        method: "POST",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          brand: productData.brand,
          base_name: productData.baseName,
        }),
      });

      if (!groupResponse.ok) {
        throw new Error("Failed to create product group");
      }

      const groupData = await groupResponse.json();
      const productGroupId = groupData[0].id;

      // Save ingredients
      const ingredientsResponse = await fetch(`${this.supabaseUrl}/rest/v1/product_group_ingredients`, {
        method: "POST",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          product_group_id: productGroupId,
          ingredients: productData.ingredients,
          is_current: true,
          verification_count: 1,
        }),
      });

      if (!ingredientsResponse.ok) {
        throw new Error("Failed to save ingredients");
      }

      // Create verification record
      await fetch(`${this.supabaseUrl}/rest/v1/ingredient_verifications`, {
        method: "POST",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_group_id: productGroupId,
          retailer_id: 1, // Walmart from initial data
          hash: this.generateIngredientsHash(productData.ingredients),
        }),
      });

      return {
        success: true,
        productGroupId,
      };
    } catch (error) {
      console.error("Error saving product data:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  generateIngredientsHash(ingredients) {
    // Simple hash function for ingredients string
    return Array.from(ingredients)
      .reduce((hash, char) => {
        return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
      }, 0)
      .toString(16);
  }

  async getProductIngredients(productGroupId) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/product_group_ingredients?product_group_id=eq.${productGroupId}&is_current=eq.true`,
        {
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch ingredients");
      }

      const data = await response.json();
      return data[0]?.ingredients || null;
    } catch (error) {
      console.error("Error fetching ingredients:", error);
      return null;
    }
  }
}

export default DatabaseHandler;
