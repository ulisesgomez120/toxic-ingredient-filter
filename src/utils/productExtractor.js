// Main function to extract product from list item
import RetailerConfig from "./retailerConfig";

const retailerConfig = new RetailerConfig();

async function extractProductFromList(listItem) {
  try {
    // Get retailer ID from current URL
    const retailerId = await retailerConfig.getRetailerId(window.location.href);

    const name = getProductName(listItem);
    const sizeInfo = getSizeInfo(listItem, name);
    const brand = extractBrandFromName(name);

    return {
      external_id: getExternalId(listItem),
      url_path: getUrlPath(listItem),
      name,
      brand,
      retailerId,
      ...getPriceInfo(listItem),
      ...sizeInfo,
      image_url: getImageUrl(listItem),
      // attributes: getAttributes(listItem),
    };
  } catch (error) {
    console.error("Error extracting product from list:", error);
    return null;
  }
}

// Helper function to extract brand from product name
function extractBrandFromName(name) {
  if (!name) return "";

  // Common brand patterns:
  // 1. Brand Name - Product Description
  // 2. Brand Name® Product Description
  // 3. Brand Name™ Product Description
  // 4. BRAND NAME Product Description

  // Try to find brand by looking for common separators
  const separators = [" - ", " – ", "®", "™", ":"];
  for (const separator of separators) {
    const parts = name.split(separator);
    if (parts.length > 1) {
      return parts[0].trim();
    }
  }

  // Try to find brand by looking for all caps portion at start
  const words = name.split(" ");
  let brandWords = [];
  for (const word of words) {
    // If word is all caps (allowing for '&' and ''')
    if (word.replace(/[&']/g, "").toUpperCase() === word.replace(/[&']/g, "")) {
      brandWords.push(word);
    } else {
      break;
    }
  }
  if (brandWords.length > 0) {
    return brandWords.join(" ");
  }

  // If no clear separator or pattern, try to extract first 2-3 words as brand
  // but only if they look like a brand (capitalized words)
  const potentialBrandWords = words.slice(0, 3);
  if (potentialBrandWords.length >= 1) {
    return potentialBrandWords.join(" ");
  }

  return "";
}

// Helper functions for list extraction
function getExternalId(element) {
  const testId = element.getAttribute("data-testid") || "";
  return testId.replace("item_list_item_", "");
}

function getUrlPath(element) {
  const link = element.querySelector('a[role="button"]');
  return link ? link.getAttribute("href") : "";
}

function getProductName(element) {
  const nameElement = element.querySelector(".e-147kl2c");
  return nameElement ? nameElement.textContent.trim() : "";
}

function getPriceInfo(element) {
  const priceElement = element.querySelector(".e-1ip314g");
  let priceAmount = 0;

  if (priceElement) {
    // Get all text nodes to handle superscript numbers
    const textNodes = Array.from(priceElement.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE)
      .map((node) => node.textContent.trim())
      .join("");

    // Remove dollar sign and any whitespace
    const priceText = textNodes.replace("$", "").replace(/\s+/g, "");

    // Convert to cents then to dollars
    if (priceText) {
      const cents = parseInt(priceText, 10);
      priceAmount = cents / 100;
    }
  }
  return {
    price_amount: priceAmount || 0,
    price_unit: "each", // default, can be updated based on UI
  };
}

