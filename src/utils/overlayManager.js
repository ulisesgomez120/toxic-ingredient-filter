// Import toxic ingredients data
import { DEFAULT_TOXIC_INGREDIENTS } from "../../defaultIngredients";

export class OverlayManager {
  constructor() {
    // Initialize toxic ingredients as a Map for efficient lookups
    this.toxicIngredients = new Map(
      DEFAULT_TOXIC_INGREDIENTS.map((ingredient) => [ingredient.name.toLowerCase(), ingredient])
    );
  }

  // Get severity color based on highest concern level
  getSeverityColor(toxinFlags) {
    const concernLevels = {
      High: "#dc3545", // Red
      Moderate: "#ffc107", // Yellow
      Low: "#28a745", // Green
    };

    if (toxinFlags?.length === 0) {
      return "#28a745"; // Green for no toxins
    } else if (!toxinFlags) {
      return "#6c757d"; // Gray for no data
    }

    // Find highest concern level
    const highestConcern = toxinFlags.reduce((highest, current) => {
      const concernOrder = { High: 3, Moderate: 2, Low: 1 };
      return concernOrder[current.concernLevel] > concernOrder[highest] ? current.concernLevel : highest;
    }, "Low");

    return concernLevels[highestConcern];
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
  removeExistingOverlays(productElement) {
    // Remove any existing toxic badges
    console.log("productElement", productElement);
    const existingBadges = productElement.querySelectorAll(".toxic-badge");
    // console.log("ex", existingBadges);
    existingBadges.forEach((badge) => badge.remove());
  }
  createOverlay(productElement, productData) {
    // Make sure the product element has relative positioning
    if (getComputedStyle(productElement).position === "static") {
      productElement.style.position = "relative";
    }

    // Create badge container
    const badge = document.createElement("div");
    badge.className = "toxic-badge";

    // Get toxin flags or empty array
    const toxinFlags = productData?.toxin_flags || null;
    const severityColor = this.getSeverityColor(toxinFlags);
    badge.style.backgroundColor = severityColor;

    // Add count to badge
    badge.textContent = toxinFlags === null ? "X" : toxinFlags.length;

    // Create tooltip container
    const tooltip = document.createElement("div");
    tooltip.className = "toxic-tooltip";

    if (toxinFlags === null) {
      const header = document.createElement("div");
      header.className = "toxic-tooltip-header";
      header.textContent = "No ingredient data available";
      tooltip.appendChild(header);
    } else if (toxinFlags.length > 0) {
      const header = document.createElement("div");
      header.className = "toxic-tooltip-header";
      header.textContent = `Found ${toxinFlags.length} concerning ingredient${toxinFlags.length > 1 ? "s" : ""}:`;
      tooltip.appendChild(header);

      toxinFlags.forEach((ingredient) => {
        const ingredientDiv = document.createElement("div");
        ingredientDiv.className = "toxic-ingredient";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = ingredient.name;

        const concernSpan = document.createElement("span");
        concernSpan.className = `concern-level ${ingredient.concernLevel.toLowerCase()}`;
        concernSpan.textContent = ` (${ingredient.concernLevel})`;

        ingredientDiv.appendChild(nameSpan);
        ingredientDiv.appendChild(concernSpan);
        tooltip.appendChild(ingredientDiv);
      });
    } else if (toxinFlags.length === 0) {
      const noToxinsDiv = document.createElement("div");
      noToxinsDiv.className = "toxic-tooltip-safe";
      noToxinsDiv.textContent = "No concerning ingredients found";
      tooltip.appendChild(noToxinsDiv);
    }

    // Add tooltip to badge
    badge.appendChild(tooltip);

    // Add badge to product element
    productElement.appendChild(badge);

    return true;
  }
}
