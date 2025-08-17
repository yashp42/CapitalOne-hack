# py/ai_engine/graph/tools_node.py
# Executes planner tool_calls, normalizes args (implicit geocode), and merges results into facts.

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from .state import PlannerState, ToolCall

logger = logging.getLogger(__name__)

# Initialize tool registry and fact slot mapping
TOOL_MAP: Dict[str, Any] = {}

# Where to merge each tool's output inside facts
FACT_SLOT: Dict[str, str] = {
    "geocode_tool": "location",
    "weather_outlook": "weather",
    "prices_fetch": "prices",
    "regional_crop_info": "calendar",  # keeps 'calendar' slot for backward compatibility
    "policy_match": "policy",
    "pesticide_lookup": "pesticide",
    "storage_find": "storage",
    "soil_api": "soil",
    "rag_search": "rag",
    "web_search": "web"
}

# Regional Crop Info tool
try:
    from ..tools.regional_crop_info import get_regional_crop_info
    TOOL_MAP["regional_crop_info"] = get_regional_crop_info
except Exception:
    def get_regional_crop_info(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {}, "source_stamp": {"type": "stub", "provider": "regional_crop_info"}}
    TOOL_MAP["regional_crop_info"] = get_regional_crop_info

# Weather tool
try:
    from ..tools.weather_api import weather_lookup as WEATHER_TOOL
    TOOL_MAP["weather_outlook"] = WEATHER_TOOL
except Exception:
    def WEATHER_TOOL(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {}, "source_stamp": {"type": "stub", "provider": "weather"}}
    TOOL_MAP["weather_outlook"] = WEATHER_TOOL

# Policy tool
try:
    from ..tools.policy_match import policy_match
    TOOL_MAP["policy_match"] = policy_match
except Exception:
    def policy_match(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"eligible": []}, "source_stamp": {"type": "stub", "provider": "policy"}}
    TOOL_MAP["policy_match"] = policy_match

# Pesticide tool
try:
    from ..tools.pesticide_lookup import pesticide_lookup
    TOOL_MAP["pesticide_lookup"] = pesticide_lookup
except Exception:
    def pesticide_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"recommendations": []}, "source_stamp": {"type": "stub", "provider": "pesticide"}}
    TOOL_MAP["pesticide_lookup"] = pesticide_lookup

# Prices tool
try:
    from ..tools.mandi_api import prices_fetch
    TOOL_MAP["prices_fetch"] = prices_fetch
except Exception:
    def prices_fetch(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"rows": []}, "source_stamp": {"type": "stub", "provider": "mandi"}}
    TOOL_MAP["prices_fetch"] = prices_fetch

# Storage tool
try:
    from ..tools.storage_find import storage_find
    TOOL_MAP["storage_find"] = storage_find
except Exception:
    def storage_find(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"wdra": []}, "source_stamp": {"type": "stub", "provider": "storage"}}
    TOOL_MAP["storage_find"] = storage_find

# Soil tool
try:
    from ..tools.soil_api import soil_api
    TOOL_MAP["soil_api"] = soil_api
except Exception:
    def soil_api(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {}, "source_stamp": {"type": "stub", "provider": "soil"}}
    TOOL_MAP["soil_api"] = soil_api

# RAG tool
try:
    from ..tools.rag_search import rag_search
    TOOL_MAP["rag_search"] = rag_search
except Exception:
    def rag_search(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"passages": []}, "source_stamp": {"type": "stub", "provider": "rag"}}
    TOOL_MAP["rag_search"] = rag_search

# Web search tool
try:
    from ..tools.web_search import web_search
    TOOL_MAP["web_search"] = web_search
except Exception:
    def web_search(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"results": []}, "source_stamp": {"type": "stub", "provider": "web"}}
    TOOL_MAP["web_search"] = web_search

# Geocode tool
try:
    from ..tools.geocode_tool import run as geocode_run
    TOOL_MAP["geocode_tool"] = geocode_run
except Exception:
    def geocode_run(args: Dict[str, Any]) -> Dict[str, Any]:
        raise RuntimeError("geocode_tool not available; please add data/static_json/geo/district_centroids.json")
    TOOL_MAP["geocode_tool"] = geocode_run


