// src/utils/retailerConfig.js
class RetailerConfig {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_KEY;
    this.retailers = new Map(); // Cache for retailer data
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

      // Find matching retailer
      const retailer = [...this.retailers.values()].find((r) => r.name.toLowerCase() === storeName.toLowerCase());

      if (!retailer) {
        // If retailer not found, try to create it
        return await this.createRetailer(storeName);
      }

      return retailer.id;
    } catch (error) {
      console.error("Error getting retailer ID:", error);
      throw error;
    }
  }

  extractStoreFromUrl(url) {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split("/");
      const storeIndex = pathParts.indexOf("store");

      if (storeIndex !== -1 && pathParts[storeIndex + 1]) {
        // Remove any trailing slashes or extra parts
        return pathParts[storeIndex + 1].split("/")[0];
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
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch retailers");
      }

      const retailers = await response.json();
      this.retailers.clear();
      retailers.forEach((retailer) => {
        this.retailers.set(retailer.id, retailer);
      });

      this.lastFetch = Date.now();
    } catch (error) {
      console.error("Error loading retailers:", error);
      throw error;
    }
  }

  async createRetailer(name) {
    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/retailers`, {
        method: "POST",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          name: name,
          website: "instacart",
          is_active: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create retailer");
      }

      const [newRetailer] = await response.json();
      this.retailers.set(newRetailer.id, newRetailer);
      return newRetailer.id;
    } catch (error) {
      console.error("Error creating retailer:", error);
      throw error;
    }
  }
}

export default RetailerConfig;
