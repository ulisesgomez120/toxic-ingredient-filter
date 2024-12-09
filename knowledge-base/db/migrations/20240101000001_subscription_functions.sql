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
