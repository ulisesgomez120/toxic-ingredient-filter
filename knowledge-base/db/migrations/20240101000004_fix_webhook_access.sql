-- Drop existing policies
DROP POLICY IF EXISTS "Service role access" ON subscription_events;
DROP POLICY IF EXISTS "Users can view their own subscription events" ON subscription_events;

-- Enable RLS
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view their own events
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

-- Create a secure function to log events
CREATE OR REPLACE FUNCTION log_subscription_event(
    event_id TEXT,
    event_type TEXT,
    event_data JSONB,
    subscription_id UUID DEFAULT NULL,
    customer_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO subscription_events (
        stripe_event_id,
        event_type,
        event_data,
        subscription_id,
        stripe_customer_id,
        status,
        retry_count,
        created_at
    ) VALUES (
        event_id,
        event_type,
        event_data,
        subscription_id,
        customer_id,
        'pending',
        0,
        NOW()
    );
END;
$$;

-- Create a secure function to update event status
CREATE OR REPLACE FUNCTION update_event_status(
    p_event_id TEXT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE subscription_events
    SET 
        status = p_status,
        error_message = p_error_message,
        processed_at = NOW(),
        retry_count = CASE 
            WHEN p_status = 'failed' 
            THEN retry_count + 1 
            ELSE retry_count 
        END
    WHERE stripe_event_id = p_event_id;
END;
$$;

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON subscription_events TO authenticated;
GRANT EXECUTE ON FUNCTION log_subscription_event TO service_role;
GRANT EXECUTE ON FUNCTION update_event_status TO service_role;
GRANT EXECUTE ON FUNCTION increment_retry_count TO service_role;

-- Comment on functions
COMMENT ON FUNCTION log_subscription_event IS 'Securely logs a subscription event with proper access control';
COMMENT ON FUNCTION update_event_status IS 'Securely updates the status of a subscription event';
