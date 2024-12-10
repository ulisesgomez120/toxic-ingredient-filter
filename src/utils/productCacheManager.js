// src/utils/productCacheManager.js

class ProductCacheManager {
  constructor() {
    this.DB_NAME = "ToxicFoodFilter";
    this.DB_VERSION = 2; // Increment version for new subscription fields
    this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week
    this.db = null;
    this.memoryCache = new Map();
    this.currentSubscription = "basic";
    this.subscriptionVersion = 1; // Track subscription data version

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
        const oldVersion = event.oldVersion;

        // Create or update product store
        if (!db.objectStoreNames.contains("products")) {
          const productStore = db.createObjectStore("products", { keyPath: "external_id" });
          productStore.createIndex("retailerId", "retailerId", { unique: false });
          productStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
          productStore.createIndex("subscriptionTier", "subscriptionTier", { unique: false });
          productStore.createIndex("subscriptionVersion", "subscriptionVersion", { unique: false });
        } else if (oldVersion < 2) {
          const tx = event.target.transaction;
          const store = tx.objectStore("products");
          if (!store.indexNames.contains("subscriptionTier")) {
            store.createIndex("subscriptionTier", "subscriptionTier", { unique: false });
          }
          if (!store.indexNames.contains("subscriptionVersion")) {
            store.createIndex("subscriptionVersion", "subscriptionVersion", { unique: false });
          }
        }

        // Update ingredients store
        if (!db.objectStoreNames.contains("ingredients")) {
          const ingredientStore = db.createObjectStore("ingredients", { keyPath: "productGroupId" });
          ingredientStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
          ingredientStore.createIndex("subscriptionTier", "subscriptionTier", { unique: false });
          ingredientStore.createIndex("subscriptionVersion", "subscriptionVersion", { unique: false });
        } else if (oldVersion < 2) {
          const tx = event.target.transaction;
          const store = tx.objectStore("ingredients");
          if (!store.indexNames.contains("subscriptionTier")) {
            store.createIndex("subscriptionTier", "subscriptionTier", { unique: false });
          }
          if (!store.indexNames.contains("subscriptionVersion")) {
            store.createIndex("subscriptionVersion", "subscriptionVersion", { unique: false });
          }
        }
      };
    });
  }

  async getProduct(externalId) {
    // Check memory cache first
    if (this.memoryCache.has(externalId)) {
      const cachedProduct = this.memoryCache.get(externalId);
      if (this.isCacheValid(cachedProduct.lastUpdated, cachedProduct.subscriptionVersion)) {
        return cachedProduct;
      }
      this.memoryCache.delete(externalId);
    }

    // Check IndexedDB
    try {
      const tx = this.db.transaction("products", "readonly");
      const store = tx.objectStore("products");
      const product = await this.dbRequest(store.get(externalId));

      if (product && this.isCacheValid(product.lastUpdated, product.subscriptionVersion)) {
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
      subscriptionTier: this.currentSubscription,
      subscriptionVersion: this.subscriptionVersion,
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
          toxinFlags,
          lastUpdated: Date.now(),
          subscriptionTier: this.currentSubscription,
          subscriptionVersion: this.subscriptionVersion,
        })
      );
      return true;
    } catch (error) {
      console.error("Error saving ingredients:", error);
      return false;
    }
  }

  async updateSubscriptionStatus(newStatus) {
    if (this.currentSubscription !== newStatus) {
      this.currentSubscription = newStatus;
      this.subscriptionVersion++; // Increment version to invalidate old cache
      await this.cleanupSubscriptionCache();
    }
  }

  async cleanupSubscriptionCache() {
    // Clean memory cache
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.subscriptionVersion !== this.subscriptionVersion) {
        this.memoryCache.delete(key);
      }
    }

    // Clean IndexedDB
    try {
      await this.cleanSubscriptionStore("products");
      await this.cleanSubscriptionStore("ingredients");
    } catch (error) {
      console.error("Error cleaning subscription cache:", error);
    }
  }

  async cleanSubscriptionStore(storeName) {
    const tx = this.db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const index = store.index("subscriptionVersion");
    const range = IDBKeyRange.upperBound(this.subscriptionVersion - 1);

    let cursor = await this.dbRequest(index.openCursor(range));
    while (cursor) {
      await this.dbRequest(store.delete(cursor.primaryKey));
      cursor = await this.dbRequest(cursor.continue());
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

  isCacheValid(timestamp, subscriptionVersion) {
    return Date.now() - timestamp < this.CACHE_DURATION && subscriptionVersion === this.subscriptionVersion;
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
