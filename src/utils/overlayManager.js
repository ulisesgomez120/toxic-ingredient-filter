// Import toxic ingredients data
import { DEFAULT_TOXIC_INGREDIENTS } from "../../defaultIngredients";

export class OverlayManager {
  constructor() {
    // Initialize toxic ingredients as a Map for efficient lookups
    this.toxicIngredients = new Map(
      DEFAULT_TOXIC_INGREDIENTS.map((ingredient) => [ingredient.name.toLowerCase(), ingredient])
    );
  }

  // Update toxic ingredients with custom ones from settings
  updateCustomIngredients(customIngredients) {
    customIngredients.forEach((ingredient) => {
      if (typeof ingredient === "object" && ingredient.name) {
        this.toxicIngredients.set(ingredient.name.toLowerCase(), ingredient);
      }
    });
  }

  findToxicIngredients(ingredients) {
    if (!ingredients) return [];

    // Split ingredients string into array and clean up
    const ingredientList = ingredients
      .toLowerCase()
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i);

    // Find matching toxic ingredients
    const found = [];
    for (const ingredient of ingredientList) {
      for (const [toxicName, toxicData] of this.toxicIngredients) {
        if (
          ingredient.includes(toxicName.toLowerCase()) ||
          toxicData.aliases.some((alias) => ingredient.includes(alias.toLowerCase()))
        ) {
          found.push(toxicData);
          break;
        }
      }
    }

    return found;
  }

  createOverlay(productElement, productData) {
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
    const toxicIngredients = this.findToxicIngredients(productData.ingredients);

    if (toxicIngredients.length > 0) {
      // Add toxic ingredients to info container
      const header = document.createElement("div");
      header.style.fontWeight = "bold";
      header.style.marginBottom = "8px";
      header.textContent = `Found ${toxicIngredients.length} concerning ingredient${
        toxicIngredients.length > 1 ? "s" : ""
      }:`;
      infoContainer.appendChild(header);

      toxicIngredients.forEach((ingredient) => {
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
    }

    return false; // Return false if no toxic ingredients were found
  }
}
