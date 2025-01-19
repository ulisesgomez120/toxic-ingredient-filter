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

      // Check auth and subscription status
      await this.checkAuthStatus();

      // Only initialize features if we have proper access
      if (this.isAuthenticated && this.subscriptionStatus === "basic") {
        await this.initializeFeatures();
      }
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  }

  async initializeFeatures() {
    this.dbHandler = new DatabaseHandler();

    // Set up mutation observer after confirming auth
    this.setupMutationObserver();

    // Process initial page state
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

          // Check if it's a product list item (with or without data-testid) or ingredients section
          return (
            // Direct matches
            node.matches?.('li[data-testid^="item_list_item_"]') ||
            node.matches?.('div[id$="-Ingredients"]') ||
            // Match product list items by structure (for search pages)
            node.matches?.('li:has(a[role="button"][href*="/products/"])') ||
            // Nested matches
            node.querySelector?.('li[data-testid^="item_list_item_"]') ||
            node.querySelector?.('div[id$="-Ingredients"]') ||
            node.querySelector?.('li:has(a[role="button"][href*="/products/"])')
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
      // Check if we're in a modal
      const modalElement = productPageContainer.closest(".__reakit-portal");

      if (modalElement) {
        // Find ingredients section within this modal only
        const ingredientsSection = modalElement.querySelector('div[id$="-Ingredients"]');

        if (ingredientsSection) {
          // Reset processed states to ensure new product gets processed
          ingredientsSection.removeAttribute("data-processed");
          modalElement.removeAttribute("data-processed-modal");
          productPageContainer.removeAttribute("data-processed");

          this.processModal(modalElement);
          ingredientsSection.setAttribute("data-processed", "true");
          modalElement.setAttribute("data-processed-modal", "true");
        }
      } else {
        this.processProductPage(productPageContainer);
        return;
      }
    }

    // Process list items and modals
    const productElements = document.querySelectorAll(`
      li[data-testid^="item_list_item_"]:not([data-processed]),
      li:has(a[role="button"][href*="/products/"]):not([data-processed])
    `);
    productElements.forEach((element) => {
      // For items with data-testid, use that as the ID
      let itemId = element.getAttribute("data-testid");

      // For items without data-testid (search pages), construct an ID from the URL
      if (!itemId) {
        const link = element.querySelector('a[role="button"]');
        if (link) {
          const href = link.getAttribute("href");
          if (href) {
            const match = href.match(/\/products\/(\d+)-/);
            if (match) {
              itemId = `search_item_${match[1]}`;
            }
          }
        }
      }

      if (itemId && !this.processedItems.has(itemId) && !element.querySelector(".toxic-badge")) {
        this.analyzeProduct(element, itemId);
      }
    });
  }

  async analyzeProduct(productElement, itemId) {
    // Quick local feature check using cached subscription status
    if (!this.isAuthenticated || this.subscriptionStatus !== "basic") return;

    // Skip if already processed recently (using 1000ms window)
    if (
      productElement.getAttribute("data-processed-time") &&
      Date.now() - parseInt(productElement.getAttribute("data-processed-time")) < 1000
    ) {
      return;
    }

    if (!itemId || this.processedItems.has(itemId)) return;

    try {
      // Mark as processed immediately to prevent duplicate processing
      this.processedItems.add(itemId);

      const rawProductData = await extractProductFromList(productElement);
      if (!rawProductData) {
        this.overlayManager.updateOrCreateOverlay(productElement, { toxin_flags: null });
        productElement.setAttribute("data-processed-time", Date.now().toString());
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
            this.overlayManager.updateOrCreateOverlay(productElement, productDataWithIngredients);
            productElement.setAttribute("data-processed-time", Date.now().toString());
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
      // Try to create an error state overlay
      this.overlayManager.updateOrCreateOverlay(productElement, { toxin_flags: null });
      productElement.setAttribute("data-processed-time", Date.now().toString());
    }
  }

  async processModal(modalElement) {
    // Quick local feature check using cached subscription status
    if (!this.isAuthenticated || this.subscriptionStatus !== "basic") return;

    try {
      const productId = this.getProductIdFromModal(modalElement);
      const img = modalElement.querySelector(".e-76rf0");

      // Skip if already processed recently (using 1000ms window)
      if (
        img?.getAttribute("data-processed-time") &&
        Date.now() - parseInt(img.getAttribute("data-processed-time")) < 1000
      ) {
        return;
      }

      // Remove existing overlay and processed state for new product
      if (img) {
        this.overlayManager.removeExistingOverlays(img);
        img.removeAttribute("data-processed-time");
      }

      let listData = productId ? this.productListData.get(productId) : null;
      let cachedProductData = null;

      if (!listData && productId) {
        cachedProductData = await this.dataManager.cacheManager.getProduct(productId);
      }

      if (!listData && !cachedProductData && productId) {
        try {
          const productIngredients = await this.dbHandler.getCurrentProductIngredients([productId]);
          if (productIngredients && productIngredients[productId]) {
            cachedProductData = {
              external_id: productId,
              ingredients: productIngredients[productId].ingredients,
              toxin_flags: productIngredients[productId].toxin_flags,
            };
          }
        } catch (error) {
          console.error("Error fetching product from database:", error);
        }
      }

      const rawModalData = await extractProductFromSource(modalElement, "modal", listData || cachedProductData);

      if (img) {
        if (!rawModalData) {
          this.overlayManager.updateOrCreateOverlay(img, { toxin_flags: null });
          img.setAttribute("data-processed-time", Date.now().toString());
          return;
        }

        if (this.dbHandler && rawModalData.ingredients) {
          try {
            const formattedData = this.formatProductData(rawModalData);

            try {
              await this.dbHandler.saveProductListing(formattedData);
            } catch (error) {
              // If it's a duplicate key error, we can ignore it since the product already exists
              if (error.message?.includes("duplicate key value")) {
                console.log("Product already exists in database, skipping save");
              } else {
                // For other errors, we should still throw
                throw error;
              }
            }

            // Update badge in modal - do this regardless of save status since we have the data
            this.overlayManager.updateOrCreateOverlay(img, { ingredients: rawModalData.ingredients });
            // Update badge in product list if it exists
            if (productId) {
              // Try to find item by data-testid first
              let listItem = document.querySelector(`li[data-testid="item_list_item_${productId}"]`);

              // If not found, try to find by product URL pattern
              if (!listItem) {
                const productIdMatch = productId.match(/items_\d+-(\d+)/);
                if (productIdMatch) {
                  const numericId = productIdMatch[1];
                  listItem = document.querySelector(`li:has(a[role="button"][href*="/products/${numericId}-"])`);
                }
              }

              if (listItem) {
                this.overlayManager.updateOrCreateOverlay(listItem, { ingredients: rawModalData.ingredients });
              }
            }
          } catch (error) {
            console.error("Error saving modal data to database:", error);
            this.overlayManager.updateOrCreateOverlay(img, { toxin_flags: null });
          }
        } else {
          this.overlayManager.updateOrCreateOverlay(img, { toxin_flags: [] });
        }

        img.setAttribute("data-processed-time", Date.now().toString());
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
    // Quick local feature check using cached subscription status
    if (!this.isAuthenticated || this.subscriptionStatus !== "basic") return;

    if (this.processingPage) {
      return;
    }

    // Skip if already processed recently (using 1000ms window)
    if (
      productPageContainer.getAttribute("data-processed-time") &&
      Date.now() - parseInt(productPageContainer.getAttribute("data-processed-time")) < 1000
    ) {
      return;
    }

    this.processingPage = true;

    try {
      // Extract product details from the page
      const rawProductData = await extractProductFromSource(document, "product_page");

      if (!rawProductData) {
        this.overlayManager.updateOrCreateOverlay(productPageContainer, { toxin_flags: null });
        productPageContainer.setAttribute("data-processed-time", Date.now().toString());
        return;
      }

      // Process with database if handler is available
      if (this.dbHandler && rawProductData.ingredients) {
        try {
          const formattedData = this.formatProductData(rawProductData);

          try {
            await this.dbHandler.saveProductListing(formattedData);
          } catch (error) {
            // If it's a duplicate key error, we can ignore it since the product already exists
            if (error.message?.includes("duplicate key value")) {
              console.log("Product already exists in database, skipping save");
            } else {
              // For other errors, we should still throw
              throw error;
            }
          }

          // Update overlay regardless of save status since we have the data
          this.overlayManager.updateOrCreateOverlay(productPageContainer, { ingredients: rawProductData.ingredients });
        } catch (error) {
          console.error("Error processing product page with database:", error);
          this.overlayManager.updateOrCreateOverlay(productPageContainer, { toxin_flags: null });
        }
      } else {
        this.overlayManager.updateOrCreateOverlay(productPageContainer, { toxin_flags: [] });
      }

      productPageContainer.setAttribute("data-processed-time", Date.now().toString());
    } catch (error) {
      console.error("Error in processProductPage:", error);
      this.overlayManager.updateOrCreateOverlay(productPageContainer, { toxin_flags: null });
    } finally {
      this.processingPage = false;
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
      // Get auth and subscription status in a single message
      const { isAuthenticated, subscriptionStatus } = await chrome.runtime.sendMessage({
        type: "GET_AUTH_STATUS_WITH_SUBSCRIPTION",
      });

      this.isAuthenticated = isAuthenticated;
      this.subscriptionStatus = subscriptionStatus || "none";
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

  verifyFeatureAccess(feature) {
    // Fast local check using cached subscription status
    switch (feature) {
      case "basic_scan":
        return this.isAuthenticated && this.subscriptionStatus === "basic";
      default:
        return false;
    }
  }
}

// Initialize the product scanner
const scanner = new ProductScanner();
scanner.init();
