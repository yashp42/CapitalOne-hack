#!/usr/bin/env python3
"""
Test the individual confidence calculation in temperature_risk
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Test the severity calculation
def test_severity_calculation():
    print("=== Testing Severity Calculation ===")
    
    # Import the function
    try:
        from rules.temperature_risk import _severity_from_difference
        
        test_cases = [
            (0.5, "Minor breach: 0.5°C"),    # Should be ~0.2
            (1.0, "Minor breach: 1.0°C"),    # Should be ~0.3  
            (2.0, "Moderate breach: 2.0°C"), # Should be ~0.5
            (3.0, "Moderate breach: 3.0°C"), # Should be ~0.7
            (5.0, "Severe breach: 5.0°C"),   # Should be ~0.85
            (10.0, "Extreme breach: 10.0°C"), # Should be ~1.0
        ]
        
        for diff, description in test_cases:
            severity = _severity_from_difference(diff, 2.0)  # reference doesn't matter now
            print(f"  {description}: diff={diff}°C → severity={severity:.3f}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

def test_confidence_helpers():
    print("\n=== Testing Helper Confidence ===")
    
    try:
        from utils.helpers import compute_confidence
        
        # Test data similar to your frost case
        signals = {
            "handler_confidence": 0.5,
            "items_mean_score": 0.5,
            "n_items": 1,
            "num_forecast_days": 3
        }
        
        facts = {
            "weather_outlook": {
                "source_type": "external",
                "confidence": 0.9,  # High confidence weather data
                "forecast": [{"date": "2025-08-20", "tmin": 0, "tmax": 15}]
            },
            "calendar_lookup": {
                "source_type": "reference", 
                "confidence": 0.95,  # Very high confidence reference data
                "current_stage": "flowering"
            }
        }
        
        required_tools = ["weather_outlook", "calendar_lookup"]
        
        helper_conf = compute_confidence(
            signals=signals,
            facts=facts, 
            required_tools=required_tools
        )
        
        print(f"  Signals: {signals}")
        print(f"  Facts confidence: weather=0.9, calendar=0.95")
        print(f"  Helper confidence: {helper_conf:.3f}")
        
        # Calculate final confidence like the rule does
        base_conf = 0.5
        if True:  # assume we have provenance
            final_conf = 0.6 * helper_conf + 0.4 * base_conf
        else:
            final_conf = 0.8 * base_conf + 0.2 * helper_conf
            
        print(f"  Final blended confidence: {final_conf:.3f}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_severity_calculation()
    test_confidence_helpers()
