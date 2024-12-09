import authManager from "../auth/authManager";

class PopupManager {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.initializePopup();
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

    // Subscription buttons
    document.querySelectorAll(".tier-btn").forEach((button) => {
      button.addEventListener("click", (e) => this.handleTierSelection(e.target.dataset.tier));
    });

    // Settings button
    this.settingsBtn?.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async initializePopup() {
    try {
      this.showLoading();
      const session = await authManager.getSession();

      if (session) {
        await this.handleAuthenticatedState(session.user);
      } else {
        this.handleUnauthenticatedState();
      }
    } catch (error) {
      console.error("Error initializing popup:", error);
      this.showError("Failed to initialize. Please try again.");
    } finally {
      this.hideLoading();
    }
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
      this.showLoading();
      const { data, error } = await authManager.signInWithEmail(email, password);

      if (error) throw error;

      if (data?.user) {
        await this.handleAuthenticatedState(data.user);
      }
    } catch (error) {
      console.error("Login error:", error);
      errorDiv.textContent = error.message || "Failed to sign in. Please try again.";
      errorDiv.classList.remove("hidden");
    } finally {
      this.hideLoading();
    }
  }

  async handleSignup(event) {
    event.preventDefault();

    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const errorDiv = this.signupForm.querySelector(".auth-error");

    try {
      this.showLoading();
      const { data, error } = await authManager.signUpWithEmail(email, password);

      if (error) throw error;

      if (data?.user) {
        await this.handleAuthenticatedState(data.user);
      }
    } catch (error) {
      console.error("Signup error:", error);
      errorDiv.textContent = error.message || "Failed to create account. Please try again.";
      errorDiv.classList.remove("hidden");
    } finally {
      this.hideLoading();
    }
  }

  async handleLogout() {
    try {
      this.showLoading();
      await authManager.signOut();
      this.handleUnauthenticatedState();
    } catch (error) {
      console.error("Logout error:", error);
      this.showError("Failed to sign out. Please try again.");
    } finally {
      this.hideLoading();
    }
  }

  async handleAuthenticatedState(user) {
    this.loggedOutView.classList.add("hidden");
    this.loggedInView.classList.remove("hidden");
    this.subscriptionSection.classList.remove("hidden");

    if (user.email) {
      this.userEmail.textContent = user.email;
    }

    await this.updateSubscriptionStatus();
  }

  handleUnauthenticatedState() {
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
      const { subscriptionStatus } = response;

      this.updateSubscriptionUI(subscriptionStatus);
    } catch (error) {
      console.error("Error checking subscription:", error);
      this.showError("Failed to load subscription status.");
    }
  }

  updateSubscriptionUI(status) {
    // Update plan badge
    this.planName.textContent = this.getPlanDisplayName(status);
    this.planPrice.textContent = this.getPlanPrice(status);

    // Update features list
    this.subscriptionFeatures.innerHTML = this.getFeaturesList(status);

    // Update tier buttons
    this.updateTierButtons(status);
  }

  getPlanDisplayName(status) {
    switch (status) {
      case "pro":
        return "Pro";
      case "basic":
        return "Basic";
      default:
        return "Free";
    }
  }

  getPlanPrice(status) {
    switch (status) {
      case "pro":
        return "$3.99/month";
      case "basic":
        return "$1.99/month";
      default:
        return "";
    }
  }

  getFeaturesList(status) {
    let features = [];

    switch (status) {
      case "pro":
        features = [
          "Advanced ingredient scanning",
          "Custom ingredients lists",
          "Detailed health insights",
          "Priority support",
        ];
        break;
      case "basic":
        features = ["Basic ingredient scanning", "Default ingredients database", "Basic allergen alerts"];
        break;
      default:
        features = ["Basic features"];
    }

    return features.map((feature) => `<div>✓ ${feature}</div>`).join("");
  }

  updateTierButtons(currentStatus) {
    const basicBtn = document.querySelector('[data-tier="basic"]');
    const proBtn = document.querySelector('[data-tier="pro"]');

    switch (currentStatus) {
      case "pro":
        basicBtn.textContent = "Downgrade to Basic";
        proBtn.textContent = "Current Plan";
        proBtn.disabled = true;
        break;
      case "basic":
        basicBtn.textContent = "Current Plan";
        basicBtn.disabled = true;
        proBtn.textContent = "Upgrade to Pro";
        break;
      default:
        basicBtn.textContent = "Select Basic";
        proBtn.textContent = "Select Pro";
    }
  }

  async handleTierSelection(tier) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_PAYMENT_LINK",
        tier,
      });

      if (response.url) {
        chrome.tabs.create({ url: response.url });
      }
    } catch (error) {
      console.error("Error handling tier selection:", error);
      this.showError("Failed to process subscription request.");
    }
  }

  showLoading() {
    document.body.classList.add("loading");
  }

  hideLoading() {
    document.body.classList.remove("loading");
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
