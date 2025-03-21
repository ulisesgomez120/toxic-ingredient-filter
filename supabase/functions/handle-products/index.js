// supabase/functions/handle-product-data/index.js
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers to allow requests from the Chrome extension
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Validates product data to ensure it conforms to expected types and constraints
 * @param {Object} data - The product data to validate
 * @param {boolean} requireIngredients - Whether ingredients are required (true for modal view)
 * @returns {Object} Validation result with isValid flag, errors array, and validated data
 */
function validateProductData(data, requireIngredients = false) {
  const requiredFields = {
    retailer_id: "number",
    external_id: "string",
    url_path: "string",
  };

  // Only require ingredients if specified (for modal view)
  if (requireIngredients) {
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
    if (data[field] === undefined || data[field] === null) {
      validationErrors.push(`Missing required field: ${field}`);
      continue;
    }

    if (typeof data[field] !== type) {
      validationErrors.push(`Invalid type for ${field}: expected ${type}, got ${typeof data[field]}`);
      continue;
    }

    // Additional validation for empty strings
    if (type === "string" && data[field].trim() === "") {
      validationErrors.push(`Field ${field} cannot be empty`);
      continue;
    }

    validatedData[field] = data[field];
  }

  // Check optional fields
  for (const [field, type] of Object.entries(optionalFields)) {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== type) {
        validationErrors.push(`Invalid type for ${field}: expected ${type}, got ${typeof data[field]}`);
        continue;
      }
      validatedData[field] = data[field];
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
}

/**
 * Finds or creates a product group based on ingredients
 * @param {Object} supabase - Supabase client
 * @param {string} ingredients - Product ingredients
 * @param {Object} toxinFlags - Optional toxin flags data
 * @returns {Promise<Object>} Product group data with id and ingredients_id
 */
async function findOrCreateProductGroup(supabase, ingredients, toxinFlags = null) {
  try {
    // Call the existing PostgreSQL function to find or create a product group
    const { data, error } = await supabase.rpc("find_or_create_product_group", {
      p_ingredients: ingredients,
      p_toxin_flags: toxinFlags,
    });

    if (error) {
      console.error("Error in find_or_create_product_group:", error);
      throw new Error(`Failed to find or create product group: ${error.message}`);
    }

    if (!data || !data[0] || !data[0].product_group_id) {
      throw new Error("Failed to get product group ID from database");
    }

    return {
      id: data[0].product_group_id,
      ingredients_id: data[0].ingredients_id,
    };
  } catch (error) {
    console.error("Error in findOrCreateProductGroup:", error);
    throw error;
  }
}

/**
 * Upserts a product listing (creates or updates)
 * @param {Object} supabase - Supabase client
 * @param {Object} listingData - Product listing data
 * @returns {Promise<Object>} The created or updated product listing
 */
async function upsertProductListing(supabase, listingData) {
  try {
    const { product_group_id, retailer_id, external_id, url_path, price_amount, price_unit, image_url } = listingData;

    // First, try to find existing listing
    const { data: existingListings, error: searchError } = await supabase
      .from("product_listings")
      .select("id")
      .eq("retailer_id", retailer_id)
      .eq("external_id", external_id)
      .limit(1);

    if (searchError) {
      throw new Error(`Failed to search for product listing: ${searchError.message}`);
    }

    const now = new Date().toISOString();

    if (existingListings && existingListings.length > 0) {
      // Update existing listing
      const { data: updatedListing, error: updateError } = await supabase
        .from("product_listings")
        .update({
          product_group_id,
          url_path,
          price_amount,
          price_unit,
          image_url,
          last_seen_at: now,
          updated_at: now,
        })
        .eq("id", existingListings[0].id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update product listing: ${updateError.message}`);
      }

      return updatedListing;
    }

    // If not found, create new listing
    const { data: newListing, error: createError } = await supabase
      .from("product_listings")
      .insert({
        product_group_id,
        retailer_id,
        external_id,
        url_path,
        price_amount,
        price_unit,
        image_url,
        last_seen_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (createError) {
      // If it's a duplicate key error, try to fetch the existing record
      if (createError.message?.includes("duplicate key value")) {
        const { data: existingListing, error: retryError } = await supabase
          .from("product_listings")
          .select()
          .eq("retailer_id", retailer_id)
          .eq("external_id", external_id)
          .single();

        if (retryError) {
          throw new Error(`Failed to fetch existing listing: ${retryError.message}`);
        }

        return existingListing;
      }
      throw new Error(`Failed to create product listing: ${createError.message}`);
    }

    return newListing;
  } catch (error) {
    console.error("Error in upsertProductListing:", error);
    throw error;
  }
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const productData = await req.json();
    console.log("Received product data:", JSON.stringify(productData));

    // Determine if ingredients are required (modal view)
    const isModalView =
      productData.ingredients !== undefined &&
      productData.ingredients !== null &&
      productData.ingredients.trim() !== "";

    // Validate input
    const validation = validateProductData(productData, isModalView);
    if (!validation.isValid) {
      console.error("Validation errors:", validation.errors);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid product data",
          details: validation.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process the product data
    let productGroup;
    let listing;

    // Step 1: Find or create product group if ingredients are provided
    if (validation.data.ingredients) {
      productGroup = await findOrCreateProductGroup(supabase, validation.data.ingredients);

      if (!productGroup || !productGroup.id) {
        throw new Error("Failed to create product group");
      }

      // Step 2: Create/update product listing
      listing = await upsertProductListing(supabase, {
        product_group_id: productGroup.id,
        retailer_id: validation.data.retailer_id,
        external_id: validation.data.external_id,
        url_path: validation.data.url_path,
        price_amount: validation.data.price_amount,
        price_unit: validation.data.price_unit,
        image_url: validation.data.image_url,
      });
    } else {
      // If no ingredients, just return success without doing anything
      // This handles the list view case where we don't have ingredients yet
      return new Response(
        JSON.stringify({
          success: true,
          message: "No ingredients provided, skipping database operations",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        product_group_id: productGroup.id,
        listing_id: listing.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Error handling
    console.error("Error processing request:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
