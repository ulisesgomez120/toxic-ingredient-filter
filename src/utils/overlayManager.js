// Import toxic ingredients data
import { DEFAULT_TOXIC_INGREDIENTS } from "../../default-ingredients";

export class OverlayManager {
  constructor() {
    // Initialize toxic ingredients as a Map for efficient lookups
    this.toxicIngredients = new Map(
      DEFAULT_TOXIC_INGREDIENTS.map((ingredient) => [ingredient.name.toLowerCase(), ingredient])
    );
    this.creatingOverlay = false;
    this.customIngredients = new Map();
    this.subscriptionStatus = "basic"; // Default to basic
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
    // Clear existing custom ingredients
    this.customIngredients.clear();

    // Only store custom ingredients if pro subscription
    if (this.subscriptionStatus === "pro") {
      customIngredients.forEach((ingredient) => {
        if (typeof ingredient === "object" && ingredient.name) {
          this.customIngredients.set(ingredient.name.toLowerCase(), ingredient);
        }
      });
    }
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
    const found = [];
    for (const ingredient of ingredientList) {
      // Check default ingredients
      for (const [toxicName, toxicData] of this.toxicIngredients) {
        if (
          ingredient.includes(toxicName.toLowerCase()) ||
          toxicData.aliases.some((alias) => ingredient.includes(alias.toLowerCase()))
        ) {
          found.push(toxicData);
          break;
        }
      }

      // Check custom ingredients for pro users
      if (this.subscriptionStatus === "pro") {
        for (const [customName, customData] of this.customIngredients) {
          if (ingredient.includes(customName.toLowerCase())) {
            found.push(customData);
            break;
          }
        }
      }
    }
    return found;
  }

  removeExistingOverlays(productElement) {
    if (!productElement) return;

    // Remove any existing toxic badges within this product element
    const existingBadges = productElement.querySelectorAll(".toxic-badge");
    existingBadges.forEach((badge) => {
      if (badge && badge.parentNode === productElement) {
        badge.remove();
      }
    });
  }

  createOverlay(productElement, productData) {
    // Return if already creating an overlay or element is invalid
    if (this.creatingOverlay || !productElement) return false;

    // Return if element already has an overlay
    if (productElement.querySelector(".toxic-badge")) return false;

    try {
      this.creatingOverlay = true;

      // Make sure the product element has relative positioning
      if (getComputedStyle(productElement).position === "static") {
        productElement.style.position = "relative";
      }

      // Create badge container
      const badge = document.createElement("div");
      badge.className = "toxic-badge";
      badge.setAttribute("data-created", Date.now().toString());

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

        // Group ingredients by source (default vs custom)
        const defaultIngredients = [];
        const customIngredients = [];

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

          if (this.customIngredients.has(ingredient.name.toLowerCase())) {
            customIngredients.push(ingredientDiv);
          } else {
            defaultIngredients.push(ingredientDiv);
          }
        });

        // Add default ingredients
        defaultIngredients.forEach((div) => tooltip.appendChild(div));

        // Add custom ingredients with header if any exist
        if (customIngredients.length > 0) {
          const customHeader = document.createElement("div");
          customHeader.className = "toxic-tooltip-subheader";
          customHeader.textContent = "Custom Ingredients:";
          tooltip.appendChild(customHeader);
          customIngredients.forEach((div) => tooltip.appendChild(div));
        }
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
    } catch (error) {
      console.error("Error creating overlay:", error);
      return false;
    } finally {
      this.creatingOverlay = false;
    }
  }

  updateSubscriptionStatus(status) {
    this.subscriptionStatus = status;
    // Re-process custom ingredients based on new status
    if (status !== "pro") {
      this.customIngredients.clear();
    }
  }
}
