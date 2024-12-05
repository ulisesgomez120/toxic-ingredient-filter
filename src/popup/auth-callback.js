import { authService } from "../utils/authService.js";

class AuthCallbackHandler {
  constructor() {
    this.statusElement = null;
    this.spinnerElement = null;
  }

  init() {
    // Wait for DOM to be ready
    document.addEventListener("DOMContentLoaded", () => {
      this.statusElement = document.getElementById("status");
      this.spinnerElement = document.getElementById("spinner");
      this.handleCallback();
    });
  }

  updateStatus(message, type = "info") {
    if (this.statusElement) {
      this.statusElement.textContent = message;
      this.statusElement.className = type;
    }
  }

  showSpinner(show = true) {
    if (this.spinnerElement) {
      this.spinnerElement.style.display = show ? "block" : "none";
    }
  }

  async handleCallback() {
    try {
      const hash = window.location.hash;
      if (!hash) {
        throw new Error("No authentication data received");
      }

      this.updateStatus("Completing authentication...");
      this.showSpinner(true);

      // Handle the callback with auth service
      await authService.handleCallback(hash);

      // Show success and close
      this.updateStatus("Authentication successful!", "success");
      this.showSpinner(false);

      // Notify the extension that auth is complete
      chrome.runtime.sendMessage({ type: "AUTH_COMPLETED" });

      // Close the popup after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (error) {
      console.error("Auth callback error:", error);
      this.updateStatus(error.message || "Authentication failed. Please try again.", "error");
      this.showSpinner(false);

      // Notify the extension of auth failure
      chrome.runtime.sendMessage({
        type: "AUTH_FAILED",
        error: error.message,
      });
    }
  }
}

// Initialize the handler
const handler = new AuthCallbackHandler();
handler.init();
