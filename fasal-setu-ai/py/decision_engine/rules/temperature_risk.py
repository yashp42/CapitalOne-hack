# rules/temperature_risk.py
"""
Handler for intent: "temperature_risk"
Decision template: "frost_or_heat_risk_assessment"

Deterministic temperature risk assessment based on provided weather_outlook and calendar_lookup facts.

Expectations about inputs (facts dict keys):
 - "weather_outlook": must contain "forecast" (list of day dicts). Each day dict should ideally have:
       - "date" (ISO string) and either/both "t_min"/"t_max" or variants like "tmin"/"tmax" or "min_temp"/"max_temp".
 - "calendar_lookup": may contain crop stage information and optional per-stage critical temperature thresholds.
       - look for keys: "critical_temps", "stage_thresholds", "stage_critical_temps", or per-stage "frost_threshold"/"heat_threshold".
       - If per-stage thresholds are present they should be shaped like:
           {"flowering": {"frost_threshold": 2.0, "heat_threshold": 38.0}, ...}
 - Optional: intent or calendar may include a top-level "crop_stage" or "current_stage" to select stage-specific thresholds.

Fallback assumptions (explicit):
 - If calendar does not provide thresholds, use defaults:
     frost_threshold = 2.0 (°C)
     heat_threshold = 38.0 (°C)
 - Lookahead default = 7 days
 - Temperatures are in °C; if temperatures are missing we cannot compute risk.

Return shape:
 {
   "action": "frost_or_heat_risk_assessment",
   "items": [
       {
         "name": "frost_risk" or "heat_risk",
         "score": severity (0..1),
         "reasons": [...],
         "tradeoffs": [...],
         "meta": { ... worst_day, observed_temp, threshold ... },
         "sources": [ provenance entries if available ]
       },
       ...
   ],
   "confidence": float (0..1),
   "notes": "text",
   "missing": []  # present when required inputs missing
 }
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime
import logging
import statistics

# Robust imports
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


# Conservative defaults (explicit)
DEFAULT_LOOKAHEAD_DAYS = 7
DEFAULT_FROST_THRESHOLD_C = 2.0
DEFAULT_HEAT_THRESHOLD_C = 38.0


def _safe_get(d: Optional[Dict[str, Any]], *keys, default=None):
    if not isinstance(d, dict):
        return default
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


def _parse_temp(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        try:
            # sometimes string with units
            s = str(value).strip().split()[0]
            return float(s)
        except Exception:
            return None

def _normalize_forecast_days(weather_out: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Robust normalizer for incoming weather_out shapes.
    Returns list of dicts: {'date': ISOstr|None, 't_min': float|None, 't_max': float|None, 'raw': original_entry}
    Handles:
      - forecast: [ {...}, {...} ]  (list of day dicts)
      - time-series arrays: {'time':[...], 'tmin_c': [...], 'tmax_c': [...], ...}
    Accepts many key name variants (tmin, t_min, tmin_c, temp_min, etc).
    """
    if not weather_out or not isinstance(weather_out, dict):
        return []

    def _to_float(v):
        if v is None:
            return None
        try:
            return float(v)
        except Exception:
            try:
                s = str(v).strip().split()[0]
                return float(s)
            except Exception:
                return None

    def _find_any(d: Dict[str, Any], *keys):
        # exact key first, then case-insensitive fallback
        for k in keys:
            if k in d and d[k] is not None:
                return d[k]
        low = {str(k).lower(): v for k, v in d.items()}
        for k in keys:
            kl = str(k).lower()
            if kl in low and low[kl] is not None:
                return low[kl]
        return None

    # 1) Case A: list of dicts under 'forecast' / 'daily' / 'data'
    raw_fc = None
    for candidate in ("forecast", "daily", "data"):
        if candidate in weather_out and isinstance(weather_out[candidate], list):
            raw_fc = weather_out[candidate]
            break

    normalized = []

    if isinstance(raw_fc, list):
        for entry in raw_fc:
            if not isinstance(entry, dict):
                continue
            date_raw = _find_any(entry, "date", "datetime", "time", "dt")
            # accept many variants including plain 'tmin' / 'tmax'
            tmin_raw = _find_any(entry, "t_min", "tmin", "tmin_c", "temp_min", "min_temp", "night_temp")
            tmax_raw = _find_any(entry, "t_max", "tmax", "tmax_c", "temp_max", "max_temp", "day_temp")
            # nested 'temperature' object fallback
            if (tmin_raw is None or tmax_raw is None) and "temperature" in entry and isinstance(entry["temperature"], dict):
                tmin_raw = tmin_raw or _find_any(entry["temperature"], "min", "t_min", "tmin")
                tmax_raw = tmax_raw or _find_any(entry["temperature"], "max", "t_max", "tmax")
            tmin_f = _to_float(tmin_raw)
            tmax_f = _to_float(tmax_raw)
            # include even if one of them exists; we'll filter later if needed
            normalized.append({"date": date_raw, "t_min": tmin_f, "t_max": tmax_f, "raw": entry})

    # 2) Case B: timeseries arrays: time + tmin_c / tmax_c / temp_2m_c etc.
    if not normalized:
        # check for timeseries style arrays
        time_arr = None
        for tkey in ("time", "times", "date", "time_hourly"):
            if tkey in weather_out and isinstance(weather_out[tkey], list):
                time_arr = weather_out[tkey]
                break
        if isinstance(time_arr, list) and len(time_arr) > 0:
            # try to find tmin/tmax arrays (various possible names)
            def _arr_get(*names):
                for n in names:
                    if n in weather_out and isinstance(weather_out[n], list):
                        return weather_out[n]
                    # try lowercased keys
                    lowmap = {k.lower(): v for k, v in weather_out.items()}
                    for nn in names:
                        if nn.lower() in lowmap and isinstance(lowmap[nn.lower()], list):
                            return lowmap[nn.lower()]
                return None

            tmin_arr = _arr_get("tmin", "tmin_c", "t_min", "temp_min", "min_temp", "tmin_celsius")
            tmax_arr = _arr_get("tmax", "tmax_c", "t_max", "temp_max", "max_temp", "tmax_celsius")
            temp2m_arr = _arr_get("temp_2m_c", "temp_2m", "temperature")

            # prefer tmin/tmax pair; else if only hourly temp available use that as t_max/t_min heuristics across day
            if tmin_arr and isinstance(tmin_arr, list):
                length = min(len(time_arr), len(tmin_arr))
                for i in range(length):
                    date_raw = time_arr[i]
                    tmin_f = _to_float(tmin_arr[i])
                    tmax_f = None
                    if tmax_arr and i < len(tmax_arr):
                        tmax_f = _to_float(tmax_arr[i])
                    normalized.append({"date": date_raw, "t_min": tmin_f, "t_max": tmax_f, "raw": {"index": i}})
            elif temp2m_arr and isinstance(temp2m_arr, list):
                # aggregate per-day if time arr looks daily; otherwise include as best-effort
                length = min(len(time_arr), len(temp2m_arr))
                for i in range(length):
                    date_raw = time_arr[i]
                    temp_f = _to_float(temp2m_arr[i])
                    normalized.append({"date": date_raw, "t_min": temp_f, "t_max": temp_f, "raw": {"index": i}})
    # Final filter: keep entries that have at least one numeric temp
    normalized_filtered = [d for d in normalized if (d.get("t_min") is not None) or (d.get("t_max") is not None)]
    return normalized_filtered



