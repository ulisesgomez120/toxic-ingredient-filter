// Dynamic import of utility functions
import { extractProductFromList, extractProductFromModal } from "./utils/productExtractor";
import DatabaseHandler from "./utils/databaseHandler";

class ProductScanner {
  constructor() {
    this.toxicIngredients = new Set(); // Will populate from storage/API
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
    this.setupDebugShortcuts();
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

  // Convert snake_case to camelCase
  convertToCamelCase(obj) {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertToCamelCase(item));
    }
    if (obj !== null && typeof obj === "object") {
      return Object.keys(obj).reduce((acc, key) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[camelKey] = this.convertToCamelCase(obj[key]);
        return acc;
      }, {});
    }
    return obj;
  }

  // Format product data for database
  formatProductData(rawData) {
    const camelData = this.convertToCamelCase(rawData);
    return {
      brand: "", // TODO: Extract brand from name or add to productExtractor
      baseName: camelData.name,
      name: camelData.name,
      retailerId: camelData.retailerId,
      externalId: camelData.externalId,
      urlPath: camelData.urlPath,
      priceAmount: camelData.priceAmount,
      priceUnit: camelData.priceUnit,
      imageUrl: camelData.imageUrl,
      baseUnit: camelData.baseUnit,
      size: camelData.size,
      attributes: camelData.attributes,
    };
  }

  async debugLogAllProducts() {
    console.log("===== DEBUG: Extracting All Visible Products =====");
    const productElements = document.querySelectorAll('li[data-testid^="item_list_item_"]');

    if (productElements.length === 0) {
      console.warn("No product elements found on the page.");
      return;
    }

    for (const [index, element] of productElements.entries()) {
      try {
        const rawProductData = await extractProductFromList(element);
        console.group(`Product #${index + 1}`);
        console.log("Raw Element:", element);
        console.log("Extracted Data:", rawProductData);

        // Test database processing if handler is available
        if (this.dbHandler && rawProductData) {
          console.group("Database Processing Test");
          try {
            const formattedData = this.formatProductData(rawProductData);
            console.log("Formatted Data:", formattedData);

            const result = await this.dbHandler.saveProductListing(formattedData);
            console.log("Product Listing Save Result:", result);
          } catch (error) {
            console.error("Database Processing Error:", error);
          }
          console.groupEnd();
        }

        console.groupEnd();
      } catch (error) {
        console.error(`Error extracting product #${index + 1}:`, error);
      }
    }

    console.log("===== DEBUG: Product Extraction Complete =====");
  }

  async debugLogModal() {
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

      // Debug: Log all data attributes in the modal
      console.log("Modal element attributes:", modalElement.getAttributeNames());
      const allElements = modalElement.querySelectorAll("*");
      console.log(
        "All elements with data-testid:",
        Array.from(allElements)
          .filter((el) => el.hasAttribute("data-testid"))
          .map((el) => ({
            testId: el.getAttribute("data-testid"),
            element: el,
          }))
      );

      // Get the product ID from the modal
      const productId = this.getProductIdFromModal(modalElement);
      console.log("Extracted Product ID:", productId);
      console.log("Current Product List Data Map:", Array.from(this.productListData.entries()));

      const listData = this.productListData.get(productId);
      console.log("Retrieved List Data:", listData);

      console.group("Modal Data");
      console.log("Raw Modal Element:", modalElement);
      console.log("Ingredients Section:", ingredientsSection);
      console.log("Associated List Data:", listData);

      const rawModalData = await extractProductFromModal(modalElement, listData);
      console.log("Extracted Modal Data:", rawModalData);

      // Test database processing if handler is available
      if (this.dbHandler && rawModalData) {
        console.group("Database Processing Test");
        try {
          const formattedData = this.convertToCamelCase(rawModalData);
          console.log("Formatted Modal Data:", formattedData);

          // First validate the modal data
          const validationResult = await this.dbHandler.testModalDataProcessing(formattedData);
          console.log("Modal Data Validation Result:", validationResult);

          if (validationResult.success) {
            // If validation passed, try to save the ingredients
            const productGroup = await this.dbHandler.findOrCreateProductGroup({
              brand: formattedData.brand || "",
              baseName: formattedData.name,
            });

            if (productGroup && formattedData.ingredients) {
              await this.dbHandler.saveIngredients(productGroup.id, formattedData.ingredients);
              console.log("Ingredients saved successfully for product group:", productGroup.id);
            }

            // Save any additional attributes if present
            if (formattedData.attributes && formattedData.attributes.length > 0) {
              const product = await this.dbHandler.findOrCreateProduct({
                productGroupId: productGroup.id,
                name: formattedData.name,
                baseUnit: formattedData.baseUnit,
                size: formattedData.size,
              });

              await this.dbHandler.saveAttributes(product.id, formattedData.retailerId, formattedData.attributes);
              console.log("Attributes saved successfully for product:", product.id);
            }
          }
        } catch (error) {
          console.error("Database Processing Error:", error);
        }
        console.groupEnd();
      } else {
        console.warn("Database handler not initialized - skipping database processing test");
      }

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

  getProductIdFromModal(modalElement) {
    console.log("Attempting to get product ID from modal");

    // Debug: Log all data attributes in the modal
    console.log("Modal element attributes:", modalElement.getAttributeNames());
    const allElements = modalElement.querySelectorAll("*");
    console.log(
      "All elements with data-testid:",
      Array.from(allElements)
        .filter((el) => el.hasAttribute("data-testid"))
        .map((el) => ({
          testId: el.getAttribute("data-testid"),
          element: el,
        }))
    );

    let numericId = null;

    // Try to find product ID from the modal content
    const modalContent = modalElement.querySelector('[data-testid^="item_details_"]');
    if (modalContent) {
      const testId = modalContent.getAttribute("data-testid");
      numericId = testId.replace("item_details_", "");
      console.log("Found numeric ID from modal content:", numericId);
    }

    // Try to find from any element with item_details in its data-testid
    if (!numericId) {
      const itemDetailsElement = modalElement.querySelector('[data-testid*="item_details"]');
      if (itemDetailsElement) {
        const testId = itemDetailsElement.getAttribute("data-testid");
        const match = testId.match(/\d+/);
        if (match) {
          numericId = match[0];
          console.log("Found numeric ID from item details element:", numericId);
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
          console.log("Found numeric ID from ingredients section:", numericId);
        }
      }
    }

    // Fallback: Try to find from URL
    if (!numericId) {
      const urlMatch = window.location.href.match(/\/items\/(\d+)/);
      if (urlMatch) {
        numericId = urlMatch[1];
        console.log("Found numeric ID from URL:", numericId);
      }
    }

    if (!numericId) {
      console.warn("Could not find numeric ID from modal");
      return null;
    }

    // Get the full ID using the current prefix pattern
    const fullId = this.getFullId(numericId);
    console.log("Constructed full ID:", fullId);
    return fullId;
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
          console.log("Set ID prefix pattern:", this.idPrefix);
        }

        console.log("Storing product data:", {
          id: rawProductData.external_id,
          data: rawProductData,
        });
        // Store with the full external_id
        this.productListData.set(rawProductData.external_id, rawProductData);
      }

      // Save to database if handler is available
      if (this.dbHandler) {
        try {
          const formattedData = this.formatProductData(rawProductData);
          const result = await this.dbHandler.saveProductListing(formattedData);
          console.log("Product saved to database:", result);
        } catch (error) {
          console.error("Error saving product to database:", error);
        }
      }

      // Send product data to background script
      chrome.runtime.sendMessage({
        type: "PRODUCT_FOUND",
        data: rawProductData,
      });

      // Apply visual feedback if needed
      this.createOverlay(productElement, rawProductData);
    } catch (error) {
      console.error("Error analyzing product:", error);
    }
  }

  async processModal(modalElement) {
    try {
      // Get the product ID from the modal
      const productId = this.getProductIdFromModal(modalElement);
      console.log("Processing modal for product ID:", productId);
      console.log("Available product data:", Array.from(this.productListData.entries()));

      // Get the associated list data
      const listData = this.productListData.get(productId);
      console.log("Retrieved list data for modal:", listData);

      const rawModalData = await extractProductFromModal(modalElement, listData);
      console.log("Extracted modal data:", rawModalData);

      if (!rawModalData) return;

      // Process with database if handler is available
      if (this.dbHandler) {
        try {
          const formattedData = this.convertToCamelCase(rawModalData);
          console.log("Formatted modal data:", formattedData);

          // First validate the modal data
          const validationResult = await this.dbHandler.testModalDataProcessing(formattedData);
          console.log("Modal data validation result:", validationResult);

          if (validationResult.success) {
            // If validation passed, try to save the ingredients
            const productGroup = await this.dbHandler.findOrCreateProductGroup({
              brand: formattedData.brand || "",
              baseName: formattedData.name,
            });

            if (productGroup && formattedData.ingredients) {
              await this.dbHandler.saveIngredients(productGroup.id, formattedData.ingredients);
              console.log("Ingredients saved successfully for product group:", productGroup.id);
            }

            // Save any additional attributes if present
            if (formattedData.attributes && formattedData.attributes.length > 0) {
              const product = await this.dbHandler.findOrCreateProduct({
                productGroupId: productGroup.id,
                name: formattedData.name,
                baseUnit: formattedData.baseUnit,
                size: formattedData.size,
              });

              await this.dbHandler.saveAttributes(product.id, formattedData.retailerId, formattedData.attributes);
              console.log("Attributes saved successfully for product:", product.id);
            }
          } else {
            console.warn("Modal data validation failed:", validationResult.errors);
          }
        } catch (error) {
          console.error("Error processing modal data:", error);
        }
      }

      // Send modal data to background script
      chrome.runtime.sendMessage({
        type: "MODAL_DATA_FOUND",
        data: rawModalData,
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
