# py/ai_engine/graph/tools_node.py
# Executes planner tool_calls, normalizes args (implicit geocode), and merges results into facts.

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple, cast

from .state import PlannerState, ToolCall

logger = logging.getLogger(__name__)

# Initialize tool registry and fact slot mapping
TOOL_MAP: Dict[str, Any] = {}

# Where to merge each tool's output inside facts
FACT_SLOT: Dict[str, str] = {
    "geocode_tool": "location",
    "weather_outlook": "weather",
    "prices_fetch": "prices",
    # keep legacy name "calendar" for regional crop info outputs
    "regional_crop_info": "calendar",
    "policy_match": "policy",
    "pesticide_lookup": "pesticide",
    "storage_find": "storage",
    "soil_api": "soil",
    "rag_search": "rag",
    "web_search": "web",
}

# Location dependent tool names used repeatedly
LOCATION_BASED_TOOLS: List[str] = ["weather_outlook", "soil_api", "storage_find"]

############################
# Tool import registration #
############################

# Each block first tries package-relative import, then script-context import
# (when running from inside ai_engine directory), else defines stub.

# Regional Crop Info tool
try:
    from ..tools.regional_crop_info import get_regional_crop_info  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.regional_crop_info import get_regional_crop_info  # type: ignore
    except Exception:  # noqa: E722
        def get_regional_crop_info(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {}, "source_stamp": {"type": "stub", "provider": "regional_crop_info"}}
TOOL_MAP["regional_crop_info"] = get_regional_crop_info

# Weather tool
try:
    from ..tools.weather_api import weather_lookup as WEATHER_TOOL  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.weather_api import weather_lookup as WEATHER_TOOL  # type: ignore
    except Exception:  # noqa: E722
        def WEATHER_TOOL(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {}, "source_stamp": {"type": "stub", "provider": "weather"}}
TOOL_MAP["weather_outlook"] = WEATHER_TOOL

# Policy tool
try:
    from ..tools.policy_match import policy_match  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.policy_match import policy_match  # type: ignore
    except Exception:  # noqa: E722
        def policy_match(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {"eligible": []}, "source_stamp": {"type": "stub", "provider": "policy"}}
TOOL_MAP["policy_match"] = policy_match

# Pesticide tool
try:
    from ..tools.pesticide_lookup import pesticide_lookup  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.pesticide_lookup import pesticide_lookup  # type: ignore
    except Exception:  # noqa: E722
        def pesticide_lookup(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {"recommendations": []}, "source_stamp": {"type": "stub", "provider": "pesticide"}}
TOOL_MAP["pesticide_lookup"] = pesticide_lookup

# Prices tool
try:
    from ..tools.mandi_api import prices_fetch  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.mandi_api import prices_fetch  # type: ignore
    except Exception:  # noqa: E722
        def prices_fetch(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {"rows": []}, "source_stamp": {"type": "stub", "provider": "mandi"}}
TOOL_MAP["prices_fetch"] = prices_fetch

# Storage tool
try:
    from ..tools.storage_find import storage_find  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.storage_find import storage_find  # type: ignore
    except Exception:  # noqa: E722
        def storage_find(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {"wdra": []}, "source_stamp": {"type": "stub", "provider": "storage"}}
TOOL_MAP["storage_find"] = storage_find

# Soil tool
try:
    from ..tools.soil_api import soil_api  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.soil_api import soil_api  # type: ignore
    except Exception:  # noqa: E722
        def soil_api(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {}, "source_stamp": {"type": "stub", "provider": "soil"}}
TOOL_MAP["soil_api"] = soil_api

# RAG tool
try:
    from ..tools.rag_search import rag_search  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.rag_search import rag_search  # type: ignore
    except Exception:  # noqa: E722
        def rag_search(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {"passages": []}, "source_stamp": {"type": "stub", "provider": "rag"}}
TOOL_MAP["rag_search"] = rag_search

