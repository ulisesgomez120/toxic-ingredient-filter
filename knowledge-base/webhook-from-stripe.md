# Subscribed to these events:

customer.created
customer.deleted
customer.subscription.created
customer.subscription.deleted
customer.subscription.updated
customer.updated
invoice.created
invoice.paid
invoice.payment_action_required
invoice.payment_failed
payment_intent.payment_failed

# customer.subscription.updated event

Description
{customer.email} subscription has been set to cancel at the end of the billing period
data:

```JSON
{
  "object": {
    "id": "sub_1QVPohRxeyQrsSA7r20VJHKA",
    "object": "subscription",
    "application": null,
    "application_fee_percent": null,
    "automatic_tax": {
      "disabled_reason": null,
      "enabled": true,
      "liability": {
        "type": "self"
      }
    },
    "billing_cycle_anchor": 1734061527,
    "billing_cycle_anchor_config": null,
    "billing_thresholds": null,
    "cancel_at": 1739418327,
    "cancel_at_period_end": true,
    "canceled_at": 1736799240,
    "cancellation_details": {
      "comment": null,
      "feedback": null,
      "reason": "cancellation_requested"
    },
    "collection_method": "charge_automatically",
    "created": 1734061527,
    "currency": "usd",
    "current_period_end": 1739418327,
    "current_period_start": 1736739927,
    "customer": "cus_ROCDzV3y3Alx4G",
    "days_until_due": null,
    "default_payment_method": "pm_1QVPofRxeyQrsSA7kEakluSK",
    "default_source": null,
    "default_tax_rates": [],
    "description": null,
    "discount": null,
    "discounts": [],
    "ended_at": null,
    "invoice_settings": {
      "account_tax_ids": null,
      "issuer": {
        "type": "self"
      }
    },
    "items": {
      "object": "list",
      "data": [
        {
          "id": "si_ROCD9T50H6LBX2",
          "object": "subscription_item",
          "billing_thresholds": null,
          "created": 1734061527,
          "discounts": [],
          "metadata": {},
          "plan": {
            "id": "price_1QSAgsRxeyQrsSA7l4FWfeNc",
            "object": "plan",
            "active": true,
            "aggregate_usage": null,
            "amount": 199,
            "amount_decimal": "199",
            "billing_scheme": "per_unit",
            "created": 1733288398,
            "currency": "usd",
            "interval": "month",
            "interval_count": 1,
            "livemode": false,
            "metadata": {},
            "meter": null,
            "nickname": null,
            "product": "prod_RKqNhsUp0RFltH",
            "tiers_mode": null,
            "transform_usage": null,
            "trial_period_days": null,
            "usage_type": "licensed"
          },
          "price": {
            "id": "price_1QSAgsRxeyQrsSA7l4FWfeNc",
            "object": "price",
            "active": true,
            "billing_scheme": "per_unit",
            "created": 1733288398,
            "currency": "usd",
            "custom_unit_amount": null,
            "livemode": false,
            "lookup_key": null,
            "metadata": {},
            "nickname": null,
            "product": "prod_RKqNhsUp0RFltH",
            "recurring": {
              "aggregate_usage": null,
              "interval": "month",
              "interval_count": 1,
              "meter": null,
              "trial_period_days": null,
              "usage_type": "licensed"
            },
            "tax_behavior": "unspecified",
            "tiers_mode": null,
            "transform_quantity": null,
            "type": "recurring",
            "unit_amount": 199,
            "unit_amount_decimal": "199"
          },
          "quantity": 1,
          "subscription": "sub_1QVPohRxeyQrsSA7r20VJHKA",
          "tax_rates": []
        }
      ],
      "has_more": false,
      "total_count": 1,
      "url": "/v1/subscription_items?subscription=sub_1QVPohRxeyQrsSA7r20VJHKA"
    },
    "latest_invoice": "in_1QX79sRxeyQrsSA7mtsk3VCS",
    "livemode": false,
    "metadata": {},
    "next_pending_invoice_item_invoice": null,
    "on_behalf_of": null,
    "pause_collection": null,
    "payment_settings": {
      "payment_method_options": {
        "acss_debit": null,
        "bancontact": null,
        "card": {
          "network": null,
          "request_three_d_secure": "automatic"
        },
        "customer_balance": null,
        "konbini": null,
        "sepa_debit": null,
        "us_bank_account": null
      },
      "payment_method_types": null,
      "save_default_payment_method": "off"
    },
    "pending_invoice_item_interval": null,
    "pending_setup_intent": null,
    "pending_update": null,
    "plan": {
      "id": "price_1QSAgsRxeyQrsSA7l4FWfeNc",
      "object": "plan",
      "active": true,
      "aggregate_usage": null,
      "amount": 199,
      "amount_decimal": "199",
      "billing_scheme": "per_unit",
      "created": 1733288398,
      "currency": "usd",
      "interval": "month",
      "interval_count": 1,
      "livemode": false,
      "metadata": {},
      "meter": null,
      "nickname": null,
      "product": "prod_RKqNhsUp0RFltH",
      "tiers_mode": null,
      "transform_usage": null,
      "trial_period_days": null,
      "usage_type": "licensed"
    },
    "quantity": 1,
    "schedule": null,
    "start_date": 1734061527,
    "status": "active",
    "test_clock": "clock_1QX79pRxeyQrsSA7z2ihnxRX",
    "transfer_data": null,
    "trial_end": null,
    "trial_settings": {
      "end_behavior": {
        "missing_payment_method": "create_invoice"
      }
    },
    "trial_start": null
  },
  "previous_attributes": {
    "cancel_at": null,
    "cancel_at_period_end": false,
    "canceled_at": null,
    "cancellation_details": {
      "reason": null
    }
  }
}
```

