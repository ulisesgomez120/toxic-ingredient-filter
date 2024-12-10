CREATE OR REPLACE FUNCTION get_user_subscription_status(user_id UUID)
RETURNS TABLE (
    subscription_tier TEXT,
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
    JOIN subscription_tiers st ON us.tier_id = st.id
    WHERE us.user_id = user_id
    AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;