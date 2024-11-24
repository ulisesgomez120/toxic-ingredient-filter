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
    this.processingPage = false;
    this.processedItems = new Set(); // Track items that have been fully processed
    this.observerTimeout = null;
    this.navigationTimeout = null;
    this.lastProcessedTime = 0;
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
    // Clear any existing navigation timeout
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }

    // Set new timeout
    this.navigationTimeout = setTimeout(() => {
      console.log("Checking for product container after delay");
      const productPageContainer = this.findProductContainer();
      if (productPageContainer && !this.processingPage) {
        console.log("Product container found, processing page");
        // Remove data-processed to allow reprocessing
        productPageContainer.removeAttribute("data-processed");
        this.overlayManager.removeExistingOverlays(productPageContainer);
        this.handlePageChanges();
      }
    }, 500);
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

  hasRelevantChanges(mutations) {
    return mutations.some((mutation) => {
      // Check for added nodes that match our selectors
      if (mutation.type === "childList" && mutation.addedNodes.length) {
        return Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;

          // Check if it's a product list item or ingredients section
          return (
            node.matches?.('li[data-testid^="item_list_item_"]') ||
            node.matches?.('div[id$="-Ingredients"]') ||
            node.querySelector?.('li[data-testid^="item_list_item_"]') ||
            node.querySelector?.('div[id$="-Ingredients"]')
          );
        });
      }
      return false;
    });
  }

  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      // Check if enough time has passed since last processing
      const now = Date.now();
      if (now - this.lastProcessedTime < 250) {
        return; // Skip if less than 250ms has passed
      }

      // Check if mutations contain relevant changes
      if (!this.hasRelevantChanges(mutations)) {
        return;
      }

      // Clear any existing timeout
      if (this.observerTimeout) {
        clearTimeout(this.observerTimeout);
      }

      // Set new timeout
      this.observerTimeout = setTimeout(() => {
        this.lastProcessedTime = Date.now();
        this.handlePageChanges();
      }, 250);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  handlePageChanges() {
    console.log("Handle page changes called");

    // Find product container using multiple selectors
    const productPageContainer = this.findProductContainer();

    if (productPageContainer && !productPageContainer.hasAttribute("data-processed") && !this.processingPage) {
      console.log("Processing product page");
      this.processProductPage(productPageContainer).then(() => {
        productPageContainer.setAttribute("data-processed", "true");
      });
      return;
    }

    // Process list items and modals
    const productElements = document.querySelectorAll('li[data-testid^="item_list_item_"]:not([data-processed])');
    productElements.forEach((element) => {
      const itemId = element.getAttribute("data-testid");
      if (itemId && !this.processedItems.has(itemId) && !element.querySelector(".toxic-badge")) {
        this.analyzeProduct(element, itemId);
      }
    });

    const ingredientsSection = document.querySelector('div[id$="-Ingredients"]:not([data-processed])');
    if (ingredientsSection) {
      const modalElement = ingredientsSection.closest(".__reakit-portal");
      if (modalElement && !modalElement.querySelector(".toxic-badge")) {
        this.processModal(modalElement);
        ingredientsSection.setAttribute("data-processed", "true");
      }
    }
  }

  async analyzeProduct(productElement, itemId) {
    if (!itemId || this.processedItems.has(itemId) || productElement.querySelector(".toxic-badge")) return;

    try {
      // Mark as processed immediately to prevent duplicate processing
      this.processedItems.add(itemId);

      // Remove any existing overlays
      this.overlayManager.removeExistingOverlays(productElement);

      const rawProductData = await extractProductFromList(productElement);
      if (!rawProductData) {
        this.overlayManager.createOverlay(productElement, { toxin_flags: null });
        return;
      }

      if (rawProductData.external_id) {
        if (!this.idPrefix) {
          this.idPrefix = this.extractIdPrefix(rawProductData.external_id);
        }

        this.productListData.set(rawProductData.external_id, rawProductData);

        // Create a promise to handle the overlay creation
        const overlayPromise = new Promise((resolve) => {
          this.dataManager.queueProduct(rawProductData, (productDataWithIngredients) => {
            if (!productElement.querySelector(".toxic-badge")) {
              this.overlayManager.createOverlay(productElement, productDataWithIngredients);
              productElement.setAttribute("data-processed", "true");
            }
            resolve();
          });
        });

        // Wait for overlay creation
        await overlayPromise;
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
      // Remove from processed items if there was an error
      this.processedItems.delete(itemId);
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
          const formattedData = this.formatProductData(rawModalData);
          await this.dbHandler.saveProductListing(formattedData);

          const toxinFlags = this.overlayManager.findToxicIngredients(rawModalData.ingredients);
          const img = modalElement.querySelector(".e-76rf0");
          if (img && !img.querySelector(".toxic-badge")) {
            this.overlayManager.removeExistingOverlays(img);
            this.overlayManager.createOverlay(img, { toxin_flags: toxinFlags });
          }
        } catch (error) {
          console.error("Error saving modal data to database:", error);
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
    if (this.processingPage) return;
    this.processingPage = true;
    console.log("Process product page started");

    try {
      console.log("Removing existing overlays");
      this.overlayManager.removeExistingOverlays(productPageContainer);

      // Extract product details from the page
      const rawProductData = await extractProductFromSource(document, "product_page");
      console.log("Raw product data:", rawProductData);

      if (!rawProductData) {
        console.log("No raw product data found");
        // Create overlay with no data state
        this.overlayManager.createOverlay(productPageContainer, { toxin_flags: null });
        return;
      }

      // Process with database if handler is available
      if (this.dbHandler && rawProductData.ingredients) {
        try {
          // Format the data before saving
          const formattedData = this.formatProductData(rawProductData);

          // Save the product listing first
          await this.dbHandler.saveProductListing(formattedData);

          // Process ingredients and create overlay
          const toxinFlags = this.overlayManager.findToxicIngredients(rawProductData.ingredients);
          console.log("Toxin flags found:", toxinFlags);

          // Create overlay with actual data (only once)
          if (!productPageContainer.querySelector(".toxic-badge")) {
            console.log("Creating overlay with toxin data");
            this.overlayManager.createOverlay(productPageContainer, { toxin_flags: toxinFlags || [] });
          }
        } catch (error) {
          console.error("Error processing product page with database:", error);
          // Create overlay even if there was an error
          if (!productPageContainer.querySelector(".toxic-badge")) {
            this.overlayManager.createOverlay(productPageContainer, { toxin_flags: null });
          }
        }
      } else {
        // Create overlay with no data state if no database handler or ingredients
        this.overlayManager.createOverlay(productPageContainer, { toxin_flags: null });
      }
    } catch (error) {
      console.error("Error in processProductPage:", error);
      // Create overlay with error state
      if (!productPageContainer.querySelector(".toxic-badge")) {
        this.overlayManager.createOverlay(productPageContainer, { toxin_flags: null });
      }
    } finally {
      this.processingPage = false;
    }
  }

  formatProductData(rawData) {
    return {
      name: rawData.name,
      retailerId: rawData.retailerId,
      externalId: rawData.external_id,
      urlPath: rawData.url_path,
      priceAmount: rawData.price_amount ?? 0,
      priceUnit: rawData.price_unit,
      imageUrl: rawData.image_url,
      baseUnit: rawData.base_unit,
      size: rawData.size,
      ingredients: rawData.ingredients,
    };
  }
}

// Initialize the product scanner
const scanner = new ProductScanner();
scanner.init();
