// Dynamic import of utility functions
import { extractProductFromList, extractProductFromSource } from "./utils/productExtractor";
import DatabaseHandler from "./utils/databaseHandler";
import { OverlayManager } from "./utils/overlayManager";
import { ProductDataManager } from "./utils/productDataManager";
import "./styles/overlay.css";

class ProductScanner {
  constructor() {
    this.overlayManager = new OverlayManager();
    this.dataManager = new ProductDataManager();
    this.strictnessLevel = "moderate";
    this.dbHandler = null;
    this.productListData = new Map();
    this.idPrefix = null;
    this.productPageSelectors = [".e-76rf0", "[data-testid='product_details']", ".product-container"];
  }

  async init() {
    try {
      this.dbHandler = new DatabaseHandler();
      console.log("Database handler initialized successfully");

      // Listen for navigation events
      navigation.addEventListener("navigate", (e) => {
        console.log("Navigation event detected");
        this.handleNavigation();
      });

      // Also handle initial page load
      this.handleNavigation();
    } catch (error) {
      console.error("Failed to initialize database handler:", error);
    }

    await this.loadSettings();
    this.setupMutationObserver();
  }

  handleNavigation() {
    // Try multiple times with increasing delays
    const delays = [0, 100, 500, 1000];
    delays.forEach((delay) => {
      setTimeout(() => {
        console.log(`Checking for product container after ${delay}ms`);
        const productPageContainer = this.findProductContainer();
        if (productPageContainer) {
          console.log("Product container found, processing page");
          // Remove data-processed to allow reprocessing
          productPageContainer.removeAttribute("data-processed");
          this.overlayManager.removeExistingOverlays(productPageContainer);
          this.handlePageChanges([{}]);
        }
      }, delay);
    });
  }

