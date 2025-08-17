# py/ai_engine/tools/storage_find.py
"""
Storage locator tool (WDRA static CSVs, no API key).

Reads one or more WDRA "Registered Warehouses" CSV files from:
    data/static_json/storage/wdra/

Args (all optional unless noted):
{
  "state": "Bihar",        # recommended
  "district": "Patna",     # optional; if present and found, district rows win
  "limit": 3               # default 3 (min(3, available))
}

Behavior:
- If district provided and matching rows exist → return up to `limit` rows from that district.
- Else if state provided and matching rows exist → return up to `limit` rows from that state.
- Else → error ("no_matches" or "missing_state_or_district").

Return envelope (unchanged):
{
  "data": {
    "query": {...},
    "facilities": [
      {
        "wh_name": "...",
        "wh_id": "...",
        "whm_name": "...",
        "address": "...",
        "district": "...",
        "state": "...",
        "capacity_mt": <float|null>,
        "registration_date": "...",
        "valid_upto": "...",
        "contact_no": "...",
        "status": "...",
        "remarks": "...",
        "source_file": "Registered Warehouses - WDRA.csv"
      }
    ],
    "count": <int>
  },
  "source_stamp": {
    "type": "wdra_csv",
    "dir": "py/ai_engine/data/static_json/storage/wdra",
    "files": ["*.csv"],
    "source_url": "https://wdra.gov.in/web/wdra/registered-warehouses",
    "executed_at": "<iso8601>"
  },
  "error": "..."          # only when missing args or no matches
}
"""

from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

try:
    import pandas as pd
except Exception:
    pd = None

# Allow override via env; default to repo data path
WDRA_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "data", "static_json", "storage", "wdra"
))

_WS = re.compile(r"\s+")

def _canon(s: Any) -> str:
    if s is None:
        return ""
    return _WS.sub(" ", str(s).strip())

def _lc(s: Any) -> str:
    return _canon(s).lower()

def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

# Column normalization
_ALIASES = {
    # canonical -> observed variants
    "whm_name": {"whm name", "warehouseman name", "warehouse man name", "warehouseman"},
    "wh_name": {"wh name", "warehouse name", "name of warehouse", "warehouse"},
    "wh_id": {"wh id", "warehouse id", "wh code", "code", "wh code"},
    "address": {"address", "name and address", "address line"},
    "district": {"district"},
    "state": {"state"},
    "capacity_mt": {"capacity(in mt)", "capacity", "capacity in mt", "capacity_mt"},
    "registration_date": {"registration date", "date of registration", "reg date", "registration"},
    "valid_upto": {"registration valid upto", "valid upto", "valid up to", "validity"},
    "contact_no": {"contact no.", "contact no", "mobile", "phone", "contact"},
    "status": {"status"},
    "remarks": {"remarks", "note", "notes"},
}

def _norm_cols(cols: List[str]) -> List[str]:
    out = []
    for c in cols:
        c = _lc(c)
        c = c.replace("-", " ").replace("/", " ").replace(".", " ")
        c = _WS.sub("_", c).strip("_")
        out.append(c)
    return out

def _apply_aliases(df: Any) -> Any:
    # Build reverse map: variant -> canonical
    reverse = {}
    for canon, variants in _ALIASES.items():
        for v in variants:
            reverse[_norm_cols([v])[0]] = canon
    ren = {}
    for c in list(df.columns):
        cc = reverse.get(c, c)
        ren[c] = cc
    return df.rename(columns=ren)

def _read_any_csv(path: str) -> Optional[Any]:
    if pd is None:
        return None
    try:
        df = pd.read_csv(path)
        df.columns = _norm_cols(list(df.columns))
        df = _apply_aliases(df)
        df["_source_file"] = os.path.basename(path)
        return df
    except Exception:
        return None

def _load_all() -> Tuple[List[str], Optional[Any]]:
    files, frames = [], []
    # If pandas not available, just report filenames (no DataFrame returned)
    if pd is None:
        if not os.path.isdir(WDRA_DIR):
            return files, None
        for fn in os.listdir(WDRA_DIR):
            if fn.lower().endswith(".csv"):
                files.append(fn)
        return files, None

    if not os.path.isdir(WDRA_DIR):
        return files, (pd.DataFrame() if pd is not None else None)

    for fn in os.listdir(WDRA_DIR):
        if not fn.lower().endswith(".csv"):
            continue
        path = os.path.join(WDRA_DIR, fn)
        df = _read_any_csv(path)
        if df is None or df.empty:
            continue
        files.append(fn)
        frames.append(df)
    if not frames:
        return files, (pd.DataFrame() if pd is not None else None)
    big = pd.concat(frames, ignore_index=True)
    return files, big