# Web search tool
try:
    from ..tools.web_search import web_search  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.web_search import web_search  # type: ignore
    except Exception:  # noqa: E722
        def web_search(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            return {"data": {"results": []}, "source_stamp": {"type": "stub", "provider": "web"}}
TOOL_MAP["web_search"] = web_search

# Geocode tool
try:
    from ..tools.geocode_tool import run as geocode_run  # type: ignore
except Exception:  # noqa: E722
    try:
        from tools.geocode_tool import run as geocode_run  # type: ignore
    except Exception:  # noqa: E722
        def geocode_run(args: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore
            raise RuntimeError("geocode_tool not available; please add data/static_json/geo/district_centroids.json")
TOOL_MAP["geocode_tool"] = geocode_run


def _maybe_enrich_latlon(
    args: Dict[str, Any],
    profile: Optional[Dict[str, Any]],
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """Best-effort lat/lon enrichment.

    If args lacks lat/lon but state+district exist (directly or in profile), call geocoder.
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


def _normalize_args(
    tool: str,
    args: Dict[str, Any],
    profile: Optional[Dict[str, Any]],
    temp_facts: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """Per-tool normalization (defaults, lat/lon inference, etc.)."""
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
    has_location_tools = any(call.tool in LOCATION_BASED_TOOLS for call in executed_calls)
    
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
            except Exception as exc:  # noqa: BLE001 broad to capture tool runtime
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
            except Exception as exc:  # noqa: BLE001
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
                if tool_name in LOCATION_BASED_TOOLS and "location" in temp_facts:
                    raw_loc = temp_facts["location"]
                    data_obj = raw_loc.get("data", {}) if isinstance(raw_loc, dict) else {}
                    location_data: Dict[str, Any] = cast(Dict[str, Any], data_obj if isinstance(data_obj, dict) else {})
                    if "lat" in location_data and "lon" in location_data:
                        try:
                            args["lat"] = float(location_data["lat"])  # type: ignore[index]
                            args["lon"] = float(location_data["lon"])  # type: ignore[index]
                            meta = {"geocode": temp_facts["location"]}
                        except (TypeError, ValueError):  # fall back to enrichment if casting fails
                            args, meta = _normalize_args(tool_name, args, state.profile)
                    else:
                        args, meta = _normalize_args(tool_name, args, state.profile)
                # Special handling for prices_fetch to use crop results
                elif tool_name == "prices_fetch" and "calendar" in temp_facts:
                    raw_cal = temp_facts["calendar"]
                    data_obj = raw_cal.get("data", {}) if isinstance(raw_cal, dict) else {}
                    calendar_data: Dict[str, Any] = cast(Dict[str, Any], data_obj if isinstance(data_obj, dict) else {})
                    crops_val = calendar_data.get("crops") if isinstance(calendar_data, dict) else None
                    if isinstance(crops_val, list) and crops_val and not args.get("commodity"):
                        first = crops_val[0]
                        first_crop = first.get("crop_name") if isinstance(first, dict) else None
                        if first_crop:
                            args["commodity"] = first_crop
                            meta = {"auto_commodity_from_calendar": first_crop}
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

            except Exception as exc:  # noqa: BLE001
                logger.exception("Tool %s failed", tool_name)
                temp_facts[slot] = {"error": str(exc)}
        
        # Update state.facts with all results
        state.facts = temp_facts

        # Retry pass: if geocode succeeded and any location-based tool slot holds an error complaining about lat/lon, auto-fill and retry once
        if has_geocode and "location" in temp_facts:
            raw_loc = temp_facts.get("location")
            loc_data = raw_loc.get("data") if isinstance(raw_loc, dict) else {}
            loc_dict: Dict[str, Any] = cast(Dict[str, Any], loc_data if isinstance(loc_data, dict) else {})
            if "lat" in loc_dict and "lon" in loc_dict:
                for lname in LOCATION_BASED_TOOLS:
                    slot = FACT_SLOT.get(lname, lname)
                    val = temp_facts.get(slot)
                    needs_retry = (
                        isinstance(val, dict)
                        and "error" in val
                        and "lat" in val.get("error", "")
                        and "lon" in val.get("error", "")
                    )
                    if needs_retry:
                        tool_fn = TOOL_MAP.get(lname)
                        if not tool_fn:
                            continue
                        try:
                            retry_args = {
                                "lat": float(loc_dict["lat"]),  # type: ignore[index]
                                "lon": float(loc_dict["lon"]),  # type: ignore[index]
                            }
                        except (TypeError, ValueError):
                            continue
                        try:
                            # preserve original days if present in original call
                            for oc in executed_calls:
                                if oc.tool == lname and isinstance(oc.args, dict) and "days" in oc.args:
                                    retry_args["days"] = oc.args["days"]
                            result = _call_tool(tool_fn, retry_args)
                            temp_facts[slot] = result
                        except Exception as rex:  # noqa: BLE001
                            temp_facts[slot] = {"error": str(rex)}
                state.facts = temp_facts

        # Mark executed; clear pending
        state.tool_calls.extend(executed_calls)
        state.pending_tool_calls.clear()

    except Exception as e:  # noqa: BLE001
        logger.error(f"tools_node error: {e}")
        # Always return a valid state
        state.facts = temp_facts
        state.tool_calls = state.tool_calls if hasattr(state, 'tool_calls') else []

    return state
