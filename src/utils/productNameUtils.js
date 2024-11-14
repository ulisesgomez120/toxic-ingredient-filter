// src/utils/productNameUtils.js

/**
 * Normalizes a product name by removing special characters and standardizing format
 * @param {string} name - The product name to normalize
 * @returns {string} - The normalized name
 */
export const normalizeProductName = (name) => {
  if (!name) return "";

  return name
    .toLowerCase()
    .replace(/[®™]/g, "") // Remove trademark symbols
    .replace(/['"""'']/g, "") // Remove quotes
    .replace(/&/g, "and") // Replace & with and
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except hyphen
    .replace(/\s+/g, " ") // Normalize spaces
    .replace(/^(the|a|an)\s+/i, "") // Remove leading articles
    .trim();
};

/**
 * Extracts brand and base name from a product name
 * @param {string} name - The full product name
 * @returns {Object} - Object containing brand and base name info
 */
export const extractProductInfo = (name) => {
  if (!name) return { brand: "", baseName: name || "" };

  // Common brand-name separators
  const separators = [" - ", " – ", " : ", ": ", " | ", "|", ","];

  // First try with explicit separators
  for (const separator of separators) {
    if (name.includes(separator)) {
      const [brandPart, ...rest] = name.split(separator);
      const baseName = rest.join(separator).trim();
      if (baseName) {
        return {
          brand: brandPart.trim(),
          baseName: baseName,
          normalizedBrand: normalizeProductName(brandPart),
          normalizedBaseName: normalizeProductName(baseName),
        };
      }
    }
  }

  // If no separator found, use the full name as both brand and base_name
  return {
    brand: name.trim(),
    baseName: name.trim(),
    normalizedBrand: normalizeProductName(name),
    normalizedBaseName: normalizeProductName(name),
  };
};

/**
 * Checks if two brand names match using strict equality after normalization
 * @param {string} storedBrand - The stored brand name
 * @param {string} newBrand - The new brand name to compare
 * @returns {boolean} - Whether the brands match
 */
export const checkBrandMatch = (storedBrand, newBrand) => {
  return storedBrand === newBrand;
};

/**
 * Checks if two base names match using strict equality
 * @param {string} storedBaseName - The stored base name
 * @param {string} newBaseName - The new base name to compare
 * @returns {boolean} - Whether the base names match
 */
export const checkBaseNameMatch = (storedBaseName, newBaseName) => {
  return storedBaseName === newBaseName;
};
