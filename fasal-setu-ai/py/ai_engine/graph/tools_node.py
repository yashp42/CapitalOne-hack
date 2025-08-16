# py/ai_engine/graph/tools_node.py
# Executes planner tool_calls, normalizes args (implicit geocode), and merges results into facts.

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from .state import PlannerState, ToolCall

logger = logging.getLogger(__name__)

# Initialize tool registry and fact slot mapping
TOOL_MAP: Dict[str, Any] = {}
FACT_SLOT: Dict[str, str] = {
    "geocode_tool": "location",
    "weather_outlook": "weather", 
    "prices_fetch": "prices",
    "calendar_lookup": "calendar",
    "policy_match": "policy",
    "pesticide_lookup": "pesticide",
    "storage_find": "storage",
    "soil_api": "soil",
    "rag_search": "rag",
    "web_search": "web"
}

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

# Dataset (crop calendar) tool
try:
    from ..tools.dataset_lookup import calendar_lookup
    TOOL_MAP["calendar_lookup"] = calendar_lookup
except Exception:
    def calendar_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {}, "source_stamp": {"type": "stub", "provider": "dataset"}}
    TOOL_MAP["calendar_lookup"] = calendar_lookup

# Pesticide tool
try:
    from ..tools.pesticide_lookup import pesticide_lookup
    TOOL_MAP["pesticide_lookup"] = pesticide_lookup
except Exception:
    def pesticide_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"labels": []}, "source_stamp": {"type": "stub", "provider": "pesticide"}}
    TOOL_MAP["pesticide_lookup"] = pesticide_lookup

# Storage tool
try:
    from ..tools.storage_find import storage_find
    TOOL_MAP["storage_find"] = storage_find
except Exception:
    def storage_find(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"wdra": []}, "source_stamp": {"type": "stub", "provider": "storage"}}
    TOOL_MAP["storage_find"] = storage_find

# Policy tool
try:
    from ..tools.policy_match import policy_match
    TOOL_MAP["policy_match"] = policy_match
except Exception:
    def policy_match(args: Dict[str, Any]) -> Dict[str, Any]:
        return {"data": {"eligible": []}, "source_stamp": {"type": "stub", "provider": "policy"}}
    TOOL_MAP["policy_match"] = policy_match

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

# Geocode tool (for implicit geocoding)
try:
    from ..tools.geocode_tool import run as geocode_run
    TOOL_MAP["geocode_tool"] = geocode_run
except Exception:
    def geocode_run(args: Dict[str, Any]) -> Dict[str, Any]:
        raise RuntimeError("geocode_tool not available; please add data/static_json/geo/district_centroids.json")
    TOOL_MAP["geocode_tool"] = geocode_run

logger = logging.getLogger(__name__)

# Registry: planner tool name -> callable
TOOL_MAP: Dict[str, Any] = {
    "geocode_tool": geocode_run,
    "weather_outlook": WEATHER_TOOL,     # NB: fixed key (was 'weather_lookup' earlier)
    "prices_fetch": prices_fetch,
    "calendar_lookup": calendar_lookup,
    "policy_match": policy_match,
    "pesticide_lookup": pesticide_lookup,
    "storage_find": storage_find,
    "rag_search": rag_search,
    "soil_api": soil_api,
    "web_search": web_search,
    # (No explicit 'variety_lookup': we don’t use it anymore)
}

# Where to merge each tool’s output inside facts
FACT_SLOT: Dict[str, str] = {
    "geocode_tool": "location",
    "weather_outlook": "weather",
    "prices_fetch": "prices",
    "calendar_lookup": "calendar",
    "policy_match": "policy",
    "pesticide_lookup": "pesticide",
    "storage_find": "storage",
    "soil_api": "soil",
    "rag_search": "rag",
    "web_search": "web",   # allowed by schema additionalProperties
}


logger = logging.getLogger(__name__)

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




def _normalize_args(tool: str, args: Dict[str, Any], profile: Optional[Dict[str, Any]]) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """Per-tool normalization (defaults, lat/lon inference, etc.)"""
    args = dict(args)
    meta: Optional[Dict[str, Any]] = None

    if tool == "calendar_lookup":
        args.setdefault("kind", "crop_calendar")
        args.setdefault("fields", ["region_info", "crop_info"])
        args.setdefault("state", (profile or {}).get("state"))
        args.setdefault("district", (profile or {}).get("district"))

    elif tool == "weather_outlook":
        args.setdefault("days", 3)
        args, meta = _maybe_enrich_latlon(args, profile)

    elif tool == "soil_api":
        args, meta = _maybe_enrich_latlon(args, profile)

    elif tool == "storage_find":
        args.setdefault("state", (profile or {}).get("state"))
        args.setdefault("district", (profile or {}).get("district"))
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
    """Support LC StructuredTool (.invoke), LC Tool (.run), or plain function(callable)."""
    if hasattr(fn, "invoke"):
        return fn.invoke(args)  # StructuredTool path
    if hasattr(fn, "run"):
        return fn.run(args)     # Some LC Tool implementations
    return fn(args)             # Plain function

