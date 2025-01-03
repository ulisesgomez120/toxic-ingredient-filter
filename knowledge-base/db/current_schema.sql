

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_event_processed"("event_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."check_event_processed"("event_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_event_processed"("event_id" "text") IS 'Securely checks if a subscription event has already been processed';



CREATE OR REPLACE FUNCTION "public"."get_subscription_tier"("user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'tier_id', st.id,
        'tier_name', st.name,
        'features', st.features,
        'status', us.status,
        'current_period_end', us.current_period_end
    ) INTO result
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.subscription_tier_id = st.id
    WHERE us.user_id = $1
    AND us.status = 'active';
    
    RETURN result;
END;
$_$;


ALTER FUNCTION "public"."get_subscription_tier"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("p_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_user_id_by_email"("p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_id_by_email"("p_email" "text") IS 'Get user ID from auth.users by email address';



CREATE OR REPLACE FUNCTION "public"."get_user_subscription_status"("p_user_id" "uuid") RETURNS TABLE("subscription_tier" character varying, "is_active" boolean, "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_subscription_status"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_active_subscription"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_subscriptions
        WHERE user_subscriptions.user_id = $1
        AND status = 'active'
        AND current_period_end > NOW()
    );
END;
$_$;


ALTER FUNCTION "public"."has_active_subscription"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_retry_count"("event_id" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE subscription_events
    SET retry_count = retry_count + 1
    WHERE stripe_event_id = event_id
    RETURNING retry_count INTO new_count;
    
    RETURN new_count;
END;
$$;


ALTER FUNCTION "public"."increment_retry_count"("event_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_subscription_event"("event_id" "text", "event_type" "text", "event_data" "jsonb", "subscription_id" "uuid" DEFAULT NULL::"uuid", "customer_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."log_subscription_event"("event_id" "text", "event_type" "text", "event_data" "jsonb", "subscription_id" "uuid", "customer_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_subscription_event"("event_id" "text", "event_type" "text", "event_data" "jsonb", "subscription_id" "uuid", "customer_id" "text") IS 'Securely logs a subscription event with proper access control';



CREATE OR REPLACE FUNCTION "public"."log_subscription_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        INSERT INTO subscription_status_history
            (user_subscription_id, previous_status, new_status)
        VALUES
            (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_subscription_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_text"("input_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    RETURN lower(regexp_replace(
        regexp_replace(
            regexp_replace(
                COALESCE(input_text, ''),
                '[®™]', '', 'g'
            ),
            '[^a-zA-Z0-9\s-]', '', 'g'
        ),
        '\s+', ' ', 'g'
    ));
END;
$$;


ALTER FUNCTION "public"."normalize_text"("input_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.find_or_create_product_group(
  p_ingredients text,
  p_toxin_flags jsonb DEFAULT NULL
) RETURNS TABLE (
  product_group_id integer,
  ingredients_id integer
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing record;
  v_group_id integer;
  v_ingredients_id integer;
BEGIN
  -- First try to find existing group by ingredients hash
  -- The hash will be generated automatically by the database
  SELECT pgi.product_group_id, pgi.id INTO v_existing
  FROM product_group_ingredients pgi
  WHERE pgi.ingredients_hash = encode(sha256(p_ingredients::bytea), 'hex')
  AND pgi.is_current = true;
  
  IF FOUND THEN
    -- Update verification count
    UPDATE product_group_ingredients
    SET verification_count = verification_count + 1,
        found_at = NOW()
    WHERE id = v_existing.id;
    
    RETURN QUERY SELECT v_existing.product_group_id, v_existing.id;
    RETURN;
  END IF;

  -- If not found, create new group and ingredients atomically
  INSERT INTO product_groups DEFAULT VALUES
  RETURNING id INTO v_group_id;

  -- Create ingredients entry
  -- ingredients_hash will be generated automatically
  INSERT INTO product_group_ingredients 
    (product_group_id, ingredients, is_current, verification_count, toxin_flags, found_at, created_at)
  VALUES 
    (v_group_id, p_ingredients, true, 1, p_toxin_flags, NOW(), NOW())
  RETURNING id INTO v_ingredients_id;

  -- Update product group with current ingredients
  UPDATE product_groups 
  SET current_ingredients_id = v_ingredients_id,
      updated_at = NOW()
  WHERE id = v_group_id;

  RETURN QUERY SELECT v_group_id, v_ingredients_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.find_or_create_product_group(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_product_group(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_product_group(text, jsonb) TO service_role;


CREATE OR REPLACE FUNCTION "public"."update_current_ingredients"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE product_groups
    SET current_ingredients_id = NEW.id
    WHERE id = NEW.product_group_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_current_ingredients"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_status"("p_event_id" "text", "p_status" "text", "p_error_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_event_status"("p_event_id" "text", "p_status" "text", "p_error_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_event_status"("p_event_id" "text", "p_status" "text", "p_error_message" "text") IS 'Securely updates the status of a subscription event';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."product_group_ingredients" (
    "id" integer NOT NULL,
    "product_group_id" integer,
    "ingredients" "text" NOT NULL,
    "is_current" boolean DEFAULT true,
    "found_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "verification_count" integer DEFAULT 1,
    "ingredients_hash" character varying(64) GENERATED ALWAYS AS ("encode"("sha256"(("ingredients")::"bytea"), 'hex'::"text")) STORED,
    "toxin_flags" "jsonb"
);


ALTER TABLE "public"."product_group_ingredients" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_group_ingredients" IS 'Stores ingredient history and toxin analysis results.';



COMMENT ON COLUMN "public"."product_group_ingredients"."toxin_flags" IS 'JSONB array of toxin information found in ingredients. Format: 
[{
    "name": "toxin name",
    "category": "toxin category",
    "concernLevel": "high/moderate/low",
    "healthEffects": ["effect1", "effect2"],
    "aliases": ["alias1", "alias2"]
}]';



CREATE TABLE IF NOT EXISTS "public"."product_groups" (
    "id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "current_ingredients_id" integer
);


ALTER TABLE "public"."product_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_groups" IS 'Groups products by matching ingredients. No longer stores brand/name info.';



CREATE TABLE IF NOT EXISTS "public"."product_listings" (
    "id" integer NOT NULL,
    "retailer_id" integer,
    "external_id" character varying(100) NOT NULL,
    "url_path" "text",
    "price_amount" numeric(10,2),
    "price_unit" character varying(20),
    "image_url" "text",
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "product_group_id" integer NOT NULL
);


ALTER TABLE "public"."product_listings" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_listings" IS 'Stores retailer-specific product information with direct link to ingredient groups.';



CREATE OR REPLACE VIEW "public"."current_product_ingredients" AS
 SELECT "pl"."retailer_id",
    "pl"."external_id",
    "pl"."url_path",
    "pl"."image_url",
    "pgi"."ingredients",
    "pgi"."ingredients_hash",
    "pgi"."toxin_flags",
    "pgi"."verification_count"
   FROM (("public"."product_listings" "pl"
     JOIN "public"."product_groups" "pg" ON (("pl"."product_group_id" = "pg"."id")))
     JOIN "public"."product_group_ingredients" "pgi" ON (("pg"."current_ingredients_id" = "pgi"."id")));


ALTER TABLE "public"."current_product_ingredients" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_group_ingredients_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."product_group_ingredients_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_group_ingredients_id_seq" OWNED BY "public"."product_group_ingredients"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."product_groups_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."product_groups_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_groups_id_seq" OWNED BY "public"."product_groups"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."product_listings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."product_listings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_listings_id_seq" OWNED BY "public"."product_listings"."id";



CREATE TABLE IF NOT EXISTS "public"."retailers" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "website" character varying(100) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."retailers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."retailers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."retailers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."retailers_id_seq" OWNED BY "public"."retailers"."id";



CREATE TABLE IF NOT EXISTS "public"."subscription_events" (
    "id" integer NOT NULL,
    "stripe_event_id" character varying(100),
    "event_type" character varying(100),
    "subscription_id" integer,
    "event_data" "jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "stripe_customer_id" character varying(100)
);


ALTER TABLE "public"."subscription_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."subscription_events_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."subscription_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."subscription_events_id_seq" OWNED BY "public"."subscription_events"."id";



CREATE TABLE IF NOT EXISTS "public"."subscription_status_history" (
    "id" integer NOT NULL,
    "user_subscription_id" integer,
    "previous_status" character varying(50) NOT NULL,
    "new_status" character varying(50) NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_status_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."subscription_status_history_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."subscription_status_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."subscription_status_history_id_seq" OWNED BY "public"."subscription_status_history"."id";



CREATE TABLE IF NOT EXISTS "public"."subscription_tiers" (
    "id" integer NOT NULL,
    "name" character varying(50) NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "stripe_price_id" character varying(100),
    "features" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_tiers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."subscription_tiers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."subscription_tiers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."subscription_tiers_id_seq" OWNED BY "public"."subscription_tiers"."id";



CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_tier_id" integer,
    "stripe_subscription_id" character varying(100),
    "stripe_customer_id" character varying(100),
    "status" character varying(50) NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "canceled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_subscriptions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."user_subscriptions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_subscriptions_id_seq" OWNED BY "public"."user_subscriptions"."id";



ALTER TABLE ONLY "public"."product_group_ingredients" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_group_ingredients_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_groups" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_groups_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_listings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_listings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."retailers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."retailers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."subscription_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."subscription_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."subscription_status_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."subscription_status_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."subscription_tiers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."subscription_tiers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_subscriptions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_subscriptions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_group_ingredients"
    ADD CONSTRAINT "product_group_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_groups"
    ADD CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_listings"
    ADD CONSTRAINT "product_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_listings"
    ADD CONSTRAINT "product_listings_retailer_id_external_id_key" UNIQUE ("retailer_id", "external_id");



ALTER TABLE ONLY "public"."retailers"
    ADD CONSTRAINT "retailers_name_website_key" UNIQUE ("name", "website");



ALTER TABLE ONLY "public"."retailers"
    ADD CONSTRAINT "retailers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."subscription_status_history"
    ADD CONSTRAINT "subscription_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_stripe_price_id_key" UNIQUE ("stripe_price_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_product_group_ingredients_current" ON "public"."product_group_ingredients" USING "btree" ("product_group_id", "is_current");



CREATE UNIQUE INDEX "idx_product_group_ingredients_unique_hash" ON "public"."product_group_ingredients" 
USING "btree" ("ingredients_hash") WHERE ("is_current" = true);

CREATE INDEX "idx_product_group_ingredients_toxin_flags" ON "public"."product_group_ingredients" USING "gin" ("toxin_flags");



CREATE UNIQUE INDEX "idx_product_group_ingredients_unique_current" ON "public"."product_group_ingredients" USING "btree" ("product_group_id", "ingredients_hash") WHERE ("is_current" = true);



CREATE INDEX "idx_product_groups_current_ingredients" ON "public"."product_groups" USING "btree" ("current_ingredients_id");



CREATE INDEX "idx_product_listings_external" ON "public"."product_listings" USING "btree" ("retailer_id", "external_id");



CREATE INDEX "idx_product_listings_group" ON "public"."product_listings" USING "btree" ("product_group_id");



CREATE INDEX "idx_product_listings_url" ON "public"."product_listings" USING "btree" ("retailer_id", "url_path");



CREATE INDEX "idx_subscription_events_status" ON "public"."subscription_events" USING "btree" ("status");



CREATE INDEX "idx_subscription_events_stripe_event_id" ON "public"."subscription_events" USING "btree" ("stripe_event_id");



CREATE INDEX "idx_subscription_events_subscription_id" ON "public"."subscription_events" USING "btree" ("subscription_id");



CREATE INDEX "idx_subscription_status_history_subscription_id" ON "public"."subscription_status_history" USING "btree" ("user_subscription_id");



CREATE INDEX "idx_user_subscriptions_status" ON "public"."user_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "subscription_status_change" AFTER UPDATE ON "public"."user_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."log_subscription_status_change"();



CREATE OR REPLACE TRIGGER "update_current_ingredients_trigger" AFTER INSERT OR UPDATE ON "public"."product_group_ingredients" FOR EACH ROW WHEN (("new"."is_current" = true)) EXECUTE FUNCTION "public"."update_current_ingredients"();



ALTER TABLE ONLY "public"."product_group_ingredients"
    ADD CONSTRAINT "product_group_ingredients_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "public"."product_groups"("id");



ALTER TABLE ONLY "public"."product_groups"
    ADD CONSTRAINT "product_groups_current_ingredients_id_fkey" FOREIGN KEY ("current_ingredients_id") REFERENCES "public"."product_group_ingredients"("id");



ALTER TABLE ONLY "public"."product_listings"
    ADD CONSTRAINT "product_listings_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "public"."product_groups"("id");



ALTER TABLE ONLY "public"."product_listings"
    ADD CONSTRAINT "product_listings_retailer_id_fkey" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id");



ALTER TABLE ONLY "public"."subscription_status_history"
    ADD CONSTRAINT "subscription_status_history_user_subscription_id_fkey" FOREIGN KEY ("user_subscription_id") REFERENCES "public"."user_subscriptions"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_subscription_tier_id_fkey" FOREIGN KEY ("subscription_tier_id") REFERENCES "public"."subscription_tiers"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Enable read access for all users" ON "public"."subscription_tiers" USING (true);



CREATE POLICY "Service role can manage subscriptions" ON "public"."user_subscriptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Subscription tiers are viewable by all users" ON "public"."subscription_tiers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can update their own subscription" ON "public"."user_subscriptions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscriptions" ON "public"."user_subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscription" ON "public"."user_subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscription events" ON "public"."subscription_events" FOR SELECT USING ((("subscription_id" IN ( SELECT "user_subscriptions"."id"
   FROM "public"."user_subscriptions"
  WHERE ("user_subscriptions"."user_id" = "auth"."uid"()))) OR (("stripe_customer_id")::"text" IN ( SELECT "user_subscriptions"."stripe_customer_id"
   FROM "public"."user_subscriptions"
  WHERE ("user_subscriptions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own subscription history" ON "public"."subscription_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_subscriptions"
  WHERE (("user_subscriptions"."id" = "subscription_status_history"."user_subscription_id") AND ("user_subscriptions"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."subscription_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."check_event_processed"("event_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_event_processed"("event_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_event_processed"("event_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_subscription_tier"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_subscription_tier"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_subscription_tier"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_subscription_status"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_subscription_status"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_subscription_status"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_subscription"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_active_subscription"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_active_subscription"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_retry_count"("event_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_retry_count"("event_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_retry_count"("event_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_subscription_event"("event_id" "text", "event_type" "text", "event_data" "jsonb", "subscription_id" "uuid", "customer_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_subscription_event"("event_id" "text", "event_type" "text", "event_data" "jsonb", "subscription_id" "uuid", "customer_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_subscription_event"("event_id" "text", "event_type" "text", "event_data" "jsonb", "subscription_id" "uuid", "customer_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_subscription_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_subscription_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_subscription_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_text"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text"("input_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_current_ingredients"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_current_ingredients"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_current_ingredients"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_status"("p_event_id" "text", "p_status" "text", "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_status"("p_event_id" "text", "p_status" "text", "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_status"("p_event_id" "text", "p_status" "text", "p_error_message" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."product_group_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."product_group_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."product_group_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."product_groups" TO "anon";
GRANT ALL ON TABLE "public"."product_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."product_groups" TO "service_role";



GRANT ALL ON TABLE "public"."product_listings" TO "anon";
GRANT ALL ON TABLE "public"."product_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."product_listings" TO "service_role";



GRANT ALL ON TABLE "public"."current_product_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."current_product_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."current_product_ingredients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_group_ingredients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_group_ingredients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_group_ingredients_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_groups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_groups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_groups_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_listings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_listings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_listings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."retailers" TO "anon";
GRANT ALL ON TABLE "public"."retailers" TO "authenticated";
GRANT ALL ON TABLE "public"."retailers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."retailers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."retailers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."retailers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_events" TO "anon";
GRANT ALL ON TABLE "public"."subscription_events" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."subscription_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subscription_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subscription_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_status_history" TO "anon";
GRANT ALL ON TABLE "public"."subscription_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_status_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."subscription_status_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subscription_status_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subscription_status_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tiers" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."subscription_tiers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subscription_tiers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subscription_tiers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_subscriptions_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
