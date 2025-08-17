#!/usr/bin/env python3

import json
from rules.market_advice import handle

# Test data with user's original format (single price point)
facts = {
    "prices": {
        "data": [
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
                },
                {
                    "wh_name": "Central Warehouse Miraj Base Depot",
                    "wh_id": 2531646,
                    "whm_name": "Central Warehousing Corporation",
                    "address": "Manik Nagar Near Railway Colony, Miraj",
                    "district": "Sangli",
                    "state": "MAHARASHTRA",
                    "capacity_mt": 80000,
                    "registration_date": "18-Feb-2021",
                    "valid_upto": "17-Feb-2026",
                    "contact_no": 9860603465,
                    "status": "Active",
                    "remarks": None,
                    "source_file": "Registered Warehouses - WDRA _MAHARASHTRA.csv"
                },
                {
                    "wh_name": "JALGAON H-14",
                    "wh_id": 6574925,
                    "whm_name": "Maharashtra State Warehousing Corporation",
                    "address": "PLOT NO.H14,MIDC AREA,JALGAON, JALGAON",
                    "district": "Jalgaon",
                    "state": "MAHARASHTRA",
                    "capacity_mt": 61803,
                    "registration_date": "15-May-2022",
                    "valid_upto": "14-May-2027",
                    "contact_no": 9579713020,
                    "status": "Active",
                    "remarks": None,
                    "source_file": "Registered Warehouses - WDRA _MAHARASHTRA.csv"
                }
            ],
            "count": 3
        },
        "source_stamp": {
            "type": "wdra_csv",
            "dir": "E:\\capitalone\\CapitalOne-hack\\fasal-setu-ai\\data\\static_json\\storage\\wdra",
            "files": [
                "Registered Warehouses - WDRA _BIHAR.csv",
                "Registered Warehouses - WDRA _MAHARASHTRA.csv",
                "Registered Warehouses - WDRA_KARNATAKA.csv",
                "Registered Warehouses - WDRA_PUNJAB.csv"
            ],
            "source_url": "https://wdra.gov.in/web/wdra/registered-warehouses",
            "executed_at": "2025-08-17T23:06:18Z"
        }
    },
    "rag": {
        "data": []
    },
    "web": {
        "data": {
            "results": [
                {
                    "title": "plant vs grow vs cultivate | WordReference Forums",
                    "url": "https://forum.wordreference.com/threads/plant-vs-grow-vs-cultivate.3908300/",
                    "snippet": "Feb 13, 2022 · Plant means to put the seeds in the ground. Whether anything grows as a result of that is another matter. Grow can be intransitive or transitive. Flowers grow. You can grow flowers. Cultivate is similar to grow in is transitive sense. It sounds technical and literary. It refers to agricultural activity in general. I don't think you'd use it for what you do in a single season. …",
                    "source": "ddg"
                },
                {
                    "title": "plural of wheat - WordReference Forums",
                    "url": "https://forum.wordreference.com/threads/plural-of-wheat.4130861/",
                    "snippet": "Feb 4, 2025 · I see an explanation from wordhippo on the plural of wheat In more general, commonly used, contexts, the plural form will also be wheat. However, in more specific contexts, the plural form can also be wheats e.g. in reference to various types of wheats or a collection of wheats. Also I find...",
                    "source": "ddg"
                },
                {
                    "title": "Rolled oats vs oat flakes vs oats vs oatmeal - WordReference …",
                    "url": "https://forum.wordreference.com/threads/rolled-oats-vs-oat-flakes-vs-oats-vs-oatmeal.3929745/",
                    "snippet": "Apr 24, 2022 · Hello. I'm a bit confused by all of these words: \"oats\", \"rolled oats\", \"oatmeal\" and \"oat flakes\". Which of them can I use speaking about oats without any salt, sugar, cinnamon?",
                    "source": "ddg"
                },
                {
                    "title": "wheat shocks - WordReference Forums",
                    "url": "https://forum.wordreference.com/threads/wheat-shocks.3838126/",
                    "snippet": "Jun 25, 2021 · What is the meaning of \"wheat shocks\" in this context: \"My wheat will begin to sprout in the shock pretty soon. Do you reckon your father would be willing...",
                    "source": "ddg"
                },
                {
                    "title": "bushel of wheat - WordReference Forums",
                    "url": "https://forum.wordreference.com/threads/bushel-of-wheat.3673145/",
                    "snippet": "Mar 7, 2020 · No, this \"bushel of wheat\" is literally a bushel of wheat. As I said, this is related to the repeal of the Corn Laws, which artificially increased the price of wheat, and which was a major political issue of the day. Like I said, it's used both literally and metaphorically.",
                    "source": "ddg"
                }
            ],
            "answer_box": None
        },
        "source_stamp": {
            "type": "search",
            "providers": [
                "ddg"
            ],
            "executed_at": "2025-08-17T23:06:25Z",
            "args_used": {
                "k": 5,
                "recency_days": 0,
                "region": "in-en",
                "safesearch": "moderate",
                "news_only": False,
                "domains": [],
                "site": None
            }
        }
    }
}

intent = {
    "intent": "market_advice",
    "decision_template": "sell_or_hold_decision",
    "request_id": "test-single-price"
}

print("Testing Market Advice with Single Price Point")
print("=" * 50)
print("User's original data format with validation-compliant response...")

# Call the handler with debug
result = handle(intent=intent, facts=facts)

print(f"\nResult:")
print(json.dumps(result, indent=2))

# Check if recommendation was made
if result.get("action") == "require_more_info":
    print(f"\n❌ Still requires more info: {result.get('notes')}")
elif result.get("items"):
    item = result["items"][0]
    print(f"\n✅ Decision made: {result.get('action')}")
    print(f"Recommendation: {item.get('name')}")
    print(f"Confidence: {item.get('score')}")
    print(f"Current Price: ₹{item.get('meta', {}).get('current_price')}")
    print(f"Storage Available: {item.get('meta', {}).get('storage_available')}")
    print(f"Reasons: {item.get('reasons', [])[0] if item.get('reasons') else 'None'}")
else:
    print(f"\n⚠️ Unexpected result format")
