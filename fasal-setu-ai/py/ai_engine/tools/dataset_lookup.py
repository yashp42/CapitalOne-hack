"""
Calendar lookup tool (exact match + smart fallback).

Reads crop calendar JSON files under:
  data/static_json/crop_calendar/<state>_<district>.json

Exact resolution only (no aliases/fuzzy). File stem uses lowercase + underscores.

Args:
{
  "kind": "crop_calendar",                # required (currently only this kind supported)
  "state": "Karnataka",                   # optional (needed for region mode)
  "district": "Bengaluru Rural",          # optional (needed for region mode)
  "crop": "paddy",                        # optional
  "fields": ["region_info","crop_info"],  # optional; default both
  "query": "level of water required in rice",  # optional free-text; triggers fallback when region/crop insufficient
  "fallback": { "allow_rag": true, "allow_web": false, "k": 6 },  # optional; defaults as shown
  "strict_region": false                  # if true, do not fallback when region is missing
}

Return envelope (always):
{
  "data": { "region_info": {...} | null, "crop_info": {...} | null } | null,
  "source_stamp": { "type":"static_pack", "path":"...", "doc_date":"...", "last_checked":"..." },
  "matched": { "state":"...", "district":"...", "crop":"...", "match_method":"exact|none", "confidence": 0.0 },
  "available": { "crops": ["..."] },
  "_meta": { "fields": [...], "route": "calendar|calendar+rag|rag_local|web" },
  "fallback": { "route":"rag_local|web", "reason":"region_not_found|general_crop_query|crop_not_found", "query":"...", "passages":[...]}  # present when fallback used
  # "error": "..."  # present if strict_region=true or everything failed
}
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

# path to .../data/static_json/crop_calendar
DATA_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "../../..", "data", "static_json", "crop_calendar"
))

_WS = re.compile(r"\s+")
_NONALNUM = re.compile(r"[^a-z0-9_]+")

def _canon(s: str) -> str:
    """lowercase, collapse whitespace to single space, then turn spaces/hyphens into underscores."""
    x = _WS.sub(" ", s.strip().lower())
    x = x.replace("-", " ")
    x = _WS.sub("_", x).strip("_")
    x = _NONALNUM.sub("_", x)
    return x

def _file_path(state: Optional[str], district: Optional[str]) -> Optional[str]:
    if not state or not district:
        return None
    stem = f"{_canon(state)}_{_canon(district)}"
    path = os.path.join(DATA_DIR, f"{stem}.json")
    return path if os.path.exists(path) else None

def _read_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _extract_region_info(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "state": doc.get("state"),
        "district": doc.get("district"),
        "agro_climatic_zone": doc.get("agro_climatic_zone"),
        "dominant_soils": doc.get("dominant_soils") or [],
        "normal_annual_rain_mm": doc.get("normal_annual_rain_mm"),
        "rainfall_pattern_notes": doc.get("rainfall_pattern_notes"),
    }

def _available_crops(doc: Dict[str, Any]) -> List[str]:
    crops = []
    for c in doc.get("crops", []) or []:
        name = c.get("crop_name")
        if name:
            crops.append(str(name))
    # unique + stable order
    seen, out = set(), []
    for n in crops:
        k = n.lower()
        if k not in seen:
            seen.add(k)
            out.append(n)
    return out

def _find_crop_info(doc: Dict[str, Any], crop: Optional[str]) -> Optional[Dict[str, Any]]:
    if not crop:
        return None
    target = crop.strip().lower()
    for c in doc.get("crops", []) or []:
        if (c.get("crop_name") or "").strip().lower() == target:
            return c
    return None

def _rag_fallback(query: str, k: int = 6) -> Dict[str, Any]:
    try:
        # use sibling tool so all RAG settings live in one place
        from .rag_search import rag_search
    except Exception:
        def rag_search(_args):
            return {"data": {"passages": []}, "source_stamp": {"type": "stub", "provider": "rag"}}
    payload = rag_search({"query": query, "k": k})
    passages = (payload or {}).get("data", {}).get("passages", []) or []
    return {
        "route": "rag_local",
        "reason": "general_crop_query",
        "query": query,
        "passages": passages[:k],
    }

def _web_fallback(query: str, k: int = 6) -> Dict[str, Any]:
    try:
        from .web_search import web_search
    except Exception:
        def web_search(_args):
            return {"data": {"results": []}, "source_stamp": {"type": "stub", "provider": "web"}}
    payload = web_search({"query": query, "k": k})
    results = (payload or {}).get("data", {}).get("results", []) or []
    passages = [
        {"text": r.get("snippet") or r.get("title") or "",
         "source_stamp": {"type": "web", "url": r.get("url")}}
        for r in results[:k]
    ]
    return {"route": "web", "reason": "general_crop_query", "query": query, "passages": passages}

def calendar_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
    # 0) validate kind
    if (args or {}).get("kind", "crop_calendar") != "crop_calendar":
        return {"data": None, "error": "unsupported_kind",
                "source_stamp": {"type": "static_pack", "path": DATA_DIR}}

    state = args.get("state")
    district = args.get("district")
    crop = args.get("crop")
    fields = args.get("fields") or ["region_info", "crop_info"]
    # allow only the two supported blocks
    fields = [f for f in fields if f in ("region_info", "crop_info")] or ["region_info", "crop_info"]

    query = (args.get("query") or "").strip()
    strict_region = bool(args.get("strict_region", False))
    fb = args.get("fallback") or {}
    allow_rag = bool(fb.get("allow_rag", True))
    allow_web = bool(fb.get("allow_web", False))
    k = int(fb.get("k", 6))

    matched = {
        "state": state,
        "district": district,
        "crop": crop or None,
        "match_method": "none",
        "confidence": 0.0,
    }
    available = {"crops": []}
    source_stamp = {"type": "static_pack", "path": DATA_DIR}
    data_out: Optional[Dict[str, Any]] = None
    route = "calendar"
    fallback_block: Optional[Dict[str, Any]] = None

    # 1) exact region file (lowercase+underscored) if state+district present
    path = _file_path(state, district) if (state and district) else None
    if path:
        doc = _read_json(path)
        matched.update({"match_method": "exact", "confidence": 1.0})
        available["crops"] = _available_crops(doc)
        # relative path three levels up: py/ai_engine/tools/ -> project root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
        source_stamp = {
            "type": "static_pack",
            "path": os.path.relpath(path, start=project_root),
            "doc_date": doc.get("doc_date"),
            "last_checked": doc.get("last_checked"),
        }

        region_info = _extract_region_info(doc) if "region_info" in fields else None
        crop_info = _find_crop_info(doc, crop) if "crop_info" in fields else None
        data_out = {"region_info": region_info, "crop_info": crop_info}

        # If user asked a topic OR crop not found, optionally add RAG passages
        if ((query and allow_rag) or (("crop_info" in fields) and crop and crop_info is None and allow_rag)):
            fbq = query or f"{crop} crop calendar irrigation critical stages India"
            fallback_block = _rag_fallback(fbq, k)
            route = "calendar+rag"

    else:
        # 2) region missing/not found
        if strict_region:
            return {
                "data": None,
                "error": "not_found: region",
                "source_stamp": source_stamp,
                "matched": matched,
                "available": available,
                "_meta": {"fields": fields, "route": "calendar"},
            }

        # general crop/topic or region not provided → fallback
        fbq = query or (f"{crop} crop calendar irrigation critical stages India" if crop else
                        "crop calendar irrigation critical stages India")
        if allow_rag:
            fallback_block = _rag_fallback(fbq, k)
            route = "rag_local"
        elif allow_web:
            fallback_block = _web_fallback(fbq, k)
            route = "web"
        else:
            return {
                "data": None,
                "error": "not_found: region",
                "source_stamp": source_stamp,
                "matched": matched,
                "available": available,
                "_meta": {"fields": fields, "route": "calendar"},
            }

    # 3) compose response
    resp = {
        "data": data_out,
        "source_stamp": source_stamp,
        "matched": matched,
        "available": available,
        "_meta": {"fields": fields, "route": route},
    }
    if fallback_block:
        # refine reason when crop missing in a found region
        if data_out and ("crop_info" in fields) and crop and (data_out.get("crop_info") is None):
            fallback_block = {**fallback_block, "reason": "crop_not_found"}
        elif matched.get("match_method") == "none":
            fallback_block = {**fallback_block, "reason": "region_not_found"}
        resp["fallback"] = fallback_block

    return resp
