# py/ai_engine/tools/web_search.py
"""
Simple, effective web search tool with graceful fallbacks.

Primary provider: DuckDuckGo (duckduckgo_search).
Optional fallbacks (enabled by env keys): Brave, Serper (Google), Bing.

Args (all optional):
{
  "query": "text to search",
  "k": 2,                       # max results
  "recency_days": 0,            # 0 = any time; else e.g. 7, 30, 365
  "safesearch": "moderate",     # "off"|"moderate"|"strict"  (DDG)
  "region": "in-en",            # DDG region (e.g., "in-en", "us-en")
  "domains": ["icar.org.in",".gov.in"],  # prefer/filter sites
  "site": "example.com",        # shorthand for single site:
  "news_only": false,           # news endpoint where supported
  "backend": "auto"             # leave as-is; internal use
}

Return envelope (stable):
{
  "data": {
    "results": [
      {"title":"...", "url":"...", "snippet":"...", "source":"ddg|brave|serper|bing"}
    ],
    "answer_box": {...}  # when provider returns it (Serper)
  },
  "source_stamp": {
    "type":"search",
    "providers":["ddg","brave"],     # those that actually ran
    "executed_at":"<iso8601>",
    "args_used": { ...sanitized args... }
  },
  "error": "..."   # only when all providers fail
}
"""

from __future__ import annotations

import os
import re
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

# Optional deps (gracefully degrade if not installed)
try:
    from duckduckgo_search import DDGS  # pip install duckduckgo_search
except Exception:
    DDGS = None

try:
    import requests  # used for Brave/Serper/Bing
except Exception:
    requests = None


# -------------------------- utils --------------------------

_UTM_KEYS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "gclid", "fbclid", "igshid", "mc_cid", "mc_eid"
}
_WS = re.compile(r"\s+")

def _canon(s: Any) -> str:
    if s is None:
        return ""
    return _WS.sub(" ", str(s).strip())

def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _normalize_url(u: str) -> str:
    try:
        p = urlparse(u)
        q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k not in _UTM_KEYS]
        p2 = p._replace(query=urlencode(q, doseq=True), fragment="")
        return urlunparse(p2)
    except Exception:
        return u

def _augment_query_with_domains(q: str, domains: Optional[List[str]], site: Optional[str]) -> str:
    q = q or ""
    filters = []
    if site:
        filters.append(f"site:{site}")
    if domains:
        # Use OR over multiple sites (not all providers support it; harmless where unsupported)
        filters.append(" OR ".join([f"site:{d}" for d in domains if d]))
    if filters:
        q = f"{q} ({' OR '.join(filters)})"
    return q.strip()

def _timelimit_from_days(days: int) -> Optional[str]:
    # DDG timelimit tokens: 'd' (day), 'w' (week), 'm' (month), 'y' (year)
    if not days or days <= 0:
        return None
    if days <= 1:
        return "d"
    if days <= 7:
        return "w"
    if days <= 31:
        return "m"
    return "y"

def _freshness_from_days(days: int) -> Optional[str]:
    # Brave/Bing freshness strings: "pd" (past day), "pw" (past week), "pm" (past month), "py" (past year)
    if not days or days <= 0:
        return None
    if days <= 1:
        return "pd"
    if days <= 7:
        return "pw"
    if days <= 31:
        return "pm"
    return "py"

def _summary_from_results(results: List[Dict[str, Any]], max_chars: int = 420) -> Optional[str]:
    if not results:
        return None
    chunks = []
    for r in results[:3]:
        t = _canon(r.get("title"))
        s = _canon(r.get("snippet"))
        if t and s:
            chunks.append(f"{t}: {s}")
        elif t:
            chunks.append(t)
        elif s:
            chunks.append(s)
    txt = " | ".join(chunks)
    return txt[:max_chars] if txt else None


# -------------------------- providers --------------------------

