-- Grant necessary permissions for subscription_tiers table
GRANT ALL ON subscription_tiers TO service_role;
GRANT USAGE ON SEQUENCE subscription_tiers_id_seq TO service_role;

-- Verify the initial data is present
DO $$
BEGIN
    -- Check if Basic tier exists
    IF NOT EXISTS (SELECT 1 FROM subscription_tiers WHERE name = 'Basic') THEN
        -- Insert Basic tier if missing
        INSERT INTO subscription_tiers (name, price, stripe_price_id, features) VALUES
        (
            'Basic',
            1.99,
            'prod_RKqNhsUp0RFltH',
            '{
                "defaultIngredients": true,
                "customIngredients": false,
                "maxCustomIngredients": 0
            }'
        );
    END IF;
END $$;
