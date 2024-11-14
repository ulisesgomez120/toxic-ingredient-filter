// Background Service Worker for Toxic Food Filter

class BackgroundService {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    // Listen for messages from content script and options page
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Indicates we'll respond asynchronously
    });
  }

  async handleMessage(request, sender, sendResponse) {
    switch (request.type) {
      case "CHECK_INGREDIENTS":
        const result = await this.checkIngredients(request.ingredients);
        sendResponse({ result });
        break;
      case "UPDATE_SETTINGS":
        await this.updateSettings(request.settings);
        sendResponse({ success: true });
        break;
      // Add more message handlers as needed
    }
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
