# Subscription Check Implementation Plan

## Overview

Implement robust subscription status checking in the Chrome extension to properly gate features based on subscription tier. This includes real-time checks with Supabase, caching for performance, and proper handling of subscription changes.

## Implementation Details

### 1. Database Queries

```sql
-- Function to get user's current subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_id UUID)
RETURNS TABLE (
    subscription_tier TEXT,
    is_active BOOLEAN,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        st.name as subscription_tier,
        us.status = 'active' as is_active,
        us.current_period_end as expires_at
    FROM user_subscriptions us
    JOIN subscription_tiers st ON us.tier_id = st.id
    WHERE us.user_id = user_id
    AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Subscription Status Cache

```typescript
interface SubscriptionStatus {
  tier: "basic" | "pro";
  isActive: boolean;
  expiresAt: string;
  lastChecked: string;
}

// Cache duration: 1 hour for active subscriptions, 5 minutes for others
const CACHE_DURATION = {
  active: 60 * 60 * 1000, // 1 hour
  inactive: 5 * 60 * 1000, // 5 minutes
};
```

### 3. Implementation Steps

1. Update Background Service:

   - Add subscription cache management
   - Implement real Supabase checks
   - Add periodic status verification
   - Handle subscription expiration

2. Add Cache Management:

   - Store subscription status in ChromeStorage
   - Implement cache invalidation
   - Add refresh mechanisms

3. Add Status Monitoring:

   - Track subscription changes
   - Handle edge cases
   - Implement error recovery

4. Update Feature Verification:
   - Use cached status when possible
   - Fallback to real-time checks
   - Handle offline scenarios

## Code Changes Required

### 1. Background Service Updates

```javascript
// In background.js

class BackgroundService {
  constructor() {
    this.subscriptionCheckInterval = null;
    this.initialize();
  }

  async initialize() {
    try {
      await authManager.initializeFromStorage();
      await this.initializeSubscriptionChecks();
      this.setupMessageHandlers();
    } catch (error) {
      console.error("Error initializing background service:", error);
    }
  }

  async initializeSubscriptionChecks() {
    // Start periodic checks if user is authenticated
    const session = await authManager.getSession();
    if (session) {
      this.startPeriodicChecks();
    }

    // Listen for auth state changes
    authManager.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        this.startPeriodicChecks();
      } else if (event === "SIGNED_OUT") {
        this.stopPeriodicChecks();
      }
    });
  }

  async checkSubscriptionStatus() {
    try {
      const session = await authManager.getSession();
      if (!session) return "basic";

      // Check cache first
      const cached = await this.getSubscriptionFromCache();
      if (cached && this.isCacheValid(cached)) {
        return cached.tier;
      }

      // Perform real-time check
      const { data, error } = await supabase.rpc("get_user_subscription_status", {
        user_id: session.user.id,
      });

      if (error) throw error;

      const status = {
        tier: data.subscription_tier || "basic",
        isActive: data.is_active,
        expiresAt: data.expires_at,
        lastChecked: new Date().toISOString(),
      };

      // Update cache
      await this.updateSubscriptionCache(status);

      return status.tier;
    } catch (error) {
      console.error("Error checking subscription:", error);
      return "basic"; // Fallback to basic on error
    }
  }

  async getSubscriptionFromCache() {
    try {
      const { subscription } = await chrome.storage.local.get("subscription");
      return subscription;
    } catch (error) {
      console.error("Error reading subscription cache:", error);
      return null;
    }
  }

  async updateSubscriptionCache(status) {
    try {
      await chrome.storage.local.set({ subscription: status });
    } catch (error) {
      console.error("Error updating subscription cache:", error);
    }
  }

  isCacheValid(cached) {
    const now = new Date().getTime();
    const lastChecked = new Date(cached.lastChecked).getTime();
    const duration = cached.isActive ? CACHE_DURATION.active : CACHE_DURATION.inactive;

    return now - lastChecked < duration;
  }

  startPeriodicChecks() {
    if (this.subscriptionCheckInterval) return;

    // Check every 5 minutes
    this.subscriptionCheckInterval = setInterval(async () => {
      await this.checkSubscriptionStatus();
    }, 5 * 60 * 1000);

    // Initial check
    this.checkSubscriptionStatus();
  }

  stopPeriodicChecks() {
    if (this.subscriptionCheckInterval) {
      clearInterval(this.subscriptionCheckInterval);
      this.subscriptionCheckInterval = null;
    }
  }
}
```

### 2. Feature Verification Updates

```javascript
async verifyFeatureAccess(feature) {
  try {
    const session = await authManager.getSession();
    if (!session) return false;

    const subscriptionStatus = await this.checkSubscriptionStatus();
    const cached = await this.getSubscriptionFromCache();

    // If subscription is expired, force a real-time check
    if (cached && new Date(cached.expiresAt) < new Date()) {
      await this.checkSubscriptionStatus();
    }

    switch (feature) {
      case "basic_scan":
        return subscriptionStatus === "basic" || subscriptionStatus === "pro";

      case "custom_ingredients":
        return subscriptionStatus === "pro";

      default:
        return false;
    }
  } catch (error) {
    console.error("Error verifying feature access:", error);
    return false;
  }
}
```

## Testing Requirements

1. Subscription Status Changes:

   - Test new subscription activation
   - Test subscription expiration
   - Test tier upgrades/downgrades
   - Test subscription cancellation

2. Cache Behavior:

   - Test cache invalidation
   - Test refresh mechanisms
   - Test offline handling
   - Test error recovery

3. Feature Access:

   - Test basic tier access
   - Test pro tier access
   - Test expired subscription handling
   - Test offline access

4. Edge Cases:
   - Test network failures
   - Test invalid cache data
   - Test concurrent checks
   - Test auth state changes

## Success Criteria

1. Subscription status is accurately tracked
2. Cache improves performance
3. Feature access is properly controlled
4. Offline functionality works as expected
5. Error handling is robust
6. State changes are handled gracefully

## Implementation Order

1. Add database function for subscription status
2. Implement subscription cache management
3. Update background service with real checks
4. Add periodic status verification
5. Update feature verification logic
6. Add comprehensive error handling
7. Implement testing scenarios
8. Document implementation details

## Notes

- Cache duration is configurable based on subscription status
- Real-time checks are performed on critical operations
- Offline support falls back to cached status
- Error handling defaults to basic tier access
- Periodic checks ensure status accuracy
