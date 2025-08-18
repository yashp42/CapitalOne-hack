#!/usr/bin/env python3

import json
import requests

# User's exact failing input
payload = {
    "intent": "temperature_risk",
    "decision_template": "frost_or_heat_risk_assessment",
    "missing": [],
    "tool_calls": [
        {
            "tool": "weather_outlook",
            "args": {
                "lat": 28.6,
                "lon": 77.2,
                "days": 7
            }
        },
        {
            "tool": "regional_crop_info",
            "args": {
                "state": "Delhi",
                "crop": "wheat"
            }
        },
        {
            "tool": "rag_search",
            "args": {
                "query": "wheat frost temperature thresholds grain filling stage",
                "k": 6
            }
        },
        {
            "tool": "web_search",
            "args": {
                "query": "crop frost protection measures wheat near freezing Delhi"
            }
        }
    ],
    "facts": {
        "weather": {
            "data": {
                "lat": 28.625,
                "lon": 77.25,
                "elevation": 224,
                "tz": "Asia/Kolkata",
                "run_at": "2025-08-17T22:50:37Z",
                "time": [
                    "2025-08-17",
                    "2025-08-18",
                    "2025-08-19",
                    "2025-08-20",
                    "2025-08-21",
                    "2025-08-22",
                    "2025-08-23",
                    "2025-08-24"
                ],
                "tmax_c": [
                    33.2,
                    33.8,
                    32.7,
                    32.2,
                    32,
                    31.3,
                    29.2,
                    29
                ],
                "tmin_c": [
                    28.1,
                    27.2,
                    26.6,
                    26.5,
                    26.5,
                    26.1,
                    25.8,
                    25.2
                ],
                "rain_mm": [
                    6.5,
                    4.4,
                    1.8,
                    5.9,
                    0.8,
                    5.4,
                    10.5,
                    13.8
                ]
            }
        },
        "calendar": {
            "data": {
                "crops": [
                    {
                        "crop_name": "wheat",
                        "season": "Rabi",
                        "ideal_temp_c": {
                            "range_day": [20, 25],
                            "notes": "Cool climate preferred during growth, warmer during maturity"
                        }
                    }
                ]
            }
        },
        "rag": {
            "data": []
        },
        "web": {
            "data": {
                "results": [
                    {
                        "title": "Crop frost protection measures",
                        "snippet": "Protection measures for wheat during cold weather"
                    }
                ]
            }
        }
    }
}

print("Testing Temperature Risk with API")
print("=================================")

try:
    response = requests.post("http://127.0.0.1:8000/decision", json=payload, timeout=10)
    
    if response.status_code == 200:
        result = response.json()
        print("✅ SUCCESS")
        print(f"Status: {result.get('status')}")
        print(f"Action: {result.get('result', {}).get('action')}")
        print(f"Confidence: {result.get('result', {}).get('confidence')}")
        print(f"Items: {len(result.get('result', {}).get('items', []))}")
        print(f"Notes: {result.get('result', {}).get('notes', '')[:100]}...")
        
        print(f"\nFull result:")
        print(json.dumps(result, indent=2))
    else:
        print(f"❌ ERROR {response.status_code}")
        print(response.text)
        
except requests.exceptions.ConnectionError:
    print("❌ Server not running. Please start the server with: python app.py")
except Exception as e:
    print(f"❌ Error: {e}")
