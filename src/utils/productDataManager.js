import DatabaseHandler from "./databaseHandler";
import ProductCacheManager from "./productCacheManager";

export class ProductDataManager {
  constructor() {
    this.dbHandler = new DatabaseHandler();
    this.cacheManager = new ProductCacheManager();
    this.pendingRequests = new Map(); // Track pending requests to avoid duplicates
    this.batchSize = 10; // Number of products to process in one batch
    this.batchDelay = 500; // Delay between batches in ms
    this.currentBatch = new Set(); // Current batch of products to process
    this.batchTimeout = null;
  }

  /**
   * Queue a product for ingredient data fetching
   * @param {Object} productData Basic product data from list
   * @param {Function} callback Callback to run when data is ready
   */
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

    console.log(`Processing batch of ${batch.length} products`);

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
            // Format data for database
            const formattedData = this.formatProductData(productData);

            // Try to find existing product group
            const productGroup = await this.dbHandler.findOrCreateProductGroup({
              brand: formattedData.brand,
              baseName: formattedData.name,
            });

            if (productGroup) {
              // Save product group to cache
              await this.cacheManager.saveProductGroup(productGroup);

              // Get ingredients
              const ingredients = await this.dbHandler.getProductIngredients(productGroup.id);

              if (ingredients) {
                // Save ingredients to cache
                await this.cacheManager.saveIngredients(productGroup.id, ingredients);

                const enrichedProduct = {
                  ...productData,
                  ingredients,
                };

                // Save complete product data to cache
                await this.cacheManager.saveProduct(enrichedProduct);

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
        callback(productData);
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
