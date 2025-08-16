"""Simple web search tool using DuckDuckGo (ddgs package)."""

from typing import Any, Dict
try:
    from ddgs import DDGS
except ImportError:
    DDGS = None

def web_search(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args.get("query", "")
    if DDGS is None:
        return {"data": None, "source_stamp": "ddgs_missing"}
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=1))
        text = results[0]["body"] if results else None
    return {"data": text, "source_stamp": "duckduckgo"}
