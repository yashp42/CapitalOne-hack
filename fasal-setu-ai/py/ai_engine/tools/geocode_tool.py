"""
Geocode tool (offline, deterministic)

Looks up centroid lat/lon for (state, district) from:
  data/static_json/geo/district_centroids.json

Input args (any one of):
  - {"state": "...", "district": "..."}
  - {"query": "District, State"}  # will parse "district, state" in either order

Returns (common envelope):
{
  "data": { "lat": 13.21, "lon": 77.64, "matched_state": "Karnataka",
            "matched_district": "Bengaluru Rural",
            "confidence": 0.95, "method": "static_centroid" },
  "source_stamp": { "type":"local_dataset", "path":"data/static_json/geo/district_centroids.json" }
}
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
    """
    Accepts 'District, State' or 'State, District' and tries both orders.
    """
    q = _norm(q)
    if "," in q:
        a, b = [x.strip() for x in q.split(",", 1)]
        return a or None, b or None
    parts = q.split()
    if len(parts) >= 2:
        # unsure: return as district-only; caller will try fuzzy
        return " ".join(parts), None
    return None, None


def run(args: Dict[str, Any]) -> Dict[str, Any]:
    # validate input
    state = args.get("state")
    district = args.get("district")
    query = args.get("query")

    if (not state or not district) and query:
        # try to parse a freeform "District, State"
        a, b = _parse_query(query)
        # try both interpretations
        if a and b:
            # (district=a, state=b) first
            district = district or a
            state = state or b

    record = None
    confidence = 0.0

    if state and district:
        record = _find_exact(state, district)
        confidence = 0.95 if record else 0.0

    if not record and district:
        got = _best_by_district_only(district)
        if got:
            record, confidence = got

    if not record:
        raise ValueError("Could not geocode location. Provide 'state' and 'district', or 'query'='District, State'.")

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
