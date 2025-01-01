// Main function to extract product listing data
import RetailerConfig from "./retailerConfig";

const retailerConfig = new RetailerConfig();

async function extractProductFromList(listItem) {
  try {
    // Get retailer ID from current URL
    const retailerId = await retailerConfig.getRetailerId(window.location.href);

    return {
      external_id: getExternalId(listItem),
      url_path: getUrlPath(listItem),
      retailer_id: retailerId,
      ...getPriceInfo(listItem),
      image_url: getImageUrl(listItem),
    };
  } catch (error) {
    console.error("Error extracting product from list:", error);
    return null;
  }
}

// Helper functions for list extraction
function getExternalId(element) {
  // Get the data-testid attribute which contains the full external ID
  const testId = element.getAttribute("data-testid") || "";
  if (testId.startsWith("item_list_item_")) {
    return testId.replace("item_list_item_", "");
  }

  // Fallback: Try to extract ID from the element's ID attribute
  const elementId = element.id;
  if (elementId && elementId.includes("items_")) {
    return elementId;
  }

  // Try to find a child element with an ID containing "items_"
  const childWithId = element.querySelector('[id*="items_"]');
  if (childWithId) {
    return childWithId.id;
  }

  return testId;
}

function getUrlPath(element) {
  const link = element.querySelector('a[role="button"]');
  return link ? link.getAttribute("href") : "";
}

function getPriceInfo(element) {
  // Try multiple selectors for price
  const priceSelectors = [
    ".e-1x7s36o", // Current Instacart price selector
    ".e-1ip314g", // Original selector
  ];

  let priceAmount = 0;

  for (const selector of priceSelectors) {
    const priceElement = element.querySelector(selector);
    if (priceElement) {
      // Get all text nodes to handle superscript numbers
      const textNodes = Array.from(priceElement.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE)
        .map((node) => node.textContent.trim())
        .join("");

      // Remove dollar sign and any whitespace
      const priceText = textNodes.replace("$", "").replace(/\s+/g, "");

      // Convert to dollars
      if (priceText) {
        priceAmount = parseFloat(priceText);
        break; // Found a valid price, stop looking
      }
    }
  }

  return {
    price_amount: priceAmount || 0,
    price_unit: "each", // default, can be updated based on UI
  };
}

function getImageUrl(element) {
  const img = element.querySelector('img[data-testid="item-card-image"]');
  if (!img) return "";

  // Get first source from srcset (highest quality)
  const srcset = img.getAttribute("srcset");
  if (srcset) {
    return srcset.split(",")[0].trim().split(" ")[0];
  }

  return img.getAttribute("src") || "";
}

// Helper functions for modal/product page extraction
function getModalExternalId(modalContent) {
  // Try to get ID from URL first since it's most reliable
  const urlMatch = window.location.href.match(/\/(\d+)(?:\?|$)/);
  if (urlMatch) {
    // Look for prefix in the page content first
    const prefixMatch = modalContent.innerHTML.match(/items_(\d+)-\d+/);
    if (prefixMatch) {
      return `items_${prefixMatch[1]}-${urlMatch[1]}`;
    }
    return `items_${urlMatch[1]}`; // Fallback to simple format
  }

  // Try to get from ingredients section ID
  const ingredientsSection = modalContent.querySelector('div[id$="-Ingredients"]');
  if (ingredientsSection) {
    const sectionId = ingredientsSection.id;
    // Try to match full format first
    const fullMatch = sectionId.match(/items_(\d+)-(\d+)-Ingredients$/);
    if (fullMatch) {
      return `items_${fullMatch[1]}-${fullMatch[2]}`;
    }
    // Fallback to simple format
    const match = sectionId.match(/(\d+)-Ingredients$/);
    if (match) {
      return `items_${match[1]}`;
    }
  }

  // Try to get the ID from data-testid attribute
  const detailsElement = modalContent.querySelector('[data-testid^="item_details_"]');
  if (detailsElement) {
    const testId = detailsElement.getAttribute("data-testid");
    // Try to match full format first
    const fullMatch = testId.match(/item_details_(items_\d+-\d+)/);
    if (fullMatch) {
      return fullMatch[1];
    }
    // Fallback to simple format
    return testId.replace("item_details_", "");
  }

  // Try to find any element with an ID containing "items_"
  const elementWithItemsId = modalContent.querySelector('[id*="items_"]');
  if (elementWithItemsId) {
    // Try to match full format first
    const fullMatch = elementWithItemsId.id.match(/(items_\d+-\d+)/);
    if (fullMatch) {
      return fullMatch[1];
    }
    return elementWithItemsId.id;
  }

  return null;
}

function getModalUrlPath() {
  const url = new URL(window.location.href);
  return url.pathname + url.search;
}

function getIngredients(sourceContent) {
  // Try multiple selectors for ingredients
  const ingredientSelectors = [
    'div[id$="-Ingredients"] p',
    'div[id$="-Ingredients"] .e-tluef2',
    ".e-tluef2", // Generic ingredients class
  ];

  for (const selector of ingredientSelectors) {
    const ingredientsElement = sourceContent.querySelector(selector);
    if (ingredientsElement) {
      const ingredientsText = ingredientsElement.textContent.trim();
      return ingredientsText || null;
    }
  }

  return null;
}

// Extract product data from modal or product page
async function extractProductFromSource(sourceContent, sourceType = "modal", listData = null) {
  try {
    // Get retailer ID if no list data provided
    const retailer_id = listData ? listData.retailer_id : await retailerConfig.getRetailerId(window.location.href);

    let external_id, url_path, ingredients;

    // If we have listData, use its external_id to maintain consistency
    if (listData && listData.external_id) {
      external_id = listData.external_id;
    } else {
      // Otherwise get ID from modal/page and try to match format
      external_id = getModalExternalId(sourceContent);
    }

    if (sourceType === "modal") {
      url_path = getModalUrlPath();
      ingredients = getIngredients(sourceContent);
    } else if (sourceType === "product_page") {
      url_path = getModalUrlPath();
      ingredients = getIngredients(sourceContent);
    }

    // Return minimal data needed for product group and ingredients
    return {
      external_id,
      url_path,
      retailer_id,
      ingredients,
    };
  } catch (error) {
    console.error(`Error extracting product from ${sourceType}:`, error);
    return null;
  }
}

async function processProductList(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const productElements = doc.querySelectorAll('li[data-testid^="item_list_item_"]');

  const productPromises = Array.from(productElements).map((element) => extractProductFromList(element));

  const products = await Promise.all(productPromises);
  return products.filter((product) => product !== null);
}

export { extractProductFromList, processProductList, extractProductFromSource };
