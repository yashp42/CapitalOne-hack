
"""
build_index.py: Ingests all static JSON/text files from data/static_json/, chunks them (JSON-aware), embeds with llama-text-embed-v2, and upserts to Pinecone index.
"""
import os
import json
import os
from pathlib import Path
from typing import List, Dict, Any
from langchain.text_splitter import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
load_dotenv()




# Use HuggingFaceEmbeddings for free, local embedding
try:
	from langchain_community.embeddings import HuggingFaceEmbeddings
except ImportError:
	raise ImportError("Please install langchain-community: pip install langchain-community")

try:
	from pinecone import Pinecone, ServerlessSpec
except ImportError:
	raise ImportError("Pinecone v7+ SDK is required. Please install with: pip install 'pinecone[grpc]'")

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
                # crop may appear as "crop" or "crop_name"
                crop_val = obj.get("crop") or obj.get("crop_name")
                if crop_val:
                        tags["crop"] = str(crop_val).lower()
        return tags


def load_and_chunk_json(file_path: Path, chunk_size=1024, chunk_overlap=100) -> List[Dict[str, Any]]:
        """Load JSON and chunk by top-level array/object or recursively by text.

        Each returned chunk includes extracted tags under the "tags" key.
        """
        with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        base_tags = _tags_from_path(file_path)
        # If it's a list of dicts, treat each as a chunk
        if isinstance(data, list):
                chunks = []
                for item in data:
                        tags = {**base_tags, **_tags_from_obj(item)}
                        chunks.append({"text": json.dumps(item, ensure_ascii=False), "source": str(file_path), "tags": tags})
                return chunks
        # If it's a dict, chunk by keys or by text
        elif isinstance(data, dict):
                tags = {**base_tags, **_tags_from_obj(data)}
                chunks = []
                for k, v in data.items():
                        if isinstance(v, str) and len(v) > chunk_size:
                                splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
                                for chunk in splitter.split_text(v):
                                        chunks.append({"text": chunk, "source": f"{file_path}:{k}", "tags": tags})
                        else:
                                chunk_tags = {**tags, **_tags_from_obj(v)}
                                chunks.append({"text": json.dumps({k: v}, ensure_ascii=False), "source": f"{file_path}:{k}", "tags": chunk_tags})
                return chunks
        else:
                # Fallback: treat as a single chunk
                return [{"text": json.dumps(data, ensure_ascii=False), "source": str(file_path), "tags": base_tags}]

def embed_and_upsert(chunks: List[Dict[str, Any]], index):
        embedder = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        batch = []
        for i, chunk in enumerate(chunks):
                text = chunk["text"]
                source = chunk["source"]
                tags = chunk.get("tags", {})
                embedding = embedder.embed_query(text)
                metadata = {"source": source, "text": text, **tags}
                batch.append({"id": f"{source}-{i}", "values": embedding, "metadata": metadata})
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
			dimension=1024,  # Make sure this matches your embedding size
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
