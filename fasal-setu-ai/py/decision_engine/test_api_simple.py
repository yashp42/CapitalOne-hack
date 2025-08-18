#!/usr/bin/env python3
import json
import requests

# Test the actual API call with variety selection
url = "http://127.0.0.1:8000/decision"
headers = {"Content-Type": "application/json"}

# Simple test payload
test_payload = {
  "intent": "variety_selection", 
  "decision_template": "variety_ranked_list",
  "missing": [],
  "tool_calls": [
    {
      "tool": "geocode_tool",
      "args": {"state": "Bihar", "district": "Patna"}
    },
    {
      "tool": "regional_crop_info",
      "args": {"state": "Bihar"}
    }
  ],
  "facts": {
    "location": {
      "data": {
        "lat": 25.61,
        "lon": 85.14,
        "matched_state": "Bihar",
        "matched_district": "Patna"
      }
    },
    "calendar": {
      "data": {
        "state": "Bihar",
        "crops": [
          {
            "crop_name": "rice",
            "season": "Kharif",
            "planting_window": {"start": "06-20", "end": "07-15"},
            "ideal_temp_c": {"range_day": [25, 35]},
            "irrigation_ideal": {"seasonal_requirement_mm": 1200}
          },
          {
            "crop_name": "wheat", 
            "season": "Rabi",
            "planting_window": {"start": "11-15", "end": "12-10"},
            "ideal_temp_c": {"range_day": [20, 25]},
            "irrigation_ideal": {"seasonal_requirement_mm": 450}
          }
        ]
      }
    }
  }
}

try:
    print("Sending request to API...")
    response = requests.post(url, json=test_payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
