"""Simple web search tool using DuckDuckGo."""

from typing import Any, Dict
from langchain_community.tools import DuckDuckGoSearchRun

_search = DuckDuckGoSearchRun()


def web_search(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args.get("query", "")
    return {"data": _search.run(query), "source_stamp": "duckduckgo"}
