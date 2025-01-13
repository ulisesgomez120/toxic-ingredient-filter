/**
 * Custom storage adapter for Supabase to use chrome.storage.local
 * Implements the required getItem, setItem, and removeItem methods
 * with improved error handling and initialization checks
 */
export class ChromeStorageAdapter {
  constructor() {
    this.ready = false;
    this.initializeStorage();
  }

  async initializeStorage() {
    // Wait for chrome.storage to be available
    if (typeof chrome === "undefined" || !chrome.storage) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.initializeStorage();
      return;
    }
    this.ready = true;
  }

  async waitForReady() {
    if (!this.ready) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.waitForReady();
    }
  }

  async getItem(key) {
    try {
      await this.waitForReady();
      const result = await chrome.storage.local.get(key);
      if (result[key]) {
        // Check if stored data has expired
        const data = result[key];
        if (data && data.expiresAt && Date.now() > data.expiresAt) {
          await this.removeItem(key);
          return null;
        }
        return data.value;
      }
      return null;
    } catch (error) {
      console.error("ChromeStorageAdapter getItem error:", error);
      return null;
    }
  }

  async setItem(key, value) {
    try {
      await this.waitForReady();
      // Store with expiration (30 days)
      const data = {
        value,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      await chrome.storage.local.set({ [key]: data });
    } catch (error) {
      console.error("ChromeStorageAdapter setItem error:", error);
      throw error; // Propagate error for better handling
    }
  }

  async removeItem(key) {
    try {
      await this.waitForReady();
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error("ChromeStorageAdapter removeItem error:", error);
      throw error; // Propagate error for better handling
    }
  }
}
