// Dynamic import of utility functions
async function loadProductExtractor() {
  try {
    const module = await import(chrome.runtime.getURL("src/utils/productExtractor.js"));
    return {
      extractProductFromList: module.extractProductFromList,
      extractProductFromModal: module.extractProductFromModal,
    };
  } catch (error) {
    console.error("Failed to load product extractor:", error);
    return null;
  }
}

class ProductScanner {
  constructor() {
    this.toxicIngredients = new Set(); // Will populate from storage/API
    this.strictnessLevel = "moderate"; // Default setting
    this.productExtractor = null;
  }

  async init() {
    // Load product extractor dynamically
    const extractor = await loadProductExtractor();
    if (!extractor) {
      console.error("Could not load product extractor");
      return;
    }
    this.productExtractor = extractor;

    await this.loadSettings();
    this.setupMutationObserver();
    this.setupDebugShortcut();
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

  setupDebugShortcut() {
    document.addEventListener("keydown", (event) => {
      // Ctrl+Shift+D to trigger debug logging
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        this.debugLogAllProducts();
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
        const productData = this.productExtractor.extractProductFromList(element);
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
      if (!this.productExtractor) {
        console.error("Product extractor not loaded");
        return;
      }

      const productData = this.productExtractor.extractProductFromList(productElement);
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
      if (!this.productExtractor) {
        console.error("Product extractor not loaded");
        return;
      }

      const modalData = this.productExtractor.extractProductFromModal(modalElement);
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
