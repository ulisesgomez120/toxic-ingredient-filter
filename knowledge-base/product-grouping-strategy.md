# Product Grouping Strategy

## Current Issues

1. The current approach tries to group products by normalizing names and brands, which leads to:

   - Inconsistent grouping across retailers
   - Duplicate entries for the same product
   - Missed matches for products with different names but same ingredients

2. The database schema shows the true intent:
   - Product groups are meant to track products with the same ingredients
   - The ingredients_hash column is used to uniquely identify ingredient combinations
   - Toxin flags are associated with ingredient groups, not product names

## Proposed Solution

### 1. Ingredient-First Approach

Instead of trying to match products by name, we should:

1. First get the ingredients for a product
2. Generate an ingredients_hash
3. Look up existing product groups with matching ingredients
4. Only create a new product group if no matching ingredients found

### 2. Database Flow

```sql
-- Example flow for handling a new product
WITH ingredient_match AS (
  SELECT pg.id as group_id
  FROM product_groups pg
  JOIN product_group_ingredients pgi ON pg.id = pgi.product_group_id
  WHERE pgi.ingredients_hash = sha256(new_ingredients)
  AND pgi.is_current = true
  LIMIT 1
)
INSERT INTO product_groups (brand, base_name)
SELECT new_brand, new_base_name
WHERE NOT EXISTS (SELECT 1 FROM ingredient_match);
```

### 3. Implementation Steps

1. Modify Product Loading:

   ```javascript
   async function saveProduct(productData) {
     // 1. First get ingredients from product page
     const ingredients = await extractIngredients(productData.url);

     // 2. Find or create product group based on ingredients
     const productGroup = await findOrCreateProductGroupByIngredients(ingredients);

     // 3. Create product variant
     const product = await createProductVariant(productGroup.id, productData);

     // 4. Create product listing
     await createProductListing(product.id, productData);
   }
   ```

2. Ingredient Matching:

   ```javascript
   async function findOrCreateProductGroupByIngredients(ingredients) {
     // 1. Generate ingredients hash
     const hash = generateIngredientsHash(ingredients);

     // 2. Look for existing group with matching ingredients
     const existingGroup = await findGroupByIngredientsHash(hash);
     if (existingGroup) return existingGroup;

     // 3. If no match, create new group
     return await createNewProductGroup(ingredients);
   }
   ```

3. Handle Ingredient Updates:
   ```javascript
   async function updateProductIngredients(productId, newIngredients) {
     // 1. Get current product group
     const currentGroup = await getProductGroup(productId);

     // 2. Check if ingredients actually changed
     if (await ingredientsMatch(currentGroup.id, newIngredients)) {
       return currentGroup;
     }

     // 3. Find or create appropriate group for new ingredients
     const newGroup = await findOrCreateProductGroupByIngredients(newIngredients);

     // 4. Move product to new group
     await moveProductToGroup(productId, newGroup.id);
   }
   ```

### 4. Benefits

1. More Accurate Grouping:

   - Products with same ingredients are grouped together regardless of name
   - Different formulations of similar products are properly separated
   - Handles retailer-specific naming conventions

2. Better Toxin Analysis:

   - Toxin flags are consistently applied to all products with same ingredients
   - Changes in formulation are properly tracked
   - Reduces duplicate analysis of same ingredients

3. Improved Data Quality:
   - Ingredient changes are properly tracked over time
   - Product variants are correctly associated
   - Cross-retailer product matching is more accurate

### 5. Implementation Notes

1. Ingredient Normalization:

   - Standardize ingredient formatting
   - Handle common variations in ingredient names
   - Remove irrelevant information (percentages, etc.)

2. Hash Generation:

   - Use consistent ingredient ordering
   - Remove whitespace and punctuation
   - Consider using a fuzzy matching algorithm for ingredients

3. Performance:
   - Index ingredient hashes
   - Batch ingredient lookups
   - Cache common ingredient combinations

## Next Steps

1. Create an ingredient normalization service
2. Implement fuzzy matching for ingredients
3. Add ingredient validation and cleanup
4. Create migration plan for existing data
5. Add monitoring for grouping accuracy

This approach aligns with the database schema and provides a more accurate way to group products based on their actual contents rather than just their names.
