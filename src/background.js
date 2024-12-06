import authManager from "./auth/authManager";

class BackgroundService {
  constructor() {
    this.setupAuthSystem();
    this.setupMessageHandlers();
  }

  async setupAuthSystem() {
    try {
      // Initialize auth manager
      await authManager.initializeFromStorage();
      console.log("Auth system initialized");
    } catch (error) {
      console.error("Error initializing auth system:", error);
    }
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.type) {
        case "GET_AUTH_STATUS":
          const session = await authManager.getSession();
          sendResponse({
            isAuthenticated: !!session,
            user: session?.user || null,
          });
          break;

        case "CHECK_SUBSCRIPTION":
          const subscriptionStatus = await this.checkSubscriptionStatus();
          sendResponse({ subscriptionStatus });
          break;

        case "VERIFY_ACCESS":
          const hasAccess = await this.verifyFeatureAccess(request.feature);
          sendResponse({ hasAccess });
          break;

        default:
          console.warn("Unknown message type:", request.type);
          sendResponse({ error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message });
    }
  }

  async checkSubscriptionStatus() {
    try {
      const session = await authManager.getSession();
      if (!session) return "none";

      // TODO: Implement subscription check with Supabase
      // This will be implemented when we add subscription management
      return "free";
    } catch (error) {
      console.error("Error checking subscription:", error);
      return "error";
    }
  }

  async verifyFeatureAccess(feature) {
    try {
      const session = await authManager.getSession();
      if (!session) return false;

      const subscriptionStatus = await this.checkSubscriptionStatus();

      // Basic feature access rules
      switch (feature) {
        case "basic_scan":
          // Available to all authenticated users
          return true;

        case "custom_ingredients":
          // Only available to pro subscribers
          return subscriptionStatus === "pro";

        default:
          return false;
      }
    } catch (error) {
      console.error("Error verifying feature access:", error);
      return false;
    }
  }

  // Helper method to broadcast auth state changes to all extension pages
  async broadcastAuthState(authState) {
    const tabs = await chrome.tabs.query({});
    tabs.forEach((tab) => {
      chrome.tabs
        .sendMessage(tab.id, {
          type: "AUTH_STATE_CHANGED",
          authState,
        })
        .catch((error) => {
          // Ignore errors for tabs that can't receive messages
          console.debug("Could not send auth state to tab:", tab.id);
        });
    });
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
