"""
rag_search.py: Query Pinecone for top-k similar passages given a query, using local or Pinecone embedder.
"""
import os
from dotenv import load_dotenv
load_dotenv()
from typing import Dict, Any

# Use Pinecone's built-in embedder if available (v7+), else fallback to HuggingFaceEmbeddings
try:
    from pinecone import Pinecone, EmbeddingModel
    EMBEDDER = EmbeddingModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
    def embed_query(text):
        return EMBEDDER.embed_documents([text])[0]
except ImportError:
    try:
        from langchain_community.embeddings import HuggingFaceEmbeddings
        EMBEDDER = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        def embed_query(text):
            return EMBEDDER.embed_query(text)
    except ImportError:
        raise ImportError("Please install pinecone[grpc] or langchain-community: pip install pinecone[grpc] langchain-community")

INDEX_NAME = "rag-index"
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_ENV = os.environ.get("PINECONE_ENV", "us-east-1-aws")
# You can find your Pinecone environment string in the Pinecone Console (https://console.pinecone.io/) under your project settings or API keys. It looks like "gcp-starter", "us-east1-gcp", "us-east-1-aws", etc.

def rag_search(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Args should include:
        query: str
        top_k: int (default 5)
    Returns:
        {data: [{text, source_stamp}], source_stamp}
    """
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