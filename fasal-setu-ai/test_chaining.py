#!/usr/bin/env python3

import sys
import os
sys.path.append('.')

from py.ai_engine.graph.tools_node import tools_node
from py.ai_engine.graph.state import PlannerState, ToolCall

def test_crop_price_chaining():
    """Test the regional_crop_info → prices_fetch chaining"""
    print("Testing crop → price chaining...")
    
    # Create state with both tools
    state = PlannerState(
        query='test crop-price chaining',
        pending_tool_calls=[
            ToolCall(tool='regional_crop_info', args={'state': 'Maharashtra'}),
            ToolCall(tool='prices_fetch', args={'state': 'Maharashtra'})
        ]
    )
    
    try:
        result = tools_node(state)
        
        print("\n=== Results ===")
        print(f"Calendar data available: {bool(result.facts.get('calendar', {}).get('data'))}")
        print(f"Prices data available: {bool(result.facts.get('prices', {}).get('data'))}")
        
        # Check calendar
        calendar = result.facts.get('calendar', {})
        if calendar.get('data'):
            crops = calendar['data'].get('crops', [])
            print(f"Crops found: {[c.get('crop_name') for c in crops[:3] if isinstance(c, dict)]}")
        
        # Check prices
        prices = result.facts.get('prices', {})
        if prices.get('error'):
            print(f"Prices error: {prices['error']}")
        elif prices.get('data'):
            print("Prices data successfully retrieved!")
            if 'auto_commodity_from_calendar' in prices.get('_meta', {}):
                print(f"Auto-selected commodity: {prices['_meta']['auto_commodity_from_calendar']}")
        
        return result
        
    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_crop_price_chaining()
