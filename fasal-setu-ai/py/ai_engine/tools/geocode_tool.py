"""
Geocode tool (offline, deterministic)

Looks up centroid lat/lon for (state, district) from:
  data/static_json/geo/district_centroids.json

Input args (must use one of these formats):
    - {"state": "...", "district": "..."}  # Preferred: explicit pair
    - {"query": "District, State"}         # Will parse "district, state" in either order

Fallback (low confidence) supported ONLY for district-only when LLM omitted state (state inferred).

Returns (common envelope):
{
  "data": { "lat": 13.21, "lon": 77.64, "matched_state": "Karnataka",
            "matched_district": "Bengaluru Rural",
            "confidence": 0.95, "method": "static_centroid" },
  "source_stamp": { "type":"local_dataset", "path":"data/static_json/geo/district_centroids.json" }
}

Note: Planner SHOULD still provide both district + state. Do NOT rely on state-only calls; choose a district (e.g. capital) instead.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from difflib import get_close_matches

DATA_PATH = Path(__file__).resolve().parents[3] / "data" / "static_json" / "geo" / "district_centroids.json"

# common aliases (extend as needed)
_STATE_ALIASES = {
    "odisha": "odisha",
    "orissa": "odisha",
    "karnataka": "karnataka",
    "kar nataka": "karnataka",
    "bengal": "west bengal",
    "west bengal": "west bengal",
    "up": "uttar pradesh",
    "uttaranchal": "uttarakhand",
    "bangalore": "karnataka",
}

_DISTRICT_ALIASES = {
    "bengaluru": "bengaluru urban",
    "bangalore": "bengaluru urban",
    "bangalore rural": "bengaluru rural",
    "mysore": "mysuru",
    "bellary": "ballari",
    "tumkur": "tumakuru",
    "calcutta": "kolkata",
    "bombay": "mumbai",
    "ahmadabad": "ahmedabad",
}

_WS = re.compile(r"\s+")


def _norm(s: Optional[str]) -> str:
    if not s:
        return ""
    s = s.strip().lower()
    s = _WS.sub(" ", s)
    s = re.sub(r"[^\w\s]", " ", s)
    s = _WS.sub(" ", s).strip()
    return s


def _alias_state(s: str) -> str:
    s = _norm(s)
    return _STATE_ALIASES.get(s, s)


def _alias_district(s: str) -> str:
    s = _norm(s)
    s = s.replace(" district", "").replace(" dist", "")
    return _DISTRICT_ALIASES.get(s, s)


@lru_cache(maxsize=1)
def _load_rows() -> List[Dict[str, Any]]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Geo file not found: {DATA_PATH}")
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    # accept both {"records":[...]} and plain list [...]
    rows = data.get("records", data)
    if not isinstance(rows, list):
        raise ValueError("district_centroids.json must be a list of records or {records: [...]}")
    # normalize cached copies of names
    for r in rows:
        r["_state_norm"] = _alias_state(r.get("state"))
        r["_district_norm"] = _alias_district(r.get("district"))
    return rows


def _find_exact(state: str, district: str) -> Optional[Dict[str, Any]]:
    s, d = _alias_state(state), _alias_district(district)
    for r in _load_rows():
        if r["_state_norm"] == s and r["_district_norm"] == d:
            return r
    return None


def _best_by_district_only(district: str) -> Optional[Tuple[Dict[str, Any], float]]:
    d = _alias_district(district)
    cand = [r for r in _load_rows() if r["_district_norm"] == d]
    if cand:
        return cand[0], 0.80  # ambiguous but exact district string
    # fuzzy on district
    all_d = list({r["_district_norm"] for r in _load_rows()})
    close = get_close_matches(d, all_d, n=1, cutoff=0.88)
    if close:
        for r in _load_rows():
            if r["_district_norm"] == close[0]:
                return r, 0.70
    return None


def _parse_query(q: str) -> Tuple[Optional[str], Optional[str]]:
    """Parse a free‑text location query.

    We must preserve the comma BEFORE aggressive normalization so that
    patterns like "Kolhapur, Maharashtra" are correctly split into two
    tokens. Previous logic normalized first (removing punctuation) which
    collapsed the comma and caused both parts to be treated as one long
    district string, leading to missing state & failure.

    Returns (part1, part2) without assuming which is district vs state.
    Caller logic will attempt (district=a,state=b) then swapped variant.
    """
    raw = q.strip()
    if "," in raw:
        a, b = [x.strip() for x in raw.split(",", 1)]
        return a or None, b or None
    # Fallback: run normalization and treat entire string as a single district token
    normed = _norm(raw)
    parts = normed.split()
    if len(parts) >= 2:
        return " ".join(parts), None
    return None, None


def run(args: Dict[str, Any]) -> Dict[str, Any]:
    # validate input
    state = args.get("state")
    district = args.get("district")
    query = args.get("query")

    parsed_variant_tried = False
    if (not state or not district) and query:
        # try to parse a freeform "District, State" (or "State, District")
        a, b = _parse_query(query)
        if a and b:
            # attempt interpretation 1: district=a, state=b
            if not district:
                district = a
            if not state:
                state = b
            parsed_variant_tried = True

    record: Optional[Dict[str, Any]] = None
    confidence: float = 0.0

    # Try exact with current ordering
    if state and district:
        record = _find_exact(state, district)
        if record:
            confidence = 0.95
    
    # If not found and we parsed a freeform query, try swapped order (user may have given State,District)
    if not record and parsed_variant_tried and state and district:
        record = _find_exact(district, state)  # swap
        if record:
            # swap semantics since we mis-assigned earlier
            state, district = district, state
            confidence = 0.92

    # OPTIONAL: district-only fuzzy fallback (provide lower confidence) when LLM failed to supply state
    if not record and district and not state:
        dist_res = _best_by_district_only(district)
        if dist_res:
            record, confidence = dist_res
            state = record.get("state")
            # downgrade confidence because state inferred
            confidence = min(confidence, 0.75)


    if not record:
        # Build informative error
        missing_parts = []
        if not state:
            missing_parts.append("state")
        if not district:
            missing_parts.append("district")
        if missing_parts:
            raise ValueError(
                "Missing required location component(s): " + ", ".join(missing_parts) + ". "
                "Provide both 'state' and 'district' or a free-text 'query' like 'District, State'. "
                "State-only and district-only fallbacks failed to resolve a centroid."
            )
        raise ValueError(
            f"Could not geocode combination (state='{state}', district='{district}'). "
            "Check spelling or specify as 'District, State'."
        )

    lat = record.get("lat")
    lon = record.get("lon")
    if lat is None or lon is None:
        raise ValueError("Geo record found but missing lat/lon in dataset.")

    out = {
        "data": {
            "lat": float(lat),
            "lon": float(lon),
            "matched_state": record.get("state"),
            "matched_district": record.get("district"),
            "confidence": round(confidence, 2),
            "method": "static_centroid",
        },
        "source_stamp": {
            "type": "local_dataset",
            "path": str(DATA_PATH.relative_to(Path(__file__).resolve().parents[3])),
        },
    }
    return out
