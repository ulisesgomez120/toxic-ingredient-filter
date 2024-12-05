# Authentication & Subscription Implementation Requirements

## Authentication Provider

- Using Supabase Auth for user authentication
- Currently using Google Cloud Function as proxy to Supabase
- Need to secure API key exposure in app

## Subscription Model

### Tiers

1. Basic Tier ($1.99)
   - Access to default ingredients checking only
   - Using expanded defaultIngredients list
2. Pro Tier ($3.99)
   - All basic features
   - Custom ingredient additions

### Subscription Management

- Redirect to Stripe-hosted web portal for management
- No trial period offered
- Implement Stripe webhooks for real-time subscription status updates

## User Flow

- Authentication required on first install
- No app functionality without active subscription
- Extension should not run any code for unsubscribed users

## Technical Requirements

1. Authentication Flow

   - Implement Supabase Auth integration
   - Secure API communications

2. Subscription Verification

   - Cache subscription status (check weekly or monthly not sure)
   - Implement Stripe webhook handling
   - Update proxy function to verify subscription status

3. Security Updates Needed

- Remove exposed API keys
- Implement proper auth token handling
- Add subscription verification layer
- Secure webhook endpoints

## Implementation Considerations

1. Database Updates

   - User table for auth
   - Subscription status tracking
   - Subscription history

2. Extension Updates

   - Auth state management
   - Subscription status checking
   - Feature access control
   - Error handling for expired/invalid subscriptions

3. API Security

   - Token-based authentication
   - Subscription status verification
   - Rate limiting
   - Request validation

4. User Experience
   - Clear auth/subscription flows
   - Proper error messaging
   - Subscription status indicators
   - Easy access to subscription management
