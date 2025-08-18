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
        
    # Handle different weather data structures
    forecast_stats = None
    
    # Try new structure with tmax_c, tmin_c, rain_mm arrays
    if 'tmax_c' in weather and 'tmin_c' in weather and 'rain_mm' in weather:
        try:
            tmax_values = weather['tmax_c']
            tmin_values = weather['tmin_c']
            rain_values = weather['rain_mm']
            
            if tmax_values and tmin_values and rain_values:
                mean_max_temp = sum(tmax_values) / len(tmax_values)
                mean_min_temp = sum(tmin_values) / len(tmin_values)
                total_rain = sum(rain_values)
                
                forecast_stats = {
                    'mean_max_temp': mean_max_temp,
                    'mean_min_temp': mean_min_temp,
                    'total_rain_mm': total_rain
                }
        except Exception:
            pass
    
    # Fallback to old structure
    if not forecast_stats:
        forecast_stats = _avg_forecast_temp_and_rain(weather)
    
    if not forecast_stats:
        return None

    # Simple heuristics without seasonal normals
    hotness = None
    dryness = None
    
    try:
        mean_max = forecast_stats.get("mean_max_temp")
        total_rain = forecast_stats.get("total_rain_mm")
        
        # Simple thresholds for August in Bihar (current season)
        if mean_max is not None:
            # For August in Bihar, normal max temp ~32-35°C
            if mean_max > 35:
                hotness = min(1.0, (mean_max - 35) / 5)  # Scale 35-40°C to 0-1
            elif mean_max < 30:
                hotness = 0.0  # Cooler than normal
            else:
                hotness = (mean_max - 30) / 5  # Scale 30-35°C to 0-1
                
        if total_rain is not None:
            # For August in Bihar, normal rainfall ~200-300mm over 5-6 days
            expected_rain = 250  # mm for forecast period
            if total_rain < expected_rain * 0.5:
                dryness = 0.8  # Quite dry
            elif total_rain < expected_rain * 0.8:
                dryness = 0.4  # Somewhat dry
            else:
                dryness = 0.1  # Normal or wet
                
    except Exception as e:
        logger.warning(f"Error computing climate signal: {e}")
        return None
    
    if hotness is not None or dryness is not None:
        return {
            'hotness': hotness or 0.0,
            'dryness': dryness or 0.0
        }
    
    return None


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


def _extract_crop_score_factors(crop_entry):
    """Extract scoring factors from a crop calendar entry."""
    # Default values
    factors = {
        'rainfall_need': 500,  # mm default
        'temp_min': 15,        # °C default
        'temp_max': 35,        # °C default
        'duration': 120,       # days default
        'yield_per_hectare': 2000,  # kg default
        'profitability': 'medium'
    }
    
    if isinstance(crop_entry, dict):
        # Extract from various possible structures
        factors['rainfall_need'] = crop_entry.get('rainfall_requirement', crop_entry.get('water_need', 500))
        factors['temp_min'] = crop_entry.get('temperature_min', crop_entry.get('min_temp', 15))
        factors['temp_max'] = crop_entry.get('temperature_max', crop_entry.get('max_temp', 35))
        factors['duration'] = crop_entry.get('duration_days', crop_entry.get('crop_duration', 120))
        factors['yield_per_hectare'] = crop_entry.get('expected_yield', crop_entry.get('yield', 2000))
        factors['profitability'] = crop_entry.get('profitability', crop_entry.get('economics', 'medium'))
    
    return factors


