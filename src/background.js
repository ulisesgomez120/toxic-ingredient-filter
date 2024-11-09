// src/background.js
class BackgroundService {
  constructor() {
    console.log("BackgroundService initialized");
    this.setupListeners();
    this.setupCache(); // renamed for clarity
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep connection open for async response
    });
  }

  async setupCache() {
    // Initialize extension's cache
    this.cache = {
      products: new Map(),
      settings: null,
    };

    // Load any saved settings
    chrome.storage.sync.get(
      {
        strictnessLevel: "moderate",
        customIngredients: [],
      },
      (settings) => {
        this.cache.settings = settings;
      }
    );
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.type) {
        case "PRODUCT_FOUND":
          await this.handleProductData(request.data);
          break;
        case "MODAL_DATA_FOUND":
          await this.handleModalData(request.data);
          break;
        case "GET_SETTINGS":
          sendResponse({ settings: this.cache.settings });
          break;
        default:
          console.warn("Unknown message type:", request.type);
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  async handleProductData(productData) {
    try {
      // Store in cache
      this.cache.products.set(productData.external_id, {
        ...productData,
        lastSeen: new Date(),
      });

      // TODO: Implement database connection and storage
      console.log("Product data received:", productData);
    } catch (error) {
      console.error("Error handling product data:", error);
    }
  }

  async handleModalData(modalData) {
    try {
      // Update cached product if exists
      if (modalData.external_id && this.cache.products.has(modalData.external_id)) {
        const existingProduct = this.cache.products.get(modalData.external_id);
        this.cache.products.set(modalData.external_id, {
          ...existingProduct,
          ...modalData,
          lastUpdated: new Date(),
        });
      }

      // TODO: Implement database connection and storage
      console.log("Modal data received:", modalData);
    } catch (error) {
      console.error("Error handling modal data:", error);
    }
  }

  // Helper method to clear cache
  clearCache() {
    this.cache.products.clear();
    console.log("Cache cleared");
  }

  // Helper method to get cache stats
  getCacheStats() {
    return {
      productCount: this.cache.products.size,
      settings: this.cache.settings,
    };
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();

export default backgroundService;
