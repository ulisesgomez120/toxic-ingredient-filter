-- We have a postgres db in supabase.com

-- Stores that we scrape from
CREATE TABLE retailers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    website VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, website)
);

-- Product groups for variants
CREATE TABLE product_groups (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100),
    base_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Add unique constraint on brand + base_name to prevent duplicates
    UNIQUE(brand, base_name)
);

-- Product variants
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_group_id INTEGER REFERENCES product_groups(id),
    name VARCHAR(255) NOT NULL,
    base_unit VARCHAR(50),
    size VARCHAR(50),
    nutrition JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Add unique constraint on product_group_id + name to prevent duplicate variants
    UNIQUE(product_group_id, name)
);

-- Shared ingredients at product group level with versioning
CREATE TABLE product_group_ingredients (
    id SERIAL PRIMARY KEY,
    product_group_id INTEGER REFERENCES product_groups(id),
    ingredients TEXT NOT NULL,
    is_current BOOLEAN DEFAULT true,
    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verification_count INTEGER DEFAULT 1,
    -- Add hash column to detect duplicate ingredients
    ingredients_hash VARCHAR(64) GENERATED ALWAYS AS (encode(sha256(ingredients::bytea), 'hex')) STORED
);

-- Create a partial unique index instead of the WHERE clause in UNIQUE constraint
CREATE UNIQUE INDEX idx_product_group_ingredients_unique_current 
ON product_group_ingredients (product_group_id, ingredients_hash) 
WHERE is_current = true;

-- Retailer-specific product listings
CREATE TABLE product_listings (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    retailer_id INTEGER REFERENCES retailers(id),
    external_id VARCHAR(100) NOT NULL,
    url_path TEXT,
    price_amount DECIMAL(10,2),
    price_unit VARCHAR(20),
    image_url TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(retailer_id, external_id)
);

-- Track ingredient verification sources
CREATE TABLE ingredient_verifications (
    id SERIAL PRIMARY KEY,
    product_group_id INTEGER REFERENCES product_groups(id),
    retailer_id INTEGER REFERENCES retailers(id),
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    hash VARCHAR(64),
    UNIQUE(product_group_id, retailer_id, hash)
);

-- Create indexes
CREATE INDEX idx_product_listings_external ON product_listings(retailer_id, external_id);
CREATE INDEX idx_product_listings_url ON product_listings(retailer_id, url_path);
CREATE INDEX idx_product_group_ingredients_current ON product_group_ingredients(product_group_id, is_current);
CREATE INDEX idx_product_group_ingredients_hash ON product_group_ingredients(ingredients_hash) WHERE is_current = true;

-- Initial retailer data for Instacart/Walmart
INSERT INTO retailers (name, website) VALUES ('Walmart', 'instacart');