function extractSizeFromName(name) {
  // Common units and their variations
  const units = {
    weight: /\b(?:lb|lbs|pound|pounds|oz|ounce|ounces)\b/i,
    volume: /\b(?:fl oz|fluid ounce|fluid ounces|ml|milliliter|milliliters)\b/i,
    count: /\b(?:count|ct|pack|pk|piece|pieces)\b/i,
  };

  // Try to find size information in the name after a comma
  const parts = name.split(",");
  if (parts.length > 1) {
    for (const part of parts.slice(1)) {
      const trimmed = part.trim();

      // Match patterns like "2 lbs", "16.9 fl oz", "6-count", "40-count"
      const countMatch = trimmed.match(/(\d+)(?:-|\s+)(?:count|ct|pack|pk|piece|pieces)/i);
      if (countMatch) {
        return {
          size: countMatch[1],
          base_unit: "count",
        };
      }

      // Match patterns like "3 lbs", "18 oz", "2 fl oz"
      const sizeMatch = trimmed.match(/^([\d.]+)\s*(.+)$/);
      if (sizeMatch) {
        const [, size, unit] = sizeMatch;
        if (units.weight.test(unit)) {
          return {
            size,
            base_unit: unit.toLowerCase().replace(/s$/, ""), // normalize to singular form
          };
        }
        if (units.volume.test(unit)) {
          return {
            size,
            base_unit: unit.toLowerCase(),
          };
        }
      }
    }
  }

  return null;
}

function getSizeInfo(element, productName) {
  // First try to get size from dedicated element
  const sizeElement = element.querySelector(".e-an4oxa");
  if (sizeElement) {
    const sizeText = sizeElement.getAttribute("title") || sizeElement.textContent;
    const elementSize = parseSizeAndUnit(sizeText);
    if (elementSize.size && elementSize.base_unit) {
      return elementSize;
    }
  }

  // If no size found in element, try to extract from product name
  const nameSize = extractSizeFromName(productName);
  if (nameSize) {
    return nameSize;
  }

  return { size: null, base_unit: null };
}

