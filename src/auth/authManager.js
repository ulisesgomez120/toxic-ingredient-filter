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
    console.log("Auth state changed:", event, session);

    if (event === "SIGNED_IN") {
      this.currentUser = session.user;
      await this.persistSession(session);
    } else if (event === "SIGNED_OUT") {
      this.currentUser = null;
      await this.clearSession();
    }

    // Notify subscribers
    this.notifySubscribers({ event, session });
  }

  // Subscribe to auth state changes
  subscribeToAuthChanges(callback) {
    this.authStateSubscribers.add(callback);
    // Immediately call with current state if initialized
    if (this.initialized && this.currentUser) {
      callback({ event: "RESTORED_SESSION", session: { user: this.currentUser } });
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

  // Persist session to chrome.storage
  async persistSession(session) {
    try {
      await chrome.storage.local.set({
        "auth.session": session,
        "auth.timestamp": Date.now(),
      });
      console.log("Session persisted to storage");
    } catch (error) {
      console.error("Error persisting session:", error);
    }
  }

  // Clear session from chrome.storage
  async clearSession() {
    try {
      await chrome.storage.local.remove(["auth.session", "auth.timestamp"]);
      console.log("Session cleared from storage");
    } catch (error) {
      console.error("Error clearing session:", error);
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

  // Initialize auth state from storage
  async initializeFromStorage() {
    try {
      console.log("Initializing from storage...");

      // Get stored session
      const { "auth.session": storedSession } = await chrome.storage.local.get("auth.session");

      if (storedSession) {
        console.log("Found stored session, setting auth state");
        try {
          // Set the session in Supabase
          const {
            data: { session },
            error,
          } = await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token,
          });

          if (error) {
            console.error("Error setting session:", error);
            throw error;
          }

          if (session) {
            console.log("Session restored successfully");
            this.currentUser = session.user;
            // Notify subscribers of restored session
            this.notifySubscribers({ event: "RESTORED_SESSION", session });
          }
        } catch (error) {
          console.error("Failed to restore session:", error);
          await this.clearSession();
          this.currentUser = null;
          // Notify subscribers of failed session restoration
          this.notifySubscribers({ event: "SIGNED_OUT", session: null });
        }
      } else {
        console.log("No stored session found");
        // Ensure subscribers are notified of initial signed out state
        this.notifySubscribers({ event: "SIGNED_OUT", session: null });
      }

      this.initialized = true;
    } catch (error) {
      console.error("Error initializing from storage:", error);
      this.initialized = true; // Still mark as initialized to prevent loops
      // Ensure subscribers are notified even if initialization fails
      this.notifySubscribers({ event: "SIGNED_OUT", session: null });
    }
  }
}

// Create and export singleton instance
const authManager = new AuthManager();
export default authManager;
