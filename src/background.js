// Background Service Worker for Toxic Food Filter
import DatabaseHandler from "./utils/databaseHandler.js";

class BackgroundService {
  constructor() {
    this.db = new DatabaseHandler();
    this.setupListeners();
    this.initializeCache();
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Indicates we'll respond asynchronously
    });
  }

  async initializeCache() {
    // Initialize IndexedDB for caching
    const request = indexedDB.open("ToxicFoodFilter", 1);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores
      if (!db.objectStoreNames.contains("ingredients")) {
        db.createObjectStore("ingredients", { keyPath: "productGroupId" });
      }
    };

    request.onsuccess = (event) => {
      this.indexedDB = event.target.result;
    };
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.type) {
        case "MODAL_DATA_FOUND":
          const saveResult = await this.handleModalData(request.data);
          sendResponse(saveResult);
          break;

        case "CHECK_INGREDIENTS":
          const result = await this.checkIngredients(request.ingredients);
          sendResponse({ result });
          break;

        case "UPDATE_SETTINGS":
          await this.updateSettings(request.settings);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message });
    }
  }

  async handleModalData(modalData) {
    if (!modalData?.ingredients) {
      return { success: false, error: "No ingredients data found" };
    }

    try {
      // Process the product name to extract brand and base name
      const { brand, baseName } = this.processProductName(modalData.name || "");

      const productData = {
        brand,
        baseName,
        ingredients: modalData.ingredients,
        attributes: modalData.attributes || [],
      };

      // Save to database
      const saveResult = await this.db.saveProductIngredients(productData);

      if (saveResult.success) {
        // Cache the ingredients locally
        await this.cacheIngredients(saveResult.productGroupId, modalData.ingredients);
      }

      return saveResult;
    } catch (error) {
      console.error("Error handling modal data:", error);
      return { success: false, error: error.message };
    }
  }

  processProductName(fullName) {
    // Simple brand extraction - assumes brand is before first dash or comma
    const separatorIndex = fullName.search(/[-,]/);

    if (separatorIndex > 0) {
      return {
        brand: fullName.substring(0, separatorIndex).trim(),
        baseName: fullName.substring(separatorIndex + 1).trim(),
      };
    }

    // If no separator found, treat whole name as base name
    return {
      brand: null,
      baseName: fullName.trim(),
    };
  }

  async cacheIngredients(productGroupId, ingredients) {
    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB.transaction(["ingredients"], "readwrite");
      const store = transaction.objectStore("ingredients");

      const request = store.put({
        productGroupId,
        ingredients,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async checkIngredients(ingredients) {
    // TODO: Implement ingredient checking logic
    return {
      toxic: [],
      safe: [],
    };
  }

  async updateSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(settings, resolve);
    });
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
