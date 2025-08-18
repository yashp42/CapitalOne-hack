#!/usr/bin/env python3

import json
from rules.pesticide_advice import handle

# Test data with user's format
facts = {
    "pesticide": {
        "data": {
            "items": [
                {
                    "name": "Acetamiprid",
                    "active_ingredient": "Acetamiprid",
                    "crop": "potato",
                    "pest_target": "aphids",
                    "application_stage": "tuberization",
                    "phi_days": 7.0,
                    "dosage": "250-300g/ha",
                    "restricted": False,
                    "toxicity": "moderate"
                }
            ]
        }
    },
    "rag_search": {
        "data": {
            "items": []
        }
    },
    "web_search": {
        "data": {
            "items": [
                {"title": "Organic Aphid Control", "snippet": "Natural predators and companion planting"},
                {"title": "IPM for Potatoes", "snippet": "Integrated pest management strategies"},
                {"title": "Beneficial Insects", "snippet": "Ladybugs and lacewings for aphid control"},
                {"title": "Neem Oil Application", "snippet": "Organic treatment for soft-bodied insects"},
                {"title": "Companion Planting", "snippet": "Basil and marigolds deter aphids"}
            ]
        }
    }
}

intent = {
    "intent": "pesticide_advice",
    "decision_template": "pesticide_safe_recommendation",
    "request_id": "debug-test",
    "parameters": {
        "crop": "potato",
        "pest": "aphids", 
        "stage": "tuberization",
        "days_to_harvest": 30
    }
}

print("Debug Pesticide Advice")
print("======================")
print("Facts structure:")
print(json.dumps(facts, indent=2))
print("\nIntent:")
print(json.dumps(intent, indent=2))

# Call the handler with debug
result = handle(intent=intent, facts=facts)

print(f"\nResult:")
print(json.dumps(result, indent=2))

# Check if reasons were populated
if result.get("items"):
    item = result["items"][0]
    print(f"\nFirst item reasons: {item.get('reasons', [])}")
    print(f"First item tradeoffs: {item.get('tradeoffs', [])}")
    print(f"First item meta: {item.get('meta', {})}")
