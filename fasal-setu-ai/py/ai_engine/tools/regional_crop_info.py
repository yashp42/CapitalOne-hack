"""
Regional Crop Information Tool (exact match + smart fallback).

Provides comprehensive region-specific agricultural information including:
- Recommended crop varieties
- Planting and harvesting windows
- Local agricultural practices
- Climate-appropriate recommendations

Data source: JSON files under data/static_json/crop_calendar/<state>_<district>.json
Resolution: Exact matching with smart fallback to RAG/web search

Args:
{
  "kind": "crop_calendar",                # required (currently only this kind supported)
  "state": "Karnataka",                   # optional (needed for region mode)
  "district": "Bengaluru Rural",          # optional (needed for region mode)
  "crop": "paddy",                        # optional
  "fields": ["region_info","crop_info"],  # optional; default both
  "query": "level of water required in rice",  # optional free-text; triggers fallback when region/crop insufficient
  "fallback": { "allow_rag": true, "allow_web": false, "k": 6 },  # optional; defaults as shown
  "strict_region": false                  # if true, do not fallback when region is missing
}

Return envelope (always):
{
  "data": { "region_info": {...} | null, "crop_info": {...} | null } | null,
  "source_stamp": { "type":"static_pack", "path":"...", "doc_date":"...", "last_checked":"..." },
  "matched": { "state":"...", "district":"...", "crop":"...", "match_method":"exact|none", "confidence": 0.0 },
  "available": { "crops": ["..."] },
  "_meta": { "fields": [...], "route": "calendar|calendar+rag|rag_local|web" },
  "fallback": { "route":"rag_local|web", "reason":"region_not_found|general_crop_query|crop_not_found", "query":"...", "passages":[...]}  # present when fallback used
  # "error": "..."  # present if strict_region=true or everything failed
}
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple

try:
    from .paths import CROP_CALENDAR_DIR  # type: ignore
except Exception:
    try:
        from tools.paths import CROP_CALENDAR_DIR  # type: ignore
    except Exception:
        CROP_CALENDAR_DIR = Path(__file__).resolve().parent / ".." / "data" / "static_json" / "crop_calendar"
        CROP_CALENDAR_DIR = CROP_CALENDAR_DIR.resolve()

# path to new internal data location
DATA_DIR = str(CROP_CALENDAR_DIR)

_WS = re.compile(r"\s+")
_NONALNUM = re.compile(r"[^a-z0-9_]+")

def _canon(s: str) -> str:
    """lowercase, collapse whitespace to single space, then turn spaces/hyphens into underscores."""
    x = _WS.sub(" ", s.strip().lower())
    x = x.replace("-", " ")
    x = _WS.sub("_", x).strip("_")
    x = _NONALNUM.sub("_", x)
    return x

def _file_path(state: Optional[str], district: Optional[str]) -> Optional[str]:
    if not state or not district:
        return None
    stem = f"{_canon(state)}_{_canon(district)}"
    path = os.path.join(DATA_DIR, f"{stem}.json")
    return path if os.path.exists(path) else None

def _read_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _normalize_crop_info(crop_data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize crop info to always include all expected fields with null values if missing."""
    return {
        "crop_name": crop_data.get("crop_name"),
        "season": crop_data.get("season"),
        "planting_window": {
            "start": crop_data.get("planting_window", {}).get("start"),
            "end": crop_data.get("planting_window", {}).get("end")
        },
        "stages": crop_data.get("stages", []),
        "stage_lengths_days": crop_data.get("stage_lengths_days"),
        "ideal_temp_c": {
            "range_day": crop_data.get("ideal_temp_c", {}).get("range_day"),
            "notes": crop_data.get("ideal_temp_c", {}).get("notes")
        },
        "soil_ideal": {
            "text": crop_data.get("soil_ideal", {}).get("text"),
            "ph_range": crop_data.get("soil_ideal", {}).get("ph_range")
        },
        "irrigation_ideal": {
            "critical_stages": crop_data.get("irrigation_ideal", {}).get("critical_stages", []),
            "seasonal_requirement_mm": crop_data.get("irrigation_ideal", {}).get("seasonal_requirement_mm"),
            "notes": crop_data.get("irrigation_ideal", {}).get("notes")
        },
        "weather_ideal": {
            "notes": crop_data.get("weather_ideal", {}).get("notes", [])
        },
        "contingencies": [
            {
                "hazard": cont.get("hazard"),
                "stage_window": cont.get("stage_window"),
                "measures": cont.get("measures", []),
                "alt_crops": cont.get("alt_crops"),
                "inputs_support_notes": cont.get("inputs_support_notes")
            }
            for cont in crop_data.get("contingencies", [])
        ] if crop_data.get("contingencies") else [
            {
                "hazard": None,
                "stage_window": None,
                "measures": [],
                "alt_crops": None,
                "inputs_support_notes": None
            }
        ],
        "market_mapping": {
            "commodity_names": crop_data.get("market_mapping", {}).get("commodity_names", [])
        },
        "data_gaps": crop_data.get("data_gaps", []),
        "sources": crop_data.get("sources", [])
    }

