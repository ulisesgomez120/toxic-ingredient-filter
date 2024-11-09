// Popup functionality

class PopupManager {
  constructor() {
    this.initializeElements();
    this.loadSettings();
    this.setupEventListeners();
    this.updateStats();
  }

  initializeElements() {
    this.strictnessSelect = document.getElementById("strictnessLevel");
    this.scannedCount = document.getElementById("scannedCount");
    this.toxicCount = document.getElementById("toxicCount");
    this.customCount = document.getElementById("customCount");
    this.settingsButton = document.getElementById("openSettings");
    this.upgradeButton = document.getElementById("upgradePremium");
  }

  async loadSettings() {
    // Load saved settings from chrome.storage
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          strictnessLevel: "moderate",
          customIngredients: [],
          stats: {
            scannedToday: 0,
            toxicFound: 0,
          },
        },
        resolve
      );
    });

    // Apply settings to popup
    this.strictnessSelect.value = settings.strictnessLevel;
    this.updateCustomIngredientsCount(settings.customIngredients.length);

    // Update stats
    if (settings.stats) {
      this.scannedCount.textContent = settings.stats.scannedToday;
      this.toxicCount.textContent = settings.stats.toxicFound;
    }
  }

  setupEventListeners() {
    // Strictness level change
    this.strictnessSelect.addEventListener("change", () => {
      this.saveStrictnessLevel();
    });

    // Settings button
    this.settingsButton.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });

    // Upgrade button
    this.upgradeButton.addEventListener("click", () => {
      // TODO: Implement premium upgrade flow
      chrome.tabs.create({ url: "https://example.com/premium-upgrade" });
    });
  }

  async saveStrictnessLevel() {
    const strictnessLevel = this.strictnessSelect.value;

    // Save to chrome.storage
    await new Promise((resolve) => {
      chrome.storage.sync.set({ strictnessLevel }, resolve);
    });

    // Notify background script of settings update
    chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      settings: { strictnessLevel },
    });
  }

  updateCustomIngredientsCount(count) {
    this.customCount.textContent = `${count}/3`;
  }

  async updateStats() {
    // Get current tab to check if we're on Instacart
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isInstacart = tab.url.includes("instacart.com");

    // Update status indicator
    const statusElement = document.querySelector(".status");
    if (isInstacart) {
      statusElement.textContent = "Active";
      statusElement.style.backgroundColor = "#2ecc71";
    } else {
      statusElement.textContent = "Inactive";
      statusElement.style.backgroundColor = "#95a5a6";
    }

    // Request latest stats from background script
    chrome.runtime.sendMessage({ type: "GET_STATS" }, (response) => {
      if (response && response.stats) {
        this.scannedCount.textContent = response.stats.scannedToday;
        this.toxicCount.textContent = response.stats.toxicFound;
      }
    });
  }
}

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
