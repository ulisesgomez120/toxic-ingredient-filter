-- Update the check_event_processed function to be security definer
CREATE OR REPLACE FUNCTION check_event_processed(event_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM subscription_events 
        WHERE stripe_event_id = event_id 
        AND status = 'completed'
    ) INTO event_exists;
    
    RETURN event_exists;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION check_event_processed TO service_role;

-- Comment on function
COMMENT ON FUNCTION check_event_processed IS 'Securely checks if a subscription event has already been processed';