# customer.subscription.deleted

Description
{customer.email} subscription to price_1QSAgsRxeyQrsSA7l4FWfeNc was canceled

data :

```JSON
{
  "object": {
    "id": "sub_1QVPohRxeyQrsSA7r20VJHKA",
    "object": "subscription",
    "application": null,
    "application_fee_percent": null,
    "automatic_tax": {
      "disabled_reason": null,
      "enabled": true,
      "liability": {
        "type": "self"
      }
    },
    "billing_cycle_anchor": 1734061527,
    "billing_cycle_anchor_config": null,
    "billing_thresholds": null,
    "cancel_at": 1739418327,
    "cancel_at_period_end": true,
    "canceled_at": 1736799240,
    "cancellation_details": {
      "comment": null,
      "feedback": null,
      "reason": "cancellation_requested"
    },
    "collection_method": "charge_automatically",
    "created": 1734061527,
    "currency": "usd",
    "current_period_end": 1739418327,
    "current_period_start": 1736739927,
    "customer": "cus_ROCDzV3y3Alx4G",
    "days_until_due": null,
    "default_payment_method": "pm_1QVPofRxeyQrsSA7kEakluSK",
    "default_source": null,
    "default_tax_rates": [],
    "description": null,
    "discount": null,
    "discounts": [],
    "ended_at": 1739418327,
    "invoice_settings": {
      "account_tax_ids": null,
      "issuer": {
        "type": "self"
      }
    },
    "items": {
      "object": "list",
      "data": [
        {
          "id": "si_ROCD9T50H6LBX2",
          "object": "subscription_item",
          "billing_thresholds": null,
          "created": 1734061527,
          "discounts": [],
          "metadata": {},
          "plan": {
            "id": "price_1QSAgsRxeyQrsSA7l4FWfeNc",
            "object": "plan",
            "active": true,
            "aggregate_usage": null,
            "amount": 199,
            "amount_decimal": "199",
            "billing_scheme": "per_unit",
            "created": 1733288398,
            "currency": "usd",
            "interval": "month",
            "interval_count": 1,
            "livemode": false,
            "metadata": {},
            "meter": null,
            "nickname": null,
            "product": "prod_RKqNhsUp0RFltH",
            "tiers_mode": null,
            "transform_usage": null,
            "trial_period_days": null,
            "usage_type": "licensed"
          },
          "price": {
            "id": "price_1QSAgsRxeyQrsSA7l4FWfeNc",
            "object": "price",
            "active": true,
            "billing_scheme": "per_unit",
            "created": 1733288398,
            "currency": "usd",
            "custom_unit_amount": null,
            "livemode": false,
            "lookup_key": null,
            "metadata": {},
            "nickname": null,
            "product": "prod_RKqNhsUp0RFltH",
            "recurring": {
              "aggregate_usage": null,
              "interval": "month",
              "interval_count": 1,
              "meter": null,
              "trial_period_days": null,
              "usage_type": "licensed"
            },
            "tax_behavior": "unspecified",
            "tiers_mode": null,
            "transform_quantity": null,
            "type": "recurring",
            "unit_amount": 199,
            "unit_amount_decimal": "199"
          },
          "quantity": 1,
          "subscription": "sub_1QVPohRxeyQrsSA7r20VJHKA",
          "tax_rates": []
        }
      ],
      "has_more": false,
      "total_count": 1,
      "url": "/v1/subscription_items?subscription=sub_1QVPohRxeyQrsSA7r20VJHKA"
    },
    "latest_invoice": "in_1QX79sRxeyQrsSA7mtsk3VCS",
    "livemode": false,
    "metadata": {},
    "next_pending_invoice_item_invoice": null,
    "on_behalf_of": null,
    "pause_collection": null,
    "payment_settings": {
      "payment_method_options": {
        "acss_debit": null,
        "bancontact": null,
        "card": {
          "network": null,
          "request_three_d_secure": "automatic"
        },
        "customer_balance": null,
        "konbini": null,
        "sepa_debit": null,
        "us_bank_account": null
      },
      "payment_method_types": null,
      "save_default_payment_method": "off"
    },
    "pending_invoice_item_interval": null,
    "pending_setup_intent": null,
    "pending_update": null,
    "plan": {
      "id": "price_1QSAgsRxeyQrsSA7l4FWfeNc",
      "object": "plan",
      "active": true,
      "aggregate_usage": null,
      "amount": 199,
      "amount_decimal": "199",
      "billing_scheme": "per_unit",
      "created": 1733288398,
      "currency": "usd",
      "interval": "month",
      "interval_count": 1,
      "livemode": false,
      "metadata": {},
      "meter": null,
      "nickname": null,
      "product": "prod_RKqNhsUp0RFltH",
      "tiers_mode": null,
      "transform_usage": null,
      "trial_period_days": null,
      "usage_type": "licensed"
    },
    "quantity": 1,
    "schedule": null,
    "start_date": 1734061527,
    "status": "canceled",
    "test_clock": "clock_1QX79pRxeyQrsSA7z2ihnxRX",
    "transfer_data": null,
    "trial_end": null,
    "trial_settings": {
      "end_behavior": {
        "missing_payment_method": "create_invoice"
      }
    },
    "trial_start": null
  },
  "previous_attributes": null
}
```
