// Import toxic ingredients data
import { DEFAULT_TOXIC_INGREDIENTS } from "../../default-ingredients";

export class OverlayManager {
  constructor() {
    // Initialize toxic ingredients as a Map for efficient lookups
    this.toxicIngredients = new Map(
      DEFAULT_TOXIC_INGREDIENTS.map((ingredient) => [ingredient.name.toLowerCase(), ingredient])
    );
    console.log("Toxic ingredients loaded:", this.toxicIngredients);
    this.creatingOverlay = false;
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

  findToxicIngredients(ingredients) {
    if (!ingredients || ingredients.trim() == "") return [];

    // Split ingredients string into array and clean up
    const ingredientList = ingredients
      .toLowerCase()
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i);
    // Find matching toxic ingredients
    console.log("Finding toxic ingredients in:", ingredientList);
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

  updateOrCreateOverlay(productElement, productData) {
    if (!productElement) return false;

    try {
      // Make sure the product element has relative positioning
      if (getComputedStyle(productElement).position === "static") {
        productElement.style.position = "relative";
      }

      let badge = productElement.querySelector(".toxic-badge");
      const isNewBadge = !badge;

      // Create new badge if it doesn't exist
      if (isNewBadge) {
        if (this.creatingOverlay) return false;
        this.creatingOverlay = true;
        badge = document.createElement("div");
        badge.className = "toxic-badge";
      }

      // Get toxin flags and update badge
      const toxinFlags = productData?.toxin_flags || null;
      const severityColor = this.getSeverityColor(toxinFlags);
      badge.style.backgroundColor = severityColor;
      badge.textContent = toxinFlags === null ? "X" : toxinFlags.length;
      badge.setAttribute("data-created", Date.now().toString());

      // Create or update tooltip
      let tooltip = badge.querySelector(".toxic-tooltip");
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.className = "toxic-tooltip";
      } else {
        tooltip.innerHTML = ""; // Clear existing tooltip content
      }

      // Update tooltip content
      if (toxinFlags === null) {
        tooltip.appendChild(this.createTooltipHeader("No ingredient data available"));
      } else if (toxinFlags.length > 0) {
        tooltip.appendChild(
          this.createTooltipHeader(
            `Found ${toxinFlags.length} concerning ingredient${toxinFlags.length > 1 ? "s" : ""}:`
          )
        );
        toxinFlags.forEach((ingredient) => {
          tooltip.appendChild(this.createIngredientElement(ingredient));
        });
      } else {
        const noToxinsDiv = document.createElement("div");
        noToxinsDiv.className = "toxic-tooltip-safe";
        noToxinsDiv.textContent = "No concerning ingredients found";
        tooltip.appendChild(noToxinsDiv);
      }

      // Add tooltip to badge if it's new
      if (!badge.contains(tooltip)) {
        badge.appendChild(tooltip);
      }

      // Add badge to product element if it's new
      if (isNewBadge) {
        productElement.appendChild(badge);
      }

      return true;
    } catch (error) {
      console.error("Error updating/creating overlay:", error);
      return false;
    } finally {
      this.creatingOverlay = false;
    }
  }

  // Helper method to create tooltip header
  createTooltipHeader(text) {
    const header = document.createElement("div");
    header.className = "toxic-tooltip-header";
    header.textContent = text;
    return header;
  }

  // Helper method to create ingredient element
  createIngredientElement(ingredient) {
    const ingredientDiv = document.createElement("div");
    ingredientDiv.className = "toxic-ingredient";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = ingredient.name;

    const concernSpan = document.createElement("span");
    concernSpan.className = `concern-level ${ingredient.concernLevel.toLowerCase()}`;
    concernSpan.textContent = ` (${ingredient.concernLevel})`;

    ingredientDiv.appendChild(nameSpan);
    ingredientDiv.appendChild(concernSpan);
    return ingredientDiv;
  }

  // Kept for backward compatibility, but now just calls updateOrCreateOverlay
  createOverlay(productElement, productData) {
    return this.updateOrCreateOverlay(productElement, productData);
  }

  // Only remove overlays when absolutely necessary
  removeExistingOverlays(productElement) {
    if (!productElement) return;
    const existingBadges = productElement.querySelectorAll(".toxic-badge");
    existingBadges.forEach((badge) => {
      if (badge && badge.parentNode === productElement) {
        badge.remove();
      }
    });
  }
}
