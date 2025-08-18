#!/usr/bin/env python3
"""
Direct test of orchestrator functionality without FastAPI
"""

import sys
import os
import json
from datetime import datetime, timedelta

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from orchestrator import process_act_intent

def test_temperature_risk():
    """Test temperature risk assessment directly"""
    
    # Create forecast data with frost risk
    forecast_data = []
    base_date = datetime.now()
    
    for i in range(7):
        date = base_date + timedelta(days=i)
        forecast_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "t_min": 5.0 - i,  # Will go below 2°C threshold
            "t_max": 15.0 + i,
            "rain_mm": 2.0
        })
    
    request_data = {
        "intent": "temperature_risk",
        "decision_template": "frost_or_heat_risk_assessment",
        "request_id": "test-direct-001",
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
    
    print("=== Testing Temperature Risk (Direct Orchestrator) ===")
    print("Request data:")
    print(json.dumps(request_data, indent=2, default=str))
    
    try:
        result = process_act_intent(request_data)
        
        print("\nResult:")
        print(json.dumps(result, indent=2, default=str))
        
        # Check result
        status = result.get("status", "unknown")
        confidence = result.get("confidence", 0)
        items = result.get("result", {}).get("items", []) if result.get("result") else []
        
        print(f"\n✓ Status: {status}")
        print(f"✓ Confidence: {confidence}")
        print(f"✓ Items returned: {len(items)}")
        
        if status == "complete" and confidence > 0:
            print("✅ Temperature Risk Test - SUCCESS")
        elif "missing" in result and result["missing"]:
            print(f"⚠️  Temperature Risk Test - MISSING: {result['missing']}")
        else:
            print(f"⚠️  Temperature Risk Test - PARTIAL (status={status}, conf={confidence})")
            
        return result
        
    except Exception as e:
        print(f"❌ Temperature Risk Test - ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    print("Direct Orchestrator Test")
    print("=" * 50)
    
    result = test_temperature_risk()
    
    print("\n" + "=" * 50)
    print("Direct test completed!")
