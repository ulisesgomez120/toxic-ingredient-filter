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
    this.paymentHistory = document.getElementById("payment-history");

    // Custom ingredients elements
    this.customIngredientsLocked = document.getElementById("custom-ingredients-locked");
    this.customIngredientsContent = document.getElementById("custom-ingredients-content");
    this.ingredientsContainer = document.getElementById("ingredients-container");
    this.addIngredientBtn = document.getElementById("add-ingredient-btn");
    this.unlockCustomIngredientsBtn = document.getElementById("unlock-custom-ingredients");

    // Modal elements
    this.addIngredientModal = document.getElementById("add-ingredient-modal");
    this.addIngredientForm = document.getElementById("add-ingredient-form");
    this.cancelAddIngredientBtn = document.getElementById("cancel-add-ingredient");

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

    // Custom ingredients events
    this.addIngredientBtn?.addEventListener("click", () => this.showAddIngredientModal());
    this.unlockCustomIngredientsBtn?.addEventListener("click", () => this.handleUpgrade());
    this.cancelAddIngredientBtn?.addEventListener("click", () => this.hideAddIngredientModal());
    this.addIngredientForm?.addEventListener("submit", (e) => this.handleAddIngredient(e));

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
      await Promise.all([this.loadAuthState(), this.loadSettings(), this.loadCustomIngredients()]);
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
      this.updateCustomIngredientsAccess(subscriptionStatus === "pro");
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
    switch (status) {
      case "pro":
        return "Pro Plan";
      case "basic":
        return "Basic Plan";
      default:
        return "Free Plan";
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

    return features.map((feature) => `<li>✓ ${feature}</li>`).join("");
  }

  updateSubscriptionButtons(status) {
    if (status === "pro") {
      this.upgradeBtn.style.display = "none";
      this.manageSubscriptionBtn.style.display = "block";
    } else {
      this.upgradeBtn.style.display = "block";
      this.manageSubscriptionBtn.style.display = "none";
    }
  }

  updateCustomIngredientsAccess(hasPro) {
    if (hasPro) {
      this.customIngredientsLocked.classList.add("hidden");
      this.customIngredientsContent.classList.remove("hidden");
    } else {
      this.customIngredientsLocked.classList.remove("hidden");
      this.customIngredientsContent.classList.add("hidden");
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

  async loadCustomIngredients() {
    try {
      const response = await this.sendMessage({ type: "GET_CUSTOM_INGREDIENTS" });
      if (this.ingredientsContainer) {
        this.renderCustomIngredients(response.ingredients || []);
      }
    } catch (error) {
      console.error("Error loading custom ingredients:", error);
      this.showError("Failed to load custom ingredients");
    }
  }

  renderCustomIngredients(ingredients) {
    if (!this.ingredientsContainer) return;

    this.ingredientsContainer.innerHTML = ingredients
      .map(
        (ingredient) => `
      <div class="ingredient-item">
        <div class="ingredient-info">
          <strong>${ingredient.name}</strong>
          <span class="ingredient-category">${ingredient.category}</span>
          <span class="concern-level ${ingredient.concernLevel.toLowerCase()}">${ingredient.concernLevel}</span>
        </div>
        <button class="delete-ingredient" data-id="${ingredient.id}">Delete</button>
      </div>
    `
      )
      .join("");

    // Add delete event listeners
    this.ingredientsContainer.querySelectorAll(".delete-ingredient").forEach((button) => {
      button.addEventListener("click", () => this.handleDeleteIngredient(button.dataset.id));
    });
  }

  async handleAddIngredient(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const ingredient = {
      name: formData.get("ingredient-name"),
      category: formData.get("ingredient-category"),
      concernLevel: formData.get("ingredient-concern"),
      notes: formData.get("ingredient-notes"),
    };

    try {
      await this.sendMessage({
        type: "ADD_CUSTOM_INGREDIENT",
        ingredient,
      });

      this.hideAddIngredientModal();
      this.loadCustomIngredients();
      this.showSuccess("Ingredient added successfully");
    } catch (error) {
      console.error("Error adding ingredient:", error);
      this.showError("Failed to add ingredient");
    }
  }

  async handleDeleteIngredient(id) {
    try {
      await this.sendMessage({
        type: "DELETE_CUSTOM_INGREDIENT",
        id,
      });

      this.loadCustomIngredients();
      this.showSuccess("Ingredient deleted successfully");
    } catch (error) {
      console.error("Error deleting ingredient:", error);
      this.showError("Failed to delete ingredient");
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

  showAddIngredientModal() {
    if (this.addIngredientModal) {
      this.addIngredientModal.classList.remove("hidden");
      this.addIngredientForm?.reset();
    }
  }

  hideAddIngredientModal() {
    if (this.addIngredientModal) {
      this.addIngredientModal.classList.add("hidden");
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
