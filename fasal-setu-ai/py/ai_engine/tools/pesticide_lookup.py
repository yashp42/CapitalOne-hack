"""
Pesticide lookup tool (file-based, filterable, ranked).

Reads JSON files in:
  py/ai_engine/data/static_json/pesticides/

Each file contains an array of entries with schema like:
{
  "crop_name": "...",
  "target": "...",  # pest/disease name(s)
  "active_ingredient": "...",
  "formulation": "EC/WP/etc.",
  "dose_ai_g_ha": ...,
  "dose_formulation_qty_per_ha": "...",
  "spray_volume_l_ha": "...",
  "application_method": "...",
  "phi_days": "5",
  "ppe_notes": "...",
  "who_class": "...",
  "label_source_url": "...",
  "as_on_date": "YYYY-MM-DD",
  "last_checked": "YYYY-MM-DD",
  "status": "Registered/Pending/Withdrawn",
  "notes": "...",
  "sources": ["..."]
}

Args (all optional, but at least one filter is recommended):
{
  "crop": "Rice (Paddy)",
  "target": "Brown plant hopper",   // alias: "pest"
  "active_ingredient": "Azadirachtin",
  "formulation": "EC",
  "who_class": "II",
  "status": "Registered",
  "category": "insecticides|fungicides|herbicides|pgr|bio_insecticides|other_pesticides",  // limit files scanned
  "registered_only": true,
  "bio_only": false,        // if true, restrict to file names starting with 'bio_' or 'pgr' (non-chemical)
  "chemical_only": false,   // if true, exclude 'bio_' and 'pgr' files
  "limit": 10               // default 10
}

Return envelope:
{
  "data": {
    "items": [ { ...matching entry..., "source_file":"<file>.json" }, ... ],
    "count": <int>
  },
  "source_stamp": { "type":"static_pack", "path":"py/ai_engine/data/static_json/pesticides" },
  "matched": { "filters": { ...original filters normalized... } },
  "_meta": { "route":"local_scan", "scanned_files":[...], "sort":"status->as_on_date(desc)->phi_days(asc)" }
}
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

DATA_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "data", "static_json", "pesticides"
))

# ---------------------------- utils ----------------------------

def _canon(s: Optional[str]) -> str:
    return (s or "").strip().lower()

def _is_bio_file(fname: str) -> bool:
    # heuristic: bio_* or pgr.json considered non-chemical
    name = fname.lower()
    return name.startswith("bio_") or name == "pgr.json"

def _load_json_file(path: str) -> List[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # allow { "records": [...]} or {"items":[...]}
            return data.get("records") or data.get("items") or []
        return []
    except Exception:
        return []

def _scan_files(category: Optional[str], bio_only: bool, chemical_only: bool) -> Tuple[List[str], List[Dict[str, Any]]]:
    """Return (files_scanned, entries)."""
    if not os.path.isdir(DATA_DIR):
        return [], []

    # build candidate file list
    all_files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
    # basic exclusions
    exclude = {"sources.json", ".keep"}
    all_files = [f for f in all_files if f not in exclude]

    if category:
        # keep files where the stem contains the category (simple containment)
        needle = category.lower()
        cand = [f for f in all_files if needle in f.lower()]
    else:
        cand = list(all_files)

    if bio_only:
        cand = [f for f in cand if _is_bio_file(f)]
    if chemical_only:
        cand = [f for f in cand if not _is_bio_file(f)]

    files_scanned = []
    entries: List[Dict[str, Any]] = []
    for fname in cand:
        path = os.path.join(DATA_DIR, fname)
        recs = _load_json_file(path)
        if not recs:
            continue
        for r in recs:
            if isinstance(r, dict):
                r = dict(r)
                r["source_file"] = fname  # keep provenance
                entries.append(r)
        files_scanned.append(fname)
    return files_scanned, entries

def _contains(hay: Optional[str], needle: Optional[str]) -> bool:
    if not needle:
        return True
    return _canon(needle) in _canon(hay)

def _equals(a: Optional[str], b: Optional[str]) -> bool:
    if b is None:
        return True
    return _canon(a) == _canon(b)

def _to_int_safe(x: Any) -> Optional[int]:
    try:
        if x is None or x == "":
            return None
        return int(str(x).strip())
    except Exception:
        return None

def _to_date_safe(x: Any) -> Optional[datetime]:
    if not x:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(x), fmt)
        except Exception:
            continue
    return None

def _status_rank(s: Optional[str]) -> int:
    s = _canon(s)
    if s == "registered":
        return 0
    if s in {"approved", "label claim"}:
        return 1
    if s in {"pending", "proposed"}:
        return 2
    if s in {"withdrawn", "banned"}:
        return 3
    return 4

# ---------------------------- core filter + rank ----------------------------

def _filter_entries(entries: List[Dict[str, Any]], flt: Dict[str, Any]) -> List[Dict[str, Any]]:
    crop = flt.get("crop")
    pest = flt.get("target") or flt.get("pest")
    ai = flt.get("active_ingredient")
    form = flt.get("formulation")
    who = flt.get("who_class")
    status = flt.get("status")
    reg_only = bool(flt.get("registered_only"))

    out: List[Dict[str, Any]] = []
    for e in entries:
        if crop and not _equals(e.get("crop_name"), crop):
            continue
        if pest and not _contains(e.get("target"), pest):
            continue
        if ai and not _contains(e.get("active_ingredient"), ai):
            continue
        if form and not _equals(e.get("formulation"), form):
            continue
        if who and not _equals(e.get("who_class"), who):
            continue
        if status and not _equals(e.get("status"), status):
            continue
        if reg_only and _canon(e.get("status")) != "registered":
            continue
        out.append(e)
    return out

def _rank_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def key(e: Dict[str, Any]):
        # 1) status (Registered first)
        s_rank = _status_rank(e.get("status"))
        # 2) newer as_on_date first
        dt = _to_date_safe(e.get("as_on_date")) or _to_date_safe(e.get("last_checked"))
        dt_key = -(dt.timestamp()) if dt else float("inf")
        # 3) shorter PHI first (safer/earlier-to-harvest)
        phi = _to_int_safe(e.get("phi_days"))
        phi_key = phi if phi is not None else 9999
        return (s_rank, dt_key, phi_key)
    return sorted(entries, key=key)

# ---------------------------- public API ----------------------------

def pesticide_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Search local pesticide JSONs with filters and return ranked results.
    """
    args = dict(args or {})
    limit = int(args.get("limit", 10))
    category = args.get("category")  # restrict scanning to a family of files
    bio_only = bool(args.get("bio_only", False))
    chemical_only = bool(args.get("chemical_only", False))

    files_scanned, all_entries = _scan_files(category, bio_only, chemical_only)

    # filter
    filtered = _filter_entries(all_entries, args)
    ranked = _rank_entries(filtered)
    items = ranked[: max(1, limit)] if ranked else []

    resp = {
        "data": {
            "items": items,
            "count": len(items),
        },
        "source_stamp": {
            "type": "static_pack",
            "path": os.path.relpath(DATA_DIR, start=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
        },
        "matched": {
            "filters": {
                "crop": args.get("crop"),
                "target": args.get("target") or args.get("pest"),
                "active_ingredient": args.get("active_ingredient"),
                "formulation": args.get("formulation"),
                "who_class": args.get("who_class"),
                "status": args.get("status"),
                "registered_only": bool(args.get("registered_only", False)),
                "category": category,
                "bio_only": bio_only,
                "chemical_only": chemical_only,
            }
        },
        "_meta": {
            "route": "local_scan",
            "scanned_files": files_scanned,
            "sort": "status->as_on_date(desc)->phi_days(asc)"
        }
    }

    if not items:
        resp["error"] = "no_matches"
    return resp
