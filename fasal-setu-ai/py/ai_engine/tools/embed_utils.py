"""Shared embedding utilities for RAG tools.

This module centralizes embedding configuration so that scripts such as
``build_index.py`` and ``rag_search.py`` use the exact same embedding logic.
Currently we rely on local HuggingFace embeddings via
``sentence-transformers/all-MiniLM-L6-v2``.
"""

from typing import List

try:  # pragma: no cover - dependency is required for runtime, not tests
    from langchain_community.embeddings import HuggingFaceEmbeddings
except ImportError as exc:  # pragma: no cover - provide clear message
    raise ImportError(
        "Please install langchain-community: pip install langchain-community"
    ) from exc


EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDER = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def embed_query(text: str) -> List[float]:
    """Return the embedding vector for *text*."""

    return EMBEDDER.embed_query(text)


# Expose the embedding dimension so index builders can stay in sync.
EMBEDDING_DIM = len(embed_query("dimension probe"))

