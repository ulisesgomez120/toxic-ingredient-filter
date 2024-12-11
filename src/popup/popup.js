import authManager from "../auth/authManager";

class PopupManager {
  constructor() {
    // Start with loading state
    document.body.classList.add("loading");

    // Initialize in sequence
    this.initializeElements();
    this.setupEventListeners();

    // Hide both views initially
    if (this.loggedOutView) this.loggedOutView.classList.add("hidden");
    if (this.loggedInView) this.loggedInView.classList.add("hidden");

    // Start initialization
    this.initialize();
  }

  // Async initialization sequence
  async initialize() {
    try {
      // Setup auth listener first
      this.setupAuthStateListener();

      // Wait for auth system to initialize
      await authManager.initializeFromStorage();

      // Get current session
      const session = await authManager.getSession();
      console.log("Initial session check:", session);

      if (session?.user) {
        await this.handleAuthenticatedState(session.user);
      } else {
        this.handleUnauthenticatedState();
      }
    } catch (error) {
      console.error("Initialization error:", error);
      this.handleUnauthenticatedState();
    } finally {
      // Remove loading state
      document.body.classList.remove("loading");
    }
  }

  initializeElements() {
    // Auth elements
    this.authSection = document.getElementById("auth-section");
    this.loggedOutView = document.getElementById("logged-out");
    this.loggedInView = document.getElementById("logged-in");
    this.userEmail = document.getElementById("user-email");

    // Auth forms
    this.loginForm = document.getElementById("login-form");
    this.signupForm = document.getElementById("signup-form");
    this.authTabs = document.querySelectorAll(".tab-btn");

    // Subscription elements
    this.subscriptionSection = document.getElementById("subscription-section");
    this.currentPlan = document.getElementById("current-plan");
    this.planName = document.getElementById("plan-name");
    this.planPrice = document.getElementById("plan-price");
    this.subscriptionExpiry = document.getElementById("subscription-expiry");
    this.subscriptionFeatures = document.getElementById("subscription-features");

    // Settings button
    this.settingsBtn = document.getElementById("settings-btn");
  }

  setupAuthStateListener() {
    authManager.subscribeToAuthChanges(async ({ event, session }) => {
      console.log("Auth state update in popup:", event, session);

      if (event === "SIGNED_IN" || event === "RESTORED_SESSION") {
        if (session?.user) {
          await this.handleAuthenticatedState(session.user);
        }
      } else if (event === "SIGNED_OUT") {
        this.handleUnauthenticatedState();
      }
    });
  }

  setupEventListeners() {
    // Auth tab switching
    this.authTabs.forEach((tab) => {
      tab.addEventListener("click", () => this.switchAuthTab(tab.dataset.tab));
    });

    // Form submissions
    this.loginForm?.addEventListener("submit", (e) => this.handleLogin(e));
    this.signupForm?.addEventListener("submit", (e) => this.handleSignup(e));

    // Logout
    document.getElementById("logout-btn")?.addEventListener("click", () => this.handleLogout());

    // Subscription button
    document.querySelector(".tier-btn")?.addEventListener("click", () => this.handleTierSelection("basic"));

    // Settings button
    this.settingsBtn?.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  switchAuthTab(tab) {
    // Update tab buttons
    this.authTabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    // Show/hide forms
    this.loginForm.classList.toggle("hidden", tab !== "login");
    this.signupForm.classList.toggle("hidden", tab !== "signup");

    // Clear any existing errors
    document.querySelectorAll(".auth-error").forEach((error) => {
      error.classList.add("hidden");
      error.textContent = "";
    });
  }

  async handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorDiv = this.loginForm.querySelector(".auth-error");

    try {
      document.body.classList.add("loading");
      const { data, error } = await authManager.signInWithEmail(email, password);

      if (error) throw error;

      // Auth state change will be handled by the listener
    } catch (error) {
      console.error("Login error:", error);
      errorDiv.textContent = error.message || "Failed to sign in. Please try again.";
      errorDiv.classList.remove("hidden");
    } finally {
      document.body.classList.remove("loading");
    }
  }

