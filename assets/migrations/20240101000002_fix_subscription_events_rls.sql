-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "System level access only" ON subscription_events;

-- Create new policy that allows service role access
CREATE POLICY "Service role access"
    ON subscription_events
    USING (auth.role() = 'service_role');

-- Create policy for authenticated users to view their own subscription events
CREATE POLICY "Users can view their own subscription events"
    ON subscription_events
    FOR SELECT
    USING (
        auth.uid() = (
            SELECT user_id 
            FROM user_subscriptions 
            WHERE id = subscription_events.subscription_id
        )
    );

-- Function to increment retry count
CREATE OR REPLACE FUNCTION increment_retry_count(event_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE subscription_events
    SET retry_count = retry_count + 1
    WHERE stripe_event_id = event_id
    RETURNING retry_count INTO new_count;
    
    RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
