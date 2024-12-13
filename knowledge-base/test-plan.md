# Subscription System Test Plan

## 1. Webhook Handler Testing

### a. Event Processing Tests

1. New Subscription Creation

   ```bash
   # Test command using Stripe CLI
   stripe trigger customer.subscription.created
   ```

   - Verify event is logged in subscription_events
   - Verify subscription record is created
   - Check RLS policies don't block service role

2. Payment Processing

   ```bash
   stripe trigger payment_intent.succeeded
   stripe trigger invoice.paid
   ```

   - Verify events are logged
   - Check subscription status updates
   - Validate customer record updates

3. Subscription Updates
   ```bash
   stripe trigger customer.subscription.updated
   ```
   - Verify subscription status changes
   - Check event logging
   - Validate customer notifications

### b. Error Handling Tests

1. Invalid Events

   ```bash
   # Send malformed webhook payload
   curl -X POST https://your-webhook-url.com \
     -H "Content-Type: application/json" \
     -d '{"invalid": "data"}'
   ```

   - Verify proper error responses
   - Check error logging
   - Validate retry mechanism

2. Database Failures

   - Simulate DB connection issues
   - Test retry logic
   - Verify error reporting

3. Stripe API Issues
   - Test with invalid Stripe keys
   - Verify error handling
   - Check recovery process

## 2. Subscription Flow Testing

### a. User Journey Tests

1. New Subscription

   - Sign up new user
   - Complete subscription flow
   - Verify access granted
   - Check webhook processing

2. Subscription Management

   - Access customer portal
   - Update payment method
   - Cancel subscription
   - Verify status changes

3. Feature Access
   - Test basic tier features
   - Verify feature gates
   - Check subscription expiration
   - Test grace period

### b. Integration Tests

1. Frontend Integration

   - Verify subscription status display
   - Test upgrade prompts
   - Check error messages
   - Validate loading states

2. Background Service
   - Test status checks
   - Verify caching
   - Check periodic updates
   - Validate error recovery

## 3. Security Testing

### a. Authentication Tests

1. Service Role Access

   - Verify webhook authentication
   - Test RLS policies
   - Check function permissions

2. User Access Control
   - Test authenticated routes
   - Verify subscription checks
   - Validate feature gates

### b. Data Security

1. Sensitive Data

   - Check PII handling
   - Verify payment info security
   - Test data access controls

2. API Security
   - Validate CORS settings
   - Test rate limiting
   - Check input sanitization

## Test Execution Steps

1. Local Testing

   ```bash
   # Start local development
   npm run dev

   # Start Stripe webhook forwarding
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   ```

2. Staging Testing

   - Deploy to staging environment
   - Configure test Stripe webhook
   - Run automated test suite
   - Perform manual verification

3. Production Verification
   - Verify webhook configuration
   - Test with real subscription
   - Monitor error rates
   - Check performance metrics

## Success Criteria

1. Webhook Handler

   - [ ] All events processed successfully
   - [ ] Proper error handling
   - [ ] Correct subscription updates
   - [ ] Accurate event logging

2. Subscription Management

   - [ ] Successful subscription creation
   - [ ] Proper status updates
   - [ ] Correct feature access
   - [ ] Working customer portal

3. Security
   - [ ] RLS policies working
   - [ ] Proper authentication
   - [ ] Secure data handling
   - [ ] Protected API endpoints

## Test Data Requirements

1. Test Users

   ```sql
   -- Create test user
   INSERT INTO auth.users (email) VALUES ('test@example.com');
   ```

2. Subscription Tiers

   ```sql
   -- Verify test tier
   SELECT * FROM subscription_tiers WHERE name = 'Basic';
   ```

3. Stripe Test Cards
   - 4242424242424242 (Success)
   - 4000000000000002 (Declined)
   - 4000000000000341 (Attaches 3D Secure)

## Monitoring

1. Error Tracking

   - Monitor Supabase logs
   - Check Stripe webhook logs
   - Track failed events

2. Performance Metrics
   - Event processing time
   - Subscription update latency
   - API response times

## Rollback Plan

1. Database

   ```sql
   -- Revert migrations if needed
   DROP FUNCTION IF EXISTS log_subscription_event CASCADE;
   DROP FUNCTION IF EXISTS update_event_status CASCADE;
   ```

2. Edge Functions
   - Keep previous version ready
   - Document rollback steps
   - Test rollback procedure
