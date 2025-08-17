# mandi_api.py
# Fasal-Setu mandi prices tool: API → static fallback (no scraping)
# Contract: prices_fetch(args_dict) -> {"data": [rows], "source_stamp": "..."}
# Rows follow the Fasal-Setu mandi schema.

from __future__ import annotations

import os
import json
import time
import pathlib
from datetime import date
from typing import Any, Dict, List, Optional, Iterable

import requests
from pydantic import BaseModel, Field, field_validator  # Pydantic v2
from dateutil import parser as dateparser

try:
    from langchain_core.tools import StructuredTool
except Exception:
    try:
        from langchain.tools import StructuredTool  # type: ignore
    except Exception:
        StructuredTool = None  # type: ignore

# ----------------------------
# Config
# ----------------------------
OGD_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"  # Current Daily Price...
OGD_BASE = "https://api.data.gov.in/resource/"
OGD_API_KEY = os.getenv("DATA_GOV_IN_API_KEY", "").strip()

API_LIMIT = 500
API_SLEEP = 0.25  # polite paging delay

# Static fallback directory (files already in target schema)
STATIC_DIR = pathlib.Path(__file__).resolve().parent.parent / "data" / "static_json" / "mandi"

# ----------------------------
# Helpers
# ----------------------------
# (place near helpers)
ALIASES = {
    "district": {
        "belgaum": "belagavi",
        "bangalore rural": "bengaluru rural",
        "bangalore": "bengaluru urban",
    },
    "commodity": {
        "tomatoes": "tomato",
    },
}

def _canon(val: Optional[str], kind: str) -> Optional[str]:
    if val is None:
        return None
    key = val.strip().lower()
    return ALIASES.get(kind, {}).get(key, val)

def _norm_str(x: Any) -> Optional[str]:
    if x is None:
        return None
    s = str(x).strip()
    return s if s else None

def _to_float(x: Any) -> Optional[float]:
    if x in (None, ""):
        return None
    try:
        return float(str(x).replace(",", "").strip())
    except Exception:
        return None

def _in_date_range(d: Optional[str], start: Optional[str], end: Optional[str]) -> bool:
    if not d:
        return False
    dd = dateparser.parse(d).date()
    if start and dd < dateparser.parse(start).date():
        return False
    if end and dd > dateparser.parse(end).date():
        return False
    return True

def _avg(values: Iterable[Optional[float]]) -> Optional[float]:
    nums = [v for v in values if isinstance(v, (int, float))]
    return (sum(nums) / len(nums)) if nums else None

def _is_effectively_null(row: Dict[str, Any]) -> bool:
    """True if all meaningful fields are None/empty (ignores source_url/last_checked)."""
    keys = [
        "state","district","market","arrival_date","commodity","variety",
        "min_price_rs_per_qtl","max_price_rs_per_qtl","modal_price_rs_per_qtl","arrival_qty"
    ]
    for k in keys:
        v = row.get(k)
        if v not in (None, "", "null"):
            return False
    return True

@field_validator("state", "district", "commodity", "market", "variety")
@classmethod
def _canon_fields(cls, v, info):
    if v is None:
        return v
    kind = info.field_name  # 'state' | 'district' | ...
    if kind in ("district", "commodity"):
        return _canon(v, kind)
    return v


# ----------------------------
# Input model
# ----------------------------
class MandiArgs(BaseModel):
    state: str = Field(..., description="State name, e.g., 'Karnataka'")
    district: Optional[str] = Field(None, description="District, e.g., 'Belagavi'")
    commodity: str = Field(..., description="Commodity, e.g., 'Tomato'")
    market: Optional[str] = Field(None, description="Market/APMC (optional)")
    variety: Optional[str] = Field(None, description="Variety (optional)")
    start_date: Optional[str] = Field(None, description="YYYY-MM-DD (inclusive)")
    end_date: Optional[str] = Field(None, description="YYYY-MM-DD (inclusive)")
    max_rows: int = Field(1000, description="Row cap")

    @field_validator("start_date", "end_date")
    @classmethod
    def _fmt_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return dateparser.parse(v).date().isoformat()

