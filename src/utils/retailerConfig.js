// src/utils/retailerConfig.js
class RetailerConfig {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_KEY;
    this.retailers = new Map(); // Cache for retailer data
    this.retailersByName = new Map(); // Case-insensitive name to ID mapping
    this.currentRetailerId = null; // Store current retailer's ID
    this.lastFetch = null;
    this.CACHE_DURATION = 1000 * 60 * 60; // 1 hour
  }

  async getRetailerId(url) {
    try {
      // Extract store name from URL
      const storeName = this.extractStoreFromUrl(url);
      if (!storeName) {
        throw new Error("Unable to determine store from URL");
      }

      // Check and potentially refresh retailer cache
      await this.ensureRetailerCache();

      // First check if we have a current retailer ID that matches
      if (this.currentRetailerId) {
        const currentRetailer = this.retailers.get(this.currentRetailerId);
        if (currentRetailer && currentRetailer.name.toLowerCase() === storeName.toLowerCase()) {
          return this.currentRetailerId;
        }
      }

      // Check cache using case-insensitive name lookup
      const retailerId = this.retailersByName.get(storeName.toLowerCase());
      if (retailerId) {
        this.currentRetailerId = retailerId;
        return retailerId;
      }

      // If not in cache, try to find in database
      const existingRetailer = await this.findRetailer(storeName);
      if (existingRetailer) {
        this.addToCache(existingRetailer);
        this.currentRetailerId = existingRetailer.id;
        return existingRetailer.id;
      }

      // If not found anywhere, create new retailer
      const newRetailer = await this.createRetailer(storeName);
      this.addToCache(newRetailer);
      this.currentRetailerId = newRetailer.id;
      return newRetailer.id;
    } catch (error) {
      console.error("Error getting retailer ID:", error);
      throw error;
    }
  }

  addToCache(retailer) {
    this.retailers.set(retailer.id, retailer);
    this.retailersByName.set(retailer.name.toLowerCase(), retailer.id);
  }

  extractStoreFromUrl(url) {
    try {
      console.log("extractStoreFromUrl:");
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split("/");
      const storeIndex = pathParts.indexOf("store");

      if (storeIndex !== -1 && pathParts[storeIndex + 1]) {
        // Remove any trailing slashes or extra parts
        return pathParts[storeIndex + 1].split("/")[0];
      }
      // If no store index, try to find retailerSlug in query parameters
      const params = new URLSearchParams(parsedUrl.search);
      const retailerSlug = params.get("retailerSlug");
      if (retailerSlug) {
        return retailerSlug;
      }
      return null;
    } catch (error) {
      console.error("Error parsing URL:", error);
      return null;
    }
  }

  async ensureRetailerCache() {
    const now = Date.now();
    if (!this.lastFetch || now - this.lastFetch > this.CACHE_DURATION) {
      await this.loadRetailers();
    }
  }

  async loadRetailers() {
    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/retailers?select=id,name,website&is_active=eq.true`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch retailers");
      }

      const retailers = await response.json();

      // Clear both caches
      this.retailers.clear();
      this.retailersByName.clear();

      // Populate both caches
      retailers.forEach((retailer) => {
        this.addToCache(retailer);
      });

      this.lastFetch = Date.now();
    } catch (error) {
      console.error("Error loading retailers:", error);
      throw error;
    }
  }

  async findRetailer(name) {
    try {
      // Check cache first using case-insensitive lookup
      const cachedId = this.retailersByName.get(name.toLowerCase());
      if (cachedId) {
        return this.retailers.get(cachedId);
      }

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/retailers?name=ilike.${encodeURIComponent(name)}&website=eq.instacart`,
        {
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to search for retailer");
      }

      const retailers = await response.json();
      if (retailers && retailers.length > 0) {
        const retailer = retailers[0];
        this.addToCache(retailer);
        return retailer;
      }
      return null;
    } catch (error) {
      console.error("Error finding retailer:", error);
      throw error;
    }
  }

  async createRetailer(name) {
    try {
      // Check cache one more time before creating
      const cachedId = this.retailersByName.get(name.toLowerCase());
      if (cachedId) {
        return this.retailers.get(cachedId);
      }

      // Double-check database before creating
      const existingRetailer = await this.findRetailer(name);
      if (existingRetailer) {
        this.addToCache(existingRetailer);
        return existingRetailer;
      }

      // If not found, create new retailer
      const response = await fetch(`${this.supabaseUrl}/rest/v1/retailers`, {
        method: "POST",
        headers: this.getHeaders("return=representation,resolution=merge-duplicates"),
        body: JSON.stringify({
          name: name,
          website: "instacart",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create retailer");
      }

      const [newRetailer] = await response.json();

      // If creation failed or returned no data, try to find existing one last time
      if (!newRetailer || !newRetailer.id) {
        const retryRetailer = await this.findRetailer(name);
        if (retryRetailer) {
          this.addToCache(retryRetailer);
          return retryRetailer;
        }
        throw new Error("Failed to create or find retailer");
      }

      this.addToCache(newRetailer);
      return newRetailer;
    } catch (error) {
      console.error("Error creating retailer:", error);
      throw error;
    }
  }

  async verifyRetailer(retailerId) {
    try {
      // Check cache first
      if (this.retailers.has(retailerId)) {
        return true;
      }

      const response = await fetch(`${this.supabaseUrl}/rest/v1/retailers?id=eq.${retailerId}&select=id`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to verify retailer");
      }

      const retailers = await response.json();
      return Array.isArray(retailers) && retailers.length > 0;
    } catch (error) {
      console.error("Error verifying retailer:", error);
      throw error;
    }
  }

  getHeaders(prefer = null) {
    const headers = {
      apikey: this.supabaseKey,
      Authorization: `Bearer ${this.supabaseKey}`,
      "Content-Type": "application/json",
    };

    if (prefer) {
      headers["Prefer"] = prefer;
    }

    return headers;
  }
}

export default RetailerConfig;
