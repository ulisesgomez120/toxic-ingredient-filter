// Background Service Worker for Toxic Food Filter
import { authService } from "./utils/authService.js";
import DatabaseHandler from "./utils/databaseHandler.js";
import { ProductDataManager } from "./utils/productDataManager.js";

class BackgroundService {
  constructor() {
    this.dbHandler = null;
    this.dataManager = new ProductDataManager();
    this.setupListeners();
    this.setupAlarms();
    this.init();
  }

  async init() {
    try {
      // Initialize database handler only if user is authenticated and subscribed
      const session = await authService.getSession();
      const subscription = await authService.getSubscription();

      if (session && subscription?.status === "active") {
        this.dbHandler = new DatabaseHandler();
        console.log("Database handler initialized successfully.");
      }
    } catch (error) {
      console.error("Failed to initialize:", error);
    }
  }

  setupListeners() {
    // Listen for messages from content script and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Indicates we'll respond asynchronously
    });

    // Listen for alarm events
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "subscriptionCheck") {
        this.checkSubscription();
      }
    });

    // Listen for installation
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === "install") {
        await this.handleFirstInstall();
      }
    });
  }

  async setupAlarms() {
    // Set up subscription check alarm if user is authenticated
    const session = await authService.getSession();
    if (session) {
      await authService.scheduleSubscriptionCheck();
    }
  }

  async handleFirstInstall() {
    // Open options page for initial setup
    chrome.runtime.openOptionsPage();
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.type) {
        case "CHECK_INGREDIENTS":
          await this.verifyAccess();
          const result = await this.checkIngredients(request.ingredients);
          sendResponse({ result });
          break;

        case "UPDATE_SETTINGS":
          await this.verifyAccess();
          await this.updateSettings(request.settings);
          sendResponse({ success: true });
          break;

        case "GET_AUTH_STATUS":
          const status = await this.getAuthStatus();
          sendResponse({ status });
          break;

        case "SIGN_IN":
          await authService.signIn();
          sendResponse({ success: true });
          break;

        case "SIGN_OUT":
          await authService.signOut();
          // Reinitialize without database handler
          this.dbHandler = null;
          sendResponse({ success: true });
          break;

        case "GET_SUBSCRIPTION":
          const subscription = await authService.getSubscription();
          sendResponse({ subscription });
          break;

        case "SUBSCRIBE":
          await authService.redirectToCheckout(request.tier);
          sendResponse({ success: true });
          break;

        case "CHECK_PRODUCT":
          await this.verifyAccess();
          const productData = await this.checkProduct(request.product);
          sendResponse({ productData });
          break;

        default:
          throw new Error(`Unknown message type: ${request.type}`);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message });

      // If auth/subscription error, reinitialize without database handler
      if (error.message === "Not authenticated" || error.message === "No active subscription") {
        this.dbHandler = null;
      }
    }
  }

  async verifyAccess() {
    const session = await authService.getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const subscription = await authService.getSubscription();
    if (!subscription || subscription.status !== "active") {
      throw new Error("No active subscription");
    }

    // Initialize database handler if needed
    if (!this.dbHandler) {
      this.dbHandler = new DatabaseHandler();
    }

    return { session, subscription };
  }

  async getAuthStatus() {
    const session = await authService.getSession();
    const subscription = await authService.getSubscription();

    return {
      isAuthenticated: !!session,
      subscription: subscription || null,
    };
  }

  async checkSubscription() {
    const subscription = await authService.checkSubscription();

    // Reinitialize database handler based on subscription status
    if (subscription?.status === "active" && !this.dbHandler) {
      this.dbHandler = new DatabaseHandler();
    } else if (!subscription?.status === "active" && this.dbHandler) {
      this.dbHandler = null;
    }
  }

  async checkIngredients(ingredients) {
    const { subscription } = await this.verifyAccess();

    // Basic tier only gets access to default ingredients
    if (subscription.tier === "basic") {
      return this.dataManager.checkDefaultIngredients(ingredients);
    }

    // Pro tier gets access to custom ingredients and advanced features
    return this.dataManager.checkAllIngredients(ingredients);
  }

  async checkProduct(product) {
    const { subscription } = await this.verifyAccess();

    try {
      // Store product data if we have database access
      if (this.dbHandler) {
        const formattedData = this.formatProductData(product);
        await this.dbHandler.saveProductListing(formattedData);
      }

      // Process ingredients based on subscription tier
      if (subscription.tier === "basic") {
        return this.dataManager.processBasicProduct(product);
      } else {
        return this.dataManager.processProProduct(product);
      }
    } catch (error) {
      console.error("Error checking product:", error);
      throw error;
    }
  }

  async updateSettings(settings) {
    const { subscription } = await this.verifyAccess();

    // Only pro tier can update custom ingredients
    if (settings.customIngredients && subscription.tier !== "pro") {
      throw new Error("Pro subscription required for custom ingredients");
    }

    await chrome.storage.sync.set(settings);
  }

  formatProductData(product) {
    return {
      name: product.name,
      retailerId: product.retailerId,
      externalId: product.external_id,
      urlPath: product.url_path,
      priceAmount: product.price_amount ?? 0,
      priceUnit: product.price_unit,
      imageUrl: product.image_url,
      baseUnit: product.base_unit,
      size: product.size,
      ingredients: product.ingredients,
    };
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