def _get_stage_thresholds(calendar: Dict[str, Any], stage: Optional[str]) -> Dict[str, float]:
    """
    Try to extract frost/heat thresholds from calendar for the given stage (if provided).
    Expected keys:
      - calendar["critical_temps"] or calendar["stage_thresholds"] or calendar["stage_critical_temps"]
    where the mapping is stage -> {"frost_threshold": float, "heat_threshold": float}
    Returns dict with keys 'frost_threshold' and 'heat_threshold' (floats), falling back to defaults.
    """
    frost = None
    heat = None
    # scenario 1: direct per-stage mapping
    try:
        candidates = (
            calendar.get("critical_temps") or calendar.get("stage_thresholds") or calendar.get("stage_critical_temps") or {}
        )
        if isinstance(candidates, dict) and stage:
            # match keys case-insensitively
            for sk, val in candidates.items():
                if str(sk).lower() == str(stage).lower():
                    if isinstance(val, dict):
                        frost = _safe_get(val, "frost_threshold", "frost_temp", default=None) or frost
                        heat = _safe_get(val, "heat_threshold", "heat_temp", default=None) or heat
                    break
        # scenario 2: calendar may provide top-level thresholds
        if frost is None:
            frost = _safe_get(calendar, "frost_threshold", "frost_temp")
        if heat is None:
            heat = _safe_get(calendar, "heat_threshold", "heat_temp")
    except Exception:
        pass

    try:
        frost_v = float(frost) if frost is not None else DEFAULT_FROST_THRESHOLD_C
    except Exception:
        frost_v = DEFAULT_FROST_THRESHOLD_C
    try:
        heat_v = float(heat) if heat is not None else DEFAULT_HEAT_THRESHOLD_C
    except Exception:
        heat_v = DEFAULT_HEAT_THRESHOLD_C
    return {"frost_threshold": frost_v, "heat_threshold": heat_v}


