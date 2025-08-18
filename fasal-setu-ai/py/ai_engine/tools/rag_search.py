#!/usr/bin/env python3
"""
rag_tool.py
One-file RAG tool for LLM-1 planner service.

Capabilities
- Load .txt and .json from a data folder
- Chunk via LangChain RecursiveCharacterTextSplitter
- Embed with Pinecone hosted embeddings (e.g., llama-text-embed-v2)
- Upsert/query Pinecone v7+ (serverless)
- Search API returning [{text, source_stamp, score, id}, ...]
- Optional MMR reranker
- LangChain Tool export: get_langchain_tool()

Env (.env at repo root or any parent):
  PINECONE_API_KEY=...
  # Serverless location (recommended)
  PINECONE_CLOUD=aws
  PINECONE_REGION=us-east-1
  # Legacy ENV (optional): PINECONE_ENV=...
  PINECONE_INDEX=rag-llm1
  PINECONE_NAMESPACE=default
  EMBED_MODEL=llama-text-embed-v2
  DATA_DIR=/absolute/or/relative/path/to/data
  CHUNK_SIZE=1000
  CHUNK_OVERLAP=120
  TOP_K=5
  BATCH_SIZE=64
"""

from __future__ import annotations
import os
import sys
import json
import time
import argparse
import pathlib
import hashlib
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union, cast

from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Optional: LangChain Tool wrapper (works with both new/old)
try:
    from langchain_core.tools import Tool  # LC >= 0.2
except Exception:
    try:
        from langchain.tools import Tool  # LC < 0.2
    except Exception:
        Tool = None  # still usable without Tool

# Optional: reranker needs numpy
try:
    import numpy as np
except Exception as e:
    np = None  # rerank disabled if numpy missing

# --------------------------------------------------------------------------------------
# Paths & env
# --------------------------------------------------------------------------------------
HERE = pathlib.Path(__file__).resolve().parent
# Search for a .env upward (repo root)
_env_try = HERE / ".env"
if _env_try.exists():
    load_dotenv(_env_try)
else:
    load_dotenv()  # fallback to default search

