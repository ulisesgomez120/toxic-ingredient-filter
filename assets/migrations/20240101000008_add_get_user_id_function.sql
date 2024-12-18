-- Create function to get user ID by email
CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email TEXT)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Run with privileges of function creator
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Look up user ID in auth.users table
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    -- Raise exception if user not found
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', p_email;
    END IF;

    RETURN v_user_id;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO service_role;

-- Add comment explaining function
COMMENT ON FUNCTION get_user_id_by_email(TEXT) IS 'Get user ID from auth.users by email address';
