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
    // Add more message handlers as needed
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
