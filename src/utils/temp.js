let productData = {
  external_id: "items_33151-154423",
  url_path: "/products/154423-kroger-french-fried-potatoes-garlic-fries-24-oz?retailerSlug=food-4-less-kroger",
  name: "Kroger French Fried Potatoes, Garlic Fries",
  brand: "Kroger French Fried",
  retailerId: 3,
  price_amount: 3.79,
  price_unit: "each",
  size: "24",
  base_unit: "oz",
  image_url: "https://www.instacart.com/image-server/197x197/filters:fill(FFF",
  id: 56,
  product_group_id: 1578,
  ingredients:
    "Potatoes, Vegetable Oil (contains One Or More Of The Following Oils: Canola, Soybean, Cottonseed, Sunflower, Corn), Bleached Enriched Wheat Flour (flour, Niacin, Reduced Iron, Thiamine Mononitrate, Riboflavin, Folic Acid). Contains 2% Or Less Of Artificial Grill Flavor, Baking Soda, Citric Acid (to Maintain Freshness), Dehydrated Bell Peppers, Dehydrated Garlic, Dextrose, Dextrin, Guar Gum, Maltodextrin, Monosodium Glutamate, Natural Flavors, Onion Powder, Potato Starch - Modified, Rice Flour, Salt, Sodium Acid Pyrophosphate (maintains Color And Leavening), Spices, Tapioca Starch - Modified, Xanthan Gum.",
  is_current: true,
  found_at: "2024-11-19T20:25:51.561+00:00",
  created_at: "2024-11-19T20:25:51.561+00:00",
  verification_count: 1,
  ingredients_hash: "a73cb90fcb42aef9ebf3732b1657d53684bef993e130d4a8111724d20a7cafbe",
  toxin_flags: [
    {
      name: "Partially Hydrogenated Oils",
      aliases: ["Trans fats", "PHOs"],
      isToxic: true,
      sources: [
        {
          url: "https://www.nejm.org/doi/full/10.1056/NEJMra054035",
          year: 2006,
          title: "Trans Fatty Acids and Cardiovascular Disease",
          publisher: "New England Journal of Medicine",
        },
      ],
      category: "Fats",
      concernLevel: "High",
      healthEffects: [
        "Increased LDL cholesterol",
        "Decreased HDL cholesterol",
        "Increased inflammation",
        "Higher risk of heart disease",
      ],
    },
  ],
};

function createOverlay(productElement, productData) {
  // Make sure the product element has relative positioning
  if (getComputedStyle(productElement).position === "static") {
    productElement.style.position = "relative";
  }

  // Create overlay container
  const overlay = document.createElement("div");
  overlay.className = "toxic-overlay";

  // Create info container
  const infoContainer = document.createElement("div");
  infoContainer.className = "toxic-info";
  // Find toxic ingredients if we have ingredient data
  // const toxicIngredients = this.findToxicIngredients(productData.ingredients);

  if (productData.toxin_flags?.length > 0) {
    // Add toxic ingredients to info container
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.style.marginBottom = "8px";
    header.textContent = `Found ${productData.toxin_flags.length} concerning ingredient${
      productData.toxin_flags.length > 1 ? "s" : ""
    }:`;
    infoContainer.appendChild(header);

    productData.toxin_flags.forEach((ingredient) => {
      const ingredientDiv = document.createElement("div");
      ingredientDiv.className = "toxic-ingredient";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = ingredient.name;

      const concernSpan = document.createElement("span");
      concernSpan.className = `concern-level ${ingredient.concernLevel.toLowerCase()}`;
      concernSpan.textContent = ` (${ingredient.concernLevel})`;

      ingredientDiv.appendChild(nameSpan);
      ingredientDiv.appendChild(concernSpan);
      infoContainer.appendChild(ingredientDiv);
    });

    // Add info container to overlay
    overlay.appendChild(infoContainer);

    // Add overlay to product element
    productElement.appendChild(overlay);

    return true; // Return true if overlay was added
  } else if (productData.toxin_flags?.length === 0) {
    // add badge with 0 and hover shows "No toxic ingredients found"
  } else if (productData.ingredients.length > 0) {
    // there should always be a toxin_flags array or it should be an empty array but just in case, check ingredients and find/save toxin flags
    const toxicIngredients = this.findToxicIngredients(productData.ingredients);
    // do something with toxicIngredients
  }

  return false; // Return false if no toxic ingredients were found
}