def _normalize_region_info(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize region info to always include all expected fields with null values if missing."""
    return {
        "state": doc.get("state"),
        "district": doc.get("district"),
        "agro_climatic_zone": doc.get("agro_climatic_zone"),
        "source_type": doc.get("source_type"),
        "source_url": doc.get("source_url"),
        "doc_date": doc.get("doc_date"),
        "last_checked": doc.get("last_checked"),
        "normal_annual_rain_mm": doc.get("normal_annual_rain_mm"),
        "rainfall_pattern_notes": doc.get("rainfall_pattern_notes"),
        "dominant_soils": doc.get("dominant_soils", []),
        "crops": [_normalize_crop_info(crop) for crop in doc.get("crops", [])],
        "dataset_sources": [
            {
                "key": src.get("key"),
                "title": src.get("title"),
                "url": src.get("url"),
                "tier": src.get("tier"),
                "last_checked": src.get("last_checked")
            }
            for src in doc.get("dataset_sources", [])
        ] if doc.get("dataset_sources") else [
            {
                "key": None,
                "title": None,
                "url": None,
                "tier": None,
                "last_checked": None
            }
        ]
    }

def _available_crops(doc: Dict[str, Any]) -> List[str]:
    crops = []
    for c in doc.get("crops", []) or []:
        name = c.get("crop_name")
        if name:
            crops.append(str(name))
    # unique + stable order
    seen, out = set(), []
    for n in crops:
        k = n.lower()
        if k not in seen:
            seen.add(k)
            out.append(n)
    return out

def _find_crop_info(doc: Dict[str, Any], crop: Optional[str]) -> Optional[Dict[str, Any]]:
    if not crop:
        return None
    target = crop.strip().lower()
    for c in doc.get("crops", []) or []:
        if (c.get("crop_name") or "").strip().lower() == target:
            return c
    return None

def _normalize_state_spelling(state: str) -> str:
    """Handle common misspellings in state names to match file names."""
    if not state:
        return state
    
    # Common misspellings in the data files
    spelling_map = {
        "maharashtra": "maharastra",  # Files use maharastra (missing h)
        # Add other common misspellings here as needed
    }
    
    canonical = _canon(state)
    return spelling_map.get(canonical, canonical)

def _try_static_data(args: Dict[str, Any]) -> Dict[str, Any]:
    """Try to get data from static JSON files first."""
    state = args.get("state")
    district = args.get("district")
    crop = args.get("crop")
    fields = args.get("fields") or ["region_info", "crop_info"]
    strict_region = bool(args.get("strict_region", False))

    # Normalize state spelling to match actual file names
    if state:
        state = _normalize_state_spelling(state)

    try:
        # List all JSON files in the crop calendar directory
        matched_files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]

        # If strict_region requested and both state+district present, require exact file
        if strict_region and state and district:
            file_stem = f"{state}_{_canon(district)}"
            target_file = next((f for f in matched_files if f.startswith(file_stem)), None)
            if not target_file:
                return {
                    "data": None,
                    "error": "region_not_found",
                    "source_stamp": {"type": "static_pack", "path": DATA_DIR},
                    "_meta": {
                        "suggest_web_search": True,
                        "search_query_suggestion": f"crop information {state} {district} {crop}"
                    }
                }
        # Otherwise, we'll try to aggregate matches across multiple files
        target_file = None
        # If a specific file matched and no crop was requested, return full doc
        aggregated_matches: List[Dict[str, Any]] = []

        # Helper: open and annotate doc
        def _load_doc(fname: str) -> Dict[str, Any]:
            with open(os.path.join(DATA_DIR, fname), "r", encoding="utf-8") as fh:
                d = json.load(fh)
            d["_source_file"] = fname
            return d

        # If both state+district provided, prefer exact matches (but still allow other files for crop search)
        if state and district:
            stem = f"{state}_{_canon(district)}"
            for f in matched_files:
                if f.startswith(stem):
                    aggregated_matches.append(_load_doc(f))

        # If crop is provided, search across all files for that crop
        if crop:
            target_crop = crop.strip().lower()
            for f in matched_files:
                doc = _load_doc(f)
                for c in doc.get("crops", []) or []:
                    if (c.get("crop_name") or "").strip().lower() == target_crop:
                        aggregated_matches.append(doc)
                        break

        # If only state provided (no district), collect all files for that state
        if state and not district:
            # First check for a direct state file without district
            state_file = f"{state}.json"
            if state_file in matched_files:
                aggregated_matches.append(_load_doc(state_file))
            else:
                # Otherwise collect all district files for this state
                state_prefix = state + "_"
                for f in matched_files:
                    if f.startswith(state_prefix):
                        aggregated_matches.append(_load_doc(f))

        # Deduplicate aggregated_matches by source file
        seen_files = set()
        aggr_unique = []
        for d in aggregated_matches:
            sf = d.get("_source_file")
            if sf and sf not in seen_files:
                seen_files.add(sf)
                aggr_unique.append(d)

        if aggr_unique:
            # Always return the complete normalized schema format
            # For multiple files, merge them into a comprehensive structure
            if len(aggr_unique) == 1:
                # Single file - return complete normalized structure
                doc = aggr_unique[0]
                normalized_doc = _normalize_region_info(doc)
                
                # If a specific crop was requested, filter to just that crop
                if crop:
                    matching_crops = [c for c in normalized_doc["crops"] if (c.get("crop_name") or "").lower() == crop.lower()]
                    if matching_crops:
                        normalized_doc["crops"] = matching_crops
                
                return {
                    "data": normalized_doc,
                    "source_stamp": {
                        "type": "static_pack",
                        "path": DATA_DIR,
                        "files": [doc.get("_source_file")]
                    },
                    "matched": {
                        "state": state,
                        "district": district,
                        "crop": crop,
                        "match_method": "exact",
                        "confidence": 0.95
                    },
                    "available": {"crops": [c["crop_name"] for c in normalized_doc["crops"] if c.get("crop_name")]},
                    "_meta": {"fields": fields, "route": "static_exact"}
                }
            else:
                # Multiple files - merge into single comprehensive schema
                # Use the first doc as base structure
                base_doc = aggr_unique[0]
                merged_doc = _normalize_region_info(base_doc)
                
                # Collect all crops from all documents
                all_crops = []
                crops_seen = set()
                
                for d in aggr_unique:
                    for c in d.get("crops", []) or []:
                        crop_name = (c.get("crop_name") or "").strip().lower()
                        if not crop_name:
                            continue
                        
                        # If specific crop requested, only include that crop
                        if crop and crop_name != crop.lower():
                            continue
                            
                        # Avoid duplicates
                        crop_key = f"{crop_name}_{d.get('state', '')}_{d.get('district', '')}"
                        if crop_key not in crops_seen:
                            crops_seen.add(crop_key)
                            normalized_crop = _normalize_crop_info(c)
                            # Add region context to crop
                            normalized_crop["_region_context"] = {
                                "state": d.get("state"),
                                "district": d.get("district"),
                                "source_file": d.get("_source_file")
                            }
                            all_crops.append(normalized_crop)
                
                # Update merged document
                merged_doc["crops"] = all_crops
                
                # If multiple states, set state to None and list available states in meta
                states_found = list({d.get("state") for d in aggr_unique if d.get("state")})
                districts_found = list({d.get("district") for d in aggr_unique if d.get("district")})
                
                if len(states_found) > 1:
                    merged_doc["state"] = None
                    merged_doc["district"] = None
                elif len(districts_found) > 1 and len(states_found) == 1:
                    merged_doc["district"] = None
                
                # Collect all available crop names
                available_crops = list({c["crop_name"] for c in all_crops if c.get("crop_name")})
                
                return {
                    "data": merged_doc,
                    "source_stamp": {
                        "type": "static_pack",
                        "path": DATA_DIR,
                        "files": list(seen_files)
                    },
                    "matched": {
                        "state": state,
                        "district": district,
                        "crop": crop,
                        "match_method": "aggregate",
                        "confidence": 0.8
                    },
                    "available": {
                        "crops": available_crops,
                        "states": states_found,
                        "districts": districts_found
                    },
                    "_meta": {"fields": fields, "route": "static_aggregate"}
                }

        # Nothing matched in static files
        return {
            "data": None,
            "error": "no_matching_data",
            "_meta": {
                "suggest_web_search": True,
                "search_query_suggestion": f"crop information {state or ''} {district or ''} {crop or ''}",
                "fallback_route": "rag"
            }
        }

    except Exception as e:
        return {
            "data": None,
            "error": str(e),
            "_meta": {"suggest_web_search": True}
        }

def _try_rag_fallback(query: str, k: int = 6) -> Dict[str, Any]:
    """Try RAG search as first fallback."""
    try:
        from .rag_search import rag_search
        payload = rag_search({"query": query, "k": k})
        passages = (payload or {}).get("data", {}).get("passages", []) or []
        
        if passages:
            return {
                "data": {"passages": passages},
                "source_stamp": {"type": "rag_fallback"},
                "_meta": {
                    "fallback_route": "rag",
                    "suggest_web_search": len(passages) < 2  # Suggest web if very few results
                }
            }
        
        return {
            "data": None,
            "error": "no_rag_results",
            "_meta": {
                "suggest_web_search": True,
                "search_query_suggestion": query
            }
        }
    except Exception:
        return {
            "data": None,
            "error": "rag_search_failed",
            "_meta": {"suggest_web_search": True}
        }

def _try_web_fallback(query: str, k: int = 6) -> Dict[str, Any]:
    """Try web search as final fallback."""
    try:
        from .web_search import web_search
        payload = web_search({"query": query, "k": k})
        results = (payload or {}).get("data", {}).get("results", []) or []
        
        passages = [
            {
                "text": r.get("snippet") or r.get("title") or "",
                "source_stamp": {"type": "web", "url": r.get("url")}
            }
            for r in results[:k]
        ]
        
        if passages:
            return {
                "data": {"passages": passages},
                "source_stamp": {"type": "web_search"},
                "_meta": {
                    "fallback_route": "web",
                    "suggest_more_sources": len(passages) < 2
                }
            }
        
        return {
            "data": None,
            "error": "no_web_results",
            "_meta": {
                "suggest_experts": True,
                "search_query_suggestion": query
            }
        }
    except Exception:
        return {
            "data": None,
            "error": "web_search_failed", 
            "_meta": {"suggest_experts": True}
        }

def get_regional_crop_info(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get region-specific crop information including varieties, calendars, and practices."""
    # Input validation and kind check
    if (args or {}).get("kind", "crop_calendar") != "crop_calendar":
        return {
            "data": None, 
            "error": "unsupported_kind",
            "source_stamp": {"type": "static_pack", "path": DATA_DIR}
        }
        
    # Set default fields if not provided
    if "fields" not in args or not args["fields"]:
        args["fields"] = ["region_info", "crop_info"]

    # Query mode - try RAG first
    query = (args.get("query") or "").strip()
    if query:
        fb = args.get("fallback") or {}
        k = int(fb.get("k", 6))
        
        # Try RAG first if allowed
        if fb.get("allow_rag", True):
            rag_result = _try_rag_fallback(query, k)
            if rag_result.get("data"):
                return {**rag_result, "_meta": {
                    **(rag_result.get("_meta") or {}),
                    "route": "rag_local",
                    "reason": "query_mode"
                }}
            
            # Add web suggestion if enabled
            if fb.get("allow_web"):
                rag_result["_meta"] = {
                    **(rag_result.get("_meta") or {}),
                    "suggest_web_search": True,
                    "search_query_suggestion": query
                }
            return rag_result

    # Try static data lookup
    static_result = _try_static_data(args)
    if static_result.get("data"):
        # If there's a query, append RAG results if allowed 
        if query and args.get("fallback", {}).get("allow_rag", True):
            rag_result = _try_rag_fallback(query)
            if rag_result.get("data"):
                static_result["rag_data"] = rag_result.get("data")
                static_result["_meta"] = {
                    **(static_result.get("_meta") or {}),
                    "route": "calendar+rag"
                }
        return static_result

    # Handle fallbacks based on configuration
    fb = args.get("fallback") or {}
    state = args.get("state")
    district = args.get("district") 
    crop = args.get("crop")
    k = int(fb.get("k", 6))

    # Build fallback query
    fbq = query or (
        f"{crop} crop calendar irrigation critical stages India" if crop
        else "crop calendar irrigation critical stages India"
    )

    if state and district:
        fbq = f"crop information {state} {district} {fbq}"

    # Try RAG fallback if allowed
    if fb.get("allow_rag", True):
        rag_result = _try_rag_fallback(fbq, k)
        if rag_result.get("data"):
            rag_result["_meta"] = {
                **(rag_result.get("_meta") or {}),
                "route": "rag_local",
                "reason": "static_not_found"
            }
            return rag_result

    # Return final error state from static lookup
    return static_result