def _search_ddg(query: str, k: int, recency_days: int, region: Optional[str], safesearch: str, news_only: bool) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    if DDGS is None:
        return [], None
    q = query
    timelimit = _timelimit_from_days(recency_days)
    results: List[Dict[str, Any]] = []
    answer_box = None

    try:
        with DDGS() as ddgs:
            if news_only:
                for it in ddgs.news(q, max_results=k, safesearch=safesearch or "moderate", timelimit=timelimit, region=region or "in-en"):
                    results.append({
                        "title": it.get("title"),
                        "url": _normalize_url(it.get("link") or it.get("url") or ""),
                        "snippet": it.get("body") or it.get("source") or "",
                        "source": "ddg"
                    })
            else:
                for it in ddgs.text(q, max_results=k, safesearch=safesearch or "moderate", timelimit=timelimit, region=region or "in-en"):
                    results.append({
                        "title": it.get("title"),
                        "url": _normalize_url(it.get("href") or it.get("link") or ""),
                        "snippet": it.get("body") or "",
                        "source": "ddg"
                    })
    except Exception:
        # Silent fail → let fallback try
        return [], None

    return results, answer_box


def _search_brave(query: str, k: int, recency_days: int, news_only: bool, session: Optional[Any]) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    key = os.getenv("BRAVE_API_KEY")
    if not key or requests is None:
        return [], None
    base = "https://api.search.brave.com/res/v1/news/search" if news_only else "https://api.search.brave.com/res/v1/web/search"
    params = {"q": query, "count": max(1, min(k, 20))}
    freshness = _freshness_from_days(recency_days)
    if freshness:
        params["freshness"] = freshness

    try:
        s = session or requests.Session()
        r = s.get(base, params=params, headers={"X-Subscription-Token": key}, timeout=6)
        if r.status_code != 200:
            return [], None
        data = r.json()
        out: List[Dict[str, Any]] = []
        if news_only:
            for it in (data.get("news", {}) or {}).get("results", [])[:k]:
                out.append({
                    "title": it.get("title"),
                    "url": _normalize_url((it.get("url") or "")),
                    "snippet": it.get("description") or it.get("age") or "",
                    "source": "brave"
                })
        else:
            for it in (data.get("web", {}) or {}).get("results", [])[:k]:
                out.append({
                    "title": it.get("title"),
                    "url": _normalize_url(it.get("url") or ""),
                    "snippet": it.get("description") or "",
                    "source": "brave"
                })
        return out, None
    except Exception:
        return [], None


def _search_serper(query: str, k: int, news_only: bool, session: Optional[Any]) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    key = os.getenv("SERPER_API_KEY")
    if not key or requests is None:
        return [], None
    url = "https://google.serper.dev/news" if news_only else "https://google.serper.dev/search"
    payload = {"q": query, "num": max(1, min(k, 20))}
    try:
        s = session or requests.Session()
        r = s.post(url, json=payload, headers={"X-API-KEY": key, "Content-Type": "application/json"}, timeout=6)
        if r.status_code != 200:
            return [], None
        j = r.json()
        out: List[Dict[str, Any]] = []
        if news_only:
            for it in (j.get("news") or [])[:k]:
                out.append({
                    "title": it.get("title"),
                    "url": _normalize_url(it.get("link") or ""),
                    "snippet": it.get("snippet") or it.get("source") or "",
                    "source": "serper"
                })
        else:
            for it in (j.get("organic") or [])[:k]:
                out.append({
                    "title": it.get("title"),
                    "url": _normalize_url(it.get("link") or ""),
                    "snippet": it.get("snippet") or "",
                    "source": "serper"
                })
        # capture answer box if available
        ab = j.get("answerBox") if not news_only else None
        return out, ab
    except Exception:
        return [], None


