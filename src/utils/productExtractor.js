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
    const priceText = priceElement.textContent.replace("$", "").trim();
    priceAmount = parseFloat(priceText) || 0;
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
    return {
      ingredients: getIngredients(modalContent),
      ...getModalAttributes(modalContent),
    };
  } catch (error) {
    console.error("Error extracting product from modal:", error);
    return null;
  }
}

function getIngredients(modalContent) {
  const ingredientsSection = modalContent.querySelector('[id$="-Ingredients"]');
  if (!ingredientsSection) return null;

  const ingredientsText = ingredientsSection.querySelector(".e-tluef2")?.textContent;
  return ingredientsText ? ingredientsText.trim() : null;
}

function getModalAttributes(modalContent) {
  const attributes = [];

  // Get nutritional information
  const nutritionSection = modalContent.querySelector(".e-1ml9tbj");
  if (nutritionSection) {
    // Extract serving size
    const servingSize = nutritionSection.querySelector(".e-78jcqk")?.textContent;
    if (servingSize) {
      attributes.push({
        key: "serving_size",
        value: servingSize.trim(),
      });
    }
  }

  return { attributes };
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
