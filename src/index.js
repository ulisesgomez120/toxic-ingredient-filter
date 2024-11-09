// src/index.js
import { DEFAULT_TOXIC_INGREDIENTS } from "../defaultIngredients.js";

// Initialize toxic ingredients in storage if not already set
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set({
      toxicIngredients: DEFAULT_TOXIC_INGREDIENTS,
      strictnessLevel: "moderate",
      customIngredients: [],
      settings: {
        showTooltips: true,
        highlightProducts: true,
      },
    });
  }
});

// Export for use in other extension components
export const getDefaultIngredients = () => DEFAULT_TOXIC_INGREDIENTS;

// Log initialization for debugging
console.log("Toxic Food Filter Extension initialized");
