-- Add auth and subscription tables

-- Users table for authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    tier TEXT NOT NULL CHECK (tier IN ('basic', 'pro')),
    status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription history for auditing
CREATE TABLE subscription_events (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    subscription_id UUID REFERENCES subscriptions(id),
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscription_events_subscription ON subscription_events(subscription_id);

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY users_read_own ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Users can only read their own subscriptions
CREATE POLICY subscriptions_read_own ON subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only service role can insert/update subscription data
CREATE POLICY subscriptions_service_write ON subscriptions
    FOR ALL
    USING (auth.role() = 'service_role');

-- Function to check if a user has an active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM subscriptions 
        WHERE user_id = user_uuid 
        AND status = 'active' 
        AND current_period_end > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's subscription tier
CREATE OR REPLACE FUNCTION public.get_subscription_tier(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT tier 
        FROM subscriptions 
        WHERE user_id = user_uuid 
        AND status = 'active' 
        AND current_period_end > NOW()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