def _to_float(x: Any) -> Optional[float]:
    try:
        s = str(x).replace(",", "").strip()
        if not s:
            return None
        v = float(s)
        # Guard against NaN
        if v != v:
            return None
        return v
    except Exception:
        return None

def _status_rank(s: Any) -> int:
    t = _lc(s)
    if "active" in t or "registered" in t or "valid" in t:
        return 0
    if "expired" in t or "invalid" in t:
        return 2
    return 1  # unknown/middle

def _select_columns(df: Any) -> Any:
    # Ensure all canonical columns exist
    for col in ["whm_name","wh_name","wh_id","address","district","state",
                "capacity_mt","registration_date","valid_upto","contact_no","status","remarks"]:
        if col not in df.columns:
            df[col] = None
    # Normalize capacity to float for sorting
    df["capacity_mt_norm"] = df["capacity_mt"].apply(_to_float)
    df["status_rank"] = df["status"].apply(_status_rank)
    return df

def _filter(df: Any, state: Optional[str], district: Optional[str]) -> Tuple[List[Dict[str, Any]], str]:
    # Route returns which filter matched: "district"|"state"|"none"
    if district:
        dmask = df["district"].astype(str).str.casefold() == district.casefold()
        df_d = df[dmask]
        if not df_d.empty:
            return df_d.to_dict(orient="records"), "district"
    if state:
        smask = df["state"].astype(str).str.casefold() == state.casefold()
        df_s = df[smask]
        if not df_s.empty:
            return df_s.to_dict(orient="records"), "state"
    return [], "none"

def storage_find(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Locate WDRA registered warehouses from static CSVs.
    """
    state = args.get("state")
    district = args.get("district")
    try:
        limit = int(args.get("limit", 3))
    except Exception:
        limit = 3
    if limit <= 0:
        limit = 3
    limit = min(limit, 50)

    if pd is None:
        return {"data": {"query": {"state": state, "district": district, "limit": limit},
                         "facilities": [], "count": 0},
                "source_stamp": {"type": "wdra_csv", "dir": WDRA_DIR, "files": [],
                                 "source_url": "https://wdra.gov.in/web/wdra/registered-warehouses",
                                 "executed_at": _now_iso()},
                "error": "pandas_not_available"}

    files, df = _load_all()
    stamp = {"type": "wdra_csv", "dir": WDRA_DIR, "files": files,
             "source_url": "https://wdra.gov.in/web/wdra/registered-warehouses",
             "executed_at": _now_iso()}

    if df is None or df.empty:
        return {"data": {"query": {"state": state, "district": district, "limit": limit},
                         "facilities": [], "count": 0},
                "source_stamp": stamp, "error": "no_csv_files"}

    df = _select_columns(df)

    # Filter preference: district → state
    rows, route = _filter(df, state, district)

    if not rows:
        if not (state or district):
            return {"data": {"query": {"state": state, "district": district, "limit": limit},
                             "facilities": [], "count": 0},
                    "source_stamp": stamp, "error": "missing_state_or_district"}
        return {"data": {"query": {"state": state, "district": district, "limit": limit, "route": route},
                         "facilities": [], "count": 0},
                "source_stamp": stamp, "error": "no_matches"}

    # Rank: status then capacity desc, then name
    def _row_sort_key(r: Dict[str, Any]) -> Tuple[int, float, str]:
        status_rank = r.get("status_rank", 1)
        # Normalize capacity for sorting using helper
        cap = _to_float(r.get("capacity_mt_norm"))
        if cap is None:
            cap = _to_float(r.get("capacity_mt")) or 0.0
        # Negative for descending
        return (status_rank, -cap, (r.get("wh_name") or ""))

    rows.sort(key=_row_sort_key)

    # Keep only canonical fields and trim to limit
    out: List[Dict[str, Any]] = []
    for r in rows[: limit]:
        item = {
            "wh_name": r.get("wh_name"),
            "wh_id": r.get("wh_id"),
            "whm_name": r.get("whm_name"),
            "address": r.get("address"),
            "district": r.get("district"),
            "state": r.get("state"),
            # Ensure capacity is a plain float (or omitted)
            "capacity_mt": (_to_float(r.get("capacity_mt_norm"))
                             if _to_float(r.get("capacity_mt_norm")) is not None
                             else _to_float(r.get("capacity_mt"))),
            "registration_date": r.get("registration_date"),
            "valid_upto": r.get("valid_upto"),
            "contact_no": r.get("contact_no"),
            "status": r.get("status"),
            "remarks": r.get("remarks"),
            "source_file": r.get("_source_file"),
        }
        # strip empties
        item = {k: v for k, v in item.items() if v not in (None, "", [])}
        out.append(item)

    data = {
        "query": {"state": state, "district": district, "limit": limit, "route": route},
        "facilities": out,
        "count": len(out)
    }
    return {"data": data, "source_stamp": stamp}
