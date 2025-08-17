#!/usr/bin/env python3
"""
Test JSON requests to the Decision Engine API
"""
import requests
import json

# Test data for temperature risk assessment
test_request = {
    "intent": "temperature_risk",
    "decision_template": "frost_or_heat_risk_assessment",
    "tool_calls": [
        {
            "tool": "weather_outlook",
            "args": {"lat": 26.8467, "lon": 80.9462},
            "output": {
                "forecast": [
                    {"date": "2025-08-20", "tmin": 0.0, "tmax": 15.0, "rain_mm": 0.0},
                    {"date": "2025-08-21", "tmin": 5.0, "tmax": 18.0, "rain_mm": 2.0},
                    {"date": "2025-08-22", "tmin": 8.0, "tmax": 22.0, "rain_mm": 0.5}
                ],
                "source_id": "open-meteo",
                "source_type": "weather_api"
            }
        },
        {
            "tool": "calendar_lookup",
            "args": {"crop": "wheat", "stage": "flowering"},
            "output": {
                "current_stage": "flowering", 
                "stage_critical_temps": {
                    "flowering": {
                        "frost_threshold": 2.0, 
                        "heat_threshold": 38.0
                    }
                },
                "source_id": "agri_dept",
                "source_type": "government"
            }
        }
    ],
    "request_id": "test-temperature-risk-123"
}

def test_api():
    """Test the Decision Engine API with a JSON request"""
    url = "http://127.0.0.1:8000"
    
    print("=== Testing Decision Engine API ===")
    
    # Test root endpoint
    try:
        response = requests.get(f"{url}/")
        print(f"✓ Root endpoint: {response.status_code}")
        print(f"  Response: {response.json()}")
    except Exception as e:
        print(f"✗ Root endpoint failed: {e}")
    
    # Test ping endpoint
    try:
        response = requests.get(f"{url}/ping")
        print(f"✓ Ping endpoint: {response.status_code}")
        print(f"  Response: {response.json()}")
    except Exception as e:
        print(f"✗ Ping endpoint failed: {e}")
    
    # Test decision endpoint
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(f"{url}/decision", json=test_request, headers=headers)
        print(f"✓ Decision endpoint: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"  Intent: {result.get('intent')}")
            print(f"  Status: {result.get('status')}")
            print(f"  Confidence: {result.get('confidence')}")
            print(f"  Notes: {result.get('notes')}")
            if result.get('result', {}).get('action'):
                print(f"  Action: {result['result']['action']}")
        else:
            print(f"  Error response: {response.text}")
            
    except Exception as e:
        print(f"✗ Decision endpoint failed: {e}")

if __name__ == "__main__":
    print("Make sure the server is running with: python app.py")
    print("Then run this test with: python test_json_request.py")
    print()
    test_api()