def _search_bing(query: str, k: int, recency_days: int, news_only: bool, session: Optional[Any]) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    key = os.getenv("BING_API_KEY")
    if not key or requests is None:
        return [], None
    if news_only:
        base = "https://api.bing.microsoft.com/v7.0/news/search"
        params = {"q": query, "count": max(1, min(k, 20))}
        freshness = _freshness_from_days(recency_days)
        if freshness:
            params["freshness"] = freshness
    else:
        base = "https://api.bing.microsoft.com/v7.0/search"
        params = {"q": query, "count": max(1, min(k, 20))}
        freshness = _freshness_from_days(recency_days)
        if freshness:
            params["freshness"] = freshness

    try:
        s = session or requests.Session()
        r = s.get(base, params=params, headers={"Ocp-Apim-Subscription-Key": key}, timeout=6)
        if r.status_code != 200:
            return [], None
        j = r.json()
        out: List[Dict[str, Any]] = []
        if news_only:
            for it in (j.get("value") or [])[:k]:
                out.append({
                    "title": it.get("name"),
                    "url": _normalize_url((it.get("url") or "")),
                    "snippet": it.get("description") or "",
                    "source": "bing"
                })
        else:
            for it in (j.get("webPages", {}) or {}).get("value", [])[:k]:
                out.append({
                    "title": it.get("name"),
                    "url": _normalize_url(it.get("url") or ""),
                    "snippet": it.get("snippet") or "",
                    "source": "bing"
                })
        return out, None
    except Exception:
        return [], None


# -------------------------- public API --------------------------

def web_search(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a web search with optional provider fallbacks and return structured results.
    """
    args = dict(args or {})
    query = _canon(args.get("query") or "")
    if not query:
        return {"data": {"results": []}, "source_stamp": {"type": "search", "providers": [], "executed_at": _now_iso(), "args_used": {}}, "error": "empty_query"}

    k = int(args.get("k", 5))
    k = max(1, min(k, 20))
    recency_days = int(args.get("recency_days", 0) or 0)
    region = args.get("region") or "in-en"
    safesearch = args.get("safesearch") or "moderate"
    news_only = bool(args.get("news_only", False))
    domains = args.get("domains") or []
    site = args.get("site")

    # augment query with site filters for providers that understand it (harmless otherwise)
    query_aug = _augment_query_with_domains(query, domains, site)

    providers_used: List[str] = []
    answer_box: Optional[Dict[str, Any]] = None
    all_results: List[Dict[str, Any]] = []

    # Run providers in order: Serper → Brave → DuckDuckGo → Bing
    # (Serper/Brave/Bing only fire if their API keys are present)
    # We stop early if we have >= k results.
    session = requests.Session() if requests is not None else None

    # 1) Serper (Google)
    rr, ab = _search_serper(query_aug, k, news_only, session)
    if rr:
        providers_used.append("serper")
        all_results.extend(rr)
        answer_box = answer_box or ab

    # 2) Brave (if key)
    if len(all_results) < k:
        rr, ab = _search_brave(query_aug, k - len(all_results), recency_days, news_only, session)
        if rr:
            providers_used.append("brave")
            all_results.extend(rr)
            answer_box = answer_box or ab

    # 3) DuckDuckGo (keyless)
    if len(all_results) < k:
        rr, ab = _search_ddg(query_aug, k - len(all_results), recency_days, region, safesearch, news_only)
        if rr:
            providers_used.append("ddg")
            all_results.extend(rr)
            answer_box = answer_box or ab

    # 4) Bing (if key)
    if len(all_results) < k:
        rr, ab = _search_bing(query_aug, k - len(all_results), recency_days, news_only, session)
        if rr:
            providers_used.append("bing")
            all_results.extend(rr)
            answer_box = answer_box or ab

    # Deduplicate by normalized URL while preserving order
    seen = set()
    unique_results: List[Dict[str, Any]] = []
    for r in all_results:
        u = r.get("url") or ""
        key = _normalize_url(u)
        if not key or key in seen:
            continue
        seen.add(key)
        r["url"] = key
        unique_results.append(r)

    # Trim to k
    unique_results = unique_results[:k]

    stamp = {
        "type": "search",
        "providers": providers_used,
        "executed_at": _now_iso(),
        "args_used": {
            "k": k,
            "recency_days": recency_days,
            "region": region,
            "safesearch": safesearch,
            "news_only": news_only,
            "domains": domains,
            "site": site
        }
    }

    if not unique_results:
        # No provider produced results
        return {"data": {"results": [], "answer_box": None}, "source_stamp": stamp, "error": "no_results"}

    # Optional short synthesis (cheap, deterministic)
    # summary = _summary_from_results(unique_results)

    return {
        "data": {
            "results": unique_results,
            # "summary": summary,
            "answer_box": answer_box
        },
        "source_stamp": stamp
    }
