import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers });
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("No authorization header", { status: 401, headers });
    }

    // Get the JWT token
    const token = authHeader.replace("Bearer ", "");

    // Verify the JWT token
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response("Invalid token", { status: 401, headers });
    }

    const { type, ...body } = await req.json();

    switch (type) {
      case "get_payment_link": {
        const { tierId } = body;

        // Get the payment link for the selected tier
        const { data: tier, error: tierError } = await supabaseClient
          .from("subscription_tiers")
          .select("payment_link")
          .eq("id", tierId)
          .single();

        if (tierError || !tier) {
          return new Response(JSON.stringify({ error: "Subscription tier not found" }), {
            status: 404,
            headers: { ...headers, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ url: tier.payment_link }), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      case "get_portal_link": {
        // Get the user's subscription
        const { data: subscription, error: subError } = await supabaseClient
          .from("user_subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .single();

        if (subError || !subscription) {
          return new Response(JSON.stringify({ error: "No active subscription found" }), {
            status: 404,
            headers: { ...headers, "Content-Type": "application/json" },
          });
        }

        // For now, return null as we'll implement the customer portal later if needed
        return new Response(JSON.stringify({ url: null }), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid type" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