# Data dir default matches your notebook layout
# Default to the local rag_data folder inside this tools package (preferred for repo-local corpora)
DATA_DIR = pathlib.Path(os.getenv("DATA_DIR", str(HERE / "rag_data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV     = os.getenv("PINECONE_ENV")  # legacy, optional
PINECONE_CLOUD   = os.getenv("PINECONE_CLOUD", "aws")
PINECONE_REGION  = os.getenv("PINECONE_REGION", PINECONE_ENV or "")
PINECONE_INDEX   = os.getenv("PINECONE_INDEX", "rag-llm1")
PINECONE_NS      = os.getenv("PINECONE_NAMESPACE", "default")
EMBED_MODEL      = os.getenv("EMBED_MODEL", "llama-text-embed-v2")

DEFAULT_CHUNK_SIZE    = int(os.getenv("CHUNK_SIZE", "1000"))
DEFAULT_CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "120"))
DEFAULT_TOP_K         = int(os.getenv("TOP_K", "5"))
BATCH_SIZE            = int(os.getenv("BATCH_SIZE", "64"))

# --------------------------------------------------------------------------------------
# Pinecone client + Hosted Embeddings
# --------------------------------------------------------------------------------------
if not PINECONE_API_KEY:
    print("ERROR: PINECONE_API_KEY missing. Add it to your .env.", file=sys.stderr)
    sys.exit(1)

pc = Pinecone(api_key=PINECONE_API_KEY)

def _as_vectors(embed_out) -> List[List[float]]:
    """
    Normalize Pinecone inference output to a list of vectors.
    Supports:
      - EmbeddingsList with .data rows exposing .values
      - dict with 'data' -> [{'values': ...}]
      - list-like rows
    """
    data = getattr(embed_out, "data", None)
    if data is None:
        if isinstance(embed_out, dict) and "data" in embed_out:
            data = embed_out["data"]
        else:
            data = embed_out

    vectors: List[List[float]] = []
    for row in data:
        if hasattr(row, "values"):
            vectors.append(row.values)  # v7
        elif isinstance(row, dict) and "values" in row:
            vectors.append(row["values"])
        else:
            raise TypeError(f"Unexpected embedding row type: {type(row)}")
    return vectors

def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    out = pc.inference.embed(
        model=EMBED_MODEL,
        inputs=texts,
        parameters={"input_type": "passage", "truncate": "END"},
    )
    return _as_vectors(out)

# Probe dimension
try:
    _probe_vec = embed_texts(["__probe__"])[0]
    EMBED_DIM = len(_probe_vec)
except Exception as e:
    print("ERROR: Failed to get embedding dimension. Check model access & env.")
    raise

# Ensure index exists
def _ensure_index() -> None:
    existing = {ix["name"] for ix in pc.list_indexes()}
    if PINECONE_INDEX not in existing:
        print(f"Creating index '{PINECONE_INDEX}' (dim={EMBED_DIM}, cosine) on {PINECONE_CLOUD}/{PINECONE_REGION} ...")
        pc.create_index(
            name=PINECONE_INDEX,
            dimension=EMBED_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
        )
    else:
        # optional: could print existing info
        pass

_ensure_index()
index = pc.Index(PINECONE_INDEX)

# --------------------------------------------------------------------------------------
# Loaders (.txt/.json) + chunking
# --------------------------------------------------------------------------------------
splitter = RecursiveCharacterTextSplitter(
    chunk_size=DEFAULT_CHUNK_SIZE,
    chunk_overlap=DEFAULT_CHUNK_OVERLAP,
    length_function=len,
    separators=["\n\n", "\n", " ", ""],
)

def _hash(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:12]

def _norm_source(path: pathlib.Path, extra: str = "") -> str:
    try:
        rel = path.relative_to(HERE)
    except Exception:
        rel = path
    return f"{rel.as_posix()}{('::' + extra) if extra else ''}"

def _flatten_json(obj: Any, prefix: str = "") -> Iterable[Tuple[str, str]]:
    """Yield (json_path, text_value) pairs from nested JSON."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            newp = f"{prefix}/{k}" if prefix else k
            yield from _flatten_json(v, newp)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            newp = f"{prefix}[{i}]" if prefix else f"[{i}]"
            yield from _flatten_json(v, newp)
    else:
        text = "" if obj is None else str(obj)
        if text.strip():
            yield prefix, text

def load_corpus(data_dir: pathlib.Path = DATA_DIR) -> List[Dict[str, Any]]:
    """
    Returns list of raw docs:
      {
        'doc_id': str,
        'text': str,
        'source_stamp': str,
        'meta': {'path': str, 'kind': 'txt'|'json', 'json_path': str|None}
      }
    """
    docs: List[Dict[str, Any]] = []

    # .txt
    for path in data_dir.rglob("*.txt"):
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            text = path.read_text(errors="ignore")
        src = _norm_source(path)
        if text.strip():
            docs.append({
                "doc_id": _hash(src),
                "text": text,
                "source_stamp": src,
                "meta": {"path": src, "kind": "txt", "json_path": None}
            })

    # .json
    for path in data_dir.rglob("*.json"):
        try:
            obj = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
        except Exception as e:
            print(f"⚠️ Failed to parse JSON: {path}: {e}")
            continue
        base = _norm_source(path)
        for jpath, text in _flatten_json(obj):
            src = _norm_source(path, jpath)
            docs.append({
                "doc_id": _hash(src),
                "text": text,
                "source_stamp": src,
                "meta": {"path": base, "kind": "json", "json_path": jpath}
            })

    print(f"Loaded {len(docs)} raw doc items "
          f"({sum(1 for d in docs if d['meta']['kind']=='txt')} txt, "
          f"{sum(1 for d in docs if d['meta']['kind']=='json')} json-slices).")
    return docs

def chunk_documents(raw_docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Return chunk records:
      {'id', 'text', 'source_stamp', 'metadata': {...}}
    """
    chunks: List[Dict[str, Any]] = []
    for rd in raw_docs:
        parts = splitter.split_text(rd["text"])
        for idx, part in enumerate(parts):
            if not part.strip():
                continue
            cid_seed = f"{rd['doc_id']}::{idx}"
            cid = _hash(cid_seed)
            meta = {
                "source_stamp": rd["source_stamp"],
                "path": rd["meta"]["path"],
                "kind": rd["meta"]["kind"],
                "json_path": rd["meta"]["json_path"],
                "chunk_index": idx,
                "chunk_size": DEFAULT_CHUNK_SIZE,
                "chunk_overlap": DEFAULT_CHUNK_OVERLAP,
                "embed_model": EMBED_MODEL,
            }
            chunks.append({
                "id": cid,
                "text": part,
                "source_stamp": rd["source_stamp"],
                "metadata": meta,
            })
    print(f"Chunked into {len(chunks)} chunks "
          f"(size≈{DEFAULT_CHUNK_SIZE}, overlap={DEFAULT_CHUNK_OVERLAP}).")
    return chunks

# --------------------------------------------------------------------------------------
# Upsert with metadata sanitizer
# --------------------------------------------------------------------------------------
def _pc_clean_meta(meta: Dict[str, Any]) -> Dict[str, Any]:
    """Pinecone allows str/number/bool or list[str]. Remove None & coerce."""
    clean: Dict[str, Any] = {}
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, (str, int, float, bool)):
            clean[k] = v
        elif isinstance(v, list):
            clean[k] = [str(x) for x in v if x is not None]
        else:
            clean[k] = str(v)
    return clean

