// Dynamic import of utility functions
import { extractProductFromList, extractProductFromModal } from "./utils/productExtractor";
import DatabaseHandler from "./utils/databaseHandler";
import { OverlayManager } from "./utils/overlayManager";
import { ProductDataManager } from "./utils/productDataManager";
import "./styles/overlay.css";

class ProductScanner {
  constructor() {
    this.overlayManager = new OverlayManager();
    this.dataManager = new ProductDataManager();
    this.strictnessLevel = "moderate"; // Default setting
    this.dbHandler = null;
    this.productListData = new Map(); // Store product data from list items
    this.idPrefix = null; // Will be set dynamically based on first product encountered
  }

  async init() {
    try {
      // Initialize database handler
      this.dbHandler = new DatabaseHandler();
      console.log("Database handler initialized successfully");
    } catch (error) {
      console.error("Failed to initialize database handler:", error);
      // Continue initialization even if database handler fails
    }

    await this.loadSettings();
    this.setupMutationObserver();
  }

  // Extract the store-specific ID prefix from an external_id
  extractIdPrefix(externalId) {
    const match = externalId.match(/^(items_\d+)-/);
    return match ? match[1] : null;
  }

  // Get full ID using current prefix pattern
  getFullId(numericId) {
    if (!numericId) return null;

    // If we don't have a prefix yet, try to get it from existing data
    if (!this.idPrefix && this.productListData.size > 0) {
      const firstProduct = Array.from(this.productListData.values())[0];
      this.idPrefix = this.extractIdPrefix(firstProduct.external_id);
    }

    return this.idPrefix ? `${this.idPrefix}-${numericId}` : numericId;
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
          this.overlayManager.updateCustomIngredients(settings.customIngredients);
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
      const rawProductData = await extractProductFromList(productElement);
      if (!rawProductData) return;

      // Store the product data for later use with modal
      if (rawProductData.external_id) {
        // Update the ID prefix if we haven't set it yet
        if (!this.idPrefix) {
          this.idPrefix = this.extractIdPrefix(rawProductData.external_id);
        }

        // Store with the full external_id
        this.productListData.set(rawProductData.external_id, rawProductData);
        // Queue product for ingredient data fetching
        this.dataManager.queueProduct(rawProductData, (productDataWithIngredients) => {
          if (productDataWithIngredients) {
            // Create overlay once we have ingredient data
            this.overlayManager.createOverlay(productElement, productDataWithIngredients);
          }
        });
      }

      // Save to database if handler is available
      if (this.dbHandler) {
        try {
          const formattedData = this.formatProductData(rawProductData);
          const result = await this.dbHandler.saveProductListing(formattedData);
        } catch (error) {
          console.error("Error saving product to database:", error);
        }
      }
    } catch (error) {
      console.error("Error analyzing product:", error);
    }
  }

  async processModal(modalElement) {
    try {
      // Get the product ID from the modal
      const productId = this.getProductIdFromModal(modalElement);

      // Get the associated list data
      const listData = this.productListData.get(productId);

      const rawModalData = await extractProductFromModal(modalElement, listData);
      if (!rawModalData) return;

      // Clear cache for this product to ensure we get fresh data
      this.dataManager.clearCache(productId);

      // Process with database if handler is available
      if (this.dbHandler && rawModalData.ingredients) {
        try {
          const productGroup = await this.dbHandler.findOrCreateProductGroup({
            brand: rawModalData.brand || "",
            baseName: rawModalData.name,
          });

          if (productGroup) {
            const toxinFlags = this.overlayManager.findToxicIngredients(rawModalData.ingredients);

            await this.dbHandler.saveIngredients(
              productGroup.id,
              rawModalData.ingredients,
              toxinFlags.length > 0 ? toxinFlags : []
            );
          }
        } catch (error) {
          console.error("Error saving ingredients to database:", error);
        }
      }
    } catch (error) {
      console.error("Error processing modal:", error);
    }
  }

  getProductIdFromModal(modalElement) {
    let numericId = null;

    // Try to find product ID from the modal content
    const modalContent = modalElement.querySelector('[data-testid^="item_details_"]');
    if (modalContent) {
      const testId = modalContent.getAttribute("data-testid");
      numericId = testId.replace("item_details_", "");
    }

    // Try to find from any element with item_details in its data-testid
    if (!numericId) {
      const itemDetailsElement = modalElement.querySelector('[data-testid*="item_details"]');
      if (itemDetailsElement) {
        const testId = itemDetailsElement.getAttribute("data-testid");
        const match = testId.match(/\d+/);
        if (match) {
          numericId = match[0];
        }
      }
    }

    // Try to find from the ingredients section ID
    if (!numericId) {
      const ingredientsSection = modalElement.querySelector('div[id$="-Ingredients"]');
      if (ingredientsSection) {
        const sectionId = ingredientsSection.id;
        const match = sectionId.match(/(\d+)-Ingredients$/);
        if (match) {
          numericId = match[1];
        }
      }
    }

    // Fallback: Try to find from URL
    if (!numericId) {
      const urlMatch = window.location.href.match(/\/items\/(\d+)/);
      if (urlMatch) {
        numericId = urlMatch[1];
      }
    }

    if (!numericId) {
      console.warn("Could not find numeric ID from modal");
      return null;
    }

    // Get the full ID using the current prefix pattern
    return this.getFullId(numericId);
  }

  // Format product data for database
  formatProductData(rawData) {
    // Convert snake_case to camelCase and ensure proper types
    return {
      brand: rawData.brand || "",
      baseName: rawData.name,
      name: rawData.name,
      retailerId: rawData.retailerId, // Already camelCase from retailerConfig
      externalId: rawData.external_id,
      urlPath: rawData.url_path,
      priceAmount: rawData.price_amount,
      priceUnit: rawData.price_unit,
      imageUrl: rawData.image_url,
      baseUnit: rawData.base_unit,
      size: rawData.size,
      // attributes:
      //   rawData.attributes?.map((attr) => ({
      //     key: attr.key,
      //     value: String(attr.value), // Ensure value is a string
      //   })) || [],
    };
  }
}

// Initialize the product scanner
const scanner = new ProductScanner();
scanner.init();
