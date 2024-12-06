/**
 * Custom storage adapter for Supabase to use chrome.storage.local
 * Implements the required getItem, setItem, and removeItem methods
 */
export class ChromeStorageAdapter {
  async getItem(key) {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error("ChromeStorageAdapter getItem error:", error);
      return null;
    }
  }

  async setItem(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error("ChromeStorageAdapter setItem error:", error);
    }
  }

  async removeItem(key) {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error("ChromeStorageAdapter removeItem error:", error);
    }
  }
}
