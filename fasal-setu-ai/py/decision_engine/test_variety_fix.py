#!/usr/bin/env python3
import json
import sys
import os
sys.path.append('.')

from rules.variety_selection import handle

# User's JSON data with variety selection intent
test_data = {
    'intent': {
        'intent_type': 'variety_selection',
        'attributes': {
            'crop': 'chickpea',
            'location': 'Faridabad, Haryana, India',
            'season': 'rabi',
            'land_size': '2 acre'
        }
    },
    'facts': {
        'location': {
            'query': 'Faridabad, Haryana, India',
            'lat': 28.4089,
            'lng': 77.3178
        },
        'weather': [
            {
                'date': '2024-12-22',
                'temperature_min': 7.8,
                'temperature_max': 19.5,
                'humidity': 58,
                'wind_speed': 5.4,
                'description': 'Clear',
                'precipitation': 0.0
            }
        ],
        'calendar': {
            'chickpea': {
                'sowing_start': '2024-10-15',
                'sowing_end': '2024-11-30',
                'harvesting_start': '2025-03-15',
                'harvesting_end': '2025-04-30',
                'duration': 150,
                'rainfall_requirement': 400,
                'temperature_min': 5,
                'temperature_max': 30
            },
            'mustard': {
                'sowing_start': '2024-10-01',
                'sowing_end': '2024-11-15',
                'harvesting_start': '2025-02-15',
                'harvesting_end': '2025-03-31',
                'duration': 135,
                'rainfall_requirement': 350,
                'temperature_min': 10,
                'temperature_max': 28
            }
        },
        'rag': [
            {'content': 'Chickpea varieties suitable for Haryana include HC-1, HC-3, and Pusa-362.'},
            {'content': 'Mustard cultivation is profitable in winter season with proper irrigation.'}
        ]
    }
}

if __name__ == '__main__':
    try:
        result = handle(intent=test_data['intent'], facts=test_data['facts'])
        print('Variety Selection Result:')
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()
