# rules/market_advice.py
"""
Handler for intent: "market_advice"
Decision template: "sell_or_hold_decision"

Deterministic sell-or-hold decision based on price time series (prices_fetch) and optional storage info.

Required tool outputs (facts dict):
 - "prices_fetch": dict containing "price_history" (list of {date:ISO, price:float}) or variants
Optional:
 - "storage_find": dict with storage availability/cost fields (cost_per_month, cost_per_qtl, etc.)
 - "policy_match": can influence final recommendation (not used by default)

Algorithm (deterministic, documented assumptions):
 1. Extract price series (most recent N days, default window=14).
 2. Fit simple linear regression on index (0..n-1) -> slope (price change per day).
 3. Predict next-day price = last_price + slope.
 4. expected_pct_change = (predicted - last_price) / last_price
 5. volatility = std(price_returns) or coef of variation (std/mean)
 6. Decision rules (explicit):
    - If expected_pct_change >= HOLD_PCT_THRESHOLD and volatility <= VOLATILITY_THRESHOLD -> recommend "hold"
    - Else recommend "sell"
 7. Confidence computed from data sufficiency, recency, volatility and optionally via helpers.compute_confidence.

Important: threshold constants below are explicit defaults and can be tuned.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
import math
import statistics
import logging

# robust imports for helpers/provenance
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

# -----------------------
# Tunable constants (explicit)
# -----------------------
TREND_WINDOW_DAYS = 14  # number of most recent days to use for trend/volatility calculations
MIN_PRICE_POINTS = 3    # minimum price points required to make a decision
HOLD_PCT_THRESHOLD = 0.03  # if expected pct change >= 3% => candidate for holding
VOLATILITY_THRESHOLD = 0.08 # coefficient of variation threshold (8%) considered 'low volatility'
# If storage cost info provided it can modify decision (not assumed present)
# -----------------------

# Helpers
def _safe_get(d: Optional[Dict[str, Any]], *keys, default=None):
    if not isinstance(d, dict):
        return default
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


def _parse_date(s: Any) -> Optional[str]:
    if s is None:
        return None
    if isinstance(s, datetime):
        return s.isoformat() + "Z"
    if isinstance(s, str):
        try:
            # handle trailing Z
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt.isoformat() + "Z"
        except Exception:
            try:
                dt = datetime.strptime(s[:10], "%Y-%m-%d")
                return dt.isoformat() + "Z"
            except Exception:
                return None
    return None


def _extract_price_history(prices_out: Any) -> List[Tuple[datetime, float]]:
    """
    Accepts the tool output for prices_fetch and tries to extract a time-ordered list of (date, price).
    Supports variants:
      - {"price_history": [{"date":.., "price":..}, ...]}
      - {"prices": ...}
      - list directly passed
    Returns list sorted ascending by date. If date missing, uses index ordering (last==most recent).
    """
    records = []
    if prices_out is None:
        return []
    # If dict containing explicit list
    if isinstance(prices_out, dict):
        candidates = (
            prices_out.get("price_history")
            or prices_out.get("priceHistory")
            or prices_out.get("prices")
            or prices_out.get("data")
            or prices_out.get("series")
        )
        if isinstance(candidates, list):
            for rec in candidates:
                if not isinstance(rec, dict):
                    continue
                date_raw = rec.get("date") or rec.get("timestamp") or rec.get("ts") or rec.get("arrival_date")
                price_raw = rec.get("price") or rec.get("value") or rec.get("price_per_qtl") or rec.get("price_per_kg") or rec.get("price_value") or rec.get("modal_price_rs_per_qtl")
                d = _parse_date(date_raw)
                try:
                    p = float(price_raw) if price_raw is not None else None
                except Exception:
                    p = None
                if p is None:
                    # skip records without numeric price
                    continue
                if d is None:
                    # use epoch placeholder by index; we'll sort later keeping original order
                    # place date as None and handle later
                    records.append((None, p))
                else:
                    records.append((d, p))
        # if dict directly has numeric keyed dates, skip
    elif isinstance(prices_out, list):
        # list of simple prices or dicts
        for rec in prices_out:
            if isinstance(rec, dict):
                date_raw = rec.get("date") or rec.get("timestamp") or rec.get("arrival_date")
                price_raw = rec.get("price") or rec.get("value") or rec.get("modal_price_rs_per_qtl")
                d = _parse_date(date_raw)
                try:
                    p = float(price_raw) if price_raw is not None else None
                except Exception:
                    p = None
                if p is None:
                    continue
                records.append((d, p))
            else:
                # if primitive, skip (no date)
                continue
    # Sort: place entries with parsed date first ascending; entries with None date remain in original order afterwards
    dated = [(dt, pr) for (dt, pr) in records if dt is not None]
    undated = [(dt, pr) for (dt, pr) in records if dt is None]
    dated_sorted = sorted(dated, key=lambda x: x[0])
    combined = dated_sorted + undated
    # If we have no dates at all, but there are records, treat the order as given and assign synthetic dates (index)
    if not combined:
        return []
    return combined


def _compute_trend_and_volatility(series: List[Tuple[Optional[datetime], float]], window: int = TREND_WINDOW_DAYS) -> Optional[Dict[str, Any]]:
    """
    Given series sorted ascending by date (older first), compute trend (slope per step), predicted next price,
    expected_pct_change, volatility (coef of variation computed on returns).
    Returns dict with keys: last_price, predicted_price, expected_pct_change, slope_per_step, volatility, n_points
    Returns None if insufficient points.
    """
    if not series or len(series) < MIN_PRICE_POINTS:
        return None
    # take last `window` points
    s = series[-window:] if len(series) >= window else series[:]
    prices = [p for (_, p) in s]
    n = len(prices)
    if n < MIN_PRICE_POINTS:
        return None
    # indices 0..n-1
    xs = list(range(n))
    ys = prices
    # compute slope using least squares: slope = cov(x,y)/var(x)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(xs, ys))
    den = sum((xi - mean_x) ** 2 for xi in xs)
    slope = (num / den) if den != 0 else 0.0
    # predicted next price
    predicted = ys[-1] + slope
    last_price = ys[-1]
    expected_pct_change = (predicted - last_price) / last_price if last_price != 0 else 0.0
    # volatility: use returns over series (log returns or simple returns)
    returns = []
    for i in range(1, n):
        prev = ys[i - 1]
        curr = ys[i]
        try:
            if prev != 0:
                returns.append((curr - prev) / prev)
        except Exception:
            continue
    vol = float(statistics.pstdev(returns)) if returns else 0.0  # population std dev
    # coefficient of variation on prices as alternative
    cov = 0.0
    try:
        mean_price = statistics.mean(ys)
        stdev_price = statistics.pstdev(ys)
        cov = stdev_price / mean_price if mean_price != 0 else 0.0
    except Exception:
        cov = 0.0

    return {
        "last_price": float(last_price),
        "predicted_price": float(predicted),
        "expected_pct_change": float(expected_pct_change),
        "slope_per_step": float(slope),
        "volatility_returns": float(vol),
        "cov_prices": float(cov),
        "n_points": n,
    }


def _extract_storage_cost(storage_out: Optional[Dict[str, Any]]) -> Optional[float]:
    """
    Try to extract a monthly storage cost numeric from storage_find output if present.
    Look for keys: cost_per_month, monthly_cost, cost, cost_per_qtl_per_month, cost_per_qtl
    Units are not assumed; caller must interpret. We return numeric value if found, else None.
    """
    if not storage_out or not isinstance(storage_out, dict):
        return None
    for k in ("cost_per_month", "monthly_cost", "cost", "cost_per_qtl_per_month", "cost_per_qtl", "storage_cost"):
        v = storage_out.get(k)
        if v is None:
            continue
        try:
            return float(v)
        except Exception:
            continue
    return None


def _handle_insufficient_price_data(series: List[Tuple[Optional[datetime], float]], facts: Dict[str, Any], intent: Any) -> Dict[str, Any]:
    """
    Handle cases where we have some price data but not enough for trend analysis.
    Provides a basic recommendation based on current price and storage availability.
    """
    if not series:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No price data available", "missing": ["prices_fetch.price_history"]}
    
    # Get the most recent price
    latest_price = series[-1][1]  # (date, price) tuple
    
    # Check storage availability
    storage_out = facts.get("storage_find") or facts.get("storage")
    storage_available = False
    storage_note = ""
    
    if storage_out:
        # Try to determine if storage is available
        if isinstance(storage_out, dict):
            facilities = storage_out.get("data", {}).get("facilities", []) or storage_out.get("facilities", [])
            if facilities:
                active_facilities = [f for f in facilities if f.get("status", "").lower() == "active"]
                if active_facilities:
                    storage_available = True
                    storage_note = f"Storage available at {len(active_facilities)} facilities"
    
    # Basic recommendation logic for insufficient data
    if storage_available:
        recommendation = "hold_short_term"
        reason = "Limited price history available. Storage facilities accessible - consider holding for better price discovery."
        confidence = 0.4  # Lower confidence due to limited data
    else:
        recommendation = "sell_now"
        reason = "Limited price history and storage options. Recommend immediate sale to avoid uncertainty."
        confidence = 0.3  # Lower confidence due to limited data
    
    # Create decision item
    item = {
        "name": recommendation,  # Use "name" instead of "recommendation"
        "score": confidence,     # Use "score" instead of "confidence" 
        "current_price": latest_price,
        "price_points_available": len(series),
        "reasons": [reason],
        "tradeoffs": ["Limited price history - trend analysis not possible"],
        "meta": {
            "price_history_insufficient": True,
            "storage_available": storage_available,
            "storage_note": storage_note,
            "current_price": latest_price
        },
        "sources": []
    }
    
    return {
        "action": "basic_market_recommendation",
        "items": [item],
        "handler_confidence": confidence,
        "confidence": None,
        "notes": f"Basic recommendation based on {len(series)} price point(s). For better analysis, provide at least {MIN_PRICE_POINTS} price points."
    }


def handle(*,intent: Any, facts: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main handler called by orchestrator.
    - intent: dict or pydantic model (used optionally to get lookback window or risk appetite)
    - facts: mapping tool_name -> tool_output (these come from tool_calls[*]['output'])
    """
    # Validate presence of prices_fetch
    if not facts or not isinstance(facts, dict):
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No facts provided", "missing": ["prices_fetch"]}

    # Try both "prices_fetch" and "prices" keys for compatibility
    prices_out = facts.get("prices_fetch") or facts.get("prices")
    if not prices_out:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "Missing required tool output 'prices_fetch'", "missing": ["prices_fetch"]}

    # extract series
    series = _extract_price_history(prices_out)
    if not series:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No price data found", "missing": ["prices_fetch.price_history"]}
    
    # Handle insufficient price history with basic recommendation
    if len(series) < MIN_PRICE_POINTS:
        return _handle_insufficient_price_data(series, facts, intent)

    # determine lookback window (allow override from intent)
    window = TREND_WINDOW_DAYS
    try:
        if isinstance(intent, dict):
            w = intent.get("trend_window_days")
            if w is not None:
                window = int(w)
        else:
            w = getattr(intent, "trend_window_days", None)
            if w is not None:
                window = int(w)
    except Exception:
        window = TREND_WINDOW_DAYS

    # compute stats
    # Cast the series to match expected type signature
    series_typed: List[Tuple[Optional[datetime], float]] = [(dt, price) for dt, price in series]
    stats = _compute_trend_and_volatility(series_typed, window=window)
    if not stats:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "Unable to compute trend/volatility from price history", "missing": []}

    # optional storage info - try both "storage_find" and "storage" keys for compatibility
    storage_out = facts.get("storage_find") or facts.get("storage")
    storage_cost = _extract_storage_cost(storage_out)

    # Decision logic (deterministic):
    expected_pct = stats["expected_pct_change"]
    cov = stats["cov_prices"]
    vol_returns = stats["volatility_returns"]
    last_price = stats["last_price"]
    predicted_price = stats["predicted_price"]

    reasons = []
    reasons.append(f"predicted_pct_change={expected_pct:.4f}")
    reasons.append(f"price_cov={cov:.4f}")
    reasons.append(f"volatility_returns={vol_returns:.4f}")
    meta = {
        "last_price": last_price,
        "predicted_price": predicted_price,
        "expected_pct_change": expected_pct,
        "slope_per_step": stats["slope_per_step"],
        "volatility_returns": vol_returns,
        "cov_prices": cov,
        "n_points": stats["n_points"],
    }
    if storage_cost is not None:
        meta["storage_cost"] = storage_cost
        reasons.append(f"storage_cost={storage_cost}")

    # Compute basic rule:
    # If expected_pct_change >= HOLD_PCT_THRESHOLD AND volatility (cov) <= VOLATILITY_THRESHOLD -> HOLD
    # Else SELL
    decision = "sell"
    rationale = "Predicted price change below threshold or high volatility"
    if expected_pct >= HOLD_PCT_THRESHOLD and cov <= VOLATILITY_THRESHOLD:
        decision = "hold"
        rationale = "Predicted price increase and low volatility — prefer holding"
        reasons.append("rule: expected_pct >= HOLD_PCT_THRESHOLD and cov <= VOLATILITY_THRESHOLD")
    else:
        # Special-case: if expected_pct is slightly positive but storage_cost is low relative to last_price, still hold
        # NOTE: we do NOT assume any unit conversions; this check is conservative and only used if storage_cost present
        if storage_cost is not None and last_price > 0:
            # compute storage_cost_pct = storage_cost / last_price (very rough)
            try:
                storage_cost_pct = storage_cost / last_price
                if expected_pct > storage_cost_pct and cov <= VOLATILITY_THRESHOLD:
                    decision = "hold"
                    rationale = "Expected gain exceeds estimated storage cost (rough), and volatility low"
                    reasons.append(f"storage_cost_pct={storage_cost_pct:.4f}")
            except Exception:
                pass
    # confidence heuristic (robust + combine with helpers.compute_confidence if available)
    confidence = 0.5
    try:
        n_pts = int(stats.get("n_points", 0))
        base = min(0.9, 0.4 + 0.05 * n_pts)                  # more points -> higher base (cap)
        vol_factor = max(0.0, 1.0 - min(1.0, cov * 3.0))      # higher cov => lower factor
        heuristic_conf = float(base * vol_factor)

        # try to get provenance entries (defensive)
        prov_entries = []
        try:
            if helpers is not None and hasattr(helpers, "extract_provenance_from_facts"):
                prov_entries = helpers.extract_provenance_from_facts(facts or {}) or []
        except Exception:
            prov_entries = []

        # if helper exists, ask it for a confidence and combine with heuristic
        if helpers is not None and hasattr(helpers, "compute_confidence"):
            try:
                signals = {
                    "handler_confidence": heuristic_conf,
                    "items_mean_score": expected_pct if expected_pct else 0.5,
                    "facts_mean_confidence": 1.0 - cov if cov < 1.0 else 0.5,
                }
                helper_conf = helpers.compute_confidence(signals)
                # combine: prefer helper_conf when there is provenance, otherwise favor heuristic
                if prov_entries:
                    confidence = float(0.6 * float(helper_conf) + 0.4 * heuristic_conf)
                else:
                    confidence = float(0.8 * heuristic_conf + 0.2 * float(helper_conf))
            except Exception:
                confidence = float(heuristic_conf)
        else:
            confidence = float(heuristic_conf)

    except Exception:
        confidence = 0.5

    # clamp to [0,1] and round for readability
    confidence = max(0.0, min(1.0, float(confidence)))
    confidence = round(confidence, 4)


    # provenance
    sources = []
    try:
        if provenance is not None and hasattr(provenance, "merge_provenance"):
            merged = provenance.merge_provenance(None, facts)
            sources = merged or []
    except Exception:
        # try lightweight source
        prov_src = _safe_get(prices_out, "provider") or _safe_get(prices_out, "source")
        if prov_src:
            sources = [{"source_id": prov_src, "source_type": "market", "tool": "prices_fetch"}]

    # build DecisionItem (single recommendation item)
    item = {
        "name": decision,
        "score": round(confidence, 4),
        "reasons": [rationale] + reasons,
        "tradeoffs": [
            "Holding may incur storage costs and price uncertainty" if decision == "hold" else "Selling may forgo potential price increase"
        ],
        "meta": meta,
        "sources": sources,
    }

    notes = f"Decision: {decision}. Predicted next price {predicted_price:.2f}, expected pct change {expected_pct:.4%}."

    return {"action": "sell_or_hold_decision", "items": [item], "handler_confidence": round(float(confidence), 4), "confidence": None,"notes": notes}
