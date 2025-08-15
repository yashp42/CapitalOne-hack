"""Shared embedding utilities for RAG tools.

This module centralizes embedding configuration so that scripts such as
``build_index.py`` and ``rag_search.py`` use the exact same embedding logic.
Currently we rely on local HuggingFace embeddings via
``sentence-transformers/all-MiniLM-L6-v2``.
"""

from typing import List

try:  # pragma: no cover - dependency is required for runtime, not tests
    from langchain_community.embeddings import HuggingFaceEmbeddings
except Exception:  # pragma: no cover - fall back to stubbed embeddings
    HuggingFaceEmbeddings = None  # type: ignore


EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
if HuggingFaceEmbeddings:
    try:
        EMBEDDER = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    except Exception:  # pragma: no cover - missing HF deps
        HuggingFaceEmbeddings = None
        class _StubEmbedder:
            def embed_query(self, text: str) -> List[float]:
                return [0.0]
        EMBEDDER = _StubEmbedder()
else:  # pragma: no cover - simple stub for tests
    class _StubEmbedder:
        def embed_query(self, text: str) -> List[float]:
            return [0.0]
    EMBEDDER = _StubEmbedder()


def embed_query(text: str) -> List[float]:
    """Return the embedding vector for *text*."""
    return EMBEDDER.embed_query(text)


# Expose the embedding dimension so index builders can stay in sync.
EMBEDDING_DIM = len(embed_query("dimension probe"))
