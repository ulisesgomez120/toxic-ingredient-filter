CREATE POLICY "Enable read access for all users"
ON "public"."subscription_tiers"
TO public
USING (
   true
);