def _create_varieties_from_calendar(calendar_data):
    """Create variety-like structure from crop calendar data."""
    if not calendar_data or not isinstance(calendar_data, dict):
        return []
    
    varieties = []
    
    # Handle different calendar data structures
    crops_data = calendar_data.get('data', {}).get('crops', [])
    if not crops_data:
        crops_data = calendar_data.get('crops', [])
    if not crops_data:
        crops_data = calendar_data.get('calendar', {})
        if isinstance(crops_data, dict):
            # Convert dict to list format
            crops_list = []
            for crop_name, crop_info in crops_data.items():
                crop_info['crop_name'] = crop_name
                crops_list.append(crop_info)
            crops_data = crops_list
    
    if isinstance(crops_data, list):
        for i, crop_info in enumerate(crops_data):
            if not isinstance(crop_info, dict):
                continue
                
            crop_name = crop_info.get('crop_name', f'crop_{i+1}')
            
            # Extract duration from planting window if available
            duration_days = 120  # default
            if 'planting_window' in crop_info:
                try:
                    # Try to calculate from planting window
                    duration_days = 120  # fallback
                except:
                    pass
            
            # Get irrigation requirement
            irrigation_req = 500  # default mm
            irrigation_info = crop_info.get('irrigation_ideal', {})
            if isinstance(irrigation_info, dict):
                irrigation_req = irrigation_info.get('seasonal_requirement_mm', 500)
            
            # Get temperature range
            temp_info = crop_info.get('ideal_temp_c', {})
            temp_range = temp_info.get('range_day', [20, 30]) if isinstance(temp_info, dict) else [20, 30]
            
            # Handle None or empty temp_range
            if not temp_range or not isinstance(temp_range, (list, tuple)):
                temp_range = [20, 30]
                
            temp_min = temp_range[0] if len(temp_range) > 0 else 20
            temp_max = temp_range[1] if len(temp_range) > 1 else 30
            
            variety = {
                'name': crop_name,
                'id': crop_name.lower().replace(' ', '_'),
                'type': crop_name.lower(),
                'maturity_days': duration_days,
                'temperature_tolerance': {
                    'min': temp_min,
                    'max': temp_max
                },
                'water_requirement_mm': irrigation_req,
                'characteristics': {
                    'maturity_period': f"{duration_days} days",
                    'rainfall_requirement': f"{irrigation_req} mm",
                    'temperature_range': f"{temp_min}-{temp_max}°C"
                },
                'advantages': [
                    f"Suitable for {crop_info.get('season', 'local')} season",
                    f"Well adapted to regional conditions"
                ],
                'disadvantages': [],
                'suitability_score': 0.8,  # Default good suitability for regional crops
                'market_preference_score': 0.7,  # Default market preference
                'source': f"regional_calendar_{crop_name}"
            }
            varieties.append(variety)
    
    return varieties


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
    # Required tools: variety_lookup, calendar_lookup (with fallback support)
    missing = []
    if not facts or not isinstance(facts, dict):
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No facts provided", "missing": ["variety_lookup", "calendar_lookup"]}

    # Try multiple key names for compatibility
    variety_out = facts.get("variety_lookup")
    calendar_out = facts.get("calendar_lookup") or facts.get("calendar")
    weather_out = facts.get("weather_outlook") or facts.get("weather")
    soil_out = facts.get("soil")
    prices_out = facts.get("prices_fetch")
    rag_out = facts.get("rag_search") or facts.get("rag") or facts.get("extension_notes")

    # If no variety_lookup but we have calendar with crop info, try to create varieties from crops
    if not variety_out and calendar_out:
        variety_out = _create_varieties_from_calendar(calendar_out)
        
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
        # If still None, check if variety_out itself contains variety-like entries
        if varieties is None:
            # Check if it's a dict of varieties (from _create_varieties_from_calendar)
            if all(isinstance(v, dict) and ('name' in v or 'id' in v) for v in variety_out.values()):
                varieties = list(variety_out.values())
    elif isinstance(variety_out, list):
        varieties = variety_out
    
    if not varieties:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No varieties present in variety_lookup", "missing": []}

    # typical maturity - try to get from calendar data
    typical_maturity = None
    try:
        if calendar_out:
            # First try direct fields
            typical_maturity = calendar_out.get("typical_maturity_days") or calendar_out.get("maturity_days")
            
            # If not found, try to extract from calendar data structure
            if typical_maturity is None:
                calendar_data = calendar_out.get('data', {})
                crops_list = calendar_data.get('crops', [])
                if crops_list and isinstance(crops_list, list):
                    # Get average duration from crops
                    durations = []
                    for crop in crops_list:
                        if isinstance(crop, dict):
                            # Try different duration fields
                            duration = crop.get('duration_days') or crop.get('duration')
                            if duration and isinstance(duration, (int, float)):
                                durations.append(float(duration))
                    if durations:
                        typical_maturity = sum(durations) / len(durations)
            
            if typical_maturity is not None:
                typical_maturity = float(typical_maturity)
    except Exception:
        typical_maturity = None

    # compute climate signal - handle different weather data structures
    climate_signal = None
    if weather_out:
        # Try different weather data structures
        weather_data = weather_out
        if isinstance(weather_out, dict):
            # Check for nested data structure
            if 'data' in weather_out:
                weather_data = weather_out['data']
        
        climate_signal = _compute_climate_signal(weather_data)

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
