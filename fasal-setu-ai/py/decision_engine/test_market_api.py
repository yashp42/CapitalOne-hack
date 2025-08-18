#!/usr/bin/env python3

import requests
import json

# User's original market data but with multiple price points for trend analysis
test_data = {
    "intent": "market_advice",
    "decision_template": "sell_or_hold_decision",
    "missing": [],
    "tool_calls": [
        {
            "tool": "prices_fetch",
            "args": {
                "state": "Maharashtra",
                "commodity": "wheat"
            }
        },
        {
            "tool": "storage_find",
            "args": {
                "state": "Maharashtra"
            }
        },
        {
            "tool": "rag_search",
            "args": {
                "query": "wheat price trends Maharashtra",
                "k": 6
            }
        },
        {
            "tool": "web_search",
            "args": {
                "query": "wheat price trend forecast Maharashtra"
            }
        }
    ],
    "facts": {
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
            ],
            "source_stamp": "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
        },
        "storage": {
            "data": {
                "query": {
                    "state": "Maharashtra",
                    "district": None,
                    "limit": 3,
                    "route": "state"
                },
                "facilities": [
                    {
                        "wh_name": "Central Warehouse, Vashi",
                        "wh_id": 2751640,
                        "whm_name": "Central Warehousing Corporation",
                        "address": "Near APMC/Turbhe Railway station, vashi",
                        "district": "Thane",
                        "state": "MAHARASHTRA",
                        "capacity_mt": 97406,
                        "registration_date": "24-Feb-2021",
                        "valid_upto": "23-Feb-2026",
                        "contact_no": 9819204148,
                        "status": "Active",
                        "remarks": None,
                        "source_file": "Registered Warehouses - WDRA _MAHARASHTRA.csv"
                    }
                ],
                "count": 3
            },
            "source_stamp": {
                "type": "wdra_csv"
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
}

try:
    print("Testing Market Advice API")
    print("=" * 50)
    print("Sending request with 3 price points for trend analysis...")
    
    response = requests.post(
        "http://127.0.0.1:8000/decision",
        json=test_data,
        timeout=30
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ SUCCESS!")
        print(f"Action: {result['result']['action']}")
        
        if result['result'].get('items'):
            item = result['result']['items'][0]
            print(f"Recommendation: {item['name']}")
            print(f"Confidence: {item['score']}")
            print(f"Reasons: {item['reasons'][:2]}...")  # First 2 reasons
            print(f"Predicted Price: ₹{item['meta']['predicted_price']}")
            print(f"Current Price: ₹{item['meta']['last_price']}")
            print(f"Expected Change: {item['meta']['expected_pct_change']:.2%}")
        else:
            print(f"Notes: {result['result']['notes']}")
    else:
        print(f"❌ ERROR: {response.status_code}")
        print(response.text)

except requests.exceptions.ConnectionError:
    print("❌ Connection Error: Make sure the decision engine server is running at http://127.0.0.1:8000")
except Exception as e:
    print(f"❌ Error: {e}")
