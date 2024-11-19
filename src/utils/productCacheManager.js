// src/utils/productCacheManager.js

class ProductCacheManager {
  constructor() {
    this.DB_NAME = "ToxicFoodFilter";
    this.DB_VERSION = 1;
    this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week
    this.db = null;
    this.memoryCache = new Map();

    // Initialize database
    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error("Error opening IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log("IndexedDB initialized successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create product store
        if (!db.objectStoreNames.contains("products")) {
          const productStore = db.createObjectStore("products", { keyPath: "external_id" });
          productStore.createIndex("retailerId", "retailerId", { unique: false });
          productStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
        }

        // Create product groups store
        if (!db.objectStoreNames.contains("productGroups")) {
          const groupStore = db.createObjectStore("productGroups", { keyPath: "id" });
          groupStore.createIndex("normalizedBaseName", "normalizedBaseName", { unique: true });
        }

        // Create ingredients store
        if (!db.objectStoreNames.contains("ingredients")) {
          const ingredientStore = db.createObjectStore("ingredients", { keyPath: "productGroupId" });
          ingredientStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
        }
      };
    });
  }

  async getProduct(externalId) {
    // Check memory cache first
    if (this.memoryCache.has(externalId)) {
      const cachedProduct = this.memoryCache.get(externalId);
      if (this.isCacheValid(cachedProduct.lastUpdated)) {
        return cachedProduct;
      }
      this.memoryCache.delete(externalId);
    }

    // Check IndexedDB
    try {
      const tx = this.db.transaction("products", "readonly");
      const store = tx.objectStore("products");
      const product = await this.dbRequest(store.get(externalId));

      if (product && this.isCacheValid(product.lastUpdated)) {
        this.memoryCache.set(externalId, product);
        return product;
      }
    } catch (error) {
      console.error("Error reading from IndexedDB:", error);
    }

    return null;
  }

  async saveProduct(productData) {
    const data = {
      ...productData,
      lastUpdated: Date.now(),
    };

    try {
      // Save to IndexedDB
      const tx = this.db.transaction("products", "readwrite");
      const store = tx.objectStore("products");
      await this.dbRequest(store.put(data));

      // Update memory cache
      this.memoryCache.set(data.external_id, data);

      return true;
    } catch (error) {
      console.error("Error saving product:", error);
      return false;
    }
  }

  async saveProductGroup(groupData) {
    try {
      const tx = this.db.transaction("productGroups", "readwrite");
      const store = tx.objectStore("productGroups");
      await this.dbRequest(
        store.put({
          ...groupData,
          lastUpdated: Date.now(),
        })
      );
      return true;
    } catch (error) {
      console.error("Error saving product group:", error);
      return false;
    }
  }
  async getProductWithIngredients(productGroupId) {
    try {
      const tx = this.db.transaction("ingredients", "readonly");
      const store = tx.objectStore("ingredients");
      const ingredientData = await this.dbRequest(store.get(productGroupId));

      if (ingredientData && this.isCacheValid(ingredientData.lastUpdated)) {
        return {
          ingredients: ingredientData.ingredients,
          toxinFlags: ingredientData.toxinFlags,
        };
      }
    } catch (error) {
      console.error("Error getting ingredients:", error);
    }
    return null;
  }

  async saveIngredients(productGroupId, ingredients, toxinFlags = []) {
    try {
      const tx = this.db.transaction("ingredients", "readwrite");
      const store = tx.objectStore("ingredients");
      await this.dbRequest(
        store.put({
          productGroupId,
          ingredients,
          toxinFlags, // Add toxinFlags to the stored data
          lastUpdated: Date.now(),
        })
      );
      return true;
    } catch (error) {
      console.error("Error saving ingredients:", error);
      return false;
    }
  }

  async cleanupCache() {
    const cutoffTime = Date.now() - this.CACHE_DURATION;

    // Clean memory cache
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.lastUpdated < cutoffTime) {
        this.memoryCache.delete(key);
      }
    }

    // Clean IndexedDB
    try {
      // Clean products
      await this.cleanStore("products", "lastUpdated", cutoffTime);
      // Clean ingredients
      await this.cleanStore("ingredients", "lastUpdated", cutoffTime);
    } catch (error) {
      console.error("Error cleaning cache:", error);
    }
  }

  async cleanStore(storeName, timeField, cutoffTime) {
    const tx = this.db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const index = store.index(timeField);
    const range = IDBKeyRange.upperBound(cutoffTime);

    let cursor = await this.dbRequest(index.openCursor(range));
    while (cursor) {
      await this.dbRequest(store.delete(cursor.primaryKey));
      cursor = await this.dbRequest(cursor.continue());
    }
  }

  isCacheValid(timestamp) {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  dbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all products for a retailer
  async getRetailerProducts(retailerId) {
    try {
      const tx = this.db.transaction("products", "readonly");
      const store = tx.objectStore("products");
      const index = store.index("retailerId");
      const range = IDBKeyRange.only(retailerId);

      const products = [];
      let cursor = await this.dbRequest(index.openCursor(range));

      while (cursor) {
        if (this.isCacheValid(cursor.value.lastUpdated)) {
          products.push(cursor.value);
        }
        cursor = await this.dbRequest(cursor.continue());
      }

      return products;
    } catch (error) {
      console.error("Error getting retailer products:", error);
      return [];
    }
  }
}

export default ProductCacheManager;
