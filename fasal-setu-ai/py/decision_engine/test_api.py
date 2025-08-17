#!/usr/bin/env python3
"""
Simple API test using requests
"""

import requests
import json
import time

def test_api():
    url = "http://127.0.0.1:8000/decision"
    
    data = {
        "intent": "temperature_risk",
        "decision_template": "frost_or_heat_risk_assessment",
        "request_id": "test-api-001",
        "tool_calls": [
            {
                "tool": "weather_outlook",
                "args": {"location": "test"},
                "output": {
                    "forecast": [
                        {"date": "2025-08-18", "t_min": 5.0, "t_max": 15.0, "rain_mm": 2.0},
                        {"date": "2025-08-19", "t_min": 4.0, "t_max": 16.0, "rain_mm": 2.0},
                        {"date": "2025-08-20", "t_min": 3.0, "t_max": 17.0, "rain_mm": 2.0},
                        {"date": "2025-08-21", "t_min": 1.0, "t_max": 18.0, "rain_mm": 2.0}
                    ],
                    "source_id": "test-weather-api",
                    "source_type": "weather"
                }
            },
            {
                "tool": "calendar_lookup",
                "args": {"crop": "wheat"},
                "output": {
                    "crop_name": "wheat",
                    "current_stage": "flowering",
                    "frost_threshold": 2.0,
                    "heat_threshold": 35.0,
                    "source_id": "test-calendar-db",
                    "source_type": "government"
                }
            }
        ],
        "facts": {}
    }
    
    # Wait a moment for server to start
    time.sleep(2)
    
    try:
        print("Sending request to API...")
        response = requests.post(url, json=data, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print("Response:")
        result = response.json()
        print(json.dumps(result, indent=2))
        
        # Validate result
        if response.status_code == 200:
            status = result.get("status")
            confidence = result.get("confidence")
            items = result.get("result", {}).get("items", [])
            
            print(f"\n✅ API Test SUCCESS")
            print(f"   Status: {status}")
            print(f"   Confidence: {confidence}")
            print(f"   Items: {len(items)}")
            
            return True
        else:
            print(f"❌ API Test FAILED - HTTP {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error - Server not running?")
        return False
    except Exception as e:
        print(f"❌ Test Error: {e}")
        return False

if __name__ == "__main__":
    print("API Test")
    print("=" * 30)
    success = test_api()
    print("=" * 30)
    if success:
        print("🎉 All tests passed!")
    else:
        print("💥 Tests failed!")
