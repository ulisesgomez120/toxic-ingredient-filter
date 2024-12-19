# Subscription Cancellation Documentation

## For Users

### How Subscription Cancellation Works

When you cancel your subscription:

- Your subscription remains active until the end of your current billing period
- You'll continue to have full access to all features until the period ends
- Your subscription will not auto-renew for the next period
- No refunds are issued for partial periods

### What to Expect After Cancellation

1. Immediate Effects:

   - You'll see your subscription status marked as "Canceling"
   - The cancellation date will be displayed
   - All features remain accessible

2. At Period End:
   - Your subscription status will change to "Canceled"
   - Access to premium features will be restricted
   - You can resubscribe at any time

## For Developers

### Webhook Implementation Details

The subscription cancellation flow is handled by the Stripe webhook handler (`stripe-webhook/index.js`).

#### Key Components

1. Event Handling:

```javascript
case "customer.subscription.updated":
  // Handles both subscription updates and cancellation requests
  await updateSubscriptionStatus(eventObject, event.type);
  break;
```

2. Status Updates:

```javascript
// Updates subscription record with cancellation details
const updates = {
  status: subscription.status,
  cancel_at_period_end: subscription.cancel_at_period_end,
  canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
  current_period_end: new Date(subscription.current_period_end * 1000),
  updated_at: new Date(),
};
```

3. Event Logging:

```javascript
// Logs cancellation event for tracking
await supabaseClient.from("subscription_events").insert({
  user_subscription_id: currentSubscription.id,
  event_type: "cancellation_scheduled",
  details: {
    current_period_end: subscription.current_period_end,
  },
});
```

### Database Schema

The subscription status is tracked in the following tables:

1. user_subscriptions:

   - status: Current subscription status
   - cancel_at_period_end: Boolean flag for scheduled cancellations
   - canceled_at: Timestamp of cancellation request
   - current_period_end: Access expiration date

2. subscription_events:
   - Tracks subscription lifecycle events
   - Includes cancellation requests and status changes

### Testing

To test cancellation handling:

```bash
# Test cancellation at period end
stripe trigger customer.subscription.updated \
  --add-attributes "cancel_at_period_end=true,canceled_at=1736799240"
```

### Error Handling

The webhook handler includes comprehensive error handling:

- Validates webhook signatures
- Verifies subscription existence
- Handles database updates atomically
- Logs all events and errors
- Returns appropriate HTTP responses

### Maintenance Notes

1. Monitoring:

   - Watch for failed webhook deliveries in Stripe dashboard
   - Monitor subscription_events table for cancellation patterns
   - Check error logs for update failures

2. Common Issues:

   - Webhook signature verification failures
   - Database connection issues
   - Invalid subscription states

3. Best Practices:
   - Always verify webhook signatures
   - Log all subscription state changes
   - Maintain idempotency in event handling
   - Keep subscription status in sync with Stripe
