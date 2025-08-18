#!/usr/bin/env python3
"""
Test pesticide advice with the specific input format provided by user
"""

import sys
import os
import json
from datetime import datetime, timedelta

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from orchestrator import process_act_intent

def test_pesticide_advice():
    """Test pesticide advice with user's specific data format"""
    
    request_data = {
        "intent": "pesticide_advice",
        "decision_template": "pesticide_safe_recommendation",
        "request_id": "test-pesticide-001",
        "missing": [],
        "tool_calls": [
            {
                "tool": "pesticide_lookup",
                "args": {
                    "crop": "potato",
                    "pest": "aphids",
                    "stage": "tuberization"
                }
            },
            {
                "tool": "rag_search",
                "args": {
                    "query": "IPM practices for aphids on potato",
                    "k": 6
                }
            },
            {
                "tool": "web_search",
                "args": {
                    "query": "organic aphid control potato natural remedies"
                }
            }
        ],
        "facts": {
            "pesticide": {
                "data": {
                    "items": [
                        {
                            "crop_name": "Potato",
                            "target": "Aphids",
                            "active_ingredient": "Acetamiprid",
                            "formulation": "20% SP",
                            "dose_ai_g_ha": "10–20 g",
                            "dose_formulation_qty_per_ha": "50–100 g",
                            "spray_volume_l_ha": "500",
                            "application_method": "Foliar spray: apply solution evenly with knapsack or tractor sprayer; thorough leaf coverage is essential, especially on lower leaf surfaces.",
                            "phi_days": "7",
                            "ppe_notes": "Use gloves and mask.",
                            "who_class": "Class II (Moderately hazardous)",
                            "label_source_url": None,
                            "as_on_date": "2025-03-31",
                            "last_checked": "2025-08-14",
                            "status": "Registered",
                            "notes": None,
                            "sources": [
                                "1._mup_insecticide_03.04.2025.pdf"
                            ],
                            "source_file": "acetamiprid_acequinocyl.json"
                        }
                    ],
                    "count": 1
                },
                "source_stamp": {
                    "type": "static_pack",
                    "path": "data\\static_json\\pesticides"
                },
                "matched": {
                    "filters": {
                        "crop": "potato",
                        "target": "aphids",
                        "active_ingredient": None,
                        "formulation": None,
                        "who_class": None,
                        "status": None,
                        "registered_only": False,
                        "category": None,
                        "bio_only": False,
                        "chemical_only": False
                    }
                },
                "_meta": {
                    "route": "local_scan",
                    "scanned_files": [
                        "abamectin_acequinocyl.json",
                        "acetamiprid_acequinocyl.json",
                        "bio_insectisides.json",
                        "bio_pesticides.json",
                        "fungicides.json",
                        "herbicides.json",
                        "other_pesticides.json",
                        "pgr.json"
                    ],
                    "sort": "status->as_on_date(desc)->phi_days(asc)"
                }
            },
            "rag": {
                "data": []
            },
            "web": {
                "data": {
                    "results": [
                        {
                            "title": "16 PROVEN Ways to Get Rid of Aphids on Potato (2023)",
                            "url": "https://thegardeningdad.com/proven-ways-to-get-rid-of-aphids-on-potato/",
                            "snippet": "Dec 20, 2022 · This ultimate guide is broken down by how to get rid of aphids on potato and how to prevent aphids with natural remedies that work, commercial products that live up to …",
                            "source": "ddg"
                        },
                        {
                            "title": "25 Natural Ways to Kill Aphids | Get Rid of Aphids Naturally",
                            "url": "https://balconygardenweb.com/natural-ways-to-kill-aphids-tips-and-spray-recipes/",
                            "snippet": "",
                            "source": "ddg"
                        },
                        {
                            "title": "Get Rid of Aphids Naturally With These 9 No-Fail Solutions",
                            "url": "https://gardenbetty.com/organic-pest-control-101-7-easy-solutions-for-getting-rid-of-aphids/",
                            "snippet": "",
                            "source": "ddg"
                        },
                        {
                            "title": "How to Get Rid of Aphids on Potato Plant",
                            "url": "https://livetoplant.com/how-to-get-rid-of-aphids-on-potato-plant/",
                            "snippet": "Jul 3, 2023 · One of the first lines of defense against aphids is using natural remedies that are safe for both the plants and the environment. Here are a few options: a. Water Spray. A strong blast …",
                            "source": "ddg"
                        },
                        {
                            "title": "How To Get Rid Of Aphids In A Organic Way - blog.entomologist.net",
                            "url": "https://blog.entomologist.net/how-to-get-rid-of-aphids-in-a-organic-way.html",
                            "snippet": "Jun 4, 2025 · To control aphids naturally, squash and remove them, blast them off, spray soapy water, cover vulnerable vegetables, and attract them. There are many home-made recipes for …",
                            "source": "ddg"
                        }
                    ],
                    "answer_box": None
                },
                "source_stamp": {
                    "type": "search",
                    "providers": [
                        "ddg"
                    ],
                    "executed_at": "2025-08-17T22:33:38Z",
                    "args_used": {
                        "k": 5,
                        "recency_days": 0,
                        "region": "in-en",
                        "safesearch": "moderate",
                        "news_only": False,
                        "domains": [],
                        "site": None
                    }
                }
            }
        }
    }
    
    print("=== Testing Pesticide Advice (User's Data Format) ===")
    print("Request data:")
    print(json.dumps({k: v for k, v in request_data.items() if k != 'facts'}, indent=2, default=str))
    print("\nFacts summary:")
    print(f"- Pesticide items: {len(request_data['facts']['pesticide']['data']['items'])}")
    print(f"- RAG results: {len(request_data['facts']['rag']['data'])}")
    print(f"- Web results: {len(request_data['facts']['web']['data']['results'])}")
    
    try:
        result = process_act_intent(request_data)
        
        print("\nResult:")
        print(json.dumps(result, indent=2, default=str))
        
        # Check result
        status = result.get("status", "unknown")
        confidence = result.get("confidence", 0)
        items = result.get("result", {}).get("items", []) if result.get("result") else []
        action = result.get("result", {}).get("action", "") if result.get("result") else ""
        
        print(f"\n✓ Status: {status}")
        print(f"✓ Action: {action}")
        print(f"✓ Confidence: {confidence}")
        print(f"✓ Items returned: {len(items)}")
        
        if items:
            for i, item in enumerate(items):
                print(f"✓ Item {i+1}: {item.get('name', 'unnamed')} (score: {item.get('score', 0)})")
        
        if status == "complete" and confidence > 0 and items:
            print("✅ Pesticide Advice Test - SUCCESS")
        elif action == "require_more_info":
            print(f"⚠️  Pesticide Advice Test - NEEDS MORE INFO: {result.get('result', {}).get('notes', '')}")
        else:
            print(f"⚠️  Pesticide Advice Test - PARTIAL (status={status}, conf={confidence})")
            
        return result
        
    except Exception as e:
        print(f"❌ Pesticide Advice Test - ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    print("Pesticide Advice Test")
    print("=" * 60)
    
    result = test_pesticide_advice()
    
    print("\n" + "=" * 60)
    print("Test completed!")