def _severity_from_difference(diff: float, reference: float) -> float:
    """
    Convert an absolute difference to a 0..1 severity.
    For frost: diff = threshold - observed_temp (positive if below threshold)
    For heat: diff = observed_temp - threshold (positive if above)
    
    Improved scaling:
    - Minor breach (0-1°C): 0.1-0.3 severity
    - Moderate breach (1-3°C): 0.3-0.7 severity  
    - Severe breach (3°C+): 0.7-1.0 severity
    """
    try:
        if diff <= 0:
            return 0.0
        
        # Progressive severity scaling based on absolute difference
        if diff <= 1.0:
            # Minor breach: 0-1°C = 10-30% severity
            sev = 0.1 + (diff * 0.2)  # 0.1 + (0 to 1) * 0.2 = 0.1 to 0.3
        elif diff <= 3.0:
            # Moderate breach: 1-3°C = 30-70% severity
            sev = 0.3 + ((diff - 1.0) / 2.0) * 0.4  # 0.3 + (0 to 1) * 0.4 = 0.3 to 0.7
        else:
            # Severe breach: 3°C+ = 70-100% severity
            excess = min(diff - 3.0, 7.0)  # Cap at 10°C total (7°C excess)
            sev = 0.7 + (excess / 7.0) * 0.3  # 0.7 + (0 to 1) * 0.3 = 0.7 to 1.0
        
        return float(max(0.0, min(1.0, sev)))
    except Exception:
        return 0.0


def _select_worst_day_for_risk(days: List[Dict[str, Any]], risk_type: str, threshold: float, lookahead: int):
    """
    From normalized forecast days, consider first `lookahead` days and select worst day for risk_type:
    - For 'frost': find min t_min and compute diff = threshold - t_min (positive means breach)
    - For 'heat': find max t_max and compute diff = t_max - threshold (positive means breach)
    Returns (worst_day_dict, observed_temp, diff, severity) or (None, None, None, 0.0) if not computable.
    """
    consider = (days or [])[:lookahead]
    if not consider:
        return None, None, None, 0.0
    if risk_type == "frost":
        # find day with smallest t_min
        candidate = None
        best_val = None
        for d in consider:
            tmin = d.get("t_min")
            if tmin is None:
                continue
            if (best_val is None) or (tmin < best_val):
                best_val = tmin
                candidate = d
        if candidate is None or best_val is None:
            return None, None, None, 0.0
        diff = threshold - float(best_val)  # positive if breach
        severity = _severity_from_difference(diff, threshold) if diff > 0 else 0.0
        return candidate, best_val, diff, float(severity)
    else:  # heat
        candidate = None
        best_val = None
        for d in consider:
            tmax = d.get("t_max")
            if tmax is None:
                continue
            if (best_val is None) or (tmax > best_val):
                best_val = tmax
                candidate = d
        if candidate is None or best_val is None:
            return None, None, None, 0.0
        diff = float(best_val) - threshold  # positive if breach
        severity = _severity_from_difference(diff, threshold) if diff > 0 else 0.0
        return candidate, best_val, diff, float(severity)


def _build_item(name: str, severity: float, reasons: List[str], meta: Dict[str, Any], sources: List[Dict[str, Any]]):
    return {
        "name": name,
        "score": round(severity, 4),
        "reasons": reasons,
        "tradeoffs": [],
        "meta": meta,
        "sources": sources,
    }


