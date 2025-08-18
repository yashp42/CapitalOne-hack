#!/usr/bin/env python3
import json
import sys
import os
sys.path.append('.')

from rules.variety_selection import handle

# User's actual data from request
test_data = {
  "intent": "variety_selection",
  "decision_template": "variety_ranked_list",
  "missing": [],
  "tool_calls": [
    {
      "tool": "geocode_tool",
      "args": {
        "state": "Bihar",
        "district": "Patna"
      }
    },
    {
      "tool": "weather_outlook",
      "args": {
        "days": 5
      }
    },
    {
      "tool": "regional_crop_info",
      "args": {
        "state": "Bihar"
      }
    },
    {
      "tool": "rag_search",
      "args": {
        "query": "Bihar kharif crop suitability current weather"
      }
    }
  ],
  "facts": {
    "location": {
      "data": {
        "lat": 25.61,
        "lon": 85.14,
        "matched_state": "Bihar",
        "matched_district": "Patna",
        "confidence": 0.95,
        "method": "static_centroid"
      },
      "source_stamp": {
        "type": "local_dataset",
        "path": "data\\static_json\\geo\\district_centroids.json"
      }
    },
    "weather": {
      "data": {
        "lat": 25.625,
        "lon": 85.125,
        "elevation": 56,
        "tz": "Asia/Kolkata",
        "run_at": "2025-08-17T23:34:26Z",
        "time": [
          "2025-08-17",
          "2025-08-18",
          "2025-08-19",
          "2025-08-20",
          "2025-08-21",
          "2025-08-22"
        ],
        "tmax_c": [
          33.9,
          32.5,
          32.8,
          32.1,
          30.4,
          29
        ],
        "tmin_c": [
          28.3,
          27.4,
          26.7,
          26.3,
          26.1,
          26
        ],
        "rain_mm": [
          1.4,
          4.7,
          1.8,
          8.2,
          20.2,
          15.3
        ]
      }
    },
    "calendar": {
      "data": {
        "state": "Bihar",
        "district": None,
        "agro_climatic_zone": "North West Alluvial Plain Zone",
        "source_type": "CRIDA_contingency",
        "crops": [
          {
            "crop_name": "rice",
            "season": "Kharif",
            "planting_window": {
              "start": "06-20",
              "end": "07-15"
            },
            "ideal_temp_c": {
              "range_day": [
                25,
                35
              ],
              "notes": "Warm, humid climate preferred"
            },
            "irrigation_ideal": {
              "critical_stages": [
                "transplanting",
                "tillering",
                "flowering",
                "grain filling"
              ],
              "seasonal_requirement_mm": 1200,
              "notes": "Avoid water stress during critical growth stages"
            }
          },
          {
            "crop_name": "wheat",
            "season": "Rabi",
            "planting_window": {
              "start": "11-15",
              "end": "12-10"
            },
            "ideal_temp_c": {
              "range_day": [
                20,
                25
              ],
              "notes": "Cool climate preferred during growth, warmer during maturity"
            },
            "irrigation_ideal": {
              "critical_stages": [
                "crown root initiation",
                "tillering",
                "flowering",
                "grain filling"
              ],
              "seasonal_requirement_mm": 450,
              "notes": "Avoid stress during reproductive stages"
            }
          },
          {
            "crop_name": "maize",
            "season": "Kharif",
            "planting_window": {
              "start": "05-28",
              "end": "06-14"
            }
          },
          {
            "crop_name": "pigeonpea",
            "season": "Kharif",
            "planting_window": {
              "start": "05-01",
              "end": "07-28"
            }
          },
          {
            "crop_name": "lentil",
            "season": "Rabi",
            "planting_window": {
              "start": "10-01",
              "end": "11-01"
            }
          }
        ]
      }
    },
    "rag": {
      "data": []
    }
  }
}

if __name__ == '__main__':
    try:
        result = handle(intent=test_data, facts=test_data['facts'])
        print('Variety Selection Result:')
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()
