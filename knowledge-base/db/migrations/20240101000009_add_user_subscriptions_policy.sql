-- Enable RLS on user_subscriptions table if not already enabled
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy for service role to manage subscriptions
CREATE POLICY "Service role can manage subscriptions"
ON user_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
ON user_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Grant necessary permissions to service role
GRANT ALL ON user_subscriptions TO service_role;
