import authManager from "./auth/authManager";
import { supabase } from "./utils/supabaseClient";

// Cache duration constants (in milliseconds)
const CACHE_DURATION = {
  active: 60 * 60 * 1000, // 1 hour
  inactive: 5 * 60 * 1000, // 5 minutes
};

class BackgroundService {
  constructor() {
    this.subscriptionCheckInterval = null;
    this.lastAuthEvent = null;
    this.lastAuthTimestamp = 0;
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize auth system first
      await authManager.initializeFromStorage();
      console.log("Auth system initialized in background");

      // Setup message handlers
      this.setupMessageHandlers();

      // Setup auth state listener
      this.setupAuthStateListener();

      // Initialize subscription checks only if user is authenticated
      const session = await authManager.getSession();
      if (session) {
        this.startPeriodicChecks();
      }
    } catch (error) {
      console.error("Error initializing background service:", error);
    }
  }

  setupAuthStateListener() {
    authManager.subscribeToAuthChanges(async ({ event, session }) => {
      const now = Date.now();

      // Prevent duplicate events within 1 second
      if (event === this.lastAuthEvent && now - this.lastAuthTimestamp < 1000) {
        return;
      }

      this.lastAuthEvent = event;
      this.lastAuthTimestamp = now;

      // Get subscription status before broadcasting state change
      let subscriptionStatus = "basic";
      if (session) {
        subscriptionStatus = await this.checkSubscriptionStatus();
      }

      // Handle auth state change
      if (event === "SIGNED_IN" || event === "RESTORED_SESSION") {
        this.startPeriodicChecks();
      } else if (event === "SIGNED_OUT") {
        this.stopPeriodicChecks();
        this.clearSubscriptionCache();
      }

      // Notify popup of auth state change with subscription status
      this.broadcastStateChange({
        type: "AUTH_STATE_CHANGED",
        isAuthenticated: !!session,
        user: session?.user || null,
        subscriptionStatus,
        event,
      });
    });
  }

  broadcastStateChange(message) {
    chrome.runtime.sendMessage(message).catch((error) => {
      // Ignore errors when popup is not open
      if (!error.message.includes("receiving end does not exist")) {
        console.error("Error broadcasting state change:", error);
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
          const subscriptionStatus = session ? await this.checkSubscriptionStatus() : "basic";
          sendResponse({
            isAuthenticated: !!session,
            user: session?.user || null,
            subscriptionStatus,
          });
          break;

        case "CHECK_SUBSCRIPTION":
          const status = await this.checkSubscriptionStatus();
          // Broadcast subscription change to all components
          this.broadcastStateChange({
            type: "SUBSCRIPTION_CHANGED",
            subscriptionStatus: status,
          });
          sendResponse({ subscriptionStatus: status });
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

        default:
          console.warn("Unknown message type:", request.type);
          sendResponse({ error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message });
    }
  }

  async getSubscriptionFromCache() {
    try {
      const { subscription } = await chrome.storage.local.get("subscription");
      return subscription;
    } catch (error) {
      console.error("Error reading subscription cache:", error);
      return null;
    }
  }

  async updateSubscriptionCache(status) {
    try {
      await chrome.storage.local.set({ subscription: status });
      // Broadcast subscription change
      this.broadcastStateChange({
        type: "SUBSCRIPTION_CHANGED",
        subscriptionStatus: status.tier,
      });
    } catch (error) {
      console.error("Error updating subscription cache:", error);
    }
  }

  async clearSubscriptionCache() {
    try {
      await chrome.storage.local.remove("subscription");
    } catch (error) {
      console.error("Error clearing subscription cache:", error);
    }
  }

  isCacheValid(cached) {
    if (!cached || !cached.lastChecked) return false;

    const now = new Date().getTime();
    const lastChecked = new Date(cached.lastChecked).getTime();
    const duration = cached.isActive ? CACHE_DURATION.active : CACHE_DURATION.inactive;

    return now - lastChecked < duration;
  }

  async checkSubscriptionStatus() {
    try {
      const session = await authManager.getSession();
      if (!session) {
        console.log("No session found in checkSubscriptionStatus");
        return "basic"; // Default to basic if no session
      }

      // Check cache first
      const cached = await this.getSubscriptionFromCache();
      if (cached && this.isCacheValid(cached)) {
        console.log("Using cached subscription status:", cached.tier);
        return cached.tier;
      }

      // Perform real-time check with Supabase
      const { data, error } = await supabase.rpc("get_user_subscription_status", {
        p_user_id: session.user.id,
      });

      if (error) throw error;

      // If no subscription found, return basic
      if (!data || data.length === 0) {
        const status = {
          tier: "basic",
          isActive: false,
          expiresAt: null,
          lastChecked: new Date().toISOString(),
        };
        await this.updateSubscriptionCache(status);
        return "basic";
      }

      // Format subscription status from the first row
      const status = {
        tier: data[0]?.subscription_tier || "basic",
        isActive: data[0]?.is_active || false,
        expiresAt: data[0]?.expires_at,
        lastChecked: new Date().toISOString(),
      };

      // Update cache and broadcast change
      await this.updateSubscriptionCache(status);
      console.log("Updated subscription status:", status.tier);

      return status.tier;
    } catch (error) {
      console.error("Error in checkSubscriptionStatus:", error);
      return "basic"; // Default to basic on error
    }
  }

  async verifyFeatureAccess(feature) {
    try {
      const session = await authManager.getSession();
      if (!session) return false;

      // Get cached subscription first
      const cached = await this.getSubscriptionFromCache();

      // Force a real-time check if subscription is expired
      if (cached && cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
        await this.checkSubscriptionStatus();
      }

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

  startPeriodicChecks() {
    if (this.subscriptionCheckInterval) {
      this.stopPeriodicChecks(); // Clear existing interval if any
    }

    // Check every 5 minutes
    this.subscriptionCheckInterval = setInterval(async () => {
      const status = await this.checkSubscriptionStatus();
      // Broadcast status update
      this.broadcastStateChange({
        type: "SUBSCRIPTION_CHANGED",
        subscriptionStatus: status,
      });
    }, 5 * 60 * 1000);

    // Initial check
    this.checkSubscriptionStatus();
  }

  stopPeriodicChecks() {
    if (this.subscriptionCheckInterval) {
      clearInterval(this.subscriptionCheckInterval);
      this.subscriptionCheckInterval = null;
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
    return "https://billing.stripe.com/p/login/test_28o29F7xf4Cr3pC288";
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
