# rules/variety_selection.py
"""
Handler for intent: "variety_selection"
Decision template: "variety_ranked_list"

Deterministic, rule-based variety ranking using provided tool outputs.
Inputs expected via `facts` dict (populated from tool_calls[*].output):
 - "variety_lookup": {"varieties": [ {..}, ... ], "provider": str, "retrieved_at": str, "confidence": float}
 - "calendar_lookup": {"crop": str, "district": str, "sowing_window": {"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}, "typical_maturity_days": int, ...}
 - Optional: "eather_outlook", "soil", "prices_fetch", "rag_search"

Behavior:
 - If required tools (variety_lookup, calendar_lookup) are missing -> return dict indicating missing fields.
 - Compute for each variety simple matching scores:
     * maturity_match: closeness of variety.maturity_days to typical_maturity_days (0..1)
     * climate_match: if weather_outlook provides seasonal normals and forecast, compute anomaly and
       prefer varieties with higher heat/drought tolerance if forecast is warmer/drier than normal.
       If weather info missing, this criterion is skipped.
     * pest_score: if rag_search lists pests, use variety.pest_resistance mapping to compute mean resistance.
     * market_score: use variety.market_preference_score if present.
     * soil_match: skipped unless variety declares pH range or soil sample present (kept simple).
 - The final variety score is the mean of available criterion scores (no external weights).
 - Returns top_n (default 3) varieties sorted by score (descending) as items with reasons and meta.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
import math
import statistics
import logging
from datetime import datetime

# robust imports for utilities and models
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


def _safe_get(var: Dict[str, Any], key: str, default=None):
    try:
        return var.get(key, default)
    except Exception:
        return default


def _compute_maturity_score(var_maturity: Optional[float], typical_maturity: Optional[float]) -> Optional[float]:
    if var_maturity is None or typical_maturity is None:
        return None
    try:
        vm = float(var_maturity)
        tm = float(typical_maturity)
        if tm <= 0:
            return None
        # closeness measure: 1 - relative absolute error, clipped to [0,1]
        score = 1.0 - min(1.0, abs(vm - tm) / tm)
        return max(0.0, min(1.0, score))
    except Exception:
        return None


def _avg_forecast_temp_and_rain(weather: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """
    Returns dict with mean_max_temp, mean_min_temp, total_rain over forecast if available.
    """
    if not weather:
        return None
    fc = weather.get("forecast") or weather.get("daily") or []
    if not isinstance(fc, list) or len(fc) == 0:
        return None
    temps_max = []
    temps_min = []
    rains = []
    for day in fc:
        try:
            tmax = day.get("t_max") or day.get("tmax") or day.get("t_max_c") or day.get("tMax") or day.get("t_max_celsius")
            tmin = day.get("t_min") or day.get("tmin") or day.get("t_min_c")
            rain = day.get("rain_mm") or day.get("precip_mm") or day.get("rain") or day.get("precipitation")
            if tmax is not None:
                temps_max.append(float(tmax))
            if tmin is not None:
                temps_min.append(float(tmin))
            if rain is not None:
                rains.append(float(rain))
        except Exception:
            continue
    if not temps_max and not temps_min and not rains:
        return None
    
    # Ensure all values are floats, not None
    result = {}
    if temps_max:
        result["mean_max_temp"] = float(statistics.mean(temps_max))
    if temps_min:
        result["mean_min_temp"] = float(statistics.mean(temps_min))
    if rains:
        result["total_rain"] = float(sum(rains))
    else:
        result["total_rain"] = 0.0
    result["days"] = float(len(fc))
    
    return result


def _compute_climate_signal(weather: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """
    Compute relative climate anomalies vs seasonal normals if possible.
    Returns a dict {'hotness': 0..1, 'dryness': 0..1} where higher means hotter/drier than normal.
    If seasonal_normals are not present, attempt simple heuristics; otherwise return None.
    """
    if not weather:
        return None
    normals = weather.get("seasonal_normals") or {}
    # try to compute monthly normal mean temp and rain - expect lists of length 12
    forecast_stats = _avg_forecast_temp_and_rain(weather)
    if not forecast_stats:
        return None

    hotness = None
    dryness = None
    try:
        # determine normal monthly averages if available
        monthly_temps = normals.get("monthly_avg_temp") if isinstance(normals, dict) else None
        monthly_rain = normals.get("monthly_avg_rain_mm") if isinstance(normals, dict) else None

        # attempt to locate the forecast month from first forecast date
        fc = weather.get("forecast") or []
        first_date = None
        if fc and isinstance(fc, list) and len(fc) > 0:
            first_date = fc[0].get("date")
        month_index = None
        if first_date:
            try:
                dt = datetime.fromisoformat(first_date)
                month_index = dt.month - 1
            except Exception:
                month_index = None

        # hotness: compare forecast mean_max_temp to monthly_avg_temp[month_index]
        if monthly_temps and month_index is not None and 0 <= month_index < len(monthly_temps):
            norm_temp = monthly_temps[month_index]
            if norm_temp is not None:
                ft = forecast_stats.get("mean_max_temp")
                if ft is not None:
                    # relative anomaly ratio
                    # if forecast > normal -> hotness = min(1, (ft - norm_temp)/max(1, norm_temp))
                    hotness = max(0.0, min(1.0, (ft - float(norm_temp)) / max(1.0, abs(float(norm_temp)))))
        # dryness: compare forecast total_rain to monthly average per forecast days
        if monthly_rain and month_index is not None and 0 <= month_index < len(monthly_rain):
            norm_rain_month = monthly_rain[month_index]
            if norm_rain_month is not None:
                # expected rain in forecast period = norm_rain_month * (days/30)
                days = forecast_stats.get("days") or 0
                expected = float(norm_rain_month) * (days / 30.0)
                actual = forecast_stats.get("total_rain") or 0.0
                # dryness score: higher when actual < expected
                if expected > 0:
                    dryness = max(0.0, min(1.0, (expected - actual) / expected))
        # fallback: if normals not available but mean_max_temp high, set hotness proportional to mean_max_temp/40
        if hotness is None:
            ft = forecast_stats.get("mean_max_temp")
            if ft is not None:
                hotness = max(0.0, min(1.0, (ft - 30.0) / 15.0))  # assumes 30C typical baseline; conservative heuristic
        if dryness is None:
            # if no rain expected, treat dryness as 1
            total_rain = forecast_stats.get("total_rain") or 0.0
            days = forecast_stats.get("days") or 1
            if total_rain <= 1e-6:
                dryness = 1.0
            else:
                # small dryness computed as inverse of average daily rain scaled
                dryness = max(0.0, min(1.0, 1.0 - min(1.0, (total_rain / max(1.0, days)) / 5.0)))
    except Exception:
        return None

    return {"hotness": hotness if hotness is not None else 0.0, "dryness": dryness if dryness is not None else 0.0}


def _compute_pest_score(var: Dict[str, Any], rag: Optional[Dict[str, Any]]) -> Optional[float]:
    """
    If rag_search provides pest list or pest risk mapping, compute average resistance across reported pests.
    """
    if not rag or not isinstance(rag, dict):
        return None
    pests = rag.get("pests") or rag.get("detected_pests") or []
    if not pests:
        return None
    resistances = []
    pres = var.get("pest_resistance") or {}
    for p in pests:
        # p might be string or dict
        pname = p if isinstance(p, str) else p.get("name")
        if not pname:
            continue
        # use provided resistance value or 0 if unknown
        r = pres.get(pname)
        try:
            if r is None:
                # try lower-case match
                r = pres.get(pname.lower())
        except Exception:
            r = None
        if r is None:
            # unknown resistance -> skip (avoid assuming neutral)
            continue
        try:
            resistances.append(float(r))
        except Exception:
            continue
    if not resistances:
        return None
    return float(sum(resistances) / len(resistances))


def handle(*,intent: Any, facts: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main handler function called by orchestrator.
    Returns a dict:
      {
         "action": "variety_ranked_list",
         "items": [ {name, score, reasons:list, tradeoffs:list, meta:dict, sources:list}, ... ],
         "confidence": float,
         "notes": "..."
      }
    """
    # Required tools: variety_lookup, calendar_lookup
    missing = []
    if not facts or not isinstance(facts, dict):
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No facts provided", "missing": ["variety_lookup", "calendar_lookup"]}

    variety_out = facts.get("variety_lookup")
    calendar_out = facts.get("calendar_lookup")
    weather_out = facts.get("weather_outlook")
    soil_out = facts.get("soil")
    prices_out = facts.get("prices_fetch")
    rag_out = facts.get("rag_search") or facts.get("rag") or facts.get("extension_notes")

    if not variety_out:
        missing.append("variety_lookup")
    if not calendar_out:
        missing.append("calendar_lookup")
    if missing:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "Missing required tool outputs", "missing": missing}

    # extract varieties list (support both 'varieties' key or root list)
    varieties = None
    if isinstance(variety_out, dict):
        varieties = variety_out.get("varieties") or variety_out.get("data") or variety_out.get("items")
    if varieties is None and isinstance(variety_out, list):
        varieties = variety_out
    if not varieties:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No varieties present in variety_lookup", "missing": []}

    # typical maturity
    typical_maturity = None
    try:
        if calendar_out:
            typical_maturity = calendar_out.get("typical_maturity_days") or calendar_out.get("maturity_days")
            if typical_maturity is not None:
                typical_maturity = float(typical_maturity)
    except Exception:
        typical_maturity = None

    # compute climate signal
    climate_signal = _compute_climate_signal(weather_out) if weather_out else None

    items = []
    per_item_scores = []
    for v in varieties:
        try:
            name = _safe_get(v, "name") or _safe_get(v, "id") or "unknown_variety"
            reasons = []
            tradeoffs = []
            meta = {}
            sources = []

            # include variety source if present
            src = _safe_get(v, "source")
            if src:
                sources.append({"source_id": src, "source_type": "catalog", "tool": "variety_lookup"})

            # maturity match
            maturity_score = _compute_maturity_score(_safe_get(v, "maturity_days"), typical_maturity)
            if maturity_score is not None:
                reasons.append(f"maturity_match={maturity_score:.2f}")
                meta["maturity_days"] = _safe_get(v, "maturity_days")

            # market preference
            market_pref = _safe_get(v, "market_preference_score")
            if market_pref is not None:
                try:
                    market_pref = float(market_pref)
                    reasons.append(f"market_pref={market_pref:.2f}")
                    meta["market_preference_score"] = market_pref
                except Exception:
                    market_pref = None

            # pest resistance (based on rag)
            pest_score = _compute_pest_score(v, rag_out)
            if pest_score is not None:
                reasons.append(f"pest_resistance_avg={pest_score:.2f}")
                meta.setdefault("pest_resistance", v.get("pest_resistance"))

            # climate match using climate_signal and variety tolerances
            climate_score = None
            if climate_signal:
                # prefer varieties with higher tolerance for detected stress
                hotness = climate_signal.get("hotness", 0.0) or 0.0
                dryness = climate_signal.get("dryness", 0.0) or 0.0
                # get variety tolerances (0..1)
                heat_tol = _safe_get(v, "heat_tolerance") or _safe_get(v, "heat_tolerance_score") or _safe_get(v, "heat_tolerance_index")
                drought_tol = _safe_get(v, "drought_tolerance")
                try:
                    heat_tol = float(heat_tol) if heat_tol is not None else None
                except Exception:
                    heat_tol = None
                try:
                    drought_tol = float(drought_tol) if drought_tol is not None else None
                except Exception:
                    drought_tol = None
                comps = []
                if heat_tol is not None:
                    comps.append((1.0 - hotness) * 1.0 + hotness * heat_tol)  # blends
                if drought_tol is not None:
                    comps.append((1.0 - dryness) * 1.0 + dryness * drought_tol)
                if comps:
                    climate_score = float(sum(comps) / len(comps))
                    reasons.append(f"climate_match={climate_score:.2f}")

            # soil match - simple if variety indicates pH range or soil texture
            soil_score = None
            try:
                var_ph_range = v.get("ph_range") or v.get("ph_tolerance")
                if var_ph_range and isinstance(var_ph_range, (list, tuple)) and soil_out:
                    soil_ph = soil_out.get("pH") or soil_out.get("ph")
                    if soil_ph is not None:
                        # var_ph_range expected [low, high]
                        try:
                            low = float(var_ph_range[0])
                            high = float(var_ph_range[1])
                            sp = float(soil_ph)
                            soil_score = 1.0 if (low <= sp <= high) else max(0.0, 1.0 - abs((sp - (low+high)/2) / ((high-low)/2 if (high-low)!=0 else 1.0)))
                            reasons.append(f"soil_ph_match={soil_score:.2f}")
                        except Exception:
                            soil_score = None
            except Exception:
                soil_score = None

            # expected yield & seed cost in meta/tradeoffs
            try:
                ey = _safe_get(v, "expected_yield_t_ha")
                if ey is not None:
                    meta["expected_yield_t_ha"] = ey
            except Exception:
                pass
            try:
                sc = _safe_get(v, "seed_cost_per_kg")
                if sc is not None:
                    meta["seed_cost_per_kg"] = sc
                    tradeoffs.append(f"seed_cost={sc}")
            except Exception:
                pass

            # gather available scores
            scores = []
            for s in (maturity_score, climate_score, pest_score, market_pref, soil_score):
                if s is None:
                    continue
                try:
                    scores.append(float(s))
                except Exception:
                    continue

            if scores:
                final_score = float(sum(scores) / len(scores))
            else:
                final_score = 0.0

            per_item_scores.append(final_score)
            items.append(
                {
                    "name": name,
                    "score": round(final_score, 4),
                    "reasons": reasons,
                    "tradeoffs": tradeoffs,
                    "meta": meta,
                    "sources": sources,
                }
            )
        except Exception as e:
            logger.debug("Error processing variety entry: %s", e, exc_info=True)
            continue

    # sort items by score desc
    items_sorted = sorted(items, key=lambda x: x.get("score", 0.0), reverse=True)

    # default top_n
    top_n = 3
    try:
        if isinstance(intent, dict):
            top_n_val = intent.get("top_n")
            if top_n_val is not None:
                top_n = int(top_n_val)
    except Exception:
        top_n = 3

    top_items = items_sorted[:top_n]

    handler_confidence_signal = float(statistics.mean(per_item_scores)) if per_item_scores else None
    # but set result.confidence to None (or include handler_confidence in result.meta) — orchestrator will compute final confidence
    return {
    "action": "variety_ranked_list",
    "items": top_items,                # each item has .score (raw_score)
    "handler_confidence": handler_confidence_signal,  # optional informative field
    "confidence": None,
    "notes": "Variety selection based on maturity, climate, pest resistance, and market preferences.",
    }
