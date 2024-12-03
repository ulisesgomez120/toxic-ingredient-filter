# Task: Implement User Authentication and Subscription Management for Chrome Extension

## Context

This Chrome extension helps users identify toxic ingredients in food products on Instacart. Currently, it uses Supabase for data storage and a Google Cloud Function as a proxy. The extension needs to be updated to include user authentication and subscription-based access using Supabase Auth and Stripe.

## Requirements Overview

1. Implement user authentication using Supabase Auth
2. Set up subscription management with Stripe
3. Update the Google Cloud Function proxy to handle auth and subscriptions
4. Secure all API communications

## Current Infrastructure

- Backend: Supabase PostgreSQL + Google Cloud Function proxy
- Frontend: Chrome Extension (content script, background service, popup)
- Proxy: Node.js function handling Supabase requests

## Implementation Scope

### 1. Authentication System

- Implement Supabase Auth integration in the extension
- Create auth flow for new installations
- Handle auth state management
- Secure API communications

### 2. Subscription System

- Two tiers:
  - Basic ($1.99): Access to default ingredients checking
  - Pro: Basic + custom ingredients
- Stripe integration for payment processing
- Subscription status verification
- Webhook handling for real-time updates

### 3. Security Updates

- Remove exposed API keys
- Implement proper auth token handling
- Add subscription verification layer
- Secure webhook endpoints

### 4. Feature Access Control

- Gate all functionality behind authentication
- Implement tier-based feature access
- Handle expired/invalid subscriptions
- Subscription status caching (weekly checks)

## Files to Modify/Create

Please provide implementations for:

1. Extension Updates:

   - Auth management system
   - Subscription verification
   - Feature access control
   - Updated proxy communication

2. Backend Updates:

   - Enhanced Google Cloud Function
   - Webhook handlers
   - Subscription verification endpoints

3. Database Schema:
   - User management tables
   - Subscription tracking tables
   - Required indexes and relations

## Technical Considerations

1. The extension should not run any code for unsubscribed users
2. Subscription status should be cached and checked weekly
3. All API communications must be secure
4. Implement proper error handling for auth/subscription failures

## Available Files for Context

The following files can be provided for implementation context:

- src/ directory (current extension implementation)
- google-cloud-function-proxy.js
- Current database schema
- Extension manifest

## Expected Deliverables

1. Complete implementation code for all required components
2. Database schema updates
3. API endpoint specifications
4. Security implementation details
5. Testing guidelines

Would you like me to proceed with providing any specific files or start with a particular component of the implementation?
