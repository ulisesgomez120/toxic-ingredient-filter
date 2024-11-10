// Main function to extract product from list item
import RetailerConfig from "./retailerConfig";

const retailerConfig = new RetailerConfig();

async function extractProductFromList(listItem) {
  try {
    // Get retailer ID from current URL
    const retailerId = await retailerConfig.getRetailerId(window.location.href);

    const name = getProductName(listItem);
    const sizeInfo = getSizeInfo(listItem, name);

    return {
      external_id: getExternalId(listItem),
      url_path: getUrlPath(listItem),
      name,
      retailerId,
      ...getPriceInfo(listItem),
      ...sizeInfo,
      image_url: getImageUrl(listItem),
      attributes: getAttributes(listItem),
    };
  } catch (error) {
    console.error("Error extracting product from list:", error);
    return null;
  }
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
    price_amount: priceAmount,
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

function getAttributes(element) {
  const attributes = [];

  // Extract rating if exists
  const ratingElement = element.querySelector(".e-8k1832");
  if (ratingElement) {
    const ratingText = ratingElement.parentElement?.textContent;
    if (ratingText) {
      attributes.push({
        key: "rating",
        value: ratingText.trim(),
      });
    }
  }

  // Extract review count if exists
  const reviewElement = element.querySelector(".e-6sv5ld");
  if (reviewElement) {
    attributes.push({
      key: "review_count",
      value: reviewElement.textContent.replace(/[()]/g, "").trim(),
    });
  }

  return attributes;
}

// Modal extraction function
async function extractProductFromModal(modalContent, listData = null) {
  try {
    // Get retailer ID if no list data provided
    const retailerId = listData ? listData.retailerId : await retailerConfig.getRetailerId(window.location.href);

    const ingredientsSection = modalContent.querySelector("#item_details-items_88668-23587497-Ingredients");
    let ingredients = null;

    if (ingredientsSection) {
      const ingredientsText = ingredientsSection.querySelector(".e-tluef2")?.textContent;
      ingredients = ingredientsText ? ingredientsText.trim() : null;
    }

    // Get nutritional information
    const nutritionSection = modalContent.querySelector(".e-1ml9tbj");
    const attributes = [];

    if (nutritionSection) {
      // Extract serving size
      const servingSize = nutritionSection.querySelector(".e-78jcqk")?.textContent;
      if (servingSize) {
        attributes.push({
          key: "serving_size",
          value: servingSize.trim(),
        });
      }

      // Extract calories
      const calories = nutritionSection.querySelector(".e-1thcph1")?.textContent;
      if (calories) {
        attributes.push({
          key: "calories",
          value: calories.trim(),
        });
      }
    }
    // Merge with list data if provided
    if (listData) {
      return {
        ...listData,
        ingredients,
        attributes: [...(listData.attributes || []), ...attributes],
      };
    }
    return {
      ingredients,
      attributes,
      retailerId,
    };
  } catch (error) {
    console.error("Error extracting product from modal:", error);
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

export { extractProductFromList, extractProductFromModal, processProductList };
