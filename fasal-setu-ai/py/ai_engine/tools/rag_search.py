"""Retrieval augmented generation search tool.

Queries a vector index for documents relevant to the user's question.
The current implementation targets a Pinecone index.

Endpoint notes:
    Expects Pinecone credentials and index name to be configured.

TODO:
    * Support other vector databases.
    * Surface retrieved documents in the response.
"""

import os
from typing import Any, Dict, List

try:  # pragma: no cover - allow running without pinecone package
    from pinecone import Pinecone
except Exception:  # pragma: no cover
    class Pinecone:  # type: ignore
        def __init__(self, *args, **kwargs):
            pass
        def Index(self, *args, **kwargs):  # pragma: no cover - stub
            raise NotImplementedError("Pinecone client not installed")

from . import embed_utils

PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
PINECONE_ENV = os.environ.get("PINECONE_ENV", "")
INDEX_NAME = os.environ.get("PINECONE_INDEX", "rag-index")


def embed_query(text: str) -> List[float]:  # pragma: no cover - thin wrapper
    return embed_utils.embed_query(text)


def rag_search(args: Dict[str, Any]) -> Dict[str, Any]:
    """Search the vector index with a filter built from *args*."""

    pc = Pinecone(api_key=PINECONE_API_KEY, environment=PINECONE_ENV)
    index = pc.Index(INDEX_NAME)
    vector = embed_query(args.get("query", ""))
    filt = {}
    for key in ("state", "district", "crop"):
        if args.get(key):
            filt[key] = str(args[key]).lower()
    index.query(vector=vector, top_k=3, filter=filt)
    return {"data": [], "source_stamp": "pinecone_rag"}
