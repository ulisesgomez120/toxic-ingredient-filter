import authManager from "../auth/authManager";

class PopupManager {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.initializeAuth();
  }

  initializeElements() {
    // Forms
    this.loginForm = document.getElementById("login-form");
    this.signupForm = document.getElementById("signup-form");

    // Tabs
    this.tabButtons = document.querySelectorAll(".tab-btn");

    // Views
    this.loggedOutView = document.getElementById("logged-out-view");
    this.loggedInView = document.getElementById("logged-in-view");

    // User info elements
    this.userEmail = document.getElementById("user-email");
    this.subStatus = document.getElementById("sub-status");

    // Error messages
    this.loginError = document.getElementById("login-error");
    this.signupError = document.getElementById("signup-error");

    // Buttons
    this.logoutBtn = document.getElementById("logout-btn");

    // Loading spinner
    this.loadingSpinner = document.getElementById("loading-spinner");

    // Ensure login form is visible initially
    this.loginForm.classList.remove("hidden");
    this.signupForm.classList.add("hidden");
  }

  setupEventListeners() {
    // Tab switching
    this.tabButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const tabName = button.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Form submissions
    this.loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    this.signupForm.addEventListener("submit", (e) => this.handleSignup(e));

    // Logout
    this.logoutBtn.addEventListener("click", () => this.handleLogout());
  }

  async initializeAuth() {
    this.showLoading();
    try {
      // Subscribe to auth state changes
      authManager.subscribeToAuthChanges((authState) => {
        this.handleAuthStateChange(authState);
      });

      // Initialize from storage
      await authManager.initializeFromStorage();
    } catch (error) {
      console.error("Error initializing auth:", error);
    } finally {
      this.hideLoading();
    }
  }

  handleAuthStateChange({ event, session }) {
    if (event === "SIGNED_IN" || event === "RESTORED_SESSION") {
      this.showLoggedInView(session.user);
    } else if (event === "SIGNED_OUT") {
      this.showLoggedOutView();
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    this.showLoading();
    this.clearErrors();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      await authManager.signInWithEmail(email, password);
      this.loginForm.reset();
    } catch (error) {
      this.loginError.textContent = error.message || "Failed to login. Please try again.";
    } finally {
      this.hideLoading();
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    this.showLoading();
    this.clearErrors();

    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-confirm-password").value;

    if (password !== confirmPassword) {
      this.signupError.textContent = "Passwords do not match";
      this.hideLoading();
      return;
    }

    try {
      await authManager.signUpWithEmail(email, password);
      this.signupForm.reset();
      // Show success message and switch to login tab
      this.switchTab("login");
    } catch (error) {
      this.signupError.textContent = error.message || "Failed to sign up. Please try again.";
    } finally {
      this.hideLoading();
    }
  }

  async handleLogout() {
    this.showLoading();
    try {
      await authManager.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      this.hideLoading();
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    this.tabButtons.forEach((button) => {
      if (button.dataset.tab === tabName) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    // Show/hide forms
    if (tabName === "login") {
      this.loginForm.classList.remove("hidden");
      this.signupForm.classList.add("hidden");
    } else {
      this.loginForm.classList.add("hidden");
      this.signupForm.classList.remove("hidden");
    }

    // Clear forms and errors
    this.clearErrors();
    if (tabName === "login") {
      this.signupForm.reset();
    } else {
      this.loginForm.reset();
    }
  }

  showLoggedInView(user) {
    this.loggedOutView.classList.add("hidden");
    this.loggedInView.classList.remove("hidden");
    this.userEmail.textContent = user.email;
    this.subStatus.textContent = "Free";
  }

  showLoggedOutView() {
    this.loggedInView.classList.add("hidden");
    this.loggedOutView.classList.remove("hidden");
    // Always show login tab when logging out
    this.switchTab("login");
  }

  showLoading() {
    this.loadingSpinner.classList.remove("hidden");
  }

  hideLoading() {
    this.loadingSpinner.classList.add("hidden");
  }

  clearErrors() {
    this.loginError.textContent = "";
    this.signupError.textContent = "";
  }
}

// Initialize popup when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
