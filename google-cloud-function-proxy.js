// Node 20
// url: https://proxy-429279015209.us-central1.run.app
// function entry point: tiProxy

const functions = require("@google-cloud/functions-framework");
const corsLib = require("cors");
const cors = corsLib({ origin: true });
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const EXTENSION_KEY = process.env.EXTENSION_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY);

// Cache for subscription status (in-memory, consider using Redis for production)
const subscriptionCache = new Map();

// Verify auth token and subscription status
async function verifyAccess(authToken) {
  if (!authToken) {
    throw new Error("No auth token provided");
  }

  // Verify JWT with Supabase
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(authToken);
  if (error || !user) {
    throw new Error("Invalid auth token");
  }

  // Check subscription cache first
  const cachedStatus = subscriptionCache.get(user.id);
  if (cachedStatus && cachedStatus.expiresAt > Date.now()) {
    return cachedStatus;
  }

  // Query subscription status
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (subError) {
    throw new Error("Error checking subscription");
  }

  if (!subscription || new Date(subscription.current_period_end) < new Date()) {
    throw new Error("No active subscription");
  }

  // Cache subscription status for 1 hour
  const status = {
    userId: user.id,
    tier: subscription.tier,
    expiresAt: Date.now() + 3600000, // 1 hour
  };
  subscriptionCache.set(user.id, status);

  return status;
}

// Handle Stripe webhook events
async function handleStripeWebhook(event) {
  const subscription = event.data.object;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await supabase.from("subscriptions").upsert({
        stripe_subscription_id: subscription.id,
        user_id: subscription.metadata.user_id,
        tier: subscription.metadata.tier,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        updated_at: new Date(),
      });

      // Log subscription event
      await supabase.from("subscription_events").insert({
        subscription_id: subscription.id,
        event_type: event.type,
        event_data: event.data.object,
      });
      break;

    case "customer.subscription.deleted":
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date() })
        .eq("stripe_subscription_id", subscription.id);

      // Log subscription cancellation
      await supabase.from("subscription_events").insert({
        subscription_id: subscription.id,
        event_type: event.type,
        event_data: event.data.object,
      });
      break;
  }

  // Clear cache for the user
  if (subscription.metadata.user_id) {
    subscriptionCache.delete(subscription.metadata.user_id);
  }
}

// Create Stripe checkout session
async function createCheckoutSession(userId, tier) {
  const prices = {
    basic: process.env.STRIPE_BASIC_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: prices[tier],
        quantity: 1,
      },
    ],
    success_url: `${process.env.EXTENSION_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.EXTENSION_URL}/cancel`,
    metadata: {
      user_id: userId,
      tier: tier,
    },
  });

  return session;
}

// Main function handler
functions.http("tiProxy", async (req, res) => {
  cors(req, res, async () => {
    try {
      // Handle Stripe webhooks
      if (req.path === "/webhook") {
        const sig = req.headers["stripe-signature"];
        try {
          const event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
          await handleStripeWebhook(event);
          res.json({ received: true });
        } catch (err) {
          res.status(400).json({ error: err.message });
        }
        return;
      }

      // Handle subscription creation
      if (req.path === "/create-checkout-session") {
        const { userId, tier } = req.body;
        if (!userId || !tier) {
          res.status(400).json({ error: "Missing required parameters" });
          return;
        }

        try {
          const session = await createCheckoutSession(userId, tier);
          res.json({ sessionId: session.id });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
        return;
      }

      // Verify extension key for all other requests
      const extensionKey = req.headers["x-extension-key"];
      if (!extensionKey || extensionKey !== EXTENSION_KEY) {
        res.status(401).json({ error: "Unauthorized extension" });
        return;
      }

      // Verify auth token and subscription
      const authToken = req.headers["authorization"]?.split("Bearer ")[1];
      const access = await verifyAccess(authToken);

      // Forward request to Supabase with auth context
      const supabasePath = req.path;
      const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";

      const response = await fetch(`${SUPABASE_URL}${supabasePath}${queryString}`, {
        method: req.method,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
          Prefer: req.headers["prefer"] || "",
          "X-User-Id": access.userId,
          "X-Subscription-Tier": access.tier,
        },
        body: ["POST", "PATCH", "PUT"].includes(req.method) ? JSON.stringify(req.body) : undefined,
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      if (error.message === "No auth token provided" || error.message === "Invalid auth token") {
        res.status(401).json({ error: error.message });
      } else if (error.message === "No active subscription") {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });
});
