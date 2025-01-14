import authManager from "./auth/authManager";
import { supabase } from "./utils/supabaseClient";

class BackgroundService {
  constructor() {
    this.isInitialized = false;
    this.initializationPromise = this.initialize();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log("Background: Starting initialization");

      // Set up auth listener first before any initialization
      console.log("Background: Setting up auth listener first");
      this.setupAuthStateListener();

      // Initialize auth system
      console.log("Background: Initializing auth system");
      await authManager.initializeFromStorage();
      console.log("Background: Auth system initialized");

      // Get initial auth state
      const session = await authManager.getSession();
      const subscriptionStatus = await this.checkSubscriptionStatus();
      console.log("Background: Got initial state", {
        hasSession: !!session,
        subscriptionStatus,
        userId: session?.user?.id,
      });

      // Store initial auth state
      this.currentAuthState = {
        isAuthenticated: !!session,
        subscriptionStatus,
      };

      // Setup message handlers after auth is initialized
      this.setupMessageHandlers();

      this.isInitialized = true;
      console.log("Background: Initialization complete");
    } catch (error) {
      console.error("Error initializing background service:", error);
      throw error; // Propagate error for better handling
    }
  }

  setupAuthStateListener() {
    console.log("Background: Setting up auth state listener");
    authManager.subscribeToAuthChanges(async ({ event, session, subscriptionStatus }) => {
      console.log("Step 8: Background received auth state change", {
        event,
        subscriptionStatus,
        hasSession: !!session,
        userId: session?.user?.id,
        currentAuthState: this.currentAuthState,
      });

      // Only notify Instacart tabs
      const tabs = await chrome.tabs.query({
        url: ["*://*.instacart.com/*"],
      });
      console.log("Step 10: Found Instacart tabs:", { tabCount: tabs.length });

      // Store current auth state for new content scripts
      this.currentAuthState = {
        isAuthenticated: !!session,
        subscriptionStatus,
      };

      // Check if we should activate features
      const shouldActivateFeatures = !!session && subscriptionStatus === "basic";
      console.log("Step 11: Feature activation decision:", {
        shouldActivateFeatures,
        hasSession: !!session,
        subscriptionStatus,
        currentAuthState: this.currentAuthState,
      });

      // Notify existing tabs
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "AUTH_STATE_CHANGED",
            authState: this.currentAuthState,
            activateFeatures: shouldActivateFeatures,
          });
          console.log("Step 12: Sent auth state to tab:", { tabId: tab.id });
        } catch (error) {
          // Ignore errors for inactive tabs
        }
      }

      // Set up listener for new content scripts
      if (!this.hasContentScriptListener) {
        chrome.runtime.onConnect.addListener((port) => {
          if (port.name === "content-script-connect") {
            // Send current auth state to new content script
            port.postMessage({
              type: "AUTH_STATE_CHANGED",
              authState: this.currentAuthState,
              activateFeatures: shouldActivateFeatures,
            });
          }
        });
        this.hasContentScriptListener = true;
      }
    });
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

  async getPaymentLink(tier = "basic") {
    // For MVP, only return basic tier link
    return "https://buy.stripe.com/test_4gwcPT5uabyM86Y4gg";
  }

  async getPortalLink() {
    return "https://billing.stripe.com/p/login/test_aEU9Cte6P1wSdpK000";
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