def handle(*,intent: Any, facts: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main handler entrypoint. Expects:
      - intent: dict or pydantic model (used to extract crop_stage if present)
      - facts: mapping tool_name -> tool_output
    Returns a dict matching the orchestrator expected response.
    """
    # Validate inputs
    missing = []
    if not facts or not isinstance(facts, dict):
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No facts provided", "missing": ["weather_outlook", "calendar_lookup"]}

    weather = facts.get("weather_outlook")
    calendar = facts.get("calendar_lookup")

    if not weather:
        missing.append("weather_outlook")
    if not calendar:
        missing.append("calendar_lookup")
    if missing:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "Missing required tool outputs", "missing": missing}

    # parse lookahead from intent or default
    lookahead_days = DEFAULT_LOOKAHEAD_DAYS
    try:
        if isinstance(intent, dict):
            la = intent.get("lookahead_days")
            if la is not None:
                lookahead_days = int(la)
        else:
            la = getattr(intent, "lookahead_days", None)
            if la is not None:
                lookahead_days = int(la)
    except Exception:
        lookahead_days = DEFAULT_LOOKAHEAD_DAYS

    # normalize forecast days
    days = _normalize_forecast_days(weather or {})
    if not days:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No usable forecast entries in weather_outlook.forecast", "missing": ["weather_outlook.forecast"]}

    # determine crop stage if available (intent preferred)
    crop_stage = None
    try:
        if isinstance(intent, dict):
            crop_stage = intent.get("crop_stage") or intent.get("growth_stage") or intent.get("stage")
        else:
            crop_stage = getattr(intent, "crop_stage", None) or getattr(intent, "growth_stage", None)
    except Exception:
        crop_stage = None
    # fallback to calendar fields
    if not crop_stage:
        crop_stage = _safe_get(calendar, "current_stage", "crop_stage", "stage")

    thresholds = _get_stage_thresholds(calendar or {}, crop_stage)

    frost_threshold = thresholds.get("frost_threshold", DEFAULT_FROST_THRESHOLD_C)
    heat_threshold = thresholds.get("heat_threshold", DEFAULT_HEAT_THRESHOLD_C)

    # try to get provenance sources
    sources = []
    try:
        if provenance is not None and hasattr(provenance, "merge_provenance"):
            merged = provenance.merge_provenance(None, facts)
            if merged:
                for m in (merged or [])[:3]:
                    try:
                        sources.append(m)
                    except Exception:
                        continue
    except Exception:
        # fallback to simple weather provider entry
        try:
            if isinstance(weather, dict):
                wp = weather.get("provider") or weather.get("source")
                if wp:
                    sources.append({"source_id": wp, "source_type": "weather", "tool": "weather_outlook"})
        except Exception:
            pass

    items: List[Dict[str, Any]] = []
    reasons_all: List[str] = []

    # Frost risk assessment
    worst_day, observed_tmin, diff_frost, severity_frost = _select_worst_day_for_risk(days, "frost", frost_threshold, lookahead_days)
    if worst_day and severity_frost and severity_frost > 0.0:
        date_str = worst_day.get("date")
        reasons = [f"predicted_min_temp={observed_tmin}C on {date_str}", f"threshold_frost={frost_threshold}C", f"breach_by={diff_frost:.2f}C"]
        meta = {"worst_date": date_str, "observed_tmin": observed_tmin, "threshold_frost": frost_threshold, "diff": round(float(diff_frost or 0), 3)}
        items.append(_build_item("frost_risk", severity_frost, reasons, meta, sources))
        reasons_all.extend(reasons)

    # Heat risk assessment
    worst_day_h, observed_tmax, diff_heat, severity_heat = _select_worst_day_for_risk(days, "heat", heat_threshold, lookahead_days)
    if worst_day_h and severity_heat and severity_heat > 0.0:
        date_str = worst_day_h.get("date")
        reasons = [f"predicted_max_temp={observed_tmax}C on {date_str}", f"threshold_heat={heat_threshold}C", f"exceed_by={diff_heat:.2f}C"]
        meta = {"worst_date": date_str, "observed_tmax": observed_tmax, "threshold_heat": heat_threshold, "diff": round(float(diff_heat or 0), 3)}
        items.append(_build_item("heat_risk", severity_heat, reasons, meta, sources))
        reasons_all.extend(reasons)

        # no detected risk in lookahead window
    if not items:
        notes = (
            f"No frost or heat risk detected in next {lookahead_days} days "
            f"based on thresholds (frost: {frost_threshold}C, heat: {heat_threshold}C)."
        )
        # heuristic confidence: high if forecasts present
        heuristic_conf = 0.75 if len(days) > 0 else 0.4
        handler_conf = float(heuristic_conf)

        # attempt to extract provenance defensively
        prov_entries = []
        try:
            if helpers is not None and hasattr(helpers, "extract_provenance_from_facts"):
                prov_entries = helpers.extract_provenance_from_facts(facts or {}) or []
                if not isinstance(prov_entries, list):
                    prov_entries = list(prov_entries)
        except Exception:
            prov_entries = []

        # try helper-based confidence and combine sensibly with heuristic
        try:
            if helpers is not None and hasattr(helpers, "compute_confidence"):
                signals = {
                    "num_forecast_days": len(days),
                    "has_forecast": bool(days),
                    "heuristic_conf": heuristic_conf,
                }
                helper_conf = helpers.compute_confidence(signals=signals, prov_entries=prov_entries)
                helper_conf = float(helper_conf)
                if prov_entries:
                    # favor helper when provenance exists
                    handler_conf = 0.6 * helper_conf + 0.4 * heuristic_conf
                else:
                    # favor heuristic when no provenance
                    handler_conf = 0.8 * heuristic_conf + 0.2 * helper_conf
        except Exception:
            # keep heuristic if helper fails
            handler_conf = float(heuristic_conf)

        handler_conf = max(0.0, min(1.0, float(handler_conf)))
        handler_conf = round(handler_conf, 4)

        return {
            "action": "frost_or_heat_risk_assessment",
            "items": [],
            "handler_confidence": handler_conf,
            "confidence": None,
            "notes": notes,
        }

    # compute overall confidence: average of individual severities (base), modulated by helpers if available
    try:
        confidences = [float(it.get("score", 0.0)) for it in items if isinstance(it, dict)]
        base_conf = float(statistics.mean(confidences)) if confidences else 0.5
    except Exception:
        base_conf = 0.5

    final_conf = float(base_conf)

    # get provenance entries defensively
    prov_entries = []
    try:
        if helpers is not None and hasattr(helpers, "extract_provenance_from_facts"):
            prov_entries = helpers.extract_provenance_from_facts(facts or {}) or []
            if not isinstance(prov_entries, list):
                prov_entries = list(prov_entries)
    except Exception:
        prov_entries = []

    # attempt helper confidence and combine with base_conf
    try:
        if helpers is not None and hasattr(helpers, "compute_confidence"):
            # Prepare signals for helper function with correct parameter names
            signal_dict = {
                "handler_confidence": base_conf,  # Use correct key name
                "items_mean_score": base_conf,    # Average score of risk items
                "n_items": len(items),            # Number of risk items found
                "num_forecast_days": len(days)    # Additional context
            }
            # Call with correct parameters: signals, facts, required_tools
            required_tools = ["weather_outlook", "calendar_lookup"]
            helper_conf = helpers.compute_confidence(
                signals=signal_dict, 
                facts=facts,  # Pass facts instead of prov_entries
                required_tools=required_tools
            )
            helper_conf = float(helper_conf)
            print(f"DEBUG: base_conf={base_conf}, helper_conf={helper_conf}, prov_entries={len(prov_entries)}")
            if prov_entries:
                # favor helper when provenance present
                final_conf = 0.6 * helper_conf + 0.4 * base_conf
                print(f"DEBUG: Using helper-weighted confidence: {final_conf}")
            else:
                # favor heuristic base when no provenance
                final_conf = 0.8 * base_conf + 0.2 * helper_conf
                print(f"DEBUG: Using base-weighted confidence: {final_conf}")
    except Exception as e:
        # keep base_conf if helper fails
        print(f"DEBUG: Helper confidence failed: {e}")
        final_conf = float(base_conf)

    final_conf = max(0.0, min(1.0, float(final_conf)))
    final_conf = round(final_conf, 4)

    notes = "Detected temperature risks for next {} days.".format(lookahead_days)
    # return handler-provided confidence (orchestrator will compute aggregated confidence)
    # keep "confidence": None for orchestrator to set canonical overall confidence
    return {
        "action": "frost_or_heat_risk_assessment",
        "items": items,
        "handler_confidence": final_conf,
        "confidence": None,
        "notes":notes,
    }
