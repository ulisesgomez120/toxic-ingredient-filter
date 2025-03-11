// OnboardingManager class to handle the onboarding experience
export class OnboardingManager {
  constructor() {
    this.hasShownOnboarding = false;
  }

  // Check if onboarding has been shown before
  async checkOnboardingStatus() {
    try {
      const result = await chrome.storage.local.get("hasShownOnboarding");
      return result.hasShownOnboarding || false;
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      return false;
    }
  }

  // Mark onboarding as shown
  async markOnboardingAsShown() {
    try {
      await chrome.storage.local.set({ hasShownOnboarding: true });
      this.hasShownOnboarding = true;
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
  }

  // Create and show the onboarding UI
  async showOnboarding() {
    // Check if onboarding has already been shown
    const hasShown = await this.checkOnboardingStatus();
    if (hasShown || this.hasShownOnboarding) {
      return false;
    }

    return this.forceShowOnboarding();
  }

  // Show onboarding regardless of whether it's been shown before
  async forceShowOnboarding() {
    // Create onboarding overlay
    const overlay = document.createElement("div");
    overlay.className = "onboarding-overlay";

    // Create onboarding container
    const container = document.createElement("div");
    container.className = "onboarding-container";

    // Add content to container
    container.innerHTML = `
      <div class="onboarding-header">
        <h2>Welcome to Clean Cart!</h2>
        <p>Let's help you make healthier food choices on Instacart</p>
      </div>
      
      <div class="onboarding-content">
        <div class="onboarding-section">
          <h3>Understanding Badge Colors</h3>
          <p>Clean Cart adds colored badges to products to help you quickly identify ingredients of concern:</p>
          
          <div class="badge-examples">
            <div class="badge-example">
              <div class="badge badge-red">3</div>
              <div class="badge-label">Red</div>
              <div class="badge-description">High concern ingredients</div>
            </div>
            
            <div class="badge-example">
              <div class="badge badge-yellow">2</div>
              <div class="badge-label">Yellow</div>
              <div class="badge-description">Moderate concern ingredients</div>
            </div>
            
            <div class="badge-example">
              <div class="badge badge-green">0</div>
              <div class="badge-label">Green</div>
              <div class="badge-description">No concerning ingredients</div>
            </div>
            
            <div class="badge-example">
              <div class="badge badge-gray">X</div>
              <div class="badge-label">Gray</div>
              <div class="badge-description">No ingredient data available</div>
            </div>
          </div>
        </div>
        
        <div class="onboarding-section">
          <h3>Detailed Information at a Glance</h3>
          <p>Hover over any badge to see more details about ingredients to watch out for:</p>
          
          <div class="tooltip-example">
            <div class="tooltip-instruction">
              <span class="tooltip-instruction-icon">👆</span>
              <span>Hover over a badge to see which ingredients you might want to research further</span>
            </div>
            <div class="tooltip-instruction">
              <span class="tooltip-instruction-icon">👁️</span>
              <span>View concern levels and specific ingredients that may require attention</span>
            </div>
          </div>
        </div>
        
        <div class="onboarding-section">
          <h3>Save Time While Shopping Healthier</h3>
          <p>Clean Cart helps you make informed decisions quickly:</p>
          
          <div class="convenience-points">
            <div class="convenience-point">
              <span class="convenience-point-icon">✓</span>
              <span class="convenience-point-text">Instantly identify products with ingredients of concern</span>
            </div>
            <div class="convenience-point">
              <span class="convenience-point-icon">✓</span>
              <span class="convenience-point-text">No need to read every ingredient list</span>
            </div>
            <div class="convenience-point">
              <span class="convenience-point-icon">✓</span>
              <span class="convenience-point-text">Make healthier choices without slowing down your shopping</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="onboarding-footer">
        <a href="https://getcleancart.com" target="_blank" class="website-link">Visit getcleancart.com for more information</a>
        <button class="close-button">Got it!</button>
      </div>
    `;

    // Add container to overlay
    overlay.appendChild(container);

    // Add overlay to body
    document.body.appendChild(overlay);

    // Add event listener to close button
    const closeButton = overlay.querySelector(".close-button");
    closeButton.addEventListener("click", async () => {
      // Remove overlay
      overlay.remove();

      // Mark onboarding as shown
      await this.markOnboardingAsShown();
    });

    // Mark as shown in memory (in case user refreshes before clicking "Got it")
    this.hasShownOnboarding = true;

    return true;
  }
}