  findProductContainer() {
    for (const selector of this.productPageSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        console.log(`Found product container with selector: ${selector}`);
        return container;
      }
    }
    return null;
  }
  extractIdPrefix(externalId) {
    const match = externalId.match(/^(items_\d+)-/);
    return match ? match[1] : null;
  }

  getFullId(numericId) {
    if (!numericId) return null;

    if (!this.idPrefix && this.productListData.size > 0) {
      const firstProduct = Array.from(this.productListData.values())[0];
      this.idPrefix = this.extractIdPrefix(firstProduct.external_id);
    }

    return this.idPrefix ? `${this.idPrefix}-${numericId}` : numericId;
  }

  async loadSettings() {
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
      // Debounce the handler to avoid multiple rapid calls
      if (this.observerTimeout) {
        clearTimeout(this.observerTimeout);
      }
      this.observerTimeout = setTimeout(() => {
        this.handlePageChanges(mutations);
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-processed"],
    });
  }

  handlePageChanges(mutations) {
    console.log("Handle page changes called");

    // Find product container using multiple selectors
    const productPageContainer = this.findProductContainer();

    if (productPageContainer && !productPageContainer.hasAttribute("data-processed")) {
      console.log("Processing product page");
      this.processProductPage(productPageContainer).then(() => {
        productPageContainer.setAttribute("data-processed", "true");
      });
      return;
    }

    // Process list items and modals
    const productElements = document.querySelectorAll('li[data-testid^="item_list_item_"]:not([data-processed])');
    productElements.forEach(async (element) => {
      await this.analyzeProduct(element);
      element.setAttribute("data-processed", "true");
    });

    const ingredientsSection = document.querySelector('div[id$="-Ingredients"]:not([data-processed])');
    if (ingredientsSection) {
      const modalElement = ingredientsSection.closest(".__reakit-portal");
      if (modalElement) {
        this.processModal(modalElement);
        ingredientsSection.setAttribute("data-processed", "true");
      }
    }
  }

  async analyzeProduct(productElement) {
    try {
      const rawProductData = await extractProductFromList(productElement);
      if (!rawProductData) return;

      if (rawProductData.external_id) {
        if (!this.idPrefix) {
          this.idPrefix = this.extractIdPrefix(rawProductData.external_id);
        }

        this.productListData.set(rawProductData.external_id, rawProductData);
        this.dataManager.queueProduct(rawProductData, (productDataWithIngredients) => {
          this.overlayManager.createOverlay(productElement, productDataWithIngredients);
        });
      }

      if (this.dbHandler) {
        try {
          const formattedData = this.formatProductData(rawProductData);
          await this.dbHandler.saveProductListing(formattedData);
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
      const productId = this.getProductIdFromModal(modalElement);
      let listData = productId ? this.productListData.get(productId) : null;
      let cachedProductData = null;

      if (!listData && productId) {
        cachedProductData = await this.dataManager.cacheManager.getProduct(productId);
      }

      if (!listData && !cachedProductData && productId) {
        try {
          const productGroup = await this.dbHandler.findProductGroupByExternalId(productId);
          if (productGroup) {
            const ingredients = await this.dbHandler.getProductWithIngredients(productGroup.id);
            cachedProductData = ingredients ? { ...productGroup, ...ingredients } : null;
          }
        } catch (error) {
          console.error("Error fetching product from database:", error);
        }
      }

      const rawModalData = await extractProductFromSource(modalElement, "modal", listData || cachedProductData);
      if (!rawModalData) return;

      this.dataManager.clearCache(productId);

      if (this.dbHandler && rawModalData.ingredients) {
        try {
          const productGroup = await this.dbHandler.findOrCreateProductGroup({
            brand: rawModalData.brand || "",
            baseName: rawModalData.name,
          });

          if (productGroup) {
            const toxinFlags = this.overlayManager.findToxicIngredients(rawModalData.ingredients);
            const img = modalElement.querySelector(".e-76rf0");
            if (img) {
              this.overlayManager.removeExistingOverlays(img);
              this.overlayManager.createOverlay(img, { toxin_flags: toxinFlags });
            }

            await this.dbHandler.saveIngredients(
              productGroup.id,
              rawModalData.ingredients,
              toxinFlags === null ? null : toxinFlags.length > 0 ? toxinFlags : []
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

    const modalContent = modalElement.querySelector('[data-testid^="item_details_"]');
    if (modalContent) {
      const testId = modalContent.getAttribute("data-testid");
      numericId = testId.replace("item_details_", "");
    }

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

    return this.getFullId(numericId);
  }

  async processProductPage(productPageContainer) {
    console.log("Process product page started");
    try {
      // Always remove existing overlays first
      console.log("Removing existing overlays");
      this.overlayManager.removeExistingOverlays(productPageContainer);

      // Extract product details from the page
      const rawProductData = await extractProductFromSource(document, "product_page");
      console.log("Raw product data:", rawProductData);

      // Create overlay with default state
      this.overlayManager.createOverlay(productPageContainer, { toxin_flags: [] });

      if (!rawProductData) {
        console.log("No raw product data found");
        return;
      }

      // Process with database if handler is available
      if (this.dbHandler && rawProductData.ingredients) {
        try {
          const productGroup = await this.dbHandler.findOrCreateProductGroup({
            brand: rawProductData.brand || "",
            baseName: rawProductData.name,
          });

          if (productGroup) {
            const toxinFlags = this.overlayManager.findToxicIngredients(rawProductData.ingredients);
            console.log("Toxin flags found:", toxinFlags);

            // Update overlay with actual data
            console.log("Updating overlay with toxin data");
            this.overlayManager.removeExistingOverlays(productPageContainer);
            this.overlayManager.createOverlay(productPageContainer, { toxin_flags: toxinFlags || [] });

            await this.dbHandler.saveIngredients(
              productGroup.id,
              rawProductData.ingredients,
              toxinFlags === null ? null : toxinFlags.length > 0 ? toxinFlags : []
            );

            const formattedData = this.formatProductData(rawProductData);
            await this.dbHandler.saveProductListing(formattedData);
          }
        } catch (error) {
          console.error("Error processing product page with database:", error);
        }
      }
    } catch (error) {
      console.error("Error in processProductPage:", error);
    }
  }

  formatProductData(rawData) {
    return {
      brand: rawData.brand || "",
      baseName: rawData.name,
      name: rawData.name,
      retailerId: rawData.retailerId,
      externalId: rawData.external_id,
      urlPath: rawData.url_path,
      priceAmount: rawData.price_amount,
      priceUnit: rawData.price_unit,
      imageUrl: rawData.image_url,
      baseUnit: rawData.base_unit,
      size: rawData.size,
    };
  }
}

// Initialize the product scanner
const scanner = new ProductScanner();
scanner.init();
