
"""Ingest JSON/text files, embed, and upsert to a Pinecone index."""

import json
import os
from pathlib import Path
from typing import List, Dict, Any

from langchain.text_splitter import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

from embed_utils import embed_query, EMBEDDING_DIM

load_dotenv()

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "static_json"
INDEX_NAME = "rag-index"

# Pinecone API key and environment should be set as env vars
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_ENV = os.environ.get("PINECONE_ENV", "gcp-starter")

def get_all_json_files(data_dir: Path) -> List[Path]:
	files = []
	for root, _, filenames in os.walk(data_dir):
		for fname in filenames:
			if fname.endswith(".json"):
				files.append(Path(root) / fname)
	return files

def load_and_chunk_json(file_path: Path, chunk_size=1024, chunk_overlap=100) -> List[Dict[str, Any]]:
	"""Load JSON and chunk by top-level array/object or recursively by text."""
	with open(file_path, "r", encoding="utf-8") as f:
		data = json.load(f)
	# If it's a list of dicts, treat each as a chunk
	if isinstance(data, list):
		return [{"text": json.dumps(item, ensure_ascii=False), "source": str(file_path)} for item in data]
	# If it's a dict, chunk by keys or by text
	elif isinstance(data, dict):
		chunks = []
		for k, v in data.items():
			if isinstance(v, str) and len(v) > chunk_size:
				splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
				for chunk in splitter.split_text(v):
					chunks.append({"text": chunk, "source": f"{file_path}:{k}"})
			else:
				chunks.append({"text": json.dumps({k: v}, ensure_ascii=False), "source": f"{file_path}:{k}"})
		return chunks
	else:
		# Fallback: treat as a single chunk
		return [{"text": json.dumps(data, ensure_ascii=False), "source": str(file_path)}]

def embed_and_upsert(chunks: List[Dict[str, Any]], index):
        batch = []
        for i, chunk in enumerate(chunks):
                text = chunk["text"]
                source = chunk["source"]
                embedding = embed_query(text)
                batch.append({"id": f"{source}-{i}", "values": embedding, "metadata": {"source": source, "text": text}})
                if len(batch) >= 32:
                        index.upsert(vectors=batch)
                        batch = []
        if batch:
                index.upsert(vectors=batch)


def main():
	if not PINECONE_API_KEY:
		raise RuntimeError("PINECONE_API_KEY not set in environment.")
	pc = Pinecone(api_key=PINECONE_API_KEY)
	# Check/create index
	if INDEX_NAME not in [idx.name for idx in pc.list_indexes()]:
                pc.create_index(
                        name=INDEX_NAME,
                        dimension=EMBEDDING_DIM,
                        metric="cosine",
                        spec=ServerlessSpec(cloud="gcp", region="us-central1")
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