def _prepare_vectors(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    texts = [c["text"] for c in chunks]
    embs = embed_texts(texts)
    vectors = []
    for c, v in zip(chunks, embs):
        meta = dict(c["metadata"])
        meta.update({"text": c["text"], "source_stamp": c["source_stamp"]})
        meta = _pc_clean_meta(meta)
        vectors.append({"id": c["id"], "values": v, "metadata": meta})
    return vectors

def _batched(it: Iterable[Any], n: int) -> Iterable[List[Any]]:
    batch: List[Any] = []
    for x in it:
        batch.append(x)
        if len(batch) >= n:
            yield batch
            batch = []
    if batch:
        yield batch

def upsert_chunks(chunks: List[Dict[str, Any]],
                  namespace: Optional[str] = None,
                  batch_size: int = BATCH_SIZE,
                  max_retries: int = 5) -> int:
    ns = namespace or PINECONE_NS
    total = 0
    for batch in _batched(chunks, batch_size):
        vectors = _prepare_vectors(batch)
        attempt, backoff = 0, 1.0
        while True:
            try:
                # cast index to Any to avoid strict type checks from pinecone stubs
                cast(Any, index).upsert(vectors=vectors, namespace=ns)
                total += len(vectors)
                break
            except Exception as e:
                attempt += 1
                if attempt > max_retries:
                    print("❌ Upsert failed after retries.", e)
                    break
                time.sleep(backoff)
                backoff *= 2
    return total

def build_index(data_dir: pathlib.Path = DATA_DIR,
                namespace: Optional[str] = None,
                batch_size: int = BATCH_SIZE) -> Dict[str, Any]:
    ns = namespace or PINECONE_NS
    print(f"Building index '{PINECONE_INDEX}' namespace='{ns}' from: {data_dir}")
    raw = load_corpus(data_dir)
    chunks = chunk_documents(raw)
    count = upsert_chunks(chunks, namespace=ns, batch_size=batch_size)
    summary = {
        "index": PINECONE_INDEX,
        "namespace": ns,
        "files_seen": len({d['meta']['path'] for d in raw}),
        "raw_items": len(raw),
        "chunks_upserted": count,
        "embed_model": EMBED_MODEL,
        "dim": EMBED_DIM,
    }
    print("✅ Build complete:", summary)
    return summary

def wipe_namespace(namespace: Optional[str] = None) -> None:
    ns = namespace or PINECONE_NS
    print(f"⚠️ Deleting all vectors in index='{PINECONE_INDEX}', namespace='{ns}' ...")
    index.delete(delete_all=True, namespace=ns)
    print("✅ Namespace wiped.")

# --------------------------------------------------------------------------------------
# Search + optional MMR reranker
# --------------------------------------------------------------------------------------
def _normalize_match(m: Dict[str, Any]) -> Dict[str, Any]:
    meta = m.get("metadata", {}) or {}
    return {
        "id": m.get("id"),
        "score": m.get("score"),
        "text": meta.get("text", ""),
        "source_stamp": meta.get("source_stamp", meta.get("path", "")),
    }


def _extract_matches(res: Any) -> List[Dict[str, Any]]:
    """Safe extraction of matches from Pinecone response or dict-like object."""
    if res is None:
        return []
    if isinstance(res, dict):
        return res.get("matches", []) or []
    # try attribute
    return getattr(res, "matches", []) or []

def semantic_search(query: str,
                    top_k: int = DEFAULT_TOP_K,
                    namespace: Optional[str] = None,
                    metadata_filter: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    if not query or not query.strip():
        return []
    ns = namespace or PINECONE_NS
    q_vec = embed_texts([query])[0]
    res = index.query(
        namespace=ns,
        vector=q_vec,
        top_k=top_k,
        include_values=False,
        include_metadata=True,
        filter=metadata_filter or None,
    )
    matches = _extract_matches(res)
    # limit returned results to top 2 chunks for downstream consumers
    top_n = min(int(top_k), 2)
    matches = matches[:top_n]
    return [_normalize_match(m) for m in matches]

# --- MMR reranker (uses numpy if available) ----------------------------------
def _mmr_rerank(query_vec, cand_vecs, lambda_mult: float = 0.7, top_k: int = 5) -> List[int]:
    """MMR reranker using numpy when available. Falls back to simple similarity sort.

    Returns indices of selected candidate vectors.
    """
    if np is None:
        # fallback: rank by dot-product similarity
        sims = [float(sum(a * b for a, b in zip(query_vec, cv))) for cv in cand_vecs]
        idxs = sorted(range(len(sims)), key=lambda i: sims[i], reverse=True)
        return idxs[:top_k]

    n = int(getattr(cand_vecs, "shape", (len(cand_vecs), 0))[0])
    if n == 0:
        return []
    top_k = min(top_k, n)

    qvec = np.array(query_vec, dtype=np.float32)
    cvecs = np.array(cand_vecs, dtype=np.float32)
    qnorm = np.linalg.norm(qvec)
    cnorms = np.linalg.norm(cvecs, axis=1)
    qnorm = 1e-9 if qnorm == 0 else qnorm
    cnorms = np.where(cnorms == 0, 1e-9, cnorms)
    sim_to_query = (cvecs @ qvec) / (cnorms * qnorm)

    selected: List[int] = []
    remaining = set(range(n))
    while len(selected) < top_k and remaining:
        if not selected:
            i = int(np.argmax(sim_to_query))
            selected.append(i); remaining.remove(i); continue

        sel_vecs = cvecs[selected]
        sims_matrix = (cvecs @ sel_vecs.T) / (cnorms[:, None] * np.linalg.norm(sel_vecs, axis=1)[None, :])
        max_sim_to_selected = np.max(sims_matrix, axis=1)
        mmr_scores = lambda_mult * sim_to_query - (1.0 - lambda_mult) * max_sim_to_selected
        mmr_scores[selected] = -np.inf  # mask already selected
        i = int(np.argmax(mmr_scores))
        if i in remaining:
            selected.append(i); remaining.remove(i)
        else:
            i = max(list(remaining), key=lambda j: sim_to_query[j])
            selected.append(i); remaining.remove(i)
    return selected

def semantic_search_reranked(query: str,
                             top_k: int = DEFAULT_TOP_K,
                             namespace: Optional[str] = None,
                             metadata_filter: Optional[Dict[str, Any]] = None,
                             fetch_k: Optional[int] = None,
                             lambda_mult: float = 0.7) -> List[Dict[str, Any]]:
    if not query or not query.strip():
        return []
    if np is None:
        # numpy not available; fall back to plain search
        return semantic_search(query, top_k, namespace, metadata_filter)

    ns = namespace or PINECONE_NS
    fetch_k = fetch_k or max(top_k * 3, top_k)

    q_vec = embed_texts([query])[0]
    res = index.query(
        namespace=ns,
        vector=q_vec,
        top_k=fetch_k,
        include_values=False,
        include_metadata=True,
        filter=metadata_filter or None,
    )
    matches = _extract_matches(res)
    if not matches:
        return []

    cand_texts = [(i, (m.get("metadata", {}) or {}).get("text", "")) for i, m in enumerate(matches)]
    cand_texts = [(i, t) for i, t in cand_texts if t.strip()]
    if not cand_texts:
        return []

    idxs, texts = zip(*cand_texts)
    cand_vecs = np.array(embed_texts(list(texts)), dtype=np.float32)
    selected_local = _mmr_rerank(np.array(q_vec, dtype=np.float32), cand_vecs,
                                 lambda_mult=lambda_mult, top_k=min(top_k, len(idxs)))
    selected_global = [idxs[i] for i in selected_local]
    # limit to top 2 chunks for downstream consumers
    top_n = min(int(top_k), 2)
    selected_global = selected_global[:top_n]
    return [_normalize_match(matches[i]) for i in selected_global]

def rag_search(args: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    LangChain-tool-style function.
    Accepts:
      - string query
      - dict with: query (str), top_k (int?), namespace (str?), filter (dict?),
                   rerank (bool?), fetch_k (int?), lambda_mult (float?)
    Returns: {"data": [ {text, source_stamp, score, id}, ... ]}
    """
    if isinstance(args, str):
        query, opts = args, {}
    else:
        query, opts = args.get("query", ""), args

    top_k       = int(opts.get("top_k", DEFAULT_TOP_K))
    ns          = opts.get("namespace", PINECONE_NS)
    filt        = opts.get("filter")
    rerank      = bool(opts.get("rerank", False))
    fetch_k     = opts.get("fetch_k")
    lambda_mult = float(opts.get("lambda_mult", 0.7))

    if rerank:
        data = semantic_search_reranked(query, top_k, ns, filt, fetch_k, lambda_mult)
    else:
        data = semantic_search(query, top_k, ns, filt)
    return {"data": data}

def get_langchain_tool():
    """
    Returns a LangChain Tool wrapping rag_search(), or None if Tool not installed.
    """
    if Tool is None:
        return None
    return Tool(
        name="rag_search",
        description=("Semantic search over Pinecone index. Args can be a string or a dict with "
                     "{query, top_k?, namespace?, filter?, rerank?, fetch_k?, lambda_mult?}. "
                     "Returns {data: [{text, source_stamp, score, id}, ...]}."),
        func=rag_search,
    )

# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------
def _cli():
    parser = argparse.ArgumentParser(description="RAG Tool (build/search/wipe).")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_build = sub.add_parser("build", help="Build index from DATA_DIR.")
    p_build.add_argument("--namespace", default=PINECONE_NS)
    p_build.add_argument("--data-dir", default=str(DATA_DIR))
    p_build.add_argument("--batch-size", type=int, default=BATCH_SIZE)

    p_search = sub.add_parser("search", help="Search the index.")
    p_search.add_argument("-q", "--query", required=True)
    p_search.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    p_search.add_argument("--namespace", default=PINECONE_NS)
    p_search.add_argument("--filter", type=str, default=None,
                          help='JSON metadata filter, e.g. \'{"kind":{"$eq":"json"}}\'')
    p_search.add_argument("--rerank", action="store_true")
    p_search.add_argument("--fetch-k", type=int, default=None)
    p_search.add_argument("--lambda-mult", type=float, default=0.7)

    p_wipe = sub.add_parser("wipe", help="Delete all vectors in a namespace.")
    p_wipe.add_argument("--namespace", default=PINECONE_NS)

    args = parser.parse_args()

    if args.cmd == "build":
        dd = pathlib.Path(args.data_dir)
        summary = build_index(dd, namespace=args.namespace, batch_size=args.batch_size)
        print(json.dumps(summary, indent=2))

    elif args.cmd == "search":
        filt = json.loads(args.filter) if args.filter else None
        payload: Dict[str, Any] = {
            "query": args.query,
            "top_k": args.top_k,
            "namespace": args.namespace,
            "filter": filt,
            "rerank": bool(args.rerank),
        }
        if args.fetch_k is not None:
            payload["fetch_k"] = args.fetch_k
        if args.lambda_mult is not None:
            payload["lambda_mult"] = args.lambda_mult

        res = rag_search(payload)
        # compact print
        for i, r in enumerate(res["data"], 1):
            txt = " ".join((r.get("text") or "").split())
            if len(txt) > 300:
                txt = txt[:300] + "..."
            print(f"\n#{i}  score={r.get('score')}\nsource={r.get('source_stamp')}\ntext  : {txt}")

    elif args.cmd == "wipe":
        wipe_namespace(namespace=args.namespace)

if __name__ == "__main__":
    _cli()
