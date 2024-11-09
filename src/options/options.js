// Options page functionality

class OptionsManager {
  constructor() {
    this.maxFreeCustomIngredients = 3;
    this.initializeElements();
    this.loadSettings();
    this.setupEventListeners();
  }

  initializeElements() {
    // Form elements
    this.strictnessSelect = document.getElementById("strictnessLevel");
    this.newIngredientInput = document.getElementById("newIngredient");
    this.addIngredientButton = document.getElementById("addIngredient");
    this.ingredientsList = document.getElementById("customIngredientsList");
    this.showTooltipsCheckbox = document.getElementById("showTooltips");
    this.highlightProductsCheckbox = document.getElementById("highlightProducts");
    this.saveButton = document.getElementById("saveSettings");
  }

  async loadSettings() {
    // Load saved settings from chrome.storage
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          // Default settings
          strictnessLevel: "moderate",
          customIngredients: [],
          showTooltips: true,
          highlightProducts: true,
        },
        resolve
      );
    });

    // Apply loaded settings to form
    this.strictnessSelect.value = settings.strictnessLevel;
    this.showTooltipsCheckbox.checked = settings.showTooltips;
    this.highlightProductsCheckbox.checked = settings.highlightProducts;

    // Populate custom ingredients list
    settings.customIngredients.forEach((ingredient) => {
      this.addIngredientToList(ingredient);
    });
  }

  setupEventListeners() {
    // Add ingredient button
    this.addIngredientButton.addEventListener("click", () => {
      this.handleAddIngredient();
    });

    // Enter key in input field
    this.newIngredientInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleAddIngredient();
      }
    });

    // Save settings button
    this.saveButton.addEventListener("click", () => {
      this.saveSettings();
    });
  }

  handleAddIngredient() {
    const ingredient = this.newIngredientInput.value.trim();
    if (!ingredient) return;

    const currentIngredients = this.getCurrentIngredients();
    if (currentIngredients.length >= this.maxFreeCustomIngredients) {
      alert("Free tier allows only 3 custom ingredients. Upgrade to premium for unlimited ingredients.");
      return;
    }

    if (currentIngredients.includes(ingredient)) {
      alert("This ingredient is already in your list.");
      return;
    }

    this.addIngredientToList(ingredient);
    this.newIngredientInput.value = "";
  }

  addIngredientToList(ingredient) {
    const li = document.createElement("li");
    li.innerHTML = `
            ${ingredient}
            <button class="remove-ingredient">Remove</button>
        `;

    li.querySelector(".remove-ingredient").addEventListener("click", () => {
      li.remove();
    });

    this.ingredientsList.appendChild(li);
  }

  getCurrentIngredients() {
    return Array.from(this.ingredientsList.children).map((li) => li.textContent.replace("Remove", "").trim());
  }

  async saveSettings() {
    const settings = {
      strictnessLevel: this.strictnessSelect.value,
      customIngredients: this.getCurrentIngredients(),
      showTooltips: this.showTooltipsCheckbox.checked,
      highlightProducts: this.highlightProductsCheckbox.checked,
    };

    // Save to chrome.storage
    await new Promise((resolve) => {
      chrome.storage.sync.set(settings, resolve);
    });

    // Notify background script of settings update
    chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      settings: settings,
    });

    // Show save confirmation
    this.showSaveConfirmation();
  }

  showSaveConfirmation() {
    const saveButton = this.saveButton;
    const originalText = saveButton.textContent;

    saveButton.textContent = "Saved!";
    saveButton.style.backgroundColor = "#27ae60";
    saveButton.disabled = true;

    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.style.backgroundColor = "";
      saveButton.disabled = false;
    }, 2000);
  }
}

// Initialize options page
document.addEventListener("DOMContentLoaded", () => {
  new OptionsManager();
});
