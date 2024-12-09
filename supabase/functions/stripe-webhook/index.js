import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0";

// Initialize Stripe with the secret key from environment variable
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Webhook signing secret for verification
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// Maximum number of retries for failed events
const MAX_RETRIES = 3;

async function logEvent(eventData) {
  const { error } = await supabaseClient.from("subscription_events").insert(eventData);

  if (error) {
    console.error("Error logging event:", error);
    throw error;
  }
}

async function updateEventStatus(eventId, status, errorMessage) {
  const { error } = await supabaseClient
    .from("subscription_events")
    .update({
      status,
      error_message: errorMessage,
      processed_at: new Date(),
      ...(status === "failed" && { retry_count: supabaseClient.rpc("increment_retry_count", { event_id: eventId }) }),
    })
    .eq("stripe_event_id", eventId);

  if (error) {
    console.error("Error updating event status:", error);
    throw error;
  }
}

async function checkEventProcessed(eventId) {
  const { data, error } = await supabaseClient.rpc("check_event_processed", { event_id: eventId });

  if (error) {
    console.error("Error checking event status:", error);
    throw error;
  }

  return !!data;
}

async function updateSubscriptionStatus(subscription) {
  const { error } = await supabaseClient
    .from("user_subscriptions")
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      updated_at: new Date(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Error updating subscription:", error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription) {
  // Get the price ID to determine the subscription tier
  const priceId = subscription.items.data[0].price.id;

  // Get the subscription tier ID based on the Stripe price ID
  const { data: tierData, error: tierError } = await supabaseClient
    .from("subscription_tiers")
    .select("id")
    .eq("stripe_price_id", priceId)
    .single();

  if (tierError || !tierData) {
    console.error("Error finding subscription tier:", tierError);
    throw tierError;
  }

  // Create new subscription record
  const { error } = await supabaseClient.from("user_subscriptions").insert({
    user_id: subscription.metadata.user_id,
    subscription_tier_id: tierData.id,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
  });

  if (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

async function handleTrialEnding(subscription) {
  // Notify user about trial ending (implement notification system later)
  console.log(`Trial ending for subscription: ${subscription.id}`);
  await updateSubscriptionStatus(subscription);
}

async function handlePaymentFailed(invoice) {
  if (!invoice.subscription) return;

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

  // Update subscription status
  await updateSubscriptionStatus(subscription);

  // TODO: Implement notification system for failed payments
  console.log(`Payment failed for subscription: ${subscription.id}`);
}

async function handleInvoicePaid(invoice) {
  if (!invoice.subscription) return;

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

  // Update subscription status
  await updateSubscriptionStatus(subscription);
}

async function processEvent(event) {
  try {
    // Log event start
    await logEvent({
      stripe_event_id: event.id,
      event_type: event.type,
      event_data: event.data.object,
      status: "pending",
      retry_count: 0,
    });

    // Handle the event based on type
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await updateSubscriptionStatus(event.data.object);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialEnding(event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
        return;
    }

    // Log successful completion
    await updateEventStatus(event.id, "completed");
  } catch (error) {
    console.error(`Error processing event ${event.id}:`, error);

    // Log failure
    await updateEventStatus(event.id, "failed", error instanceof Error ? error.message : "Unknown error");

    // Rethrow if we haven't exceeded retry limit
    const { data } = await supabaseClient
      .from("subscription_events")
      .select("retry_count")
      .eq("stripe_event_id", event.id)
      .single();

    if (data && data.retry_count < MAX_RETRIES) {
      throw error;
    }
  }
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Get the stripe signature from the headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("No signature", { status: 400 });
    }

    // Get the raw body
    const body = await req.text();

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`Webhook signature verification failed:`, errorMessage);
      return new Response(`Webhook signature verification failed: ${errorMessage}`, { status: 400 });
    }

    // Check if event was already processed
    const isProcessed = await checkEventProcessed(event.id);
    if (isProcessed) {
      return new Response(JSON.stringify({ received: true, status: "already processed" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Process the event
    await processEvent(event);

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);

    // Return 500 for server errors, but 200 for known processing errors
    // This prevents Stripe from retrying webhooks that we're already handling
    const status = error instanceof Error && error.message.includes("signature verification failed") ? 500 : 200;

    return new Response(
      JSON.stringify({
        error: "Error processing webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status,
      }
    );
  }
});
