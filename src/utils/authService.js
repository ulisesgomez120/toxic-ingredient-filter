import { createClient } from "@supabase/supabase-js";

class AuthService {
  constructor() {
    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    this.subscriptionCheckInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.init();
  }

  async init() {
    // Set up auth state change listener
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        this.clearSession();
      } else if (event === "SIGNED_IN") {
        this.setSession(session);
      }
    });

    // Check for existing session
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    if (session) {
      await this.setSession(session);
    }
  }

  async signIn() {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: chrome.runtime.getURL("src/popup/auth-callback.html"),
      },
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    await this.supabase.auth.signOut();
    await this.clearSession();
  }

  async setSession(session) {
    // Store session securely
    await chrome.storage.local.set({
      session: {
        access_token: session.access_token,
        expires_at: session.expires_at,
      },
    });

    // Check subscription status
    await this.checkSubscription();
  }

  async clearSession() {
    await chrome.storage.local.remove(["session", "subscription"]);
    await this.clearSubscriptionCheck();
  }

  async checkSubscription() {
    try {
      const session = await this.getSession();
      if (!session) return null;

      const response = await fetch(`${process.env.PROXY_URL}/subscription/status`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-extension-key": process.env.EXTENSION_KEY,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch subscription status");

      const subscription = await response.json();

      // Store subscription status
      await chrome.storage.local.set({ subscription });

      // Schedule next check
      await this.scheduleSubscriptionCheck();

      return subscription;
    } catch (error) {
      console.error("Error checking subscription:", error);
      return null;
    }
  }

  async scheduleSubscriptionCheck() {
    const alarm = await chrome.alarms.get("subscriptionCheck");
    if (!alarm) {
      await chrome.alarms.create("subscriptionCheck", {
        delayInMinutes: this.subscriptionCheckInterval / (60 * 1000),
        periodInMinutes: this.subscriptionCheckInterval / (60 * 1000),
      });
    }
  }

  async clearSubscriptionCheck() {
    await chrome.alarms.clear("subscriptionCheck");
  }

  async getSession() {
    const { session } = await chrome.storage.local.get("session");
    if (!session) return null;

    // Check if session is expired
    if (session.expires_at && session.expires_at < Date.now() / 1000) {
      await this.clearSession();
      return null;
    }

    return session;
  }

  async getSubscription() {
    const { subscription } = await chrome.storage.local.get("subscription");
    return subscription;
  }

  async createCheckoutSession(tier) {
    const session = await this.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch(`${process.env.PROXY_URL}/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "x-extension-key": process.env.EXTENSION_KEY,
      },
      body: JSON.stringify({
        tier,
        userId: session.user.id,
      }),
    });

    if (!response.ok) throw new Error("Failed to create checkout session");

    const { sessionId } = await response.json();
    return sessionId;
  }

  async redirectToCheckout(tier) {
    const sessionId = await this.createCheckoutSession(tier);
    const checkoutUrl = `https://checkout.stripe.com/pay/${sessionId}`;
    await chrome.tabs.create({ url: checkoutUrl });
  }

  async handleCallback(hash) {
    // Extract access token from URL hash
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");

    if (!accessToken) {
      throw new Error("No access token found in callback");
    }

    // Set up session with the token
    const {
      data: { session },
      error,
    } = await this.supabase.auth.setSession({
      access_token: accessToken,
    });

    if (error) throw error;

    await this.setSession(session);
    return session;
  }
}

export const authService = new AuthService();
