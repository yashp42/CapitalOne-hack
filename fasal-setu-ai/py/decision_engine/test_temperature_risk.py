#!/usr/bin/env python3

import json
from rules.temperature_risk import handle

# Test data from the user's failing input
facts = {
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
            "state": None,
            "district": None,
            "agro_climatic_zone": "North West Alluvial Plain Zone",
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

intent = {
    "intent": "temperature_risk",
    "decision_template": "frost_or_heat_risk_assessment",
    "request_id": "test-temp-risk",
    "parameters": {
        "crop": "wheat",
        "stage": "grain_filling"
    }
}

print("Temperature Risk Debug")
print("=====================")
print("Facts keys:", list(facts.keys()))
print("Weather data available:", "weather" in facts and "data" in facts.get("weather", {}))
print("Calendar data available:", "calendar" in facts and "data" in facts.get("calendar", {}))

if "weather" in facts:
    weather_data = facts["weather"]
    print(f"Weather structure: {list(weather_data.keys())}")
    if "data" in weather_data:
        data = weather_data["data"]
        print(f"Weather data structure: {list(data.keys())}")
        print(f"Weather forecast days: {len(data.get('time', []))}")
        print(f"Temp ranges: min {min(data.get('tmin_c', []))} - max {max(data.get('tmax_c', []))}")
    else:
        print("No 'data' key in weather")

if "calendar" in facts:
    calendar_data = facts["calendar"]["data"]
    print(f"Crops in calendar: {len(calendar_data.get('crops', []))}")
    if calendar_data.get('crops'):
        crop_info = calendar_data['crops'][0]
        print(f"First crop: {crop_info.get('crop_name')}")
        print(f"Ideal temp range: {crop_info.get('ideal_temp_c', {}).get('range_day')}")

print("\nCalling temperature risk handler...")

# Call the handler
try:
    result = handle(intent=intent, facts=facts)
    print(f"\nResult:")
    print(json.dumps(result, indent=2))
    
    print(f"\nAction: {result.get('action')}")
    print(f"Items count: {len(result.get('items', []))}")
    if result.get('items'):
        print(f"First item: {result['items'][0]}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