def _maybe_enrich_latlon(args: Dict[str, Any], profile: Optional[Dict[str, Any]]) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """
    If args lacks lat/lon but we have state+district (in args or profile),
    call the geocoder and inject lat/lon.
    Returns (args, meta) where meta may include {"geocode": {...}}.
    """
    args = dict(args)
    prof = profile or {}

    # If already present, done.
    if args.get("lat") is not None and args.get("lon") is not None:
        return args, None

    # Try profile lat/lon
    lat = args.get("lat") or prof.get("lat")
    lon = args.get("lon") or prof.get("lon")
    if lat is not None and lon is not None:
        args["lat"], args["lon"] = float(lat), float(lon)
        return args, None

    # Try state+district → geocode
    state = args.get("state") or prof.get("state")
    district = args.get("district") or prof.get("district")
    if state and district:
        try:
            geo = geocode_run({"state": state, "district": district})
            data = (geo or {}).get("data") or {}
            if "lat" in data and "lon" in data:
                args["lat"], args["lon"] = float(data["lat"]), float(data["lon"])
                return args, {"geocode": geo}
        except Exception as ge:
            logger.debug("Geocode failed for (%s, %s): %s", state, district, ge)

    return args, None


def _normalize_args(tool: str, args: Dict[str, Any], profile: Optional[Dict[str, Any]], 
                temp_facts: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """Per-tool normalization (defaults, lat/lon inference, etc.)"""
    args = dict(args)
    meta: Optional[Dict[str, Any]] = None
    facts = temp_facts or {}

    if tool == "regional_crop_info":
        args.setdefault("kind", "crop_calendar")
        args.setdefault("fields", ["region_info", "crop_info"])
        args.setdefault("state", (profile or {}).get("state"))
        args.setdefault("district", (profile or {}).get("district"))

    elif tool == "weather_outlook":
        args.setdefault("days", 3)
        
        # Check if geocode_tool was called previously in this batch
        if "location" in facts and isinstance(facts["location"], dict):
            location_data = facts["location"].get("data", {})
            if "lat" in location_data and "lon" in location_data:
                args["lat"] = float(location_data["lat"])
                args["lon"] = float(location_data["lon"])
                return args, {"geocode": facts["location"]}
                
        # Fallback to the regular lookup
        args, meta = _maybe_enrich_latlon(args, profile)

    elif tool == "soil_api":
        # Similar check for geocode results
        if "location" in facts and isinstance(facts["location"], dict):
            location_data = facts["location"].get("data", {})
            if "lat" in location_data and "lon" in location_data:
                args["lat"] = float(location_data["lat"])
                args["lon"] = float(location_data["lon"])
                return args, {"geocode": facts["location"]}
                
        args, meta = _maybe_enrich_latlon(args, profile)

    elif tool == "storage_find":
        args.setdefault("state", (profile or {}).get("state"))
        args.setdefault("district", (profile or {}).get("district"))
        
        # Check for geocode results
        if "location" in facts and isinstance(facts["location"], dict):
            location_data = facts["location"].get("data", {})
            if "lat" in location_data and "lon" in location_data:
                args["lat"] = float(location_data["lat"])
                args["lon"] = float(location_data["lon"])
                meta = {"geocode": facts["location"]}
        else:
            args, meta = _maybe_enrich_latlon(args, profile)
            
        args.setdefault("max_radius_km", 50)

    elif tool == "prices_fetch":
        args.setdefault("state", (profile or {}).get("state"))
        args.setdefault("district", (profile or {}).get("district"))
        args.setdefault("days", 14)

    elif tool == "rag_search":
        args.setdefault("k", 6)

    return args, meta


def _call_tool(fn: Any, args: Dict[str, Any]) -> Dict[str, Any]:
    """Support LC StructuredTool (.invoke), LC Tool (.run), or plain function(callable)."""
    if hasattr(fn, "invoke"):
        return fn.invoke(args)  # StructuredTool path
    if hasattr(fn, "run"):
        return fn.run(args)     # Some LC Tool implementations
    return fn(args)             # Plain function


def tools_node(state: PlannerState) -> PlannerState:
    """Execute pending tool calls and merge results into facts."""
    executed_calls: List[ToolCall] = list(state.pending_tool_calls)
    
    # Create a temporary facts dict to store results as we go
    temp_facts = dict(state.facts) if hasattr(state, 'facts') else {}
    
    # Special handling for geocode + location-based tools pattern
    # Check if we have geocode and any location-based tools in the same batch
    has_geocode = any(call.tool == "geocode_tool" for call in executed_calls)
    location_tools = ["weather_outlook", "soil_api", "storage_find"]
    has_location_tools = any(call.tool in location_tools for call in executed_calls)
    
    # Special handling for regional_crop_info + prices_fetch pattern
    has_crop_info = any(call.tool == "regional_crop_info" for call in executed_calls)
    has_prices = any(call.tool == "prices_fetch" for call in executed_calls)
    
    # Process all geocode calls first if we have both geocode and location-based tools
    if has_geocode and has_location_tools:
        # Process geocode calls first
        geocode_calls = [call for call in executed_calls if call.tool == "geocode_tool"]
        for call in geocode_calls:
            tool_fn = TOOL_MAP.get("geocode_tool")
            if not tool_fn:
                temp_facts["location"] = {"error": "Tool not found: geocode_tool"}
                continue
                
            try:
                result = _call_tool(tool_fn, call.args)
                temp_facts["location"] = result
            except Exception as exc:
                logger.exception("Tool %s failed", "geocode_tool")
                temp_facts["location"] = {"error": str(exc)}
                
    # Process regional_crop_info calls first if we have both crop_info and prices_fetch
    if has_crop_info and has_prices:
        crop_info_calls = [call for call in executed_calls if call.tool == "regional_crop_info"]
        for call in crop_info_calls:
            tool_fn = TOOL_MAP.get("regional_crop_info")
            if not tool_fn:
                temp_facts["calendar"] = {"error": "Tool not found: regional_crop_info"}
                continue
                
            try:
                # Normalize arguments with any existing temp_facts
                norm_args, meta = _normalize_args(call.tool, call.args, state.profile, temp_facts)
                result = _call_tool(tool_fn, norm_args)
                temp_facts["calendar"] = result
            except Exception as exc:
                logger.exception("Tool %s failed", "regional_crop_info")
                temp_facts["calendar"] = {"error": str(exc)}

    try:
        for call in executed_calls:
            tool_name = call.tool
            # Skip geocode calls if we've already processed them
            if has_geocode and has_location_tools and tool_name == "geocode_tool":
                continue
            # Skip regional_crop_info calls if we've already processed them
            if has_crop_info and has_prices and tool_name == "regional_crop_info":
                continue
                
            tool_fn = TOOL_MAP.get(tool_name)
            slot = FACT_SLOT.get(tool_name, tool_name)

            if not tool_fn:
                temp_facts[slot] = {"error": f"Tool not found: {tool_name}"}
                continue

            try:
                args = dict(call.args)
                meta = None  # Initialize meta variable
                
                # Special handling for location-based tools to use geocode results
                if tool_name in location_tools and "location" in temp_facts:
                    location_data = temp_facts["location"].get("data", {})
                    if "lat" in location_data and "lon" in location_data:
                        args["lat"] = float(location_data["lat"])
                        args["lon"] = float(location_data["lon"])
                        meta = {"geocode": temp_facts["location"]}
                    else:
                        args, meta = _normalize_args(tool_name, args, state.profile)
                # Special handling for prices_fetch to use crop results
                elif tool_name == "prices_fetch" and "calendar" in temp_facts:
                    calendar_data = temp_facts["calendar"].get("data", {})
                    if calendar_data and calendar_data.get("crops"):
                        crops = calendar_data["crops"]
                        if crops and not args.get("commodity"):
                            # Use the first crop if no commodity specified
                            first_crop = crops[0].get("crop_name") if isinstance(crops[0], dict) else None
                            if first_crop:
                                args["commodity"] = first_crop
                                meta = {"auto_commodity_from_calendar": first_crop}
                    # Still apply normal normalization if no meta was set
                    if not meta:
                        args, meta = _normalize_args(tool_name, args, state.profile)
                else:
                    args, meta = _normalize_args(tool_name, args, state.profile)
                    
                result = _call_tool(tool_fn, args)

                # Attach meta (e.g., geocode_used) non-destructively
                if meta and isinstance(result, dict):
                    result = dict(result)
                    result.setdefault("_meta", {})
                    if "geocode" in meta:
                        result["_meta"]["geocode_used"] = True
                        result["_meta"]["geocode"] = meta["geocode"]

                temp_facts[slot] = result

            except Exception as exc:
                logger.exception("Tool %s failed", tool_name)
                temp_facts[slot] = {"error": str(exc)}
        
        # Update state.facts with all results
        state.facts = temp_facts

        # Mark executed; clear pending
        state.tool_calls.extend(executed_calls)
        state.pending_tool_calls.clear()

    except Exception as e:
        logger.error(f"tools_node error: {e}")
        # Always return a valid state
        state.facts = temp_facts
        state.tool_calls = state.tool_calls if hasattr(state, 'tool_calls') else []

    return state
