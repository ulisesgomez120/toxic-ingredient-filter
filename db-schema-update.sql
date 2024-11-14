-- Update product_groups table to check only unique base_name

-- Add normalized_base_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT column_name 
                   FROM information_schema.columns 
                   WHERE table_name='product_groups' AND column_name='normalized_base_name') THEN
        ALTER TABLE product_groups 
        ADD COLUMN normalized_base_name VARCHAR(255) GENERATED ALWAYS AS (
            lower(
                regexp_replace(
                    regexp_replace(base_name, '[®™]', '', 'g'),  -- Remove trademark symbols
                    '[^a-z0-9\s-]', '', 'g'  -- Remove special characters
                )
            )
        ) STORED;
    END IF;
END $$;

-- Drop existing unique constraint on (brand, base_name)
DO $$
BEGIN
    IF EXISTS (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'product_groups' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name = 'product_groups_brand_base_name_key'
    ) THEN
        ALTER TABLE product_groups 
        DROP CONSTRAINT product_groups_brand_base_name_key;
    END IF;
END $$;

-- Create unique constraint on normalized_base_name
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'product_groups' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name = 'product_groups_normalized_base_name_unique'
    ) THEN
        ALTER TABLE product_groups 
        ADD CONSTRAINT product_groups_normalized_base_name_unique UNIQUE (normalized_base_name);
    END IF;
END $$;

-- Create an index for faster lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'product_groups' 
        AND indexname = 'idx_product_groups_normalized_base_name'
    ) THEN
        CREATE INDEX idx_product_groups_normalized_base_name 
        ON product_groups (normalized_base_name);
    END IF;
END $$;
