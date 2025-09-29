"""
Geocode tool (offline, deterministic)

Enhanced with Kerala village-level resolution. Looks up:
1. Kerala villages from data/static_json/geo/kerala_villages.json
2. District centroids from data/static_json/geo/district_centroids.json

Input args (formats in order of precedence):
    - {"state": "Kerala", "village": "..."} # Kerala village lookup
    - {"state": "...", "district": "..."}   # District centroid lookup
    - {"query": "Village/District, State"}  # Free text parsing

Returns (common envelope):
{
  "data": {
    "lat": 13.21, 
    "lon": 77.64, 
    "matched_state": "Kerala",
    "matched_district": "Ernakulam",
    "matched_village": "Kalady",  # Only for Kerala village matches
    "confidence": 0.95, 
    "method": "kerala_village" | "static_centroid"
  },
  "source_stamp": { 
    "type": "local_dataset",
    "path": "data/static_json/geo/{dataset}.json"
  }
}

Special handling for Kerala:
- Village name triggers exact lookup in kerala_villages.json
- Falls back to district centroid if village not found
- Higher confidence (0.98) for village-level matches
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from difflib import get_close_matches

try:  # standard package-relative
    from .paths import GEO_DIR  # type: ignore
except Exception:  # fallback for script-mode execution
    try:
        from tools.paths import GEO_DIR  # type: ignore
    except Exception:  # final fallback: compute relative to this file
        GEO_DIR = Path(__file__).resolve().parent / ".." / "data" / "static_json" / "geo"
        GEO_DIR = GEO_DIR.resolve()

DISTRICT_CENTROIDS_PATH = GEO_DIR / "district_centroids.json"
KERALA_VILLAGES_PATH = GEO_DIR / "kerala_villages.json"

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
def _load_district_centroids() -> List[Dict[str, Any]]:
    """Load and cache district centroids data"""
    if not DISTRICT_CENTROIDS_PATH.exists():
        raise FileNotFoundError(f"Geo file not found: {DISTRICT_CENTROIDS_PATH}")
    with open(DISTRICT_CENTROIDS_PATH, "r", encoding="utf-8") as f:
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

@lru_cache(maxsize=1)
def _load_kerala_villages() -> List[Dict[str, Any]]:
    """Load and cache Kerala villages data"""
    if not KERALA_VILLAGES_PATH.exists():
        return []  # graceful degradation if villages file not found
    try:
        with open(KERALA_VILLAGES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("records", [])
    except Exception:
        return []  # graceful degradation on any error


def _find_kerala_village(village: str) -> Optional[Dict[str, Any]]:
    """Find Kerala village by exact name match"""
    village_norm = _norm(village)
    for record in _load_kerala_villages():
        if (_norm(record.get("village", "")) == village_norm and 
            _norm(record.get("state", "")) == "kerala"):
            return record
    return None

def _find_exact(state: str, district: str) -> Optional[Dict[str, Any]]:
    s, d = _alias_state(state), _alias_district(district)
    for r in _load_district_centroids():
        if r["_state_norm"] == s and r["_district_norm"] == d:
            return r
    return None


def _best_by_district_only(district: str) -> Optional[Tuple[Dict[str, Any], float]]:
    d = _alias_district(district)
    rows = _load_district_centroids()
    cand = [r for r in rows if r["_district_norm"] == d]
    if cand:
        return cand[0], 0.80  # ambiguous but exact district string
    # fuzzy on district
    all_d = list({r["_district_norm"] for r in rows})
    close = get_close_matches(d, all_d, n=1, cutoff=0.88)
    if close:
        for r in rows:
            if r["_district_norm"] == close[0]:
                return r, 0.70
    return None


def _parse_query(q: str) -> Tuple[Optional[str], Optional[str]]:
    """Parse a free-text query.

    We intentionally DO NOT normalize punctuation before checking for a comma,
    because the normalization step strips commas. Instead:
      1. Check raw string for a comma split → interpret as two components
      2. Normalize each side separately (so aliases still work)
      3. If no comma, fall back to simple token split (ambiguous)
    """
    raw = q.strip()
    if "," in raw:
        a_raw, b_raw = [x.strip() for x in raw.split(",", 1)]
        a = _norm(a_raw)
        b = _norm(b_raw)
        return (a or None), (b or None)
    norm = _norm(raw)
    parts = norm.split()
    if len(parts) >= 2:
        return " ".join(parts), None
    return None, None


def run(args: Dict[str, Any]) -> Dict[str, Any]:
    # validate input
    state = args.get("state")
    district = args.get("district")
    village = args.get("village")
    query = args.get("query")
    
    # Special handling for Kerala village lookup
    if village and (not state or state.lower() == "kerala"):
        village_record = _find_kerala_village(village)
        if village_record:
            return {
                "data": {
                    "lat": float(village_record["lat"]),
                    "lon": float(village_record["lon"]),
                    "matched_state": "Kerala",
                    "matched_district": village_record["district"],
                    "matched_village": village_record["village"],
                    "confidence": 0.98,
                    "method": "kerala_village"
                },
                "source_stamp": {
                    "type": "local_dataset",
                    "path": "data/static_json/geo/kerala_villages.json"
                }
            }

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
    "source_stamp": {"type": "local_dataset", "path": "data/static_json/geo/district_centroids.json"},
    }
    return out