def tools_node(state: PlannerState) -> PlannerState:
    """Execute pending tool calls and merge results into facts."""
    executed_calls: List[ToolCall] = list(state.pending_tool_calls)
    auto_tool_calls: List[ToolCall] = []

    try:
        for call in executed_calls:
            tool_name = call.tool
            tool_fn = TOOL_MAP.get(tool_name)
            slot = FACT_SLOT.get(tool_name, tool_name)

            if not tool_fn:
                state.facts[slot] = {"error": f"Tool not found: {tool_name}"}
                continue

            try:
                norm_args, meta = _normalize_args(tool_name, call.args, state.profile)
                result = _call_tool(tool_fn, norm_args)

                # Attach meta (e.g., geocode_used) non-destructively
                if meta and isinstance(result, dict):
                    result = dict(result)
                    result.setdefault("_meta", {})
                    if "geocode" in meta:
                        result["_meta"]["geocode_used"] = True
                        result["_meta"]["geocode"] = meta["geocode"]

                state.facts[slot] = result

            except Exception as exc:
                logger.exception("Tool %s failed", tool_name)
                state.facts[slot] = {"error": str(exc)}

        # Mark executed; clear pending
        state.tool_calls.extend(executed_calls)
        state.pending_tool_calls.clear()

        # Execute any auto-chained tool calls (e.g., weather_outlook)
        for auto_call in auto_tool_calls:
            tool_name = auto_call.tool
            tool_fn = TOOL_MAP.get(tool_name)
            slot = FACT_SLOT.get(tool_name, tool_name)
            try:
                norm_args, meta = _normalize_args(tool_name, auto_call.args, state.profile)
                result = _call_tool(tool_fn, norm_args)

                # Attach meta (e.g., geocode_used) non-destructively
                if meta and isinstance(result, dict):
                    result = dict(result)
                    result.setdefault("_meta", {})
                    if "geocode" in meta:
                        result["_meta"]["geocode_used"] = True
                        result["_meta"]["geocode"] = meta["geocode"]

                state.facts[slot] = result

            except Exception as exc:
                logger.exception("Tool %s failed", tool_name)
                state.facts[slot] = {"error": str(exc)}

    except Exception as e:
        logger.error(f"tools_node error: {e}")
        # Always return a valid state
        state.facts = state.facts if hasattr(state, 'facts') else {}
        state.tool_calls = state.tool_calls if hasattr(state, 'tool_calls') else []

    return state
    for call in executed_calls:
        tool_name = call.tool
        tool_fn = TOOL_MAP.get(tool_name)
        slot = FACT_SLOT.get(tool_name, tool_name)
        if not tool_fn:
            state.facts[slot] = {"error": f"Tool not found: {tool_name}"}
            continue

        try:
            norm_args, meta = _normalize_args(tool_name, call.args, state.profile)
            result = _call_tool(tool_fn, norm_args)

            # Attach meta (e.g., geocode_used) non-destructively
            if meta and isinstance(result, dict):
                result = dict(result)
                result.setdefault("_meta", {})
                if "geocode" in meta:
                    result["_meta"]["geocode_used"] = True
                    result["_meta"]["geocode"] = meta["geocode"]

            state.facts[slot] = result

            # --- AUTOCHAINING: If geocode_tool or web_search returns lat/lon, call weather_outlook ---
            # No auto-chaining: rely on LLM to chain tool calls for weather_outlook after geocode/web_search

        except Exception as exc:
            logger.exception("Tool %s failed", tool_name)
            state.facts[slot] = {"error": str(exc)}

    # Mark executed; clear pending
    state.tool_calls.extend(executed_calls)
    state.pending_tool_calls.clear()

    # Execute any auto-chained tool calls (e.g., weather_outlook)
    for auto_call in auto_tool_calls:
        tool_name = auto_call.tool
        tool_fn = TOOL_MAP.get(tool_name)
        slot = FACT_SLOT.get(tool_name, tool_name)
        try:
            norm_args, meta = _normalize_args(tool_name, call.args, state.profile)
            result = _call_tool(tool_fn, norm_args)

            # Attach meta (e.g., geocode_used) non-destructively
            if meta and isinstance(result, dict):
                result = dict(result)
                result.setdefault("_meta", {})
                if "geocode" in meta:
                    result["_meta"]["geocode_used"] = True
                    result["_meta"]["geocode"] = meta["geocode"]

            # Log and include weather tool errors in facts
            if slot == "weather" and isinstance(result, dict) and "error" in result:
                logger.warning("Weather tool error: %s", result["error"])

            state.facts[slot] = result

        except Exception as exc:  # log and continue
            logger.exception("Tool %s failed", tool_name)
            state.facts[slot] = {"error": str(exc)}
