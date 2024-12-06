import { supabase } from "../utils/supabaseClient";

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.authStateSubscribers = new Set();
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
    console.log("Auth state changed:", event);

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
    // Immediately call with current state
    if (this.currentUser) {
      callback({ event: "INITIAL_STATE", session: { user: this.currentUser } });
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
    } catch (error) {
      console.error("Error persisting session:", error);
    }
  }

  // Clear session from chrome.storage
  async clearSession() {
    try {
      await chrome.storage.local.remove(["auth.session", "auth.timestamp"]);
    } catch (error) {
      console.error("Error clearing session:", error);
    }
  }

  // Get current session
  async getSession() {
    try {
      const { session } = await supabase.auth.getSession();
      return session;
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
      return data;
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }

  // Sign up with email and password
  async signUpWithEmail(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      return data;
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
      const { session } = await supabase.auth.getSession();
      if (session) {
        this.currentUser = session.user;
        this.notifySubscribers({ event: "RESTORED_SESSION", session });
      }
    } catch (error) {
      console.error("Error initializing from storage:", error);
    }
  }
}

// Create and export singleton instance
const authManager = new AuthManager();
export default authManager;
