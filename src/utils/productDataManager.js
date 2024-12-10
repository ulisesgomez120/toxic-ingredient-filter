import DatabaseHandler from "./databaseHandler";
import ProductCacheManager from "./productCacheManager";

export class ProductDataManager {
  constructor() {
    this.dbHandler = new DatabaseHandler();
    this.cacheManager = new ProductCacheManager();
    this.pendingRequests = new Map();
    this.batchSize = 10;
    this.batchDelay = 500;
    this.currentBatch = new Set();
    this.batchTimeout = null;
    this.subscriptionStatus = "basic"; // Add subscription status tracking
  }

  /**
   * Queue a product for ingredient data fetching
   * @param {Object} productData Basic product data from list
   * @param {Function} callback Callback to run when data is ready
   */
  updateSubscriptionStatus(status) {
    this.subscriptionStatus = status;
    // Clear cache when subscription changes to ensure proper feature access
    this.clearCache();
  }

  async queueProduct(productData, callback) {
    const productId = productData.external_id;

    const cachedProduct = await this.cacheManager.getProduct(productId);
    if (cachedProduct) {
      callback(cachedProduct);
      return;
    }

    // If there's already a pending request for this product,
    // add the callback to be executed when the data arrives
    if (this.pendingRequests.has(productId)) {
      this.pendingRequests.get(productId).push(callback);
      return;
    }

    // Start tracking callbacks for this product
    this.pendingRequests.set(productId, [callback]);

    // Add to current batch
    this.currentBatch.add({
      productId,
      productData,
    });

    // Schedule batch processing
    this.scheduleBatchProcessing();
  }

  async verifyAccess() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "VERIFY_ACCESS",
        feature: "basic_scan",
      });
      return response.hasAccess;
    } catch (error) {
      console.error("Error verifying access:", error);
      return false;
    }
  }

  async getIngredientsWithSubscription(productGroupId) {
    try {
      const ingredients = await this.dbHandler.getProductWithIngredients(productGroupId);

      if (!ingredients) return null;

      // For pro users, include additional processing
      if (this.subscriptionStatus === "pro") {
        // Add pro-only ingredient analysis
        ingredients.detailedAnalysis = await this.getDetailedAnalysis(ingredients.ingredients);
      }

      return ingredients;
    } catch (error) {
      console.error("Error getting ingredients with subscription:", error);
      return null;
    }
  }

  async getDetailedAnalysis(ingredients) {
    if (this.subscriptionStatus !== "pro") return null;

    try {
      // Add pro-only ingredient analysis logic here
      // This could include more detailed toxicity information,
      // alternative ingredients, health impact details, etc.
      return {
        // Example detailed analysis data
        alternativeIngredients: [],
        healthImpactDetails: [],
        scientificReferences: [],
      };
    } catch (error) {
      console.error("Error getting detailed analysis:", error);
      return null;
    }
  }

  /**
   * Schedule processing of the current batch
   */
  scheduleBatchProcessing() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay);
  }

  /**
   * Process the current batch of products
   */
  async processBatch() {
    if (this.currentBatch.size === 0) return;

    const batch = Array.from(this.currentBatch);
    this.currentBatch.clear();

    try {
      for (let i = 0; i < batch.length; i += this.batchSize) {
        const chunk = batch.slice(i, i + this.batchSize);
        await this.processChunk(chunk);

        if (i + this.batchSize < batch.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error("Error processing batch:", error);
    }
  }
  /**
   * Process a chunk of products
   */
  async processChunk(chunk) {
    try {
      const results = await Promise.all(
        chunk.map(async ({ productId, productData }) => {
          try {
            // Verify access before processing
            const hasAccess = await this.verifyAccess();
            if (!hasAccess) {
              console.log("No access to process products - subscription required");
              return null;
            }

            // Format data for database
            const formattedData = this.formatProductData(productData);

            // Try to find existing product group
            const productGroup = await this.dbHandler.findOrCreateProductGroup({
              brand: formattedData.brand,
              name: formattedData.name,
            });

            if (productGroup) {
              // Save product group to cache
              await this.cacheManager.saveProductGroup(productGroup);

              // Get ingredients with subscription-based processing
              const ingredients = await this.getIngredientsWithSubscription(productGroup.id);

              if (ingredients) {
                // Save ingredients to cache
                let toxin_flags =
                  ingredients.toxin_flags === null
                    ? null
                    : ingredients.toxin_flags.length > 0
                    ? ingredients.toxin_flags
                    : [];
                await this.cacheManager.saveIngredients(productGroup.id, ingredients.ingredients, toxin_flags);

                const enrichedProduct = {
                  ...productData,
                  ...ingredients,
                  subscriptionTier: this.subscriptionStatus, // Add subscription info to product data
                };

                // Save complete product data to cache
                await this.cacheManager.saveProduct(
                  enrichedProduct.product_group_id,
                  enrichedProduct.ingredients,
                  enrichedProduct.toxin_flags
                );

                return enrichedProduct;
              }
            }
            return null;
          } catch (error) {
            console.error("Error processing product:", error);
            return null;
          }
        })
      );

      // Execute callbacks for processed products
      for (let i = 0; i < chunk.length; i++) {
        const { productId } = chunk[i];
        const productData = results[i];
        this.executeCallbacks(productId, productData);
      }
    } catch (error) {
      console.error("Error processing chunk:", error);
    }
  }

  formatProductData(productData) {
    return {
      brand: productData.brand || "",
      baseName: productData.name,
      name: productData.name,
      retailerId: productData.retailerId,
      externalId: productData.external_id,
      urlPath: productData.url_path,
      priceAmount: productData.priceAmount,
      priceUnit: productData.priceUnit,
      imageUrl: productData.image_url,
      baseUnit: productData.baseUnit,
      size: productData.size,
    };
  }
  /**
   * Handle product data once we have it
   */
  handleProductData(productId, productData) {
    // Cache the data
    this.cache.set(productId, productData);

    // Execute all callbacks waiting for this product
    this.executeCallbacks(productId, productData);
  }

  /**
   * Execute callbacks for a product
   */
  executeCallbacks(productId, productData) {
    const callbacks = this.pendingRequests.get(productId) || [];
    callbacks.forEach((callback) => {
      try {
        // Include subscription status in callback data
        const dataWithSubscription = productData
          ? {
              ...productData,
              subscriptionTier: this.subscriptionStatus,
            }
          : null;

        callback(dataWithSubscription);
      } catch (error) {
        console.error("Error executing callback:", error);
      }
    });
    this.pendingRequests.delete(productId);
  }

  /**
   * Clear the cache for a specific product or all products
   */
  clearCache(productId = null) {
    if (productId) {
      this.cacheManager.memoryCache.delete(productId);
    } else {
      this.cacheManager.cleanupCache();
    }
  }
}
