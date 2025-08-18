#!/usr/bin/env python3
"""
Simple test for the decision engine with basic JSON inputs.
"""

import requests
import json
from datetime import datetime, timedelta

# Test data for temperature risk assessment
def create_temperature_risk_request():
    # Create a simple weather forecast with some temperature data
    forecast_data = []
    base_date = datetime.now()
    
    for i in range(7):  # 7 days forecast
        date = base_date + timedelta(days=i)
        forecast_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "t_min": 5.0 - i,  # Gradually decreasing minimum temp (will trigger frost risk)
            "t_max": 15.0 + i,  # Gradually increasing maximum temp
            "rain_mm": 2.0
        })
    
    return {
        "intent": "temperature_risk",
        "decision_template": "frost_or_heat_risk_assessment",
        "request_id": "test-001",
        "tool_calls": [
            {
                "tool": "weather_outlook",
                "args": {"location": "test"},
                "output": {
                    "forecast": forecast_data,
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

def create_irrigation_request():
    """Simple irrigation decision request"""
    return {
        "intent": "irrigation_decision",
        "decision_template": "irrigation_now_or_wait",
        "request_id": "test-002",
        "tool_calls": [
            {
                "tool": "weather_outlook",
                "args": {"location": "test"},
                "output": {
                    "forecast": [
                        {"date": "2025-08-19", "rain_mm": 2.0, "t_min": 15, "t_max": 30},
                        {"date": "2025-08-20", "rain_mm": 0.0, "t_min": 16, "t_max": 32}
                    ],
                    "source_id": "test-weather-api",
                    "source_type": "weather"
                }
            },
            {
                "tool": "calendar_lookup",
                "args": {"crop": "rice"},
                "output": {
                    "crop_name": "rice",
                    "current_stage": "flowering",
                    "irrigation_threshold": 30.0,
                    "source_id": "test-calendar-db", 
                    "source_type": "government"
                }
            }
        ],
        "facts": {}
    }

def test_request(request_data, test_name):
    """Send request to decision engine and print results"""
    print(f"\n=== Testing {test_name} ===")
    print("Request:")
    print(json.dumps(request_data, indent=2))
    
    try:
        response = requests.post(
            "http://127.0.0.1:8000/decision",
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nStatus Code: {response.status_code}")
        print("Response:")
        response_data = response.json()
        print(json.dumps(response_data, indent=2))
        
        # Check for success indicators
        if response.status_code == 200:
            status = response_data.get("status", "unknown")
            confidence = response_data.get("confidence", 0)
            items = response_data.get("result", {}).get("items", [])
            
            print(f"\n✓ Status: {status}")
            print(f"✓ Confidence: {confidence}")
            print(f"✓ Items returned: {len(items)}")
            
            if status == "complete" and confidence > 0:
                print(f"✅ {test_name} - SUCCESS")
            else:
                print(f"⚠️  {test_name} - PARTIAL (status={status}, conf={confidence})")
        else:
            print(f"❌ {test_name} - FAILED (HTTP {response.status_code})")
            
    except requests.exceptions.ConnectionError:
        print(f"❌ {test_name} - CONNECTION ERROR: Is the server running on port 8000?")
    except Exception as e:
        print(f"❌ {test_name} - ERROR: {e}")

if __name__ == "__main__":
    print("Decision Engine Simple Test")
    print("=" * 40)
    
    # Test temperature risk assessment
    temp_request = create_temperature_risk_request()
    test_request(temp_request, "Temperature Risk Assessment")
    
    # Test irrigation decision
    irrigation_request = create_irrigation_request() 
    test_request(irrigation_request, "Irrigation Decision")
    
    print("\n" + "=" * 40)
    print("Tests completed!")
