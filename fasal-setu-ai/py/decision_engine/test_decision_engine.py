#!/usr/bin/env python3
"""
Test the Decision Engine API with the temperature risk JSON request
"""
import requests
import json

# The exact JSON request from the user
test_request = {
  "request_id": "test-temps-01",
  "intent": "temperature_risk",
  "decision_template": "frost_or_heat_risk_assessment",
  "tool_calls": [
    {
      "tool": "weather_outlook",
      "args": {},
      "output": {
        "provider": "open-meteo",
        "source": "open-meteo",
        "source_type": "external",
        "forecast": [
          { "date": "2025-08-20", "tmin": 0, "tmax": 15, "tmin_c": 0, "tmax_c": 15, "rain_mm": 0 },
          { "date": "2025-08-21", "tmin": 5, "tmax": 18, "tmin_c": 5, "tmax_c": 18, "rain_mm": 0 },
          { "date": "2025-08-22", "tmin": 3, "tmax": 20, "tmin_c": 3, "tmax_c": 20, "rain_mm": 0 }
        ]
      }
    },
    {
      "tool": "calendar_lookup",
      "args": {},
      "output": {
        "source": "crop-calendar-database",
        "source_type": "reference",
        "crop": "Wheat",
        "current_stage": "flowering",
        "stage_critical_temps": {
          "flowering": {
            "frost_threshold": 2,
            "heat_threshold": 38
          }
        },
        "days_to_harvest": 30
      }
    }
  ]
}

def test_decision_engine():
    """Test the real decision engine functionality"""
    url = "http://127.0.0.1:8000/decision"
    
    print("=== Testing Decision Engine with Temperature Risk ===")
    print(f"Request ID: {test_request['request_id']}")
    print(f"Intent: {test_request['intent']}")
    print(f"Decision Template: {test_request['decision_template']}")
    print()
    
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, json=test_request, headers=headers)
        
        print(f"HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ SUCCESS! Decision Engine is working!")
            print()
            print("Response Details:")
            print(f"  Status: {result.get('status')}")
            print(f"  Notes: {result.get('notes')}")
            print(f"  Confidence: {result.get('confidence')}")
            
            if result.get('result', {}).get('action'):
                print(f"  Action: {result['result']['action']}")
                
            if result.get('result', {}).get('items'):
                print(f"  Items: {len(result['result']['items'])} risk assessments")
                for i, item in enumerate(result['result']['items']):
                    print(f"    {i+1}. {item.get('name', 'Unknown')}: Score {item.get('score', 'N/A')}")
            
            # Check if it's really working (not fallback mode)
            if result.get('status') == 'fallback_mode':
                print("\n❌ Still in fallback mode - imports may still have issues")
            else:
                print("\n🎉 Real decision engine is processing requests!")
                
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    print("Testing the Decision Engine API...")
    print("Make sure server is running at http://127.0.0.1:8000")
    print()
    test_decision_engine()
