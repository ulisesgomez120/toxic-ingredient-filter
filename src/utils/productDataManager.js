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
      // Get all external IDs from the chunk
      const externalIds = chunk.map(({ productData }) => productData.external_id);

      // Get current ingredients and toxin analysis for all products in chunk
      const productIngredients = await this.dbHandler.getCurrentProductIngredients(externalIds);

      const results = await Promise.all(
        chunk.map(async ({ productId, productData }) => {
          try {
            const productInfo = productIngredients[productData.external_id];

            // Only process if we have valid data (not null)
            if (productInfo && (productInfo.ingredients || productInfo.toxin_flags)) {
              // Save to cache
              await this.cacheManager.saveProduct({
                external_id: productId,
                retailer_id: productData.retailer_id,
                url_path: productData.url_path,
                price_amount: productData.price_amount,
                price_unit: productData.price_unit,
                image_url: productData.image_url,
                ingredients: productInfo.ingredients,
                toxin_flags: productInfo.toxin_flags,
                has_analysis: !!productInfo.toxin_flags,
              });

              const enrichedProduct = {
                ...productData,
                ingredients: productInfo.ingredients,
                toxin_flags: productInfo.toxin_flags,
                has_analysis: !!productInfo.toxin_flags,
              };

              return enrichedProduct;
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
