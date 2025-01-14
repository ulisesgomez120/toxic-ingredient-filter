import authManager from "../auth/authManager";
import { DEFAULT_TOXIC_INGREDIENTS } from "../../default-ingredients.js";

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
    this.upgradeBanner = document.getElementById("upgrade-banner");
    this.getStartedBtn = document.getElementById("get-started-btn");
    this.currentPlan = document.getElementById("current-plan");
    this.planName = document.getElementById("plan-name");
    this.planPrice = document.getElementById("plan-price");

    // Manage subscription button
    this.manageSubscriptionBtn = document.getElementById("manage-subscription");
  }

  setupAuthStateListener() {
    authManager.subscribeToAuthChanges(async ({ event, session }) => {
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

    // Subscription management
    this.manageSubscriptionBtn?.addEventListener("click", () => this.handleManageSubscription());
    this.getStartedBtn?.addEventListener("click", () => this.handleGetStarted());
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

    // Validate password length
    if (password.length < 8) {
      errorDiv.textContent = "Password must be at least 8 characters long";
      errorDiv.classList.remove("hidden");
      return;
    }

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
    // Ensure elements exist before updating
    if (!this.loggedOutView || !this.loggedInView) {
      console.error("Required elements not found");
      return;
    }

    this.loggedOutView.classList.add("hidden");
    this.loggedInView.classList.remove("hidden");

    if (user.email && this.userEmail) {
      this.userEmail.textContent = user.email;
    }

    await this.updateSubscriptionStatus();
    this.initializeIngredientsList();
  }

  handleUnauthenticatedState() {
    // Ensure elements exist before updating
    if (!this.loggedOutView || !this.loggedInView) {
      console.error("Required elements not found");
      return;
    }

    this.loggedOutView.classList.remove("hidden");
    this.loggedInView.classList.add("hidden");

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

      // Get current session to notify content scripts of updated auth state
      const session = await authManager.getSession();

      // Notify content scripts of updated auth state including subscription
      chrome.runtime.sendMessage({
        type: "AUTH_STATE_CHANGED",
        authState: {
          isAuthenticated: !!session,
          subscriptionStatus,
        },
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
      this.updateSubscriptionUI("none");
    }
  }

  updateSubscriptionUI(status) {
    const isSubscribed = status === "basic";

    // Show/hide upgrade banner
    if (this.upgradeBanner) {
      this.upgradeBanner.classList.toggle("hidden", isSubscribed);
    }

    // Update plan badge
    this.planName.textContent = isSubscribed ? "Basic Plan" : "Free Plan";
    this.planPrice.textContent = isSubscribed ? "$1.99/month" : "Free";

    // Show/hide manage subscription button
    if (this.manageSubscriptionBtn) {
      this.manageSubscriptionBtn.classList.toggle("hidden", !isSubscribed);
    }
  }

  async handleGetStarted() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_PAYMENT_LINK",
      });

      if (response.url) {
        chrome.tabs.create({ url: response.url });
      } else {
        throw new Error("No payment link received");
      }
    } catch (error) {
      console.error("Error getting payment link:", error);
      this.showError("Failed to load payment page. Please try again.");
    }
  }

  initializeIngredientsList() {
    // Sort and filter ingredients by concern level
    const highConcernIngredients = DEFAULT_TOXIC_INGREDIENTS.filter((i) => i.concernLevel === "High").sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const moderateConcernIngredients = DEFAULT_TOXIC_INGREDIENTS.filter((i) => i.concernLevel === "Moderate").sort(
      (a, b) => a.name.localeCompare(b.name)
    );

    // Display high concern ingredients
    const highConcernEl = document.getElementById("high-concern-ingredients");
    highConcernEl.innerHTML = this.formatIngredientsList(highConcernIngredients);

    // Display moderate concern ingredients
    const moderateConcernEl = document.getElementById("moderate-concern-ingredients");
    moderateConcernEl.innerHTML = this.formatIngredientsList(moderateConcernIngredients);
  }

  formatIngredientsList(ingredients) {
    return ingredients
      .map(
        (ing) => `
      <div class="ingredient-item">
        <div class="ingredient-name">${ing.name}</div>
        <div class="ingredient-details">
          <div>
            <span class="ingredient-category">${ing.category}</span>
            ${
              ing.aliases.length
                ? `<span class="ingredient-aliases">Also known as: ${ing.aliases.join(", ")}</span>`
                : ""
            }
          </div>
          <div class="health-effects">
            ${ing.healthEffects.map((effect) => `<span class="effect">${effect}</span>`).join("")}
          </div>
          <div class="source-links">
            ${ing.sources
              .map(
                (source) => `
                <a href="${source.url}" target="_blank" class="source-link">
                  ${source.title} (${source.publisher}, ${source.year})
                </a>
              `
              )
              .join("")}
          </div>
        </div>
      </div>
    `
      )
      .join("");
  }

  async handleManageSubscription() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_PORTAL_LINK",
      });

      if (response.url) {
        chrome.tabs.create({ url: response.url });
      }
    } catch (error) {
      console.error("Error accessing customer portal:", error);
      this.showError("Failed to access customer portal. Please try again.");
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
