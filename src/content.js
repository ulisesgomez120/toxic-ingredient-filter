// Dynamic import of utility functions
import { extractProductFromList, extractProductFromModal } from "./utils/productExtractor";

class ProductScanner {
  constructor() {
    this.toxicIngredients = new Set(); // Will populate from storage/API
    this.strictnessLevel = "moderate"; // Default setting
    // this.productExtractor = null;
  }

  async init() {
    // Load product extractor dynamically
    // const extractor = await loadProductExtractor();
    // if (!extractor) {
    //   console.error("Could not load product extractor");
    //   return;
    // }
    // this.productExtractor = extractor;

    await this.loadSettings();
    this.setupMutationObserver();
    this.setupDebugShortcuts();
  }

  async loadSettings() {
    // Load settings from chrome.storage
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          strictnessLevel: "moderate",
          customIngredients: [],
        },
        (settings) => {
          this.strictnessLevel = settings.strictnessLevel;
          settings.customIngredients.forEach((i) => this.toxicIngredients.add(i));
          resolve();
        }
      );
    });
  }

  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      this.handlePageChanges(mutations);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  setupDebugShortcuts() {
    document.addEventListener("keydown", (event) => {
      // Ctrl+Shift+D to trigger product list debug logging
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        this.debugLogAllProducts();
      }
      // Ctrl+Shift+M to trigger modal debug logging
      if (event.ctrlKey && event.shiftKey && event.key === "M") {
        this.debugLogModal();
      }
    });
  }

  debugLogAllProducts() {
    console.log("===== DEBUG: Extracting All Visible Products =====");
    const productElements = document.querySelectorAll('li[data-testid^="item_list_item_"]');

    if (productElements.length === 0) {
      console.warn("No product elements found on the page.");
      return;
    }

    productElements.forEach((element, index) => {
      try {
        const productData = extractProductFromList(element);
        console.group(`Product #${index + 1}`);
        console.log("Raw Element:", element);
        console.log("Extracted Data:", productData);
        console.groupEnd();
      } catch (error) {
        console.error(`Error extracting product #${index + 1}:`, error);
      }
    });

    console.log("===== DEBUG: Product Extraction Complete =====");
  }

  debugLogModal() {
    console.log("===== DEBUG: Extracting Modal Data =====");

    try {
      // Find the ingredients section first
      const ingredientsSection = document.querySelector('div[id$="-Ingredients"]');
      if (!ingredientsSection) {
        console.warn("No ingredients section found. Please open a product modal first.");
        return;
      }

      // Get the modal container by finding the closest portal ancestor
      const modalElement = ingredientsSection.closest(".__reakit-portal");
      if (!modalElement) {
        console.warn("Could not find modal container for ingredients section.");
        return;
      }

      console.group("Modal Data");
      console.log("Raw Modal Element:", modalElement);
      console.log("Ingredients Section:", ingredientsSection);

      const modalData = extractProductFromModal(modalElement);
      console.log("Extracted Modal Data:", modalData);

      // Log specific sections for debugging
      console.group("Modal Sections");
      const ingredientsText = ingredientsSection.querySelector("p")?.textContent;
      if (ingredientsText) {
        console.log("Ingredients Text:", ingredientsText);
      }

      const nutritionSection = modalElement.querySelector(".e-1ml9tbj");
      console.log("Nutrition Section:", nutritionSection);
      if (nutritionSection) {
        console.log("Nutrition Info:", {
          servingSize: nutritionSection.querySelector(".e-78jcqk")?.textContent,
          calories: nutritionSection.querySelector(".e-1thcph1")?.textContent,
        });
      }
      console.groupEnd();
      console.groupEnd();
    } catch (error) {
      console.error("Error extracting modal data:", error);
    }

    console.log("===== DEBUG: Modal Extraction Complete =====");
  }

  handlePageChanges(mutations) {
    for (const mutation of mutations) {
      // Look for product list items being added
      const productElements = document.querySelectorAll('li[data-testid^="item_list_item_"]:not([data-processed])');

      productElements.forEach(async (element) => {
        element.setAttribute("data-processed", "true");
        await this.analyzeProduct(element);
      });

      // Look for ingredients section being added
      const ingredientsSection = document.querySelector('div[id$="-Ingredients"]:not([data-processed])');
      if (ingredientsSection) {
        ingredientsSection.setAttribute("data-processed", "true");
        const modalElement = ingredientsSection.closest(".__reakit-portal");
        if (modalElement) {
          this.processModal(modalElement);
        }
      }
    }
  }

  async analyzeProduct(productElement) {
    try {
      // if (!this.productExtractor) {
      //   console.error("Product extractor not loaded");
      //   return;
      // }

      const productData = extractProductFromList(productElement);
      if (!productData) return;

      // Send product data to background script
      chrome.runtime.sendMessage({
        type: "PRODUCT_FOUND",
        data: productData,
      });

      // Apply visual feedback if needed
      this.createOverlay(productElement, productData);
    } catch (error) {
      console.error("Error analyzing product:", error);
    }
  }

  async processModal(modalElement) {
    try {
      // if (!this.productExtractor) {
      //   console.error("Product extractor not loaded");
      //   return;
      // }

      const modalData = extractProductFromModal(modalElement);
      if (!modalData) return;

      // Send modal data to background script
      chrome.runtime.sendMessage({
        type: "MODAL_DATA_FOUND",
        data: modalData,
      });
    } catch (error) {
      console.error("Error processing modal:", error);
    }
  }

  createOverlay(productElement, productData) {
    // Create and apply semi-transparent overlay
    const overlay = document.createElement("div");
    overlay.className = "toxic-overlay";
    // Add styling and hover functionality
  }
}

// Initialize the product scanner
const scanner = new ProductScanner();
scanner.init();
