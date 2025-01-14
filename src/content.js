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
    this.dbHandler = null;
    this.productListData = new Map();
    this.idPrefix = null;
    this.productPageSelectors = [".e-76rf0", "[data-testid='product_details']", ".product-container"];
    this.processingPage = false;
    this.processedItems = new Set(); // Track items that have been fully processed
    this.observerTimeout = null;
    this.navigationTimeout = null;
    this.lastProcessedTime = 0;
    this.lastUrl = window.location.href;
    this.isAuthenticated = false;
    this.subscriptionStatus = "none";
  }

  async init() {
    try {
      // Set up auth listener first to handle auth state changes
      this.setupAuthListener();

      // Check auth status and initialize features if authenticated
      await this.checkAuthStatus();
      await this.initializeFeatures();
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  }

  async initializeFeatures() {
    // Set up mutation observer to catch any early changes
    this.setupMutationObserver();

    // Only proceed with feature initialization if authenticated
    if (!this.isAuthenticated) {
      return;
    }

    this.dbHandler = new DatabaseHandler();

    // Process initial page state immediately
    this.handlePageChanges();

    // Listen for navigation events
    navigation.addEventListener("navigate", (e) => {
      // Only trigger if URL actually changed
      if (this.lastUrl !== e.destination.url) {
        this.lastUrl = e.destination.url;
        this.handleNavigation();
      }
    });
  }

  handleNavigation() {
    // Clear any existing navigation timeout
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }

    // Reset processing state
    this.processingPage = false;

    // Clear processed items set
    this.processedItems.clear();

    const resetContainer = () => {
      const container = this.findProductContainer();
      if (container) {
        container.removeAttribute("data-processed");
        this.overlayManager.removeExistingOverlays(container);
        return container;
      }
      return null;
    };

    // Immediate reset and check
    resetContainer();

    // Set a short timeout to allow DOM to update
    setTimeout(() => {
      const container = resetContainer();
      if (container) {
        this.handlePageChanges();
      }
    }, 100);

    // Set backup timeout with longer delay
    this.navigationTimeout = setTimeout(() => {
      const container = resetContainer();
      if (container) {
        this.handlePageChanges();
      }
    }, 500);
  }

  findProductContainer() {
    for (const selector of this.productPageSelectors) {
      const container = document.querySelector(selector);
      if (container) {
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
      attributes: true,
      attributeFilter: ["data-processed"], // Also watch for data-processed changes
    });
  }

  handlePageChanges() {
    // Find product container using multiple selectors
    const productPageContainer = this.findProductContainer();
    const hasProcessed = productPageContainer?.hasAttribute("data-processed");

    if (productPageContainer && !hasProcessed && !this.processingPage) {
      let modalElement = productPageContainer.closest(".__reakit-portal");
      if (modalElement) {
        const ingredientsSection = document.querySelector('div[id$="-Ingredients"]:not([data-processed])');
        if (ingredientsSection) {
          const modalElement = ingredientsSection.closest(".__reakit-portal");
          if (modalElement && !modalElement.querySelector(".toxic-badge")) {
            this.processModal(modalElement);
            ingredientsSection.setAttribute("data-processed", "true");
          }
        }
      } else {
        this.processProductPage(productPageContainer);
        return;
      }
    }

    // Process list items and modals
    const productElements = document.querySelectorAll('li[data-testid^="item_list_item_"]:not([data-processed])');
    productElements.forEach((element) => {
      const itemId = element.getAttribute("data-testid");
      if (itemId && !this.processedItems.has(itemId) && !element.querySelector(".toxic-badge")) {
        this.analyzeProduct(element, itemId);
      }
    });
  }

  async analyzeProduct(productElement, itemId) {
    if (!this.isAuthenticated) return;

    // Check feature access before processing
    const hasAccess = await this.verifyFeatureAccess("basic_scan");
    if (!hasAccess) return;

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

      // Don't save list view products to database since we don't have ingredients yet
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
      const img = modalElement.querySelector(".e-76rf0");

      if (img && !img.querySelector(".toxic-badge")) {
        this.overlayManager.removeExistingOverlays(img);

        if (!rawModalData) {
          // Create overlay with no data state
          this.overlayManager.createOverlay(img, { toxin_flags: null });
          return;
        }

        if (this.dbHandler && rawModalData.ingredients) {
          try {
            const formattedData = this.formatProductData(rawModalData);
            await this.dbHandler.saveProductListing(formattedData);

            const toxinFlags = this.overlayManager.findToxicIngredients(rawModalData.ingredients);
            this.overlayManager.createOverlay(img, { toxin_flags: toxinFlags });
          } catch (error) {
            console.error("Error saving modal data to database:", error);
            // Create overlay with error state
            this.overlayManager.createOverlay(img, { toxin_flags: null });
          }
        } else {
          // Create overlay with no data state if no database handler or ingredients
          this.overlayManager.createOverlay(img, { toxin_flags: [] });
        }
      }

      if (rawModalData) {
        this.dataManager.clearCache(productId);
      }
    } catch (error) {
      console.error("Error processing modal:", error);
      // Try to create an error state overlay if possible
      const img = modalElement.querySelector(".e-76rf0");
      if (img && !img.querySelector(".toxic-badge")) {
        this.overlayManager.removeExistingOverlays(img);
        this.overlayManager.createOverlay(img, { toxin_flags: null });
      }
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
    if (this.processingPage) {
      return;
    }

    this.processingPage = true;

    try {
      this.overlayManager.removeExistingOverlays(productPageContainer);

      // Extract product details from the page
      const rawProductData = await extractProductFromSource(document, "product_page");

      if (!rawProductData) {
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

          // Create overlay with actual data (only once)
          if (!productPageContainer.querySelector(".toxic-badge")) {
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
        this.overlayManager.createOverlay(productPageContainer, { toxin_flags: [] });
      }
    } catch (error) {
      console.error("Error in processProductPage:", error);
      // Create overlay with error state
      if (!productPageContainer.querySelector(".toxic-badge")) {
        this.overlayManager.createOverlay(productPageContainer, { toxin_flags: null });
      }
    } finally {
      this.processingPage = false;
      // Only set data-processed if we successfully created an overlay
      if (productPageContainer.querySelector(".toxic-badge")) {
        productPageContainer.setAttribute("data-processed", "true");
      }
    }
  }

  formatProductData(rawData) {
    return {
      retailer_id: rawData.retailer_id,
      external_id: rawData.external_id,
      url_path: rawData.url_path,
      price_amount: rawData.price_amount ?? 0,
      price_unit: rawData.price_unit,
      image_url: rawData.image_url,
      ingredients: rawData.ingredients,
    };
  }
  async checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_AUTH_STATUS",
      });

      this.isAuthenticated = response.isAuthenticated;

      if (this.isAuthenticated) {
        const subResponse = await chrome.runtime.sendMessage({
          type: "CHECK_SUBSCRIPTION",
        });
        this.subscriptionStatus = subResponse.subscriptionStatus;
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      this.isAuthenticated = false;
      this.subscriptionStatus = "none";
    }
  }

  setupAuthListener() {
    // Connect to background script
    const port = chrome.runtime.connect({ name: "content-script-connect" });

    // Listen for messages from background script through the port
    port.onMessage.addListener((message) => {
      if (message.type === "AUTH_STATE_CHANGED") {
        this.handleAuthStateChange(message.authState);
      }
    });

    // Also listen for broadcast messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "AUTH_STATE_CHANGED") {
        this.handleAuthStateChange(message.authState);
      }
    });
  }

  async handleAuthStateChange(authState) {
    console.log("Auth state changed:", authState);
    const wasAuthenticated = this.isAuthenticated;
    this.isAuthenticated = authState.isAuthenticated;
    this.subscriptionStatus = authState.subscriptionStatus;

    if (!wasAuthenticated && this.isAuthenticated) {
      // User just logged in - initialize features
      await this.initializeFeatures();

      // Reset processing state and trigger a new scan
      this.processingPage = false;
      this.processedItems.clear();
      this.handlePageChanges();
    } else if (wasAuthenticated && !this.isAuthenticated) {
      // User logged out - clean up
      this.cleanup();
    }
  }

  cleanup() {
    // Remove all overlays and processed states
    if (this.overlayManager) {
      document.querySelectorAll(".toxic-badge").forEach((badge) => badge.remove());
      document.querySelectorAll("[data-processed]").forEach((el) => el.removeAttribute("data-processed"));
    }

    // Clear all data
    this.productListData.clear();
    this.processedItems.clear();

    // Stop observers
    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
    }
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
  }

  async verifyFeatureAccess(feature) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "VERIFY_ACCESS",
        feature,
      });
      return response.hasAccess;
    } catch (error) {
      console.error("Error verifying feature access:", error);
      return false;
    }
  }
}

// Initialize the product scanner
const scanner = new ProductScanner();
scanner.init();
