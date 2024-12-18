-- Create subscription events table for logging and idempotency
CREATE TABLE subscription_events (
    id SERIAL PRIMARY KEY,
    stripe_event_id VARCHAR(100) UNIQUE,
    event_type VARCHAR(100),
    subscription_id INTEGER REFERENCES user_subscriptions(id),
    event_data JSONB,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_subscription_events_stripe_event_id ON subscription_events(stripe_event_id);
CREATE INDEX idx_subscription_events_status ON subscription_events(status);
CREATE INDEX idx_subscription_events_subscription_id ON subscription_events(subscription_id);

-- Add RLS policies
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Only allow system level access (no direct user access)
CREATE POLICY "System level access only"
    ON subscription_events
    USING (false);

-- Function to check if an event has been processed
CREATE OR REPLACE FUNCTION check_event_processed(event_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM subscription_events 
        WHERE stripe_event_id = event_id 
        AND status = 'completed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
