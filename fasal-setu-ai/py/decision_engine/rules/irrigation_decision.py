# rules/irrigation_decision.py
"""
Handler for intent: "irrigation_decision"
Decision template: "irrigation_now_or_wait"

Deterministic irrigation decision logic.

Required tool outputs in facts (provided by orchestrator from tool_calls[*]['output']):
 - weather_outlook (required): should contain "forecast" list with per-day entries having "date" and "rain_mm" or similar.
 - calendar_lookup (required): should contain crop calendar info and ideally crop stage info (critical_stages, root_zone_depth, Kc)
Optional:
 - soil (soil sample) or soil_moisture tool output providing "soil_moisture_pct" or "volumetric_water_content"
 - rag_search (for local advisories)
 - policy_match / other tools (not used here)

Behavior summary (deterministic):
 1. If forecasted rainfall in next 48 hours >= RAIN_THRESHOLD_MM -> recommend "wait_for_rain".
 2. Else if soil moisture present:
      - if soil_moisture_pct < SOIL_MOISTURE_THRESHOLD_FOR_STAGE -> recommend "irrigate_now"
      - else -> recommend "wait_for_rain"
 3. Else if crop stage is reported and is in calendar_lookup critical_stages -> if forecast rain low -> "irrigate_now"
 4. Else -> return require_more_info (ask for soil moisture or crop_stage)

Notes:
 - RAIN_THRESHOLD_MM and default SOIL_MOISTURE thresholds are conservative defaults and can be tuned later.
 - This handler returns action = "irrigation_now_or_wait" (decision template), and a single DecisionItem with recommendation in its meta.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
from datetime import datetime, timedelta
import statistics

# Robust imports for helpers and provenance
try:
    from ..utils import helpers as helpers
    from ..utils import provenance as provenance
except Exception:
    try:
        from utils import helpers as helpers
        from utils import provenance as provenance
    except Exception:
        helpers = None
        provenance = None

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

# Conservative defaults (explicit; change if you want)
RAIN_THRESHOLD_MM = 10.0  # if forecast >= this in next 48h, skip irrigation
SOIL_MOISTURE_DEFAULT_THRESHOLD = 30.0  # percent VWC threshold below which irrigation is recommended
SOIL_MOISTURE_STAGE_ADJUSTMENT = {
    # optional adjustment by crop stage name (if provided in calendar_lookup)
    # "flowering": 25.0,  # e.g., lower threshold during flowering
    # "vegetative": 35.0,
}


# -------------------------
# Utility helpers
# -------------------------
def _safe_get(dict_like: Optional[Dict[str, Any]], *keys, default=None):
    if not dict_like or not isinstance(dict_like, dict):
        return default
    for k in keys:
        if k in dict_like and dict_like[k] is not None:
            return dict_like[k]
    return default


def _sum_forecast_rain_mm(weather: Dict[str, Any], hours: int = 48) -> Optional[float]:
    """
    Sum forecasted rainfall for the next `hours` hours.
    Expects weather["forecast"] list of daily forecasts with 'date' and 'rain_mm' or similar.
    If forecasts are daily and hours <= 72, sum first ceil(hours/24) days.
    Returns None if forecast data unavailable.
    """
    if not weather or not isinstance(weather, dict):
        return None
    forecast = weather.get("forecast") or weather.get("daily") or weather.get("data")
    if not isinstance(forecast, list) or len(forecast) == 0:
        return None
    # If entries are hourly (contain 'hour' or time), try to sum within hours window
    # Otherwise, treat as daily and sum first N days where N = ceil(hours/24)
    try:
        # check for hourly format: entries might have 'datetime' including hour or 'hour' key
        first = forecast[0]
        if isinstance(first, dict) and ("hour" in first or "time" in first or "datetime" in first):
            # assume forecast is hourly sorted ascending
            rain_sum = 0.0
            count_hours = 0
            for entry in forecast:
                if count_hours >= hours:
                    break
                r = _safe_get(entry, "rain_mm", "precip_mm", "rain", "precip")
                try:
                    if r is not None:
                        rain_sum += float(r)
                except Exception:
                    pass
                count_hours += 1
            return float(rain_sum)
        else:
            # daily entries
            days = (hours + 23) // 24
            rain_sum = 0.0
            for d in forecast[:days]:
                r = _safe_get(d, "rain_mm", "precip_mm", "rain", "precip")
                try:
                    if r is not None:
                        rain_sum += float(r)
                except Exception:
                    pass
            return float(rain_sum)
    except Exception:
        # fallback: try summing rain keys for available entries until hours covered or entries exhausted
        try:
            n = (hours + 23) // 24
            rain_sum = 0.0
            for d in (forecast[:n] if isinstance(forecast, list) else []):
                r = _safe_get(d, "rain_mm", "precip_mm", "rain")
                if r is None:
                    continue
                try:
                    rain_sum += float(r)
                except Exception:
                    continue
            return float(rain_sum) if rain_sum is not None else None
        except Exception:
            return None


def _extract_soil_moisture(soil: Optional[Dict[str, Any]]) -> Optional[float]:
    """
    Extract a soil moisture percentage value from common fields.
    Accepts 'soil_moisture_pct', 'soil_moisture', 'volumetric_water_content', 'vwc' (0..1 or 0..100).
    Returns percentage (0..100) or None.
    """
    if not soil or not isinstance(soil, dict):
        return None
    candidates = ["soil_moisture_pct", "soil_moisture", "volumetric_water_content", "vwc", "moisture_pct"]
    for key in candidates:
        if key in soil and soil[key] is not None:
            try:
                val = float(soil[key])
                # if value seems 0..1 scale, convert
                if 0.0 <= val <= 1.0:
                    return val * 100.0
                return val
            except Exception:
                continue
    return None


def _determine_stage_threshold(calendar: Dict[str, Any], crop_stage: Optional[str] = None) -> float:
    """
    Determine soil moisture threshold (%) for irrigation based on crop stage and calendar info.
    If calendar contains explicit thresholds, use them. Else use defaults.
    """
    # try calendar-provided thresholds: calendar might have 'stage_moisture_thresholds' mapping
    try:
        stage_thresholds = calendar.get("stage_moisture_thresholds") or calendar.get("moisture_thresholds")
        if stage_thresholds and isinstance(stage_thresholds, dict) and crop_stage:
            val = stage_thresholds.get(crop_stage) or stage_thresholds.get(crop_stage.lower())
            if val is not None:
                return float(val)
    except Exception:
        pass
    # fallback to stage-specific defaults if provided globally
    if crop_stage:
        st = SOIL_MOISTURE_STAGE_ADJUSTMENT.get(crop_stage)
        if st is not None:
            return float(st)
    # default
    return float(SOIL_MOISTURE_DEFAULT_THRESHOLD)


def _build_decision_item(recommendation: str, reasons: List[str], tradeoffs: List[str], meta: Dict[str, Any], sources: List[Dict[str, Any]]):
    """
    Build a DecisionItem-like dict for the response.
    """
    return {
        "name": "irrigation_decision",
        "score": None,
        "reasons": reasons,
        "tradeoffs": tradeoffs,
        "meta": meta,
        "sources": sources,
    }


# -------------------------
# Main handler
# -------------------------
def handle(*,intent: Any, facts: Dict[str, Any]) -> Dict[str, Any]:
    """
    intent: incoming ActIntent (pydantic model or dict)
    facts: dict mapping tool_name -> tool_output (these are the outputs from tool_calls[*]['output'])
    """
    # Validate presence of required tools
    missing = []
    if not facts or not isinstance(facts, dict):
        return {
            "action": "require_more_info",
            "items": [],
            "confidence": 0.0,
            "notes": "No facts provided",
            "missing": ["weather_outlook", "calendar_lookup"],
        }

    weather = facts.get("weather_outlook")
    calendar = facts.get("calendar_lookup")
    soil = facts.get("soil") or facts.get("soil_sample") or facts.get("soil_moisture")
    rag = facts.get("rag_search") or facts.get("rag") or facts.get("extension_notes")

    if not weather:
        missing.append("weather_outlook")
    if not calendar:
        missing.append("calendar_lookup")
    if missing:
        return {
            "action": "require_more_info",
            "items": [],
            "confidence": 0.0,
            "notes": "Missing required tool outputs",
            "missing": missing,
        }

    # Compute forecast rain sum for next 48 hours
    rain_48 = _sum_forecast_rain_mm(weather, hours=48)
    reasons: List[str] = []
    tradeoffs: List[str] = []
    meta: Dict[str, Any] = {}
    sources: List[Dict[str, Any]] = []

    # Append provenance source entries if available
    try:
        # facts may already contain provider/confidence
        # prefer using provenance.merge_provenance(handler_prov=None, facts)
        if provenance is not None and hasattr(provenance, "merge_provenance"):
            merged = provenance.merge_provenance(None, facts)
            # merged is list of dicts: add top providers to sources
            for m in (merged or [])[:3]:
                try:
                    sources.append(m)
                except Exception:
                    continue
    except Exception:
        # fallback: try to gather simple source strings
        try:
            if isinstance(weather, dict):
                p = weather.get("provider") or weather.get("source")
                if p:
                    sources.append({"source_id": p, "source_type": "weather", "tool": "weather_outlook"})
        except Exception:
            pass

    if rain_48 is not None:
        meta["forecast_rain_48h_mm"] = rain_48
        reasons.append(f"forecast_rain_48h={rain_48:.2f}mm")

    # If heavy rain expected, recommend waiting
    if rain_48 is not None and rain_48 >= RAIN_THRESHOLD_MM:
        recommendation = "wait_for_rain"
        notes = f"Forecasted rain in next 48 hours >= {RAIN_THRESHOLD_MM} mm; recommend waiting for rain."
        item = _build_decision_item(recommendation, reasons, tradeoffs, meta, sources)
        # compute confidence: high if forecast is fresh
        confidence = 0.9
        try:
            if helpers is not None and hasattr(helpers, "extract_provenance_from_facts") and hasattr(helpers, "compute_confidence"):
                prov_entries = helpers.extract_provenance_from_facts(facts or {})
                confidence = helpers.compute_confidence(signals={"forecast_rain_48h": rain_48}, prov_entries=prov_entries)
            elif helpers is not None and hasattr(helpers, "compute_confidence"):
                # fallback: if helper has legacy signature, call with just signals
                confidence = helpers.compute_confidence({"soil_moisture_signal": float(soil_moisture_pct)})
        except Exception:
            pass
        item["score"] = round(confidence, 4)
        return {"action": "irrigation_now_or_wait", "items": [item], "confidence": round(confidence, 4), "notes": notes}

    # Else check soil moisture if present
    soil_moisture_pct = _extract_soil_moisture(soil)
    if soil_moisture_pct is not None:
        meta["soil_moisture_pct"] = soil_moisture_pct
    # Attempt to obtain crop_stage (prefer intent, else calendar)
    crop_stage = None
    try:
        if isinstance(intent, dict):
            crop_stage = intent.get("crop_stage") or intent.get("growth_stage") or intent.get("stage")
        else:
            crop_stage = getattr(intent, "crop_stage", None) or getattr(intent, "growth_stage", None)
    except Exception:
        crop_stage = None
    # calendar may provide 'current_stage' or 'days_after_sowing'
    if not crop_stage:
        crop_stage = calendar.get("current_stage") or calendar.get("crop_stage") or calendar.get("stage")
    if crop_stage:
        meta["crop_stage"] = crop_stage

    # Determine threshold for this stage
    stage_threshold = _determine_stage_threshold(calendar, crop_stage)

    if soil_moisture_pct is not None:
        # Compare soil moisture to threshold
        if soil_moisture_pct < stage_threshold:
            recommendation = "irrigate_now"
            reasons.append(f"soil_moisture_pct={soil_moisture_pct:.1f}% < threshold({stage_threshold}%)")
            notes = f"Soil moisture below threshold ({stage_threshold}%). Recommend irrigation now."
            # confidence calibration: lower moisture -> higher confidence
            # compute simple mapping: if soil_moisture_pct <= 0 -> 0.95 else map linearly between 0..threshold -> 0.95..0.6
            try:
                if soil_moisture_pct <= 0:
                    conf = 0.95
                else:
                    frac = max(0.0, min(1.0, (stage_threshold - soil_moisture_pct) / max(1.0, stage_threshold)))
                    conf = 0.6 + 0.35 * frac  # between 0.6 and 0.95
            except Exception:
                conf = 0.7
            # use helpers.compute_confidence if available to combine signals
            conf = helpers.compute_confidence({"soil_moisture_signal": float(soil_moisture_pct)},facts, ["weather_outlook", "calendar_lookup"])
            # compute provenance entries from facts, then compute confidence
            try:
                if helpers is not None and hasattr(helpers, "extract_provenance_from_facts") and hasattr(helpers, "compute_confidence"):
                    prov_entries = helpers.extract_provenance_from_facts(facts or {})
                    confidence = helpers.compute_confidence(signals={"soil_moisture_signal": float(soil_moisture_pct)}, prov_entries=prov_entries)
                elif helpers is not None and hasattr(helpers, "compute_confidence"):
                    # fallback: if helper has legacy signature, call with just signals
                    confidence = helpers.compute_confidence({"forecast_rain_48h": rain_48})
            except Exception:
                # keep previously-initialized confidence value on error
                pass
            item = _build_decision_item(recommendation, reasons, tradeoffs, meta, sources)
            item["score"] = round(conf, 4)
            return {"action": "irrigation_now_or_wait", "items": [item], "confidence": round(conf, 4), "notes": notes}
        else:
            recommendation = "wait_for_rain"
            reasons.append(f"soil_moisture_pct={soil_moisture_pct:.1f}% >= threshold({stage_threshold}%)")
            notes = "Soil moisture appears sufficient; recommend waiting."
            conf = 0.7
            try:
                if helpers is not None and hasattr(helpers, "compute_confidence"):
                    conf = helpers.compute_confidence({"soil_moisture_signal": float(soil_moisture_pct)},facts, ["weather_outlook", "calendar_lookup"])
            except Exception:
                pass
            item = _build_decision_item(recommendation, reasons, tradeoffs, meta, sources)
            item["score"] = round(conf, 4)
            return {"action": "irrigation_now_or_wait", "items": [item], "confidence": round(conf, 4), "notes": notes}

    # No soil moisture present - fall back to crop stage sensitivity if available
    critical_stages = None
    try:
        critical_stages = calendar.get("critical_stages") or calendar.get("sensitive_stages")
    except Exception:
        critical_stages = None

    # If crop_stage is reported and is among critical stages, and forecast rain low, recommend irrigate
    if crop_stage and critical_stages and isinstance(critical_stages, dict):
        # check if crop_stage matches a key in critical_stages
        try:
            # compare lowercased names for robustness
            stage_keys = list(critical_stages.keys())
            matched = None
            for sk in stage_keys:
                if (str(sk).lower() == str(crop_stage).lower()) or (str(sk).lower() in str(crop_stage).lower()):
                    matched = sk
                    break
            if matched:
                # if no rain forecasted -> irrigate
                if (rain_48 is None) or (rain_48 < RAIN_THRESHOLD_MM):
                    recommendation = "irrigate_now"
                    reasons.append(f"crop_stage '{crop_stage}' is critical and forecast rain insufficient ({rain_48} mm)")
                    notes = "Critical crop stage with insufficient forecast rain; recommend irrigation."
                    conf = 0.65
                    try:
                        if helpers is not None and hasattr(helpers, "compute_confidence"):
                            conf = helpers.compute_confidence({"crop_stage_critical": 1.0, "forecast_rain_48h": rain_48 or 0.0},facts, ["weather_outlook", "calendar_lookup"])
                    except Exception:
                        pass
                    item = _build_decision_item(recommendation, reasons, tradeoffs, meta, sources)
                    item["score"] = round(conf, 4)
                    return {"action": "irrigation_now_or_wait", "items": [item], "confidence": round(conf, 4), "notes": notes}
                else:
                    # forecast will provide rain - wait
                    recommendation = "wait_for_rain"
                    reasons.append(f"crop_stage '{crop_stage}' is critical but forecast rain {rain_48} mm expected")
                    notes = "Critical stage but sufficient rain forecasted; recommend waiting."
                    conf = 0.8
                    item = _build_decision_item(recommendation, reasons, tradeoffs, meta, sources)
                    item["score"] = round(conf, 4)
                    return {"action": "irrigation_now_or_wait", "items": [item], "handler_confidence": round(conf, 4),"confidence": None, "notes": notes}
        except Exception:
            pass

    # If we reach here, insufficient data to make a safe recommendation
    # Ask for soil moisture or crop stage to proceed
    missing_fields = []
    if soil is None:
        missing_fields.append("soil or soil_moisture")
    if not crop_stage:
        missing_fields.append("crop_stage (current_stage or days_after_sowing)")
    if rain_48 is None:
        missing_fields.append("forecast rainfall (weather_outlook.forecast)")

    return {
        "action": "require_more_info",
        "items": [],
        "confidence": 0.0,
        "notes": "Insufficient data to make a safe irrigation decision. Provide soil moisture or crop stage and ensure forecast is present.",
        "missing": missing_fields,
    }
