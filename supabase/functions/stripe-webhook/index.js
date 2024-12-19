import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0";

// Initialize Stripe with the secret key from environment variable
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase client with service role key
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

console.log("Supabase URL:", supabaseUrl);
console.log("Service Role Key exists:", !!supabaseKey);

const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Webhook signing secret for verification
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function updateSubscriptionStatus(subscription, eventType = null) {
  if (!subscription.id) {
    throw new Error("Missing subscription ID");
  }

  console.log(`Updating subscription status for ID: ${subscription.id}`);
  console.log(`Event type: ${eventType}`);
  console.log("Subscription details:", JSON.stringify(subscription, null, 2));

  try {
    const newPriceId = subscription?.items?.data[0]?.price?.id;

    if (!newPriceId) {
      console.error("Could not find price ID in Stripe subscription object");
      throw new Error("Could not find price ID in Stripe subscription object");
    }

    // Get the current subscription from the database
    const { data: currentSubscription, error: fetchError } = await supabaseClient
      .from("user_subscriptions")
      .select("id, subscription_tier_id, status")
      .eq("stripe_subscription_id", subscription.id)
      .single();

    if (fetchError) {
      console.error("Error fetching current subscription:", fetchError);
      throw fetchError;
    }

    if (!currentSubscription) {
      console.error("Could not find current subscription in database");
      throw new Error("Could not find current subscription in database");
    }

    // Fetch the subscription tier from the database
    const { data: newTierData, error: tierError } = await supabaseClient
      .from("subscription_tiers")
      .select("id")
      .eq("stripe_price_id", newPriceId)
      .single();

    if (tierError || !newTierData) {
      console.error("Error finding subscription tier:", tierError);
      throw new Error(`No subscription tier found for price ID: ${newPriceId}`);
    }

    const newTierId = newTierData.id;

    const updates = {
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      updated_at: new Date(),
    };

    // Handle cancellation scenarios
    if (eventType === "customer.subscription.updated" && subscription.cancel_at_period_end) {
      console.log("Subscription marked for cancellation at period end");

      // Log cancellation event
      await supabaseClient.from("subscription_events").insert({
        user_subscription_id: currentSubscription.id,
        event_type: "cancellation_scheduled",
        details: {
          current_period_end: subscription.current_period_end,
        },
      });
    }

    if (eventType === "customer.subscription.deleted" || subscription.status === "canceled") {
      console.log("Subscription canceled");
      updates.status = "canceled";

      // Log cancellation event
      await supabaseClient.from("subscription_events").insert({
        user_subscription_id: currentSubscription.id,
        event_type: "subscription_canceled",
        details: {
          cancellation_reason: subscription.cancellation_details?.reason || "unknown",
        },
      });
    }

    if (currentSubscription.subscription_tier_id !== newTierId) {
      console.log(`Subscription tier changed from ${currentSubscription.subscription_tier_id} to ${newTierId}`);
      updates.subscription_tier_id = newTierId;
    }

    const { error: updateError } = await supabaseClient
      .from("user_subscriptions")
      .update(updates)
      .eq("stripe_subscription_id", subscription.id);

    if (updateError) {
      console.error("Error updating subscription:", updateError);
      throw updateError;
    }
    console.log("Successfully updated subscription status");
  } catch (error) {
    console.error("Failed to update subscription status:", error);
    throw new Error(`Failed to update subscription status: ${error.message}`);
  }
}

async function getUserIdByEmail(email) {
  if (!email) {
    throw new Error("Email is required to look up user ID");
  }

  console.log(`Looking up user ID for email: ${email}`);

  try {
    // Query the auth.users table directly using RPC
    const { data, error } = await supabaseClient.rpc("get_user_id_by_email", {
      p_email: email.toLowerCase(),
    });

    if (error) {
      console.error("Error finding user by email:", error);
      throw error;
    }

    if (!data) {
      throw new Error(`No user found with email: ${email}`);
    }

    console.log(`Found user ID: ${data}`);
    return data;
  } catch (error) {
    console.error("Error finding user by email:", error);
    throw new Error(`Failed to find user: ${error.message}`);
  }
}

