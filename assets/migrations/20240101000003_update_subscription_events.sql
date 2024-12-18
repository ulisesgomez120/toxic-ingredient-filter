-- Make subscription_id optional
ALTER TABLE subscription_events 
ALTER COLUMN subscription_id DROP NOT NULL;

-- Add customer_id column for events that don't have a subscription yet
ALTER TABLE subscription_events
ADD COLUMN stripe_customer_id VARCHAR(100);

-- Update RLS policies
DROP POLICY IF EXISTS "Service role access" ON subscription_events;
DROP POLICY IF EXISTS "Users can view their own subscription events" ON subscription_events;

-- Allow service role full access
CREATE POLICY "Service role access"
    ON subscription_events
    USING (auth.role() = 'service_role');

-- Allow users to view events related to their subscriptions or customer ID
CREATE POLICY "Users can view their own subscription events"
    ON subscription_events
    FOR SELECT
    USING (
        (
            -- Events linked to user's subscription
            subscription_id IN (
                SELECT id 
                FROM user_subscriptions 
                WHERE user_id = auth.uid()
            )
        ) OR (
            -- Events linked to user's customer ID
            stripe_customer_id IN (
                SELECT stripe_customer_id 
                FROM user_subscriptions 
                WHERE user_id = auth.uid()
            )
        )
    );
