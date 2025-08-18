#!/usr/bin/env python3

import json
from rules.market_advice import handle

# Test data with user's format
facts = {
    "prices": {
        "data": [
            {
                "state": "Maharashtra",
                "district": "Thane",
                "market": "Palghar",
                "arrival_date": "10/08/2025",
                "commodity": "Wheat",
                "variety": "Other",
                "min_price_rs_per_qtl": 3300,
                "max_price_rs_per_qtl": 3300,
                "modal_price_rs_per_qtl": 3300,
                "arrival_qty": None,
                "source_url": "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
                "last_checked": "2025-08-18"
            },
            {
                "state": "Maharashtra",
                "district": "Thane",
                "market": "Palghar",
                "arrival_date": "12/08/2025",
                "commodity": "Wheat",
                "variety": "Other",
                "min_price_rs_per_qtl": 3350,
                "max_price_rs_per_qtl": 3350,
                "modal_price_rs_per_qtl": 3350,
                "arrival_qty": None,
                "source_url": "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
                "last_checked": "2025-08-18"
            },
            {
                "state": "Maharashtra",
                "district": "Thane",
                "market": "Palghar",
                "arrival_date": "14/08/2025",
                "commodity": "Wheat",
                "variety": "Other",
                "min_price_rs_per_qtl": 3400,
                "max_price_rs_per_qtl": 3400,
                "modal_price_rs_per_qtl": 3400,
                "arrival_qty": None,
                "source_url": "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
                "last_checked": "2025-08-18"
            }
        ]
    },
    "storage": {
        "data": {
            "facilities": [
                {
                    "wh_name": "Central Warehouse, Vashi",
                    "capacity_mt": 97406,
                    "district": "Thane",
                    "state": "MAHARASHTRA",
                    "status": "Active"
                }
            ]
        }
    },
    "rag": {
        "data": []
    },
    "web": {
        "data": {
            "results": []
        }
    }
}

intent = {
    "intent": "market_advice",
    "decision_template": "sell_or_hold_decision",
    "request_id": "debug-market-test"
}

print("Debug Market Advice")
print("==================")
print("Facts structure:")
print(json.dumps(facts, indent=2))
print("\nIntent:")
print(json.dumps(intent, indent=2))

# Call the handler with debug
result = handle(intent=intent, facts=facts)

print(f"\nResult:")
print(json.dumps(result, indent=2))

# Check if a decision was made
if result.get("action") == "require_more_info":
    print(f"\n❌ Still requires more info: {result.get('notes')}")
else:
    print(f"\n✅ Decision made: {result.get('action')}")
    if result.get("items"):
        item = result["items"][0]
        print(f"Recommendation: {item.get('recommendation')}")
        print(f"Reasons: {item.get('reasons', [])}")
        print(f"Meta: {item.get('meta', {})}")
