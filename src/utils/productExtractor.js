// Main function to extract product from list item
function extractProductFromList(listItem) {
  try {
    return {
      external_id: getExternalId(listItem),
      url_path: getUrlPath(listItem),
      name: getProductName(listItem),
      ...getPriceInfo(listItem),
      ...getSizeInfo(listItem),
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

function getSizeInfo(element) {
  const sizeElement = element.querySelector(".e-an4oxa");
  if (!sizeElement) return { size: null, base_unit: null };

  const sizeText = sizeElement.getAttribute("title") || sizeElement.textContent;
  return parseSizeAndUnit(sizeText);
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
function extractProductFromModal(modalContent) {
  try {
    // Find the ingredients section
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

    return {
      ingredients,
      attributes,
    };
  } catch (error) {
    console.error("Error extracting product from modal:", error);
    return null;
  }
}

// Usage example:
function processProductList(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const productElements = doc.querySelectorAll('li[data-testid^="item_list_item_"]');

  const products = Array.from(productElements)
    .map((element) => extractProductFromList(element))
    .filter((product) => product !== null);

  return products;
}

export { extractProductFromList, extractProductFromModal, processProductList };
