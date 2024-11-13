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
      attributes: getAttributes(listItem),
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
  const isBrandWord = (word) => /^[A-Z]/.test(word) && word.length > 1;
  const brandCandidates = potentialBrandWords.filter(isBrandWord);
  if (brandCandidates.length >= 1) {
    return brandCandidates.join(" ");
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

// Updated to only include non-nutrition attributes
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
async function extractProductFromModal(modalContent, listData = null) {
  try {
    // Get retailer ID if no list data provided
    const retailerId = listData ? listData.retailerId : await retailerConfig.getRetailerId(window.location.href);

    // Use a more generic selector that matches any div ending with "-Ingredients"
    const ingredientsSection = modalContent.querySelector('div[id$="-Ingredients"]');
    let ingredients = null;

    if (ingredientsSection) {
      // Look for ingredients text in a paragraph element
      const ingredientsText = ingredientsSection.querySelector("p")?.textContent;
      if (ingredientsText) {
        ingredients = ingredientsText.trim();
      } else {
        // Fallback to looking for the specific class if paragraph not found
        const ingredientsTextAlt = ingredientsSection.querySelector(".e-tluef2")?.textContent;
        ingredients = ingredientsTextAlt ? ingredientsTextAlt.trim() : null;
      }
    }

    // Get nutritional information using updated class
    const nutritionSection = modalContent.querySelector(".e-kdmqsz");
    let nutrition = null;

    if (nutritionSection) {
      nutrition = {
        serving_size: null,
        calories: null,
        total_fat: null,
        saturated_fat: null,
        trans_fat: null,
        polyunsaturated_fat: null,
        monounsaturated_fat: null,
        cholesterol: null,
        sodium: null,
        total_carbohydrate: null,
        dietary_fiber: null,
        total_sugars: null,
        added_sugars: null,
        protein: null,
      };

      // Extract serving size
      const servingSize = nutritionSection.querySelector(".e-78jcqk")?.textContent;
      if (servingSize) {
        const parsedSize = parseServingSize(servingSize);
        if (parsedSize) {
          nutrition.serving_size = parsedSize;
        }
      }

      // Extract calories
      const calories = nutritionSection.querySelector(".e-1thcph1")?.textContent;
      if (calories) {
        const caloriesValue = calories.match(/\d+/)?.[0];
        if (caloriesValue) {
          nutrition.calories = parseInt(caloriesValue, 10);
        }
      }

      // Define nutrition facts mapping
      const nutritionFacts = [
        { label: "Total Fat", key: "total_fat" },
        { label: "Saturated Fat", key: "saturated_fat" },
        { label: "Trans Fat", key: "trans_fat" },
        { label: "Polyunsaturated Fat", key: "polyunsaturated_fat" },
        { label: "Monounsaturated Fat", key: "monounsaturated_fat" },
        { label: "Cholesterol", key: "cholesterol" },
        { label: "Sodium", key: "sodium" },
        { label: "Total Carbohydrate", key: "total_carbohydrate" },
        { label: "Dietary Fiber", key: "dietary_fiber" },
        { label: "Total Sugars", key: "total_sugars" },
        { label: "Includes", key: "added_sugars" }, // "Includes X Added Sugars"
        { label: "Protein", key: "protein" },
      ];

      // Get all text-containing elements in the nutrition section
      const allElements = nutritionSection.getElementsByTagName("*");

      for (const element of allElements) {
        const text = element.textContent.trim();

        // Skip empty text and serving size info
        if (!text || text.includes("servings per container")) continue;

        // Try to match each nutrition fact
        for (const { label, key } of nutritionFacts) {
          if (text.includes(label)) {
            const value = extractNutritionalValue(text, label);
            if (value !== null) {
              nutrition[key] = value;
            }
            break;
          }
        }
      }
    }

    // Get non-nutrition attributes
    const attributes = [];

    // Extract rating if exists
    const ratingElement = modalContent.querySelector(".e-8k1832");
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
    const reviewElement = modalContent.querySelector(".e-6sv5ld");
    if (reviewElement) {
      attributes.push({
        key: "review_count",
        value: reviewElement.textContent.replace(/[()]/g, "").trim(),
      });
    }

    // Merge with list data if provided, otherwise extract required fields from modal
    if (listData) {
      return {
        ...listData,
        ingredients,
        nutrition,
        attributes: [...(listData.attributes || []), ...attributes],
      };
    }

    // Extract required fields from modal when list data is not available
    const name = getModalName(modalContent);
    const external_id = getModalExternalId(modalContent);
    const url_path = getModalUrlPath();

    return {
      name,
      external_id,
      url_path,
      retailerId,
      ingredients,
      nutrition,
      attributes,
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
