// src/utils/productCacheManager.js

class ProductCacheManager {
  constructor() {
    this.DB_NAME = "ToxicFoodFilter";
    this.DB_VERSION = 2; // Increment version for schema changes
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

        // Create product store with simplified structure
        if (!db.objectStoreNames.contains("products")) {
          const productStore = db.createObjectStore("products", { keyPath: "external_id" });
          productStore.createIndex("retailerId", "retailerId", { unique: false });
          productStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
        }

        // Create product groups store with simplified structure
        if (!db.objectStoreNames.contains("productGroups")) {
          const groupStore = db.createObjectStore("productGroups", { keyPath: "id" });
          groupStore.createIndex("currentIngredientsId", "currentIngredientsId", { unique: false });
        }

        // Create ingredients store with updated structure
        if (!db.objectStoreNames.contains("ingredients")) {
          const ingredientStore = db.createObjectStore("ingredients", { keyPath: "id" });
          ingredientStore.createIndex("productGroupId", "productGroupId", { unique: false });
          ingredientStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
          ingredientStore.createIndex("ingredientsHash", "ingredientsHash", { unique: false });
          ingredientStore.createIndex("isCurrent", "isCurrent", { unique: false });
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
      // First get the product group to find current ingredients ID
      const groupTx = this.db.transaction("productGroups", "readonly");
      const groupStore = groupTx.objectStore("productGroups");
      const group = await this.dbRequest(groupStore.get(productGroupId));

      if (!group || !group.currentIngredientsId) {
        return null;
      }

      // Then get the current ingredients
      const ingredientsTx = this.db.transaction("ingredients", "readonly");
      const ingredientsStore = ingredientsTx.objectStore("ingredients");
      const ingredientData = await this.dbRequest(ingredientsStore.get(group.currentIngredientsId));

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

  async saveIngredients(productGroupId, ingredients, toxinFlags = [], ingredientsHash = null) {
    try {
      const tx = this.db.transaction(["ingredients", "productGroups"], "readwrite");
      const ingredientsStore = tx.objectStore("ingredients");
      const groupsStore = tx.objectStore("productGroups");

      // Create new ingredients entry
      const ingredientData = {
        id: Date.now(), // Use timestamp as unique ID
        productGroupId,
        ingredients,
        toxinFlags,
        ingredientsHash,
        isCurrent: true,
        verificationCount: 1,
        lastUpdated: Date.now(),
      };

      // Save ingredients
      await this.dbRequest(ingredientsStore.put(ingredientData));

      // Update product group with new current ingredients ID
      await this.dbRequest(
        groupsStore.put({
          id: productGroupId,
          currentIngredientsId: ingredientData.id,
          lastUpdated: Date.now(),
        })
      );

      return true;
    } catch (error) {
      console.error("Error saving ingredients:", error);
      return false;
    }
  }

  async findGroupByIngredientsHash(ingredientsHash) {
    try {
      const tx = this.db.transaction("ingredients", "readonly");
      const store = tx.objectStore("ingredients");
      const index = store.index("ingredientsHash");
      const range = IDBKeyRange.only(ingredientsHash);

      let cursor = await this.dbRequest(index.openCursor(range));
      while (cursor) {
        const ingredientData = cursor.value;
        if (ingredientData.isCurrent && this.isCacheValid(ingredientData.lastUpdated)) {
          // Get associated product group
          const groupTx = this.db.transaction("productGroups", "readonly");
          const groupStore = groupTx.objectStore("productGroups");
          const group = await this.dbRequest(groupStore.get(ingredientData.productGroupId));
          if (group) {
            return {
              group,
              ingredients: ingredientData,
            };
          }
        }
        cursor = await this.dbRequest(cursor.continue());
      }
      return null;
    } catch (error) {
      console.error("Error finding group by ingredients hash:", error);
      return null;
    }
  }

  async updateIngredientVerification(ingredientsId) {
    try {
      const tx = this.db.transaction("ingredients", "readwrite");
      const store = tx.objectStore("ingredients");
      const data = await this.dbRequest(store.get(ingredientsId));

      if (data && data.isCurrent) {
        const updateData = {
          ...data,
          verificationCount: (data.verificationCount || 0) + 1,
          lastUpdated: Date.now(),
        };
        await this.dbRequest(store.put(updateData));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating ingredient verification:", error);
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
