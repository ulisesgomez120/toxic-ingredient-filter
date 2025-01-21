import authManager from "./auth/authManager";
import { supabase } from "./utils/supabaseClient";

class BackgroundService {
  constructor() {
    this.initialize();
    this.setupAuthStateListener();
  }

  setupAuthStateListener() {
    authManager.subscribeToAuthChanges(async ({ event, session }) => {
      // Only check subscription if authenticated
      const isAuthenticated = !!session;
      const subscriptionStatus = isAuthenticated ? await this.checkSubscriptionStatus() : "none";

      // Cache the auth state
      this.currentAuthState = {
        isAuthenticated,
        subscriptionStatus,
      };

      // Only notify Instacart tabs
      const tabs = await chrome.tabs.query({
        url: ["*://*.instacart.com/*"],
      });

      // Notify existing tabs
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "AUTH_STATE_CHANGED",
            authState: this.currentAuthState,
          });
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
            });
          }
        });
        this.hasContentScriptListener = true;
      }
    });
  }

  async initialize() {
    try {
      // Initialize auth system first
      await authManager.initializeFromStorage();

      // Get initial auth state and cache it
      const session = await authManager.getSession();
      const isAuthenticated = !!session;
      const subscriptionStatus = isAuthenticated ? await this.checkSubscriptionStatus() : "none";

      // Cache the auth state
      this.currentAuthState = {
        isAuthenticated,
        subscriptionStatus,
      };

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

        case "GET_AUTH_STATUS_WITH_SUBSCRIPTION":
          const authSession = await authManager.getSession();
          const isAuthenticated = !!authSession;
          const subscriptionStatus = isAuthenticated ? await this.checkSubscriptionStatus() : "none";
          sendResponse({
            isAuthenticated,
            subscriptionStatus,
          });
          break;

        case "CHECK_SUBSCRIPTION":
          const subStatus = await this.checkSubscriptionStatus();
          sendResponse({ subscriptionStatus: subStatus });
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

        case "AUTH_STATE_CHANGED":
          // Forward auth state change to all Instacart tabs
          const tabs = await chrome.tabs.query({
            url: ["*://*.instacart.com/*"],
          });

          for (const tab of tabs) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: "AUTH_STATE_CHANGED",
                authState: request.authState,
              });
            } catch (error) {
              // Ignore errors for inactive tabs
            }
          }
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
        return "none"; // No subscription if not authenticated
      }

      // Use cached subscription status if available and not expired
      if (
        this.currentAuthState?.subscriptionStatus === "basic" &&
        this.subscriptionCheckTimestamp &&
        Date.now() - this.subscriptionCheckTimestamp < 5 * 60 * 1000
      ) {
        // 5 minutes cache
        return this.currentAuthState.subscriptionStatus;
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
        // Cache the timestamp of this check
        this.subscriptionCheckTimestamp = Date.now();
        return "basic";
      }

      // Clear cache timestamp on non-basic status
      this.subscriptionCheckTimestamp = null;
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

      // Use cached auth state if available
      if (this.currentAuthState?.isAuthenticated) {
        // For MVP, only check basic_scan feature
        switch (feature) {
          case "basic_scan":
            // Use cached subscription status if available and not expired
            if (
              this.currentAuthState.subscriptionStatus === "basic" &&
              this.subscriptionCheckTimestamp &&
              Date.now() - this.subscriptionCheckTimestamp < 5 * 60 * 1000
            ) {
              return true;
            }
            break;
        }
      }

      // Fall back to checking subscription status if cache invalid
      const subscriptionStatus = await this.checkSubscriptionStatus();
      return feature === "basic_scan" && subscriptionStatus === "basic";
    } catch (error) {
      console.error("Error verifying feature access:", error);
      return false;
    }
  }

  async getPaymentLink(tier = "basic") {
    // For MVP, only return basic tier link
    return "https://buy.stripe.com/4gwcNj2LJg4k6jebII";
  }

  async getPortalLink() {
    return "https://billing.stripe.com/p/login/28og24gX79YR6yI000";
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
