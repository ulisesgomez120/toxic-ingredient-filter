import { supabase } from "../utils/supabaseClient";

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.authStateSubscribers = new Set();
    this.initialized = false;
    this.setupAuthStateChange();
  }

  // Set up auth state change listener
  setupAuthStateChange() {
    supabase.auth.onAuthStateChange((event, session) => {
      this.handleAuthStateChange(event, session);
    });
  }

  // Handle auth state changes
  async handleAuthStateChange(event, session) {
    try {
      console.log("Step 3: Auth state change triggered in authManager.js", { event });

      if (event === "SIGNED_IN") {
        console.log("Step 4: Processing SIGNED_IN event");
        this.currentUser = session.user;
        await this.persistSession(session);

        console.log("Step 5: Checking subscription status");
        // Check subscription status after sign in
        const { data: subscriptionData, error: subscriptionError } = await supabase.rpc("get_subscription_tier", {
          user_id: session.user.id,
        });

        if (subscriptionError) {
          console.error("Error checking subscription:", subscriptionError);
        }

        const subscriptionStatus =
          subscriptionData?.status === "active" && subscriptionData?.tier_name?.toLowerCase() === "basic"
            ? "basic"
            : "none";

        console.log("Step 6: Subscription status result:", {
          subscriptionStatus,
          subscriptionData,
          event,
          hasSession: !!session,
          userId: session?.user?.id,
        });

        // Notify subscribers with auth and subscription status
        this.notifySubscribers({
          event,
          session,
          subscriptionStatus,
        });
        console.log("Step 7: Notified subscribers of auth state change with status:", subscriptionStatus);
      } else if (event === "SIGNED_OUT") {
        this.currentUser = null;
        await this.clearSession();

        // Notify subscribers of signed out state with no subscription
        this.notifySubscribers({
          event,
          session: null,
          subscriptionStatus: "none",
        });
      } else {
        // For other events, just notify with current subscription status
        const subscriptionStatus = await this.checkSubscriptionStatus();
        this.notifySubscribers({
          event,
          session,
          subscriptionStatus,
        });
      }
    } catch (error) {
      console.error("Error in handleAuthStateChange:", error);
      // Still notify subscribers but with error state
      this.notifySubscribers({
        event,
        session,
        subscriptionStatus: "none",
        error: error.message,
      });
    }
  }

  // Check subscription status
  async checkSubscriptionStatus() {
    try {
      if (!this.currentUser) return "none";

      const { data: subscriptionData, error } = await supabase.rpc("get_subscription_tier", {
        user_id: this.currentUser.id,
      });

      if (error) {
        console.error("Error checking subscription:", error);
        return "none";
      }

      return subscriptionData?.status === "active" && subscriptionData?.tier_name?.toLowerCase() === "basic"
        ? "basic"
        : "none";
    } catch (error) {
      console.error("Error in checkSubscriptionStatus:", error);
      return "none";
    }
  }

  // Subscribe to auth state changes
  async subscribeToAuthChanges(callback) {
    this.authStateSubscribers.add(callback);
    // Immediately call with current state if initialized
    if (this.initialized && this.currentUser) {
      const subscriptionStatus = await this.checkSubscriptionStatus();
      callback({
        event: "RESTORED_SESSION",
        session: { user: this.currentUser },
        subscriptionStatus,
      });
    }
  }

  // Unsubscribe from auth state changes
  unsubscribeFromAuthChanges(callback) {
    this.authStateSubscribers.delete(callback);
  }

  // Notify all subscribers of auth state changes
  notifySubscribers(authState) {
    this.authStateSubscribers.forEach((callback) => callback(authState));
  }

  // Persist session to chrome.storage with expiration
  async persistSession(session) {
    try {
      if (!session) return;

      // Calculate expiration (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const sessionData = {
        ...session,
        expires_at: expiresAt.toISOString(),
      };

      await chrome.storage.local.set({
        "auth.session": sessionData,
        "auth.timestamp": Date.now(),
      });
    } catch (error) {
      console.error("Error persisting session:", error);
      throw error; // Propagate error for better handling
    }
  }

  // Clear session from chrome.storage
  async clearSession() {
    try {
      await chrome.storage.local.remove(["auth.session", "auth.timestamp"]);
    } catch (error) {
      // console.error("Error clearing session:", error);
    }
  }

  // Get current session
  async getSession() {
    try {
      // If not initialized, initialize first
      if (!this.initialized) {
        await this.initializeFromStorage();
      }

      // Get session from Supabase
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (session) {
        this.currentUser = session.user;
        return session;
      }

      return null;
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }

  // Sign in with email and password
  async signInWithEmail(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data };
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }

  // Sign up with email and password
  async signUpWithEmail(email, password) {
    try {
      // Validate password length
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      return { data };
    } catch (error) {
      console.error("Error signing up:", error);
      throw error;
    }
  }

  // Sign out
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Initialize auth state from storage with retry mechanism
  async initializeFromStorage(retryCount = 0) {
    try {
      if (retryCount > 3) {
        throw new Error("Max retry attempts reached");
      }

      // Wait for chrome APIs to be ready
      if (typeof chrome === "undefined" || !chrome.storage) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return this.initializeFromStorage(retryCount + 1);
      }

      // Get stored session
      const { "auth.session": storedSession } = await chrome.storage.local.get("auth.session");

      if (storedSession) {
        try {
          // Check session expiration
          const sessionExpiry = new Date(storedSession.expires_at).getTime();
          if (sessionExpiry <= Date.now()) {
            console.log("Session expired, attempting refresh");
            const {
              data: { session },
              error: refreshError,
            } = await supabase.auth.refreshSession();

            if (refreshError) {
              console.error("Error refreshing session:", refreshError);
              throw refreshError;
            }

            if (session) {
              await this.persistSession(session);
              this.currentUser = session.user;
              const subscriptionStatus = await this.checkSubscriptionStatus();
              this.notifySubscribers({
                event: "RESTORED_SESSION",
                session,
                subscriptionStatus,
              });
            }
          } else {
            // Set the valid session in Supabase
            const {
              data: { session },
              error,
            } = await supabase.auth.setSession({
              access_token: storedSession.access_token,
              refresh_token: storedSession.refresh_token,
            });

            if (error) {
              // If error is about invalid refresh token, try to refresh
              if (error.message.includes("Invalid Refresh Token")) {
                const {
                  data: { session: refreshedSession },
                  error: refreshError,
                } = await supabase.auth.refreshSession();

                if (refreshError) {
                  throw refreshError;
                }

                if (refreshedSession) {
                  await this.persistSession(refreshedSession);
                  this.currentUser = refreshedSession.user;
                  const refreshedSubscriptionStatus = await this.checkSubscriptionStatus();
                  this.notifySubscribers({
                    event: "RESTORED_SESSION",
                    session: refreshedSession,
                    subscriptionStatus: refreshedSubscriptionStatus,
                  });
                }
              } else {
                throw error;
              }
            } else if (session) {
              this.currentUser = session.user;
              const currentSubscriptionStatus = await this.checkSubscriptionStatus();
              this.notifySubscribers({
                event: "RESTORED_SESSION",
                session,
                subscriptionStatus: currentSubscriptionStatus,
              });
            }
          }
        } catch (error) {
          console.error("Failed to restore session:", error);
          // Only clear session if it's not a temporary error
          if (!error.message.includes("network") && !error.message.includes("timeout")) {
            await this.clearSession();
            this.currentUser = null;
            this.notifySubscribers({
              event: "SIGNED_OUT",
              session: null,
              subscriptionStatus: "none",
            });
          } else {
            // Retry on network errors
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return this.initializeFromStorage(retryCount + 1);
          }
        }
      } else {
        this.notifySubscribers({
          event: "SIGNED_OUT",
          session: null,
          subscriptionStatus: "none",
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error("Error initializing from storage:", error);
      this.initialized = true;
      this.notifySubscribers({
        event: "SIGNED_OUT",
        session: null,
        subscriptionStatus: "none",
      });
    }
  }
}

// Create and export singleton instance
const authManager = new AuthManager();
export default authManager;