  async handleSignup(event) {
    event.preventDefault();

    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const errorDiv = this.signupForm.querySelector(".auth-error");

    try {
      document.body.classList.add("loading");
      const { data, error } = await authManager.signUpWithEmail(email, password);

      if (error) throw error;

      // Auth state change will be handled by the listener
    } catch (error) {
      console.error("Signup error:", error);
      errorDiv.textContent = error.message || "Failed to create account. Please try again.";
      errorDiv.classList.remove("hidden");
    } finally {
      document.body.classList.remove("loading");
    }
  }

  async handleLogout() {
    try {
      document.body.classList.add("loading");
      await authManager.signOut();
      // Auth state change will be handled by the listener
    } catch (error) {
      console.error("Logout error:", error);
      this.showError("Failed to sign out. Please try again.");
    } finally {
      document.body.classList.remove("loading");
    }
  }

  async handleAuthenticatedState(user) {
    console.log("Handling authenticated state for user:", user.email);

    // Ensure elements exist before updating
    if (!this.loggedOutView || !this.loggedInView || !this.subscriptionSection) {
      console.error("Required elements not found");
      return;
    }

    this.loggedOutView.classList.add("hidden");
    this.loggedInView.classList.remove("hidden");
    this.subscriptionSection.classList.remove("hidden");

    if (user.email && this.userEmail) {
      this.userEmail.textContent = user.email;
    }

    await this.updateSubscriptionStatus();
  }

  handleUnauthenticatedState() {
    console.log("Handling unauthenticated state");

    // Ensure elements exist before updating
    if (!this.loggedOutView || !this.loggedInView || !this.subscriptionSection) {
      console.error("Required elements not found");
      return;
    }

    this.loggedOutView.classList.remove("hidden");
    this.loggedInView.classList.add("hidden");
    this.subscriptionSection.classList.add("hidden");

    // Reset forms
    this.loginForm?.reset();
    this.signupForm?.reset();

    // Show login tab by default
    this.switchAuthTab("login");
  }

  async updateSubscriptionStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "CHECK_SUBSCRIPTION" });

      if (response.error) {
        console.error("Subscription check error:", response.error);
        this.updateSubscriptionUI("none");
        return;
      }

      const { subscriptionStatus } = response;
      this.updateSubscriptionUI(subscriptionStatus);
    } catch (error) {
      console.error("Error checking subscription:", error);
      this.updateSubscriptionUI("none");
    }
  }

  updateSubscriptionUI(status) {
    // Update plan badge
    this.planName.textContent = status === "basic" ? "Basic Plan" : "Free Plan";
    this.planPrice.textContent = status === "basic" ? "$1.99/month" : "Free";

    // Update features list
    this.subscriptionFeatures.innerHTML = this.getFeaturesList(status);

    // Update subscription button
    const subscribeBtn = document.querySelector(".tier-btn");
    if (status === "basic") {
      subscribeBtn.textContent = "Current Plan";
      subscribeBtn.disabled = true;
    } else {
      subscribeBtn.textContent = "Get Started";
      subscribeBtn.disabled = false;
    }
  }

  getFeaturesList(status) {
    const features =
      status === "basic"
        ? ["Ingredient scanning", "Default ingredients database", "Basic allergen alerts", "Real-time analysis"]
        : ["Limited features"];

    return features.map((feature) => `<div>✓ ${feature}</div>`).join("");
  }

  async handleTierSelection() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_PAYMENT_LINK",
        tier: "basic",
      });

      if (response.url) {
        chrome.tabs.create({ url: response.url });
      }
    } catch (error) {
      console.error("Error handling subscription:", error);
      this.showError("Failed to process subscription request.");
    }
  }

  showError(message) {
    const existingError = document.querySelector(".error-message");
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;

    this.authSection.appendChild(errorDiv);

    // Auto-remove error after 5 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
}

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
