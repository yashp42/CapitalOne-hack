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
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

try:
    import pandas as pd  # type: ignore
except Exception:
    pd = None

POLICY_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "../../..", "data", "static_json", "policy"
))

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

def _read_any(path: str) -> Optional["pd.DataFrame"]:
    if pd is None:
        return None
    try:
        if path.lower().endswith(".csv"):
            df = pd.read_csv(path)
        elif path.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(path)
        else:
            return None
        df.columns = _norm_cols(list(df.columns))
        return df
    except Exception:
        return None

def _load_all() -> Tuple[List[str], Optional["pd.DataFrame"]]:
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

    big = pd.concat(frames, ignore_index=True)
    # unify common aliases -> normalized keys your schema expects
    aliases = {
        "scheme_name": "scheme",
        "policy_name": "scheme",
        "scheme_title": "scheme",
        "implementing_agency": "agency",
        "agency_name": "agency",
        "benefit_type": "category",
        "category_type": "category",
        "url": "link",
        "website": "link",
        "interest": "interest_rate",
        "int_rate": "interest_rate",
        "max_loan_amount": "max_amount",
        "loan_limit": "max_amount",
    }
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

def _contains(hay: Any, needle: str) -> bool:
    if not needle:
        return True
    return _lc(needle) in _lc(hay)

def _equals(a: Any, b: str) -> bool:
    if not b:
        return True
    return _lc(a) == _lc(b)

def _row_score(row: Dict[str, Any], f: Dict[str, Any]) -> Tuple[int, List[str]]:
    score, reasons = 0, []

    # hard locality/category
    if _equals(row.get("state"), f.get("state")) and f.get("state"):
        score += 5; reasons.append("state")
    if _equals(row.get("district"), f.get("district")) and f.get("district"):
        score += 4; reasons.append("district")
    if _equals(row.get("category"), f.get("category")) and f.get("category"):
        score += 3; reasons.append("category")

    # agency/crop soft
    if f.get("agency") and _contains(row.get("agency"), f["agency"]):
        score += 2; reasons.append("agency")
    if f.get("crop"):
        text_c = " ".join([_lc(row.get("scheme")), _lc(row.get("crops")), _lc(row.get("description")), _lc(row.get("notes"))])
        if f["crop"].lower() in text_c:
            score += 2; reasons.append("crop")

    # issue/keywords across meaningful text
    hay = " ".join([
        _lc(row.get("scheme")), _lc(row.get("description")), _lc(row.get("eligibility")),
        _lc(row.get("benefit")), _lc(row.get("category")), _lc(row.get("notes"))
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
            "path": os.path.relpath(POLICY_DIR, start=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))),
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
