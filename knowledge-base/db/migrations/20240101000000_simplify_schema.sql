-- Drop unnecessary tables and constraints
DROP TABLE IF EXISTS "public"."products" CASCADE;

-- Remove product_id from product_listings since we're removing products table
ALTER TABLE "public"."product_listings" DROP COLUMN "product_id";

-- Remove unnecessary fields from product_groups
ALTER TABLE "public"."product_groups" 
  DROP COLUMN "normalized_brand",
  DROP COLUMN "normalized_base_name",
  DROP COLUMN "brand",
  DROP COLUMN "base_name";

-- Drop related constraints and triggers
DROP TRIGGER IF EXISTS "product_groups_normalize_trigger" ON "public"."product_groups";
DROP FUNCTION IF EXISTS "public"."update_normalized_columns";

-- Add direct connection between product_listings and product_groups
ALTER TABLE "public"."product_listings" 
  ADD COLUMN "product_group_id" integer REFERENCES "public"."product_groups"("id");

-- Update product_groups to be ingredient-focused
ALTER TABLE "public"."product_groups" 
  ADD COLUMN "current_ingredients_id" integer REFERENCES "public"."product_group_ingredients"("id");

-- Add indexes for performance
CREATE INDEX "idx_product_listings_group" ON "public"."product_listings" ("product_group_id");
CREATE INDEX "idx_product_groups_current_ingredients" ON "public"."product_groups" ("current_ingredients_id");

-- Add migration note
COMMENT ON TABLE "public"."product_groups" IS 'Groups products by matching ingredients. No longer stores brand/name info.';
COMMENT ON TABLE "public"."product_listings" IS 'Stores retailer-specific product information with direct link to ingredient groups.';
COMMENT ON TABLE "public"."product_group_ingredients" IS 'Stores ingredient history and toxin analysis results.';


-- Add not null constraints after data migration
ALTER TABLE "public"."product_listings" 
  ALTER COLUMN "product_group_id" SET NOT NULL;

-- Add function to update current_ingredients_id
CREATE OR REPLACE FUNCTION update_current_ingredients() RETURNS trigger AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE product_groups
    SET current_ingredients_id = NEW.id
    WHERE id = NEW.product_group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_current_ingredients_trigger
AFTER INSERT OR UPDATE ON product_group_ingredients
FOR EACH ROW
WHEN (NEW.is_current = true)
EXECUTE FUNCTION update_current_ingredients();

-- Add helpful views
CREATE OR REPLACE VIEW current_product_ingredients AS
SELECT 
  pl.retailer_id,
  pl.external_id,
  pl.url_path,
  pl.image_url,
  pgi.ingredients,
  pgi.ingredients_hash,
  pgi.toxin_flags,
  pgi.verification_count
FROM product_listings pl
JOIN product_groups pg ON pl.product_group_id = pg.id
JOIN product_group_ingredients pgi ON pg.current_ingredients_id = pgi.id;
