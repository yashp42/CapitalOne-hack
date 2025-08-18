"""
Policy match tool (file-based, schema-compliant, high recall).

Scans CSV/XLSX files under:
  data/static_json/policy/

Outputs per schemas/policy.schema.json: PolicyMatchResponse.

Filters (PolicyMatchArgs):
- state, district, category
- issue (farmer problem), keywords or query (free text)
- agency, crop
- flags: smallholder, women, sc_st, fpo, tenant, kcc
- numeric hints: min_amount, max_interest
- limit

Ranking: relevance score (state/district/category/issue/keywords/agency/crop/flags)
         then recency (last_checked/as_on_date).
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

try:
    import pandas as pd  # type: ignore
except Exception:
    pd = None

try:
    from .paths import POLICY_DIR as POLICY_PATH  # type: ignore
except Exception:
    try:
        from tools.paths import POLICY_DIR as POLICY_PATH  # type: ignore
    except Exception:
        POLICY_PATH = Path(__file__).resolve().parent / ".." / "data" / "static_json" / "policy"
        POLICY_PATH = POLICY_PATH.resolve()

POLICY_DIR = str(POLICY_PATH)

_WS = re.compile(r"\s+")

def _canon(s: Any) -> str:
    if s is None:
        return ""
    s = str(s).strip()
    s = _WS.sub(" ", s)
    return s

def _lc(s: Any) -> str:
    return _canon(s).lower()

def _norm_cols(cols: List[str]) -> List[str]:
    out = []
    for c in cols:
        c = _lc(c)
        c = c.replace("-", " ").replace("/", " ").replace(".", " ")
        c = _WS.sub("_", c).strip("_")
        out.append(c)
    return out

def _read_any(path: str) -> Optional[Any]:
    if pd is None:
        return None
    try:
        # Try CSV first for .csv files but be resilient to mis-labelled binaries (e.g., xlsx renamed .csv)
        if path.lower().endswith(".csv"):
            try:
                df = pd.read_csv(path, encoding='utf-8', on_bad_lines='skip')
            except Exception:
                # Fallback: maybe it's actually an Excel file with .csv extension
                try:
                    df = pd.read_excel(path)
                except Exception:
                    return None
        elif path.lower().endswith((".xlsx", ".xls")):
            try:
                df = pd.read_excel(path)
            except Exception:
                # Fallback: try CSV read if excel parser fails
                try:
                    df = pd.read_csv(path, encoding='utf-8', on_bad_lines='skip')
                except Exception:
                    return None
        else:
            return None

        if df is None:
            return None

        df.columns = _norm_cols(list(df.columns))
        return df
    except Exception:
        return None

def _load_all() -> Tuple[List[str], Optional[Any]]:
    files, frames = [], []
    if not os.path.isdir(POLICY_DIR):
        return files, (pd.DataFrame() if pd is not None else None)

    for fn in os.listdir(POLICY_DIR):
        if not fn.lower().endswith((".csv", ".xlsx", ".xls")):
            continue
        path = os.path.join(POLICY_DIR, fn)
        df = _read_any(path)
        if df is None or df.empty:
            continue
        df["_source_file"] = fn
        frames.append(df)
        files.append(fn)

    if not frames:
        return files, (pd.DataFrame() if pd is not None else None)

    if pd is not None:
        big = pd.concat(frames, ignore_index=True)
    else:
        big = None
    # unify common aliases -> normalized keys your schema expects
    aliases = {
        # Basic scheme info
    "scheme_name": "scheme",
    "slug": "scheme",
    "details": "description",
    "benefits": "benefit",
    "application": "link",
    "documents": "eligibility",
    "level": "category",
    "schemecategory": "category",
    "schemeCategory": "category",
    "tags": "tags",
    "State": "state",
        "policy_name": "scheme",
        "scheme_title": "scheme",
        
        # Agency/department
        "implementing_agency": "agency",
        "agency_name": "agency",
        "department": "agency",
        
        # Categories and types
        "benefit_type": "category",
        "category_type": "category", 
        "schemecategory": "category",
        
        # Description and details
        "details": "description",
        "benefits": "benefit",
        "documentsrequired": "eligibility",
        
        # URLs 
        "url": "link",
        "website": "link",
        "schemeurl": "link",
        
        # Financial fields
        "interest": "interest_rate",
        "int_rate": "interest_rate",
        "max_loan_amount": "max_amount",
        "loan_limit": "max_amount",
        
        # Dates
        "updated_on": "last_checked"
    }
    if big is not None:
        for old, new in aliases.items():
            if old in big.columns and new not in big.columns:
                big.rename(columns={old: new}, inplace=True)

    return files, big

def _to_date(s: Any) -> Optional[datetime]:
    if pd is not None and isinstance(s, pd.Timestamp):
        try:
            return s.to_pydatetime()
        except Exception:
            pass
    txt = _canon(s)
    if not txt:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(txt, fmt)
        except Exception:
            continue
    return None

def _float_or_none(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(str(x).replace("%", "").replace(",", "").strip())
    except Exception:
        return None

def _split_keywords(s: str) -> List[str]:
    s = _canon(s)
    if not s:
        return []
    return [p.strip() for p in re.split(r"[;,|]+", s) if p.strip()]

def _fuzzy_contains(text: str, pattern: str, threshold: float = 0.7) -> Tuple[bool, float]:
    """Check if pattern is contained within text using fuzzy matching"""
    text, pattern = _lc(text), _lc(pattern)
    if not pattern or not text:
        return False, 0.0
        
    # Direct containment
    if pattern in text:
        return True, 1.0
        
    # Check each word for fuzzy matches
    text_words = text.split()
    pattern_words = pattern.split()
    
    if not text_words or not pattern_words:
        return False, 0.0
        
    matches = []
    for p_word in pattern_words:
        best_score = 0.0
        for t_word in text_words:
            is_match, score = _fuzzy_match(t_word, p_word, threshold=0.7)
            if score > best_score:
                best_score = score
        matches.append(best_score)
    
    # Average match score across all pattern words
    avg_score = sum(matches) / len(matches)
    return avg_score >= threshold, avg_score

def _contains(hay: Optional[Any], needle: Optional[str]) -> bool:
    """Check if needle is contained in haystack with fuzzy matching"""
    if not needle or hay is None:
        return True
    try:
        is_match, _ = _fuzzy_contains(str(hay), needle)
        return is_match
    except Exception:
        return False

def _get_soundex(s: str) -> str:
    """Get soundex code with modifications for Indian names/words"""
    if not s:
        return ""
        
    # Basic soundex mapping with extra Indian phonetics
    codes = {
        'b': '1', 'f': '1', 'p': '1', 'v': '1', 
        'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
        'd': '3', 't': '3',
        'l': '4',
        'm': '5', 'n': '5',
        'r': '6',
        # Special handling for Indian phonetics
        'sh': '2', 'ch': '2', 'th': '3', 'dh': '3', 'ph': '1'
    }
    
    s = _lc(s)
    if not s:
        return ""
        
    # Keep first letter
    first = s[0]
    # Convert rest to codes
    rest = s[1:].replace('h', '').replace('w', '').replace('y', '')
    coded = ''
    i = 0
    while i < len(rest):
        if i < len(rest)-1 and rest[i:i+2] in codes:
            coded += codes[rest[i:i+2]]
            i += 2
        elif rest[i] in codes:
            coded += codes[rest[i]]
            i += 1
        else:
            i += 1
            
    # Remove duplicates
    deduped = first
    for c in coded:
        if c != deduped[-1]:
            deduped += c
            
    # Pad with zeros
    return (deduped + "0000")[:4]

def _fuzzy_match(a: str, b: str, threshold: float = 0.8) -> Tuple[bool, float]:
    """Return (is_match, score) using multiple matching methods"""
    from difflib import SequenceMatcher
    
    a, b = _lc(a), _lc(b)
    if not a or not b:
        return False, 0.0
        
    # Exact match
    if a == b:
        return True, 1.0
        
    # Sequence matcher score
    ratio = SequenceMatcher(None, a, b).ratio()
    
    # Soundex match
    soundex_match = _get_soundex(a) == _get_soundex(b)
    
    # Contained match
    contained = a in b or b in a
    
    # Combined score (weighted)
    score = max(
        ratio * 0.6,  # Base similarity
        float(soundex_match) * 0.4,  # Soundex match
        float(contained) * 0.3  # Containment
    )
    
    return score >= threshold, score

def _equals(a: Any, b: str) -> bool:
    if not b:
        return True
    if a is None:
        return False
    # Try fuzzy match with high threshold
    is_match, _ = _fuzzy_match(str(a), b, threshold=0.9)
    return is_match

def _row_score(row: Dict[str, Any], f: Dict[str, Any]) -> Tuple[int, List[str]]:
    score, reasons = 0, []

    # Location matching with fuzzy scoring
    if f.get("state"):
        is_match, match_score = _fuzzy_match(str(row.get("state", "")), str(f["state"]))
        if is_match:
            pts = int(5 * match_score)  # Scale points by match quality
            score += pts
            reasons.append(f"state:{pts}")

    if f.get("district"):
        is_match, match_score = _fuzzy_match(str(row.get("district", "")), str(f["district"]))
        if is_match:
            pts = int(4 * match_score)
            score += pts
            reasons.append(f"district:{pts}")

    # Category with contains (for comma-separated categories)
    if f.get("category"):
        is_match, match_score = _fuzzy_contains(str(row.get("category", "")), str(f["category"]))
        if is_match:
            pts = int(3 * match_score)
            score += pts
            reasons.append(f"category:{pts}")

    # Agency and crop matching with fuzzy containment
    if f.get("agency"):
        is_match, match_score = _fuzzy_contains(str(row.get("agency", "")), str(f["agency"]))
        if is_match:
            pts = int(2 * match_score)
            score += pts
            reasons.append(f"agency:{pts}")

    if f.get("crop"):
        text_c = " ".join([
            str(row.get("scheme", "")), 
            str(row.get("crops", "")), 
            str(row.get("description", "")), 
            str(row.get("notes", "")),
            str(row.get("tags", ""))  # Include tags for crop matching
        ])
        is_match, match_score = _fuzzy_contains(text_c, str(f["crop"]))
        if is_match:
            pts = int(2 * match_score)
            score += pts
            reasons.append(f"crop:{pts}")

    # issue/keywords across meaningful text
    hay = " ".join([
        _lc(row.get("scheme", "")), 
        _lc(row.get("description", "")), 
        _lc(row.get("eligibility", "")),
        _lc(row.get("benefit", "")), 
        _lc(row.get("category", "")), 
        _lc(row.get("notes", "")),
        _lc(row.get("tags", ""))  # Include tags in search
    ])

    issue = f.get("issue") or ""
    if issue:
        # issue is strong signal
        if issue.lower() in hay:
            score += 3; reasons.append("issue")

    kws = _split_keywords(f.get("keywords") or f.get("query") or "")
    if kws:
        hits = sum(1 for kw in kws if kw.lower() in hay)
        if hits:
            score += 2 * hits; reasons.append(f"keywords:{hits}")

    # flags nudged via eligibility text
    flags = [k for k in ("smallholder","women","sc_st","fpo","tenant","kcc") if f.get(k)]
    if flags:
        elig = _lc(row.get("eligibility")) + " " + _lc(row.get("notes"))
        fhits = sum(1 for fl in flags if fl.replace("_"," ") in elig)
        if fhits:
            score += fhits; reasons.append(f"flags:{fhits}")

    # numeric constraints
    mi = f.get("min_amount")
    if mi is not None:
        got = None
        for fld in ("amount","max_amount","subsidy_amount"):
            got = got or _float_or_none(row.get(fld))
        if got is not None and got >= float(mi):
            score += 1; reasons.append("amount>=min")

    mx = f.get("max_interest")
    if mx is not None:
        ir = _float_or_none(row.get("interest_rate"))
        if ir is not None and ir <= float(mx):
            score += 1; reasons.append("interest<=max")

    return score, reasons

def _select_record(row: Dict[str, Any], idx: int) -> Dict[str, Any]:
    # map to schema keys + keep provenance
    keep = {
        "scheme": row.get("scheme"),
        "category": row.get("category"),
        "agency": row.get("agency"),
        "state": row.get("state"),
        "district": row.get("district"),
        "description": row.get("description"),
        "eligibility": row.get("eligibility"),
        "benefit": row.get("benefit"),
        "amount": row.get("amount"),
        "max_amount": row.get("max_amount"),
        "interest_rate": row.get("interest_rate"),
        "crops": row.get("crops"),
        "link": row.get("link"),
        "status": row.get("status"),
        "as_on_date": row.get("as_on_date"),
        "last_checked": row.get("last_checked"),
        "sources": row.get("sources"),
        "source_file": row.get("_source_file"),
        "record_id": row.get("id") or row.get("record_id") or idx,
    }
    # strip empty
    return {k: v for k, v in keep.items() if v not in (None, "", [])}

def policy_match(args: Dict[str, Any]) -> Dict[str, Any]:
    if pd is None:
        return {"data": {"items": [], "count": 0},
                "error": "pandas_not_available",
                "source_stamp": {"type": "static_pack", "path": POLICY_DIR}}

    files, df = _load_all()
    if df is None or df.empty:
        return {"data": {"items": [], "count": 0},
                "error": "no_policy_files",
                "source_stamp": {"type": "static_pack", "path": POLICY_DIR, "files": files}}

    f = dict(args or {})
    limit = int(f.get("limit", 10))

    # normalize key filters (lowercased text for matching)
    for k in ("state","district","category","agency","crop","issue","keywords","query"):
        if k in f and f[k] is not None:
            f[k] = _canon(f[k])

    # compute score per row
    records = df.to_dict(orient="records")
    scored: List[Tuple[int, List[str], Dict[str, Any], int]] = []
    for i, r in enumerate(records):
        s, reasons = _row_score(r, f)
        # if any filters present, drop zero-score rows to keep precision
        if any(f.get(k) for k in ("state","district","category","agency","issue","keywords","query","crop",
                                  "smallholder","women","sc_st","fpo","tenant","kcc","min_amount","max_interest")):
            if s <= 0:
                continue
        scored.append((s, reasons, r, i))

    # sort: score desc, then recency (last_checked/as_on_date) desc
    def dt_key(rec: Dict[str, Any]) -> float:
        dt = _to_date(rec.get("last_checked")) or _to_date(rec.get("as_on_date"))
        return dt.timestamp() if dt else 0.0

    scored.sort(key=lambda t: (t[0], dt_key(t[2])), reverse=True)

    items: List[Dict[str, Any]] = []
    for s, reasons, row, idx in scored[: max(1, limit)]:
        entry = _select_record(row, idx)
        entry["match_score"] = s
        entry["match_reasons"] = reasons
        items.append(entry)

    resp = {
        "data": {"items": items, "count": len(items)},
        "source_stamp": {
            "type": "static_pack",
            "path": "data/static_json/policy",
            "files": files
        },
        "matched": {"filters": {
            "state": f.get("state"),
            "district": f.get("district"),
            "category": f.get("category"),
            "issue": f.get("issue"),
            "keywords": f.get("keywords") or f.get("query"),
            "agency": f.get("agency"),
            "crop": f.get("crop"),
            "smallholder": bool(f.get("smallholder", False)),
            "women": bool(f.get("women", False)),
            "sc_st": bool(f.get("sc_st", False)),
            "fpo": bool(f.get("fpo", False)),
            "tenant": bool(f.get("tenant", False)),
            "kcc": bool(f.get("kcc", False)),
            "min_amount": f.get("min_amount"),
            "max_interest": f.get("max_interest"),
            "limit": limit
        }},
        "_meta": {"route": "local_scan", "sort": "score(desc)->date(desc)"}
    }
    if not items:
        resp["error"] = "no_matches"
    return resp
