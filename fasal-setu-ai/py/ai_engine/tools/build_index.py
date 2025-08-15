"""Utilities for building a retrieval index.

This module offers helper functions for reading agricultural documents
and uploading them to a vector index. It currently uses local JSON files
and a generic vector index interface.

Endpoint notes:
    Intended for offline preprocessing rather than runtime API calls.

TODO:
    * Connect to a real vector database client.
    * Handle large datasets and batching.
"""

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

from . import embed_utils


def load_and_chunk_json(file_path: Path) -> List[Dict[str, Any]]:
    """Load a JSON file and return chunked records with lowercase tags."""

    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)
    chunks = []
    for idx, entry in enumerate(data):
        tags = {k: str(entry.get(k, "")).lower() for k in ["state", "district", "crop"]}
        chunks.append({"id": str(idx), "text": entry.get("info", ""), "tags": tags})
    return chunks


def embed_query(text: str) -> List[float]:  # pragma: no cover - thin wrapper
    """Expose embedding utility for monkeypatching in tests."""

    return embed_utils.embed_query(text)


def embed_and_upsert(chunks: Iterable[Dict[str, Any]], index: Any) -> None:
    """Embed chunks and upsert them into *index*.

    The index is expected to expose an ``upsert`` method compatible with
    Pinecone's interface.
    """

    vectors = []
    for chunk in chunks:
        vectors.append(
            {
                "id": chunk["id"],
                "values": embed_query(chunk["text"]),
                "metadata": chunk["tags"],
            }
        )
    index.upsert(vectors)
