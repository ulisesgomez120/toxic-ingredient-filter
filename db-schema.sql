-- We have a postgres db in supabase.com

-- Stores that we scrape from
CREATE TABLE retailers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    website VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product groups for variants
CREATE TABLE product_groups (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100),
    base_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_group_id INTEGER REFERENCES product_groups(id),
    name VARCHAR(255) NOT NULL,
    base_unit VARCHAR(50),
    size VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shared ingredients at product group level
CREATE TABLE product_group_ingredients (
    id SERIAL PRIMARY KEY,
    product_group_id INTEGER REFERENCES product_groups(id),
    ingredients TEXT NOT NULL,
    is_current BOOLEAN DEFAULT true,
    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verification_count INTEGER DEFAULT 1
);

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
    hash VARCHAR(64)
);

-- Product attributes
CREATE TABLE product_attributes (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    retailer_id INTEGER REFERENCES retailers(id),
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    is_current BOOLEAN DEFAULT true,
    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_product_listings_external ON product_listings(retailer_id, external_id);
CREATE INDEX idx_product_listings_url ON product_listings(retailer_id, url_path);
CREATE INDEX idx_product_group_ingredients_current ON product_group_ingredients(product_group_id, is_current);
CREATE INDEX idx_product_attributes_current ON product_attributes(product_id, retailer_id, key, is_current);
CREATE INDEX idx_ingredient_verifications_product ON ingredient_verifications(product_group_id);

-- Initial retailer data for Instacart/Walmart
INSERT INTO retailers (name, website) VALUES ('Walmart', 'instacart');