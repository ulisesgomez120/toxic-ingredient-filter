import authManager from "./auth/authManager";
import { supabase } from "./utils/supabaseClient";

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
        return "none"; // No subscription if not authenticated
      }

      // Call the get_subscription_tier RPC function
      const { data: subscriptionData, error } = await supabase.rpc("get_subscription_tier", {
        user_id: session.user.id,
      });

      if (error) {
        console.error("Error checking subscription:", error);
        return "none";
      }

      if (!subscriptionData) {
        console.log("No subscription found for user:", session.user.email);
        return "none";
      }

      // For MVP, we only care if they have an active basic subscription
      if (subscriptionData.status === "active" && subscriptionData.tier_name.toLowerCase() === "basic") {
        return "basic";
      }

      return "none";
    } catch (error) {
      console.error("Error in checkSubscriptionStatus:", error);
      return "none"; // Default to no subscription on error
    }
  }

  async verifyFeatureAccess(feature) {
    try {
      const session = await authManager.getSession();
      if (!session) return false;

      const subscriptionStatus = await this.checkSubscriptionStatus();

      // For MVP, only check basic_scan feature
      switch (feature) {
        case "basic_scan":
          return subscriptionStatus === "basic";
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
    // For MVP, only return basic tier link
    return "https://buy.stripe.com/test_4gwcPT5uabyM86Y4gg";
  }

  async getPortalLink() {
    // TODO: Implement actual portal link generation
    return "https://billing.stripe.com/p/login/test_28o29F7xf4Cr3pC288";
  }

  async getCustomIngredients() {
    // Not implemented for MVP (basic tier only)
    return [];
  }

  async addCustomIngredient(ingredient) {
    throw new Error("Custom ingredients not available in basic tier");
  }

  async deleteCustomIngredient(id) {
    throw new Error("Custom ingredients not available in basic tier");
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
