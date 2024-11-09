import { extractProductFromList, extractProductFromModal } from "./utils/productExtractor";

class ProductScanner {
  constructor() {
    this.toxicIngredients = new Set(); // Will populate from storage/API
    this.strictnessLevel = "moderate"; // Default setting
  }

  async init() {
    await this.loadSettings();
    this.setupMutationObserver();
  }

  async loadSettings() {
    // Load settings from chrome.storage
    chrome.storage.sync.get(
      {
        strictnessLevel: "moderate",
        customIngredients: [],
      },
      (settings) => {
        this.strictnessLevel = settings.strictnessLevel;
        settings.customIngredients.forEach((i) => this.toxicIngredients.add(i));
      }
    );
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

  handlePageChanges(mutations) {
    for (const mutation of mutations) {
      // Look for product list items being added
      const productElements = document.querySelectorAll('li[data-testid^="item_list_item_"]:not([data-processed])');

      productElements.forEach(async (element) => {
        element.setAttribute("data-processed", "true");
        await this.analyzeProduct(element);
      });

      // Look for product modal
      const modalElement = document.querySelector('[data-dialog="true"]');
      if (modalElement && !modalElement.hasAttribute("data-processed")) {
        modalElement.setAttribute("data-processed", "true");
        this.processModal(modalElement);
      }
    }
  }

  async analyzeProduct(productElement) {
    try {
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
