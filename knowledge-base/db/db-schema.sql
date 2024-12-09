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

CREATE TABLE product_group_ingredients (
    id SERIAL PRIMARY KEY,
    product_group_id INTEGER REFERENCES product_groups(id),
    ingredients TEXT NOT NULL,
    is_current BOOLEAN DEFAULT true,
    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verification_count INTEGER DEFAULT 1,
    -- Add hash column to detect duplicate ingredients
    ingredients_hash VARCHAR(64) GENERATED ALWAYS AS (encode(sha256(ingredients::bytea), 'hex')) STORED,
    -- New toxin flags column
    toxin_flags JSONB
);

-- Create a partial unique index instead of the WHERE clause in UNIQUE constraint
CREATE UNIQUE INDEX idx_product_group_ingredients_unique_current 
ON product_group_ingredients (product_group_id, ingredients_hash) 
WHERE is_current = true;



COMMENT ON COLUMN product_group_ingredients.toxin_flags IS 
'JSONB array of toxin information found in ingredients. Format: 
[{
    "name": "toxin name",
    "category": "toxin category",
    "concernLevel": "high/moderate/low",
    "healthEffects": ["effect1", "effect2"],
    "aliases": ["alias1", "alias2"]
}]';

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
CREATE INDEX idx_product_group_ingredients_toxin_flags ON product_group_ingredients USING gin (toxin_flags);
-- Initial retailer data for Instacart/Walmart
INSERT INTO retailers (name, website) VALUES ('Walmart', 'instacart');


-- Updated product_groups table to check only unique base_name

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


-- subscription stuff
-- Subscription related tables and policies for Supabase

-- Subscription tiers table
CREATE TABLE subscription_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stripe_price_id VARCHAR(100) UNIQUE,
    features JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name)
);

-- User subscriptions table
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    subscription_tier_id INTEGER REFERENCES subscription_tiers(id),
    stripe_subscription_id VARCHAR(100),
    stripe_customer_id VARCHAR(100),
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(stripe_subscription_id),
    UNIQUE(stripe_customer_id)
);

-- Subscription status history for auditing
CREATE TABLE subscription_status_history (
    id SERIAL PRIMARY KEY,
    user_subscription_id INTEGER REFERENCES user_subscriptions(id),
    previous_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_subscription_status_history_subscription_id ON subscription_status_history(user_subscription_id);

-- Row Level Security Policies

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_status_history ENABLE ROW LEVEL SECURITY;

-- Subscription tiers policies
CREATE POLICY "Subscription tiers are viewable by all users"
    ON subscription_tiers FOR SELECT
    TO authenticated
    USING (true);

-- User subscriptions policies
CREATE POLICY "Users can view their own subscription"
    ON user_subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
    ON user_subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Subscription history policies
CREATE POLICY "Users can view their own subscription history"
    ON subscription_status_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_subscriptions
            WHERE user_subscriptions.id = subscription_status_history.user_subscription_id
            AND user_subscriptions.user_id = auth.uid()
        )
    );

-- Functions

-- Function to check if a user has an active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_subscriptions
        WHERE user_subscriptions.user_id = $1
        AND status = 'active'
        AND current_period_end > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current subscription tier
CREATE OR REPLACE FUNCTION public.get_subscription_tier(user_id UUID)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'tier_id', st.id,
        'tier_name', st.name,
        'features', st.features,
        'status', us.status,
        'current_period_end', us.current_period_end
    ) INTO result
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.subscription_tier_id = st.id
    WHERE us.user_id = $1
    AND us.status = 'active';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initial Data: Subscription Tiers
INSERT INTO subscription_tiers (name, price, features) VALUES
(
    'Basic',
    1.99,
    '{
        "defaultIngredients": true,
        "customIngredients": false,
        "maxCustomIngredients": 0
    }'
),
(
    'Pro',
    3.99,
    '{
        "defaultIngredients": true,
        "customIngredients": true,
        "maxCustomIngredients": 50
    }'
);

-- Trigger for subscription status history
CREATE OR REPLACE FUNCTION log_subscription_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        INSERT INTO subscription_status_history
            (user_subscription_id, previous_status, new_status)
        VALUES
            (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_status_change
    AFTER UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION log_subscription_status_change();