async function createSubscriptionFromInvoice(invoice, subscription) {
  console.log("Creating subscription from invoice");
  console.log("Invoice:", JSON.stringify(invoice, null, 2));
  console.log("Subscription:", JSON.stringify(subscription, null, 2));

  const priceId = subscription?.plan?.id;
  if (!priceId) {
    console.error("Missing price ID in subscription plan");
    throw new Error("Missing price ID in subscription plan");
  }

  try {
    // Check if subscription already exists
    const { data: existingSub } = await supabaseClient
      .from("user_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscription.id)
      .single();

    if (existingSub) {
      console.log(`Subscription ${subscription.id} already exists, updating instead`);
      return await updateSubscriptionStatus(subscription);
    }

    // Get user ID from email
    const userId = await getUserIdByEmail(invoice.customer_email);

    // Debug: Check if we can access the subscription_tiers table at all
    console.log("Attempting to access subscription_tiers table...");

    // First try a simple count query
    const { count, error: countError } = await supabaseClient
      .from("subscription_tiers")
      .select("*", { count: "exact" });

    console.log("Count query result:", { count, error: countError });

    // Then try to get all tiers
    console.log("Fetching all subscription tiers...");
    const { data: allTiers, error: allTiersError } = await supabaseClient.from("subscription_tiers").select("*");

    console.log("All tiers query result:", {
      success: !allTiersError,
      tiersFound: allTiers?.length ?? 0,
      tiers: allTiers,
      error: allTiersError,
    });

    // Now try the specific tier lookup
    console.log(`Looking for subscription tier with stripe_price_id: ${priceId}`);
    const { data: tierData, error: tierError } = await supabaseClient
      .from("subscription_tiers")
      .select("*")
      .eq("stripe_price_id", priceId)
      .single();

    console.log("Specific tier query result:", {
      success: !tierError,
      tierFound: !!tierData,
      tier: tierData,
      error: tierError,
    });

    if (tierError || !tierData) {
      console.error("Error finding subscription tier:", tierError);
      throw new Error(`No subscription tier found for price ID: ${priceId}`);
    }

    console.log(`Found tier ID: ${tierData.id}, creating subscription record`);

    // Create the subscription record
    const { error } = await supabaseClient.from("user_subscriptions").insert({
      user_id: userId,
      subscription_tier_id: tierData.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: invoice.customer,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (error) {
      console.error("Error creating subscription record:", error);
      throw error;
    }
    console.log("Successfully created subscription record");

    // Log subscription creation event
    await supabaseClient.from("subscription_events").insert({
      user_subscription_id: (
        await supabaseClient
          .from("user_subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .single()
      ).data.id,
      event_type: "subscription_created",
      details: {
        tier_id: tierData.id,
        start_date: subscription.current_period_start,
      },
    });
  } catch (error) {
    console.error("Failed to create subscription:", error);
    throw new Error(`Failed to create subscription: ${error.message}`);
  }
}

async function handleInvoicePaid(invoice) {
  if (!invoice.subscription) {
    console.log("No subscription associated with invoice");
    return;
  }

  console.log(`Processing paid invoice for subscription: ${invoice.subscription}`);
  console.log("Invoice details:", JSON.stringify(invoice, null, 2));

  try {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

    // If this is a subscription creation invoice, create the subscription record
    if (invoice.billing_reason === "subscription_create") {
      await createSubscriptionFromInvoice(invoice, subscription);
    } else {
      // Otherwise just update the status
      await updateSubscriptionStatus(subscription);
    }

    console.log("Successfully processed invoice payment");
  } catch (error) {
    console.error("Failed to handle invoice payment:", error);
    throw new Error(`Failed to handle invoice payment: ${error.message}`);
  }
}

async function processEvent(event) {
  console.log(`Processing event type: ${event.type}`);

  const eventObject = event.data.object;

  switch (event.type) {
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      console.log(`Detected subscription ${event.type} event`);
      await updateSubscriptionStatus(eventObject, event.type);
      break;

    case "invoice.paid":
      console.log("Detected invoice paid event");
      await handleInvoicePaid(eventObject);
      break;

    default:
      console.log(`Skipping unhandled event type: ${event.type}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response("No signature", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const body = await req.text();
    console.log("Received webhook body:", body);

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
      console.log("Successfully verified webhook signature");
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await processEvent(event);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return new Response(
      JSON.stringify({
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Keep 200 to prevent Stripe retries
      }
    );
  }
});