function parseSizeAndUnit(sizeText) {
  if (!sizeText) return { size: null, base_unit: null };

  // Handle common formats: "9.25 oz", "2 each", "16.9 fl oz"
  const matches = sizeText.match(/^([\d.]+)\s*(.+)$/);
  if (matches) {
    return {
      size: matches[1],
      base_unit: matches[2].trim(),
    };
  }

  return { size: null, base_unit: null };
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

function parseServingSize(servingSizeText) {
  if (!servingSizeText) return null;

  // Extract numeric value and unit from text like "Serving size 16.00 g"
  const match = servingSizeText.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
  if (match) {
    const [, amount, unit] = match;
    return {
      amount: parseFloat(amount),
      unit: unit.toLowerCase(),
    };
  }
  return null;
}

function extractNutritionalValue(text, label) {
  if (!text) return null;

  // Remove the label from the text to avoid matching wrong numbers
  const valueText = text.replace(label, "").trim();

  // Match number followed by optional unit (g, mg, %) and optional daily value
  const match = valueText.match(/(\d+(?:\.\d+)?)\s*(?:g|mg)?/);
  return match ? parseFloat(match[1]) : null;
}

// Helper functions for modal extraction
function getModalName(modalContent) {
  // Try to find the product name in the span with class e-6vf2xs
  const nameElement = modalContent.querySelector("span.e-6vf2xs");
  if (nameElement) {
    return nameElement.textContent.trim();
  }

  // Fallback to previous method
  const titleElement = modalContent.querySelector('[data-testid="item_details_title"]');
  if (titleElement) {
    return titleElement.textContent.trim();
  }
  return null;
}

function getModalExternalId(modalContent) {
  // Try to get the ID from data-testid attribute
  const detailsElement = modalContent.querySelector('[data-testid^="item_details_"]');
  if (detailsElement) {
    const testId = detailsElement.getAttribute("data-testid");
    return testId.replace("item_details_", "");
  }

  // Fallback: Try to get from ingredients section ID
  const ingredientsSection = modalContent.querySelector('div[id$="-Ingredients"]');
  if (ingredientsSection) {
    const sectionId = ingredientsSection.id;
    const match = sectionId.match(/(\d+)-Ingredients$/);
    if (match) {
      return match[1];
    }
  }

  // Fallback: Try to get from URL
  const urlMatch = window.location.href.match(/\/items\/(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  return null;
}

function getModalUrlPath() {
  // Get the current URL path
  const url = new URL(window.location.href);
  return url.pathname + url.search;
}

// Updated modal extraction function to handle nutrition as a separate object
async function extractProductFromSource(sourceContent, sourceType = "modal", listData = null) {
  try {
    // Get retailer ID if no list data provided
    const retailerId = listData ? listData.retailerId : await retailerConfig.getRetailerId(window.location.href);

    let name, external_id, url_path, ingredients, price_amount;

    if (sourceType === "modal") {
      name = getModalName(sourceContent);
      external_id = getModalExternalId(sourceContent);
      url_path = getModalUrlPath();

      // Use a more generic selector that matches any div ending with "-Ingredients"
      const ingredientsSection = sourceContent.querySelector('div[id$="-Ingredients"]');
      if (ingredientsSection) {
        const ingredientsText = ingredientsSection.querySelector("p")?.textContent;
        ingredients = ingredientsText
          ? ingredientsText.trim()
          : ingredientsSection.querySelector(".e-tluef2")?.textContent?.trim() || null;
      }
    } else if (sourceType === "product_page") {
      name = getProductPageName(sourceContent);
      external_id = getProductPageExternalId(sourceContent);
      url_path = getProductPageUrlPath();
      ingredients = getProductPageIngredients(sourceContent);
      price_amount = getProductPagePrice(sourceContent);
    }

    // Extract brand from name
    const brand = name ? extractBrandFromName(name) : "";

    // Merge with list data if provided, otherwise return extracted data
    if (listData) {
      return {
        ...listData,
        ingredients,
        brand: brand || listData.brand, // Use extracted brand or fallback to list data brand
      };
    }

    return {
      name,
      brand,
      external_id,
      url_path,
      retailerId,
      ingredients,
      price_amount,
    };
  } catch (error) {
    console.error(`Error extracting product from ${sourceType}:`, error);
    return null;
  }
}

// Usage example:
async function processProductList(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const productElements = doc.querySelectorAll('li[data-testid^="item_list_item_"]');

  const productPromises = Array.from(productElements).map((element) => extractProductFromList(element));

  const products = await Promise.all(productPromises);
  return products.filter((product) => product !== null);
}

function getProductPageName(sourceContent) {
  // Try multiple selectors for product name
  const nameSelectors = [
    ".e-6vf2xs", // Modal name selector
    '[data-testid="item_details_title"]', // Modal fallback
    ".e-76rf0 h1", // Product page potential selector
    '.e-76rf0 [data-testid="item_details_title"]', // Another potential selector
  ];

  for (const selector of nameSelectors) {
    const nameElement = sourceContent.querySelector(selector);
    if (nameElement) {
      return nameElement.textContent.trim();
    }
  }

  return null;
}

function getProductPageExternalId(sourceContent) {
  // Try to get ID from URL
  const urlMatch = window.location.href.match(/\/products\/(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Try to get from data attributes or other potential sources
  const detailsElement = sourceContent.querySelector('[data-testid^="item_details_"]');
  if (detailsElement) {
    const testId = detailsElement.getAttribute("data-testid");
    return testId.replace("item_details_", "");
  }

  return null;
}

function getProductPageUrlPath() {
  // Get the current URL path
  const url = new URL(window.location.href);
  return url.pathname + url.search;
}

function getProductPageIngredients(sourceContent) {
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

function getProductPagePrice(sourceContent) {
  // Try multiple selectors for price
  const priceSelectors = [
    ".e-76rf0 .e-1ip314g", // Price selector on product page
    ".e-1ip314g", // Generic price selector
  ];

  for (const selector of priceSelectors) {
    const priceElement = sourceContent.querySelector(selector);
    if (priceElement) {
      // Get all text nodes to handle superscript numbers
      const textNodes = Array.from(priceElement.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE)
        .map((node) => node.textContent.trim())
        .join("");

      // Remove dollar sign and any whitespace
      const priceText = textNodes.replace("$", "").replace(/\s+/g, "");

      // Convert to cents then to dollars
      if (priceText) {
        const cents = parseInt(priceText, 10);
        return cents / 100;
      }
    }
  }

  return null;
}

export { extractProductFromList, processProductList, extractProductFromSource };
