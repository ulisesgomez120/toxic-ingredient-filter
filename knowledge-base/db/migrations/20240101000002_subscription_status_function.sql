-- Function to get user's current subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(p_user_id UUID)
RETURNS TABLE (
    subscription_tier VARCHAR(50),
    is_active BOOLEAN,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.name as subscription_tier,
        us.status = 'active' as is_active,
        us.current_period_end as expires_at
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.subscription_tier_id = st.id
    WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND us.current_period_end > NOW()
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_subscription_status TO authenticated;
