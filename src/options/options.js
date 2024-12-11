class OptionsManager {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadOptions();
  }

  initializeElements() {
    // User info elements
    this.userEmail = document.getElementById("user-email");
    this.logoutBtn = document.getElementById("logout-btn");

    // Subscription elements
    this.planBadge = document.getElementById("plan-badge");
    this.planExpiry = document.getElementById("plan-expiry");
    this.featuresList = document.getElementById("features-list");
    this.upgradeBtn = document.getElementById("upgrade-btn");
    this.manageSubscriptionBtn = document.getElementById("manage-subscription-btn");

    // Settings elements
    this.strictnessLevel = document.getElementById("strictness-level");
    this.enableNotifications = document.getElementById("enable-notifications");
  }

  setupEventListeners() {
    // Auth events
    this.logoutBtn?.addEventListener("click", () => this.handleLogout());

    // Subscription events
    this.upgradeBtn?.addEventListener("click", () => this.handleUpgrade());
    this.manageSubscriptionBtn?.addEventListener("click", () => this.handleManageSubscription());

    // Settings events
    this.strictnessLevel?.addEventListener("change", () => this.saveSettings());
    this.enableNotifications?.addEventListener("change", () => this.saveSettings());

    // Listen for auth state changes
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "AUTH_STATE_CHANGED") {
        this.handleAuthStateChange(message.authState);
      }
    });
  }

  async loadOptions() {
    try {
      this.showLoading();
      await Promise.all([this.loadAuthState(), this.loadSettings()]);
    } catch (error) {
      console.error("Error loading options:", error);
      this.showError("Failed to load options. Please try again.");
    } finally {
      this.hideLoading();
    }
  }

  async loadAuthState() {
    const response = await this.sendMessage({ type: "GET_AUTH_STATUS" });
    if (response.isAuthenticated) {
      await this.handleAuthenticatedState(response.user);
    } else {
      this.handleUnauthenticatedState();
    }
  }

  async handleAuthenticatedState(user) {
    if (user.email) {
      this.userEmail.textContent = user.email;
    }

    // Show all sections
    document.querySelectorAll(".section").forEach((section) => {
      section.style.display = "block";
    });

    await this.loadSubscriptionStatus();
  }

  handleUnauthenticatedState() {
    // Instead of redirecting, show auth required message
    document.querySelectorAll(".section").forEach((section) => {
      section.style.display = "none";
    });

    const mainContent = document.querySelector(".main-content");
    const authMessage = document.createElement("div");
    // remove any existing auth message
    document.querySelectorAll(".auth-required-message").forEach((el) => el.remove());
    authMessage.className = "auth-required-message";
    authMessage.innerHTML = `
      <h2>Authentication Required</h2>
      <p>Please sign in to access settings and manage your subscription.</p>
      <button id="auth-redirect-btn" class="primary-btn">Sign In</button>
    `;

    mainContent.prepend(authMessage);

    // Add click handler for auth redirect button
    document.getElementById("auth-redirect-btn")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_AUTH", mode: "login" });
    });
  }

  async loadSubscriptionStatus() {
    try {
      const response = await this.sendMessage({ type: "CHECK_SUBSCRIPTION" });
      const { subscriptionStatus } = response;

      this.updateSubscriptionUI(subscriptionStatus);
    } catch (error) {
      console.error("Error loading subscription:", error);
      this.showError("Failed to load subscription status.");
    }
  }

  updateSubscriptionUI(status) {
    // Update plan badge
    this.planBadge.textContent = this.getPlanDisplayName(status);
    this.planBadge.className = `badge ${status}-badge`;

    // Update features list
    this.featuresList.innerHTML = this.getFeaturesList(status);

    // Update buttons
    this.updateSubscriptionButtons(status);
  }

  getPlanDisplayName(status) {
    return status === "basic" ? "Basic Plan" : "Free Plan";
  }

  getFeaturesList(status) {
    const features =
      status === "basic"
        ? ["Ingredient scanning", "Default ingredients database", "Basic allergen alerts", "Real-time analysis"]
        : ["Limited features"];

    return features.map((feature) => `<li>✓ ${feature}</li>`).join("");
  }

  updateSubscriptionButtons(status) {
    if (status === "basic") {
      this.upgradeBtn.style.display = "none";
      this.manageSubscriptionBtn.style.display = "block";
    } else {
      this.upgradeBtn.style.display = "block";
      this.manageSubscriptionBtn.style.display = "none";
    }
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          strictnessLevel: "moderate",
          enableNotifications: true,
        },
        (settings) => {
          if (this.strictnessLevel && this.enableNotifications) {
            this.strictnessLevel.value = settings.strictnessLevel;
            this.enableNotifications.checked = settings.enableNotifications;
          }
          resolve();
        }
      );
    });
  }

  async saveSettings() {
    const settings = {
      strictnessLevel: this.strictnessLevel.value,
      enableNotifications: this.enableNotifications.checked,
    };

    try {
      await chrome.storage.sync.set(settings);
      this.showSuccess("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      this.showError("Failed to save settings");
    }
  }

  async handleUpgrade() {
    try {
      const response = await this.sendMessage({ type: "GET_PAYMENT_LINK" });
      if (response.url) {
        chrome.tabs.create({ url: response.url });
      }
    } catch (error) {
      console.error("Error handling upgrade:", error);
      this.showError("Failed to process upgrade request");
    }
  }

  async handleManageSubscription() {
    try {
      const response = await this.sendMessage({ type: "GET_PORTAL_LINK" });
      if (response.url) {
        chrome.tabs.create({ url: response.url });
      }
    } catch (error) {
      console.error("Error opening subscription portal:", error);
      this.showError("Failed to open subscription management");
    }
  }

  async handleLogout() {
    try {
      await this.sendMessage({ type: "LOGOUT" });
      this.handleUnauthenticatedState();
    } catch (error) {
      console.error("Error logging out:", error);
      this.showError("Failed to logout");
    }
  }

  showLoading() {
    document.body.classList.add("loading");
  }

  hideLoading() {
    document.body.classList.remove("loading");
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;

    document.querySelector(".main-content")?.prepend(errorDiv);

    setTimeout(() => errorDiv.remove(), 5000);
  }

  showSuccess(message) {
    const successDiv = document.createElement("div");
    successDiv.className = "success-message";
    successDiv.textContent = message;

    document.querySelector(".main-content")?.prepend(successDiv);

    setTimeout(() => successDiv.remove(), 5000);
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }
}

// Initialize options page
document.addEventListener("DOMContentLoaded", () => {
  new OptionsManager();
});
