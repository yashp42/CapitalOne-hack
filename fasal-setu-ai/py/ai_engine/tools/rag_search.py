"""Query Pinecone for top-k similar passages using shared embeddings.

Optional ``state``, ``district`` and ``crop`` parameters narrow results using
metadata tags stored with each chunk.
"""

import os
from typing import Any, Dict

from dotenv import load_dotenv

from .embed_utils import embed_query

try:  # pragma: no cover - dependency is required at runtime
    from pinecone import Pinecone
except ImportError as exc:  # pragma: no cover - provide a clear message
    raise ImportError(
        "Please install pinecone: pip install pinecone"
    ) from exc

load_dotenv()

INDEX_NAME = "rag-index"
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_ENV = os.environ.get("PINECONE_ENV", "us-east-1-aws")


def rag_search(args: Dict[str, Any]) -> Dict[str, Any]:
    """Return passages similar to ``args['query']`` from the Pinecone index."""

    query = args.get("query")
    top_k = args.get("top_k", 5)
    state = args.get("state")
    district = args.get("district")
    crop = args.get("crop")

    if not query:
        return {"data": [], "source_stamp": "no_query"}
    if not PINECONE_API_KEY:
        raise RuntimeError("PINECONE_API_KEY not set in environment.")

    pc = Pinecone(api_key=PINECONE_API_KEY, environment=PINECONE_ENV)

    index = pc.Index(INDEX_NAME)
    query_vec = embed_query(query)

    filter_dict: Dict[str, str] = {}
    if state:
        filter_dict["state"] = str(state).lower()
    if district:
        filter_dict["district"] = str(district).lower()
    if crop:
        filter_dict["crop"] = str(crop).lower()

    query_kwargs: Dict[str, Any] = {
        "vector": query_vec,
        "top_k": top_k,
        "include_metadata": True,
    }
    if filter_dict:
        query_kwargs["filter"] = filter_dict

    res = index.query(**query_kwargs)

    matches = getattr(res, "matches", None)
    if matches is None and isinstance(res, dict):
        matches = res.get("matches", [])

    passages = []
    for match in matches or []:
        meta = match.get("metadata", {})

        passages.append({
            "text": meta.get("text", ""),
            "source_stamp": meta.get("source", ""),
        })

    return {"data": passages, "source_stamp": "pinecone_rag"}