# ----------------------------
# Mapping (API raw -> schema)
# ----------------------------
def _map_api_row_to_schema(rec: Dict[str, Any], source_url: str) -> Dict[str, Any]:
    return {
        "state": _norm_str(rec.get("state") or rec.get("State")),
        "district": _norm_str(rec.get("district") or rec.get("District")),
        "market": _norm_str(rec.get("market") or rec.get("Market")),
        "arrival_date": _norm_str(rec.get("arrival_date") or rec.get("date") or rec.get("Date")),
        "commodity": _norm_str(rec.get("commodity") or rec.get("Commodity")),
        "variety": _norm_str(rec.get("variety") or rec.get("Variety")),
        "min_price_rs_per_qtl": _to_float(rec.get("min_price") or rec.get("Min Price")),
        "max_price_rs_per_qtl": _to_float(rec.get("max_price") or rec.get("Max Price")),
        "modal_price_rs_per_qtl": _to_float(rec.get("modal_price") or rec.get("Modal Price")),
        "arrival_qty": _to_float(rec.get("arrival") or rec.get("Arrivals") or rec.get("arrival_qty")),
        "source_url": source_url,
        "last_checked": date.today().isoformat(),
    }

# ----------------------------
# API fetch (data.gov.in)
# ----------------------------
def _api_get(base_url: str, params: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
    """
    Calls data.gov.in endpoint. Tries 'api-key' first, then 'api_key' if needed.
    """
    # ensure format and limit present
    params.setdefault("format", "json")
    params.setdefault("limit", API_LIMIT)

    # primary: 'api-key'
    p1 = dict(params)
    p1["api-key"] = OGD_API_KEY

    r = requests.get(base_url, params=p1, timeout=timeout)
    if r.status_code == 200:
        try:
            return r.json()
        except Exception:
            pass

    # fallback: 'api_key'
    p2 = dict(params)
    p2["api_key"] = OGD_API_KEY
    r2 = requests.get(base_url, params=p2, timeout=timeout)
    r2.raise_for_status()
    return r2.json()

def _ogd_api_fetch(args: MandiArgs) -> Dict[str, Any]:
    if not OGD_API_KEY:
        raise RuntimeError("DATA_GOV_IN_API_KEY not set")

    base_url = f"{OGD_BASE}{OGD_RESOURCE_ID}"

    params = {
        # api-key injected by _api_get
        "format": "json",
        "limit": API_LIMIT,
        "offset": 0,
        "filters[state]": args.state,
        "filters[commodity]": args.commodity,
    }
    if args.district:
        params["filters[district]"] = args.district
    if args.market:
        params["filters[market]"] = args.market
    if args.variety:
        params["filters[variety]"] = args.variety

    all_records: List[Dict[str, Any]] = []
    while True:
        payload = _api_get(base_url, params, timeout=30)
        batch = payload.get("records") or payload.get("data") or []
        if not batch:
            break

        for rec in batch:
            d = rec.get("arrival_date") or rec.get("date") or rec.get("Date")
            if (args.start_date or args.end_date) and not _in_date_range(d, args.start_date, args.end_date):
                continue
            all_records.append(rec)
            if len(all_records) >= args.max_rows:
                break

        if len(all_records) >= args.max_rows:
            break

        params["offset"] = params.get("offset", 0) + params["limit"]
        if len(batch) < params["limit"]:
            break
        time.sleep(API_SLEEP)

    mapped = [_map_api_row_to_schema(r, base_url) for r in all_records[: args.max_rows]]

    # if API gave rows but they’re all null → treat as empty to trigger next fallback
    if mapped and all(_is_effectively_null(m) for m in mapped):
        return {"data": [], "source_stamp": base_url}

    return {"data": mapped, "source_stamp": base_url}

def _ogd_api_state_rollup(args: MandiArgs) -> Optional[Dict[str, Any]]:
    """
    If district-filtered API returns nothing, try state+commodity only,
    then compute state-level average for the date window.
    """
    base_url = f"{OGD_BASE}{OGD_RESOURCE_ID}"
    params = {
        "format": "json",
        "limit": API_LIMIT,
        "offset": 0,
        "filters[state]": args.state,
        "filters[commodity]": args.commodity,
        # intentionally omit district/market
    }

    all_records: List[Dict[str, Any]] = []
    while True:
        payload = _api_get(base_url, params, timeout=30)
        batch = payload.get("records") or payload.get("data") or []
        if not batch:
            break

        for rec in batch:
            d = rec.get("arrival_date") or rec.get("date") or rec.get("Date")
            if (args.start_date or args.end_date) and not _in_date_range(d, args.start_date, args.end_date):
                continue
            all_records.append(rec)
            if len(all_records) >= args.max_rows:
                break

        if len(all_records) >= args.max_rows:
            break

        params["offset"] = params.get("offset", 0) + params["limit"]
        if len(batch) < params["limit"]:
            break
        time.sleep(API_SLEEP)

    if not all_records:
        return None

    mapped = [_map_api_row_to_schema(r, base_url) for r in all_records]
    # toss null-like entries
    mapped = [m for m in mapped if not _is_effectively_null(m)]
    if not mapped:
        return None

    # latest date in window
    latest_date = None
    for m in mapped:
        d = m.get("arrival_date")
        if not d:
            continue
        try:
            dd = dateparser.parse(d).date()
            if latest_date is None or dd > latest_date:
                latest_date = dd
        except Exception:
            continue

    state_avg = {
        "state": args.state,
        "district": None,
        "market": None,
        "arrival_date": latest_date.isoformat() if latest_date else None,
        "commodity": args.commodity,
        "variety": None,
        "min_price_rs_per_qtl": _avg([_to_float(m.get("min_price_rs_per_qtl")) for m in mapped]),
        "max_price_rs_per_qtl": _avg([_to_float(m.get("max_price_rs_per_qtl")) for m in mapped]),
        "modal_price_rs_per_qtl": _avg([_to_float(m.get("modal_price_rs_per_qtl")) for m in mapped]),
        "arrival_qty": _avg([_to_float(m.get("arrival_qty")) for m in mapped]),
        "source_url": f"state-average(api gov.in): {base_url}?state={args.state}&commodity={args.commodity}",
        "last_checked": date.today().isoformat(),
    }
    return {"data": [state_avg], "source_stamp": state_avg["source_url"]}

# ----------------------------
# Static fallback (already in target schema)
# ----------------------------
def _load_static() -> List[Dict[str, Any]]:
    if not STATIC_DIR.exists():
        return []
    rows: List[Dict[str, Any]] = []
    for fp in STATIC_DIR.glob("*.json"):
        try:
            with open(fp, "r", encoding="utf-8") as f:
                obj = json.load(f)
        except Exception:
            continue
        if isinstance(obj, list):
            rows.extend(obj)
        elif isinstance(obj, dict):
            data = obj.get("data") or obj.get("records") or []
            if isinstance(data, list):
                rows.extend(data)
    return rows

def _filter_static(rows: List[Dict[str, Any]], args: MandiArgs) -> List[Dict[str, Any]]:
    out = []
    for r in rows:
        if args.state and (r.get("state") or "").strip().lower() != args.state.strip().lower():
            continue
        if args.district:
            if (r.get("district") or "").strip().lower() != args.district.strip().lower():
                continue
        if args.commodity and (r.get("commodity") or "").strip().lower() != args.commodity.strip().lower():
            continue
        if args.market and r.get("market"):
            if (r.get("market") or "").strip().lower() != args.market.strip().lower():
                continue
        if (args.start_date or args.end_date) and not _in_date_range(r.get("arrival_date"), args.start_date, args.end_date):
            continue

        # ensure housekeeping fields
        r.setdefault("last_checked", date.today().isoformat())
        r.setdefault("source_url", str(STATIC_DIR.resolve()))
        out.append(r)
    return out

def _state_average(rows: List[Dict[str, Any]], state: str, commodity: str) -> Optional[Dict[str, Any]]:
    cand = [
        r for r in rows
        if (r.get("state") or "").strip().lower() == state.strip().lower()
        and (r.get("commodity") or "").strip().lower() == commodity.strip().lower()
    ]
    if not cand:
        return None

    latest_date = None
    for r in cand:
        d = r.get("arrival_date")
        if not d:
            continue
        try:
            dd = dateparser.parse(d).date()
            if latest_date is None or dd > latest_date:
                latest_date = dd
        except Exception:
            continue

    return {
        "state": state,
        "district": None,
        "market": None,
        "arrival_date": latest_date.isoformat() if latest_date else None,
        "commodity": commodity,
        "variety": None,
        "min_price_rs_per_qtl": _avg([_to_float(r.get("min_price_rs_per_qtl")) for r in cand]),
        "max_price_rs_per_qtl": _avg([_to_float(r.get("max_price_rs_per_qtl")) for r in cand]),
        "modal_price_rs_per_qtl": _avg([_to_float(r.get("modal_price_rs_per_qtl")) for r in cand]),
        "arrival_qty": _avg([_to_float(r.get("arrival_qty")) for r in cand]),
        "source_url": f"state-average(static gov.in): {STATIC_DIR.resolve()}?state={state}&commodity={commodity}",
        "last_checked": date.today().isoformat(),
    }

def _static_fallback(args: MandiArgs) -> Dict[str, Any]:
    rows = _load_static()
    if not rows:
        return {"data": [], "source_stamp": str(STATIC_DIR.resolve())}

    dist_rows = _filter_static(rows, args)
    if dist_rows:
        return {"data": dist_rows[: args.max_rows], "source_stamp": str(STATIC_DIR.resolve())}

    state_avg = _state_average(rows, args.state, args.commodity)
    if state_avg:
        return {"data": [state_avg], "source_stamp": state_avg["source_url"]}

    # last resort: any state rows regardless of commodity
    state_only = [
        r for r in rows
        if (r.get("state") or "").strip().lower() == args.state.strip().lower()
    ]
    for r in state_only:
        r.setdefault("last_checked", date.today().isoformat())
        r.setdefault("source_url", str(STATIC_DIR.resolve()))
    return {"data": state_only[: args.max_rows], "source_stamp": str(STATIC_DIR.resolve())}

# ----------------------------
# Public entry
# ----------------------------
def prices_fetch(args: Dict[str, Any]) -> Dict[str, Any]:
    a = MandiArgs(**args)
    """
    Inputs: {state, district?, commodity, market?, variety?, start_date?, end_date?, max_rows?}
    Returns: {"data": [...], "source_stamp": "..."} in mandi schema.
    Order: API → Static
    Also: if API yields rows but all fields are null → treat as empty and fallback to static.
    """
    # 1) API with all filters
    try:
        api_res = _ogd_api_fetch(a)
        if api_res["data"]:
            return api_res
    except Exception:
        pass

    # 2) API state-only rollup (live average) before static
    try:
        roll = _ogd_api_state_rollup(a)
        if roll and roll["data"]:
            return roll
    except Exception:
        pass

    # 3) Static fallback
    return _static_fallback(a)


# ----------------------------
# LangChain tool (optional)
# ----------------------------
def make_langchain_tool():
    if StructuredTool is None:
        return None
    return StructuredTool.from_function(
        func=prices_fetch,
        name="mandi_prices_lookup",
        description=(
            "Fetch mandi prices via data.gov.in API, fallback to static JSON. "
            "Inputs: state, district, commodity, [market], [variety], [start_date], [end_date], [max_rows]. "
            "Returns {data: [...], source_stamp: '...'} in Fasal-Setu schema."
        ),
    )

# ----------------------------
# Demo
# ----------------------------
if __name__ == "__main__":
    demo_args = {
        "state": "Uttar Pradesh",
        #"district": "Belagavi",
        "commodity": "Onion",
        # "start_date": "2025-08-01",
        # "end_date": "2025-08-16",
        "max_rows": 50,
    }
    out = prices_fetch(demo_args)
    print("Source:", out.get("source_stamp"))
    print("Rows:", len(out.get("data", [])))
    for i, r in enumerate(out.get("data", [])[:5], 1):
        print(
            f"{i}. {r.get('arrival_date')} | {r.get('state')} > {r.get('district')} > {r.get('market')} | "
            f"{r.get('commodity')} ({r.get('variety')}) "
            f"modal={r.get('modal_price_rs_per_qtl')} min={r.get('min_price_rs_per_qtl')} max={r.get('max_price_rs_per_qtl')} "
            f"arrival={r.get('arrival_qty')}"
        )
