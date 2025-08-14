"""Query Pinecone for top-k similar passages using shared embeddings."""

import os
from typing import Dict, Any

from dotenv import load_dotenv
from pinecone import Pinecone

from embed_utils import embed_query

load_dotenv()

INDEX_NAME = "rag-index"
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_ENV = os.environ.get("PINECONE_ENV", "us-east-1-aws")
# You can find your Pinecone environment string in the Pinecone Console
# (https://console.pinecone.io/) under your project settings or API keys. It
# looks like "gcp-starter", "us-east1-gcp", "us-east-1-aws", etc.


def rag_search(args: Dict[str, Any]) -> Dict[str, Any]:
    """Return passages similar to ``args['query']`` from the Pinecone index."""

    query = args.get("query")
    top_k = args.get("top_k", 5)
    if not query:
        return {"data": [], "source_stamp": "no_query"}
    if not PINECONE_API_KEY:
        raise RuntimeError("PINECONE_API_KEY not set in environment.")

    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)
    query_vec = embed_query(query)
    res = index.query(vector=query_vec, top_k=top_k, include_metadata=True)

    # Pinecone v7 returns .matches (list), or dict with "matches"
    matches = getattr(res, "matches", None)
    if matches is None and isinstance(res, dict):
        matches = res.get("matches", [])

    passages = []
    for match in matches or []:
        meta = match.get("metadata", {})
        passages.append({
            "text": meta.get("text", ""),
            "source_stamp": meta.get("source", "")
        })

    return {"data": passages, "source_stamp": "pinecone_rag"}

