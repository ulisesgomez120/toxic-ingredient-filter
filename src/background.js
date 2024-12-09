import authManager from "./auth/authManager";

class BackgroundService {
  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize auth system first
      await authManager.initializeFromStorage();
      console.log("Auth system initialized in background");

      // Setup message handlers after auth is initialized
      this.setupMessageHandlers();
    } catch (error) {
      console.error("Error initializing background service:", error);
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

        case "OPEN_AUTH":
          await this.handleAuthFlow(request.mode);
          sendResponse({ success: true });
          break;

        case "LOGOUT":
          await authManager.signOut();
          sendResponse({ success: true });
          break;

        case "GET_PAYMENT_LINK":
          const paymentLink = await this.getPaymentLink(request.tier);
          sendResponse({ url: paymentLink });
          break;

        case "GET_PORTAL_LINK":
          const portalLink = await this.getPortalLink();
          sendResponse({ url: portalLink });
          break;

        case "GET_CUSTOM_INGREDIENTS":
          const ingredients = await this.getCustomIngredients();
          sendResponse({ ingredients });
          break;

        case "ADD_CUSTOM_INGREDIENT":
          await this.addCustomIngredient(request.ingredient);
          sendResponse({ success: true });
          break;

        case "DELETE_CUSTOM_INGREDIENT":
          await this.deleteCustomIngredient(request.id);
          sendResponse({ success: true });
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
      if (!session) {
        console.log("No session found in checkSubscriptionStatus");
        return "basic"; // Default to basic if no session
      }

      // TODO: Implement actual subscription check with Supabase
      // For now, always return basic for testing
      console.log("Returning basic subscription for user:", session.user.email);
      return "basic";
    } catch (error) {
      console.error("Error in checkSubscriptionStatus:", error);
      return "basic"; // Default to basic on error
    }
  }

  async verifyFeatureAccess(feature) {
    try {
      const session = await authManager.getSession();
      if (!session) return false;

      const subscriptionStatus = await this.checkSubscriptionStatus();

      switch (feature) {
        case "basic_scan":
          return subscriptionStatus === "basic" || subscriptionStatus === "pro";

        case "custom_ingredients":
          return subscriptionStatus === "pro";

        default:
          return false;
      }
    } catch (error) {
      console.error("Error verifying feature access:", error);
      return false;
    }
  }

  async handleAuthFlow(mode) {
    try {
      // Open auth page in a popup window
      const width = 400;
      const height = 600;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      const authUrl = `https://your-auth-url.com/${mode}`; // Replace with actual auth URL

      chrome.windows.create({
        url: authUrl,
        type: "popup",
        width,
        height,
        left,
        top,
      });
    } catch (error) {
      console.error("Error handling auth flow:", error);
      throw error;
    }
  }

  async getPaymentLink(tier = "basic") {
    const SUBSCRIPTION_URLS = {
      basic: "https://buy.stripe.com/test_4gwcPT5uabyM86Y4gg",
      pro: "https://buy.stripe.com/test_eVa5nrf4K6es4UM7st",
    };
    return SUBSCRIPTION_URLS[tier] || SUBSCRIPTION_URLS.basic;
  }

  async getPortalLink() {
    // TODO: Implement actual portal link generation
    return "https://billing.stripe.com/p/login/test_28o29F7xf4Cr3pC288";
  }

  async getCustomIngredients() {
    try {
      const session = await authManager.getSession();
      if (!session) return [];

      // TODO: Implement actual custom ingredients fetch
      return [
        {
          id: "1",
          name: "Test Ingredient",
          category: "preservatives",
          concernLevel: "High",
          notes: "Test notes",
        },
      ];
    } catch (error) {
      console.error("Error getting custom ingredients:", error);
      return [];
    }
  }

  async addCustomIngredient(ingredient) {
    try {
      const session = await authManager.getSession();
      if (!session) throw new Error("Not authenticated");

      // TODO: Implement actual ingredient addition
      console.log("Adding ingredient:", ingredient);
      return true;
    } catch (error) {
      console.error("Error adding custom ingredient:", error);
      throw error;
    }
  }

  async deleteCustomIngredient(id) {
    try {
      const session = await authManager.getSession();
      if (!session) throw new Error("Not authenticated");

      // TODO: Implement actual ingredient deletion
      console.log("Deleting ingredient:", id);
      return true;
    } catch (error) {
      console.error("Error deleting custom ingredient:", error);
      throw error;
    }
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
