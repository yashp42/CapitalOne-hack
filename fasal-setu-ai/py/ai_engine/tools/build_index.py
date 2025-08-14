"""Utility for building a Pinecone index from local JSON data."""

import os
import json
from pathlib import Path
from typing import List, Dict, Any, Tuple

from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter

from .embed_utils import embed_query, EMBEDDING_DIM

try:  # pragma: no cover - dependency is required at runtime
    from pinecone import Pinecone, ServerlessSpec
except ImportError as exc:  # pragma: no cover - provide a clear message
    raise ImportError(
        "Pinecone v7+ SDK is required. Please install with: pip install 'pinecone'"
    ) from exc

load_dotenv()

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "static_json"
INDEX_NAME = "rag-index"

PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_ENV = os.environ.get("PINECONE_ENV", "us-east-1-aws")


def _cloud_region_from_env(env: str) -> Tuple[str, str]:
    """Return (cloud, region) parsed from a Pinecone environment string."""

    if "-" in env:
        region, cloud = env.rsplit("-", 1)
    else:
        region, cloud = env, "aws"
    return cloud, region


def get_all_json_files(data_dir: Path) -> List[Path]:
    files = []
    for root, _, filenames in os.walk(data_dir):
        for fname in filenames:
            if fname.endswith(".json"):
                files.append(Path(root) / fname)
    return files


def _tags_from_path(file_path: Path) -> Dict[str, str]:
    """Derive tags like state and district from the file name."""

    tags: Dict[str, str] = {}
    parts = file_path.stem.split("_")
    if parts:
        tags["state"] = parts[0].lower()
        if len(parts) > 1:
            tags["district"] = "_".join(parts[1:]).lower()
    return tags


def _tags_from_obj(obj: Any) -> Dict[str, str]:
    """Extract known tags from a JSON object."""

    tags: Dict[str, str] = {}
    if isinstance(obj, dict):
        if obj.get("state"):
            tags["state"] = str(obj["state"]).lower()
        if obj.get("district"):
            tags["district"] = str(obj["district"]).lower()
        crop_val = obj.get("crop") or obj.get("crop_name")
        if crop_val:
            tags["crop"] = str(crop_val).lower()
    return tags


def load_and_chunk_json(file_path: Path, chunk_size=1024, chunk_overlap=100) -> List[Dict[str, Any]]:
    """Load JSON and chunk by top-level array/object or recursively by text."""

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    base_tags = _tags_from_path(file_path)

    if isinstance(data, list):
        chunks = []
        for item in data:
            tags = {**base_tags, **_tags_from_obj(item)}
            chunks.append({"text": json.dumps(item, ensure_ascii=False), "source": str(file_path), "tags": tags})
        return chunks
    elif isinstance(data, dict):
        chunks = []
        for k, v in data.items():
            tags = {**base_tags, **_tags_from_obj(v if isinstance(v, dict) else {k: v})}
            if isinstance(v, str) and len(v) > chunk_size:
                splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
                for chunk in splitter.split_text(v):
                    chunks.append({"text": chunk, "source": f"{file_path}:{k}", "tags": tags})
            else:
                chunk_text = json.dumps({k: v}, ensure_ascii=False)
                chunks.append({"text": chunk_text, "source": f"{file_path}:{k}", "tags": tags})
        return chunks
    else:
        tags = {**base_tags, **_tags_from_obj(data)}
        return [{"text": json.dumps(data, ensure_ascii=False), "source": str(file_path), "tags": tags}]


def embed_and_upsert(chunks: List[Dict[str, Any]], index) -> None:
    batch = []
    for i, chunk in enumerate(chunks):
        text = chunk["text"]
        source = chunk["source"]
        tags = chunk.get("tags", {})

        embedding = embed_query(text)
        metadata = {"source": source, "text": text, **tags}
        batch.append({"id": f"{source}-{i}", "values": embedding, "metadata": metadata})

        if len(batch) >= 32:
            index.upsert(vectors=batch)
            batch = []
    if batch:
        index.upsert(vectors=batch)


def main() -> None:
    if not PINECONE_API_KEY:
        raise RuntimeError("PINECONE_API_KEY not set in environment.")

    pc = Pinecone(api_key=PINECONE_API_KEY, environment=PINECONE_ENV)
    cloud, region = _cloud_region_from_env(PINECONE_ENV)

    if INDEX_NAME not in [idx.name for idx in pc.list_indexes()]:
        pc.create_index(
            name=INDEX_NAME,
            dimension=EMBEDDING_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud=cloud, region=region),
        )

    index = pc.Index(INDEX_NAME)
    files = get_all_json_files(DATA_DIR)
    print(f"Found {len(files)} files.")
    for file_path in files:
        print(f"Processing {file_path}")
        chunks = load_and_chunk_json(file_path)
        embed_and_upsert(chunks, index)
    print("Ingestion complete.")


if __name__ == "__main__":
    main()

