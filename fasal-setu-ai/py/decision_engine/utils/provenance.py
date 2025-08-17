# utils/provenance.py
"""
Provenance utilities for the Decision Engine.

This module uses the extraction helpers in utils/helpers.py and the strict models
defined in models.py (via helpers). It intentionally avoids making hard assumptions
about tool schemas - instead it calls the helper `extract_provenance_from_facts`
to discover provenance strings from validated tool outputs, and then provides
deterministic, configurable ordering and deduplication utilities.

Functions:
 - dedupe_preserve_order(seq): remove duplicates while preserving first-seen order.
 - prioritize_provenance(prov_list, priority_patterns=None): score & sort provenance values
    according to user-provided patterns (defaults provided for convenience but can be overridden).
 - merge_provenance(handler_prov, facts, priority_patterns=None): merge handler-reported
    provenance with provenance discovered in facts and return a deduplicated, prioritized list.

"""

from typing import List, Dict, Iterable, Optional, Tuple
import logging
import re
try:
    from .helpers import extract_provenance_from_facts, SOURCE_TYPE_WEIGHTS
except Exception:
    from utils.helpers import extract_provenance_from_facts, SOURCE_TYPE_WEIGHTS


logger = logging.getLogger("decision_engine.utils.provenance")
logger.addHandler(logging.NullHandler())


def dedupe_preserve_order(seq: Iterable[str]) -> List[str]:
    """
    Deduplicate strings in `seq` while preserving first-seen order.
    Returns a list of unique strings in their original order.
    """
    seen = set()
    out = []
    for item in seq or []:
        if item is None:
            continue
        s = str(item)
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out

def prioritize_provenance(prov_entries: Iterable[Dict[str, Optional[str]]]) -> List[Dict[str, Optional[str]]]:
    """
    prov_entries: iterable of dicts with keys 'source_id', 'source_type', 'tool'.
    Return entries sorted by (weight desc, original order) where weight is from SOURCE_TYPE_WEIGHTS.
    """
    if not prov_entries:
        return []
    # ensure each entry is a dict with expected keys
    normalized = []
    for p in (prov_entries or []):
        if isinstance(p, dict):
            normalized.append(p)
        else:
            normalized.append({"source_id": str(p), "source_type": None, "tool": "unknown"})
    enumerated = [(idx, p) for idx, p in enumerate(normalized)]
    # compute weight for each
    scored = []
    for idx, p in enumerated:
        stype = (p.get("source_type") or "unknown") if isinstance(p, dict) else "unknown"
        w = SOURCE_TYPE_WEIGHTS.get(stype, SOURCE_TYPE_WEIGHTS.get("unknown", 0.5))
        scored.append((idx, p, w))

    # sort by (-weight, original idx)
    scored_sorted = sorted(scored, key=lambda t: (-t[2], t[0]))

    # return only the dicts deduped by (source_id, source_type)
    out = []
    seen = set()
    for _, entry, _ in scored_sorted:
        sid = entry.get("source_id") if isinstance(entry, dict) else None
        st = entry.get("source_type") if isinstance(entry, dict) else None
        key = f"{sid}||{st}"
        if key not in seen:
            seen.add(key)
            out.append(entry)
    return out

def merge_provenance(handler_prov: Optional[Iterable] = None,
                     facts: Optional[Dict[str, Dict[str, object]]] = None
                     ) -> List[Dict[str, Optional[str]]]:
    """
    Merge handler_prov (possibly list of source_id strings or dicts) with provenance extracted from facts.
    Returns: list of source_id strings ordered by priority (highest-weight first), ties broken by original order.
    If a provenance entry has no source_id, fallback to "tool:<toolname>" or the source_type string.

    Example return:
      ["SAU_maize_advisory", "seed_catalog_2023", "open-meteo-ensemble"]
    """
    combined_entries = []

    # normalize handler_prov into dict entries if possible
    if handler_prov:
        for hp in handler_prov:
            if isinstance(hp, dict):
                combined_entries.append({
                    "source_id": hp.get("source_id"),
                    "source_type": hp.get("source_type"),
                    "tool": hp.get("tool", "handler")
                })
            else:
                # assume string source_id; treat type unknown until matched in facts
                combined_entries.append({
                    "source_id": str(hp),
                    "source_type": None,
                    "tool": "handler"
                })

    # extract from facts (ordered)
    # extract from facts (ordered) — call helper defensively
    try:
        extracted = extract_provenance_from_facts(facts or {}) or []
    except Exception:
        # log and continue with whatever handler_prov contained
        logger.exception("extract_provenance_from_facts failed; continuing with handler_prov only")
        extracted = []

    for e in extracted:
        # normalize appended entries (expect dict-like with keys 'source_id','source_type','tool')
        if isinstance(e, dict):
            combined_entries.append(e)
        else:
            # if helper returned a plain string id, wrap it
            combined_entries.append({"source_id": str(e), "source_type": None, "tool": "extracted"})


    if not combined_entries:
        return []

    # If some entries lack source_type but have source_id, try to lookup source_type from extracted facts
    # Build a quick map from source_id -> source_type (from extracted)
    lookup = {}
    for e in extracted:
        sid = e.get("source_id")
        st = e.get("source_type")
        if sid and st:
            lookup.setdefault(sid, st)

    for entry in combined_entries:
        if not entry.get("source_type"):
            sid = entry.get("source_id")
            if sid and sid in lookup:
                entry["source_type"] = lookup[sid]
            else:
                entry["source_type"] = "unknown"

    # prioritize entries (returns list of dicts)
    prioritized = prioritize_provenance(combined_entries)

    # return ordered list of best available provenance entries as dicts
    ordered = []
    for p in prioritized:
        sid = p.get("source_id")
        s_type = p.get("source_type")
        tool = p.get("tool", "unknown")
        if sid:
            ordered.append({"source_id": sid, "source_type": s_type, "tool": tool})
        else:
            # fallback: include whatever type/tool info we have
            ordered.append({"source_id": None, "source_type": s_type or "unknown", "tool": tool})

    # dedupe preserving order by (source_id, source_type, tool)
    seen = set()
    final = []
    for entry in ordered:
        key = f"{entry.get('source_id') or ''}||{entry.get('source_type') or ''}||{entry.get('tool') or ''}"
        if key not in seen:
            seen.add(key)
            final.append(entry)

    return final


