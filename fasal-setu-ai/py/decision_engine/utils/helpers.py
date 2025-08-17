# utils/helpers.py
"""
Helper utilities for the Decision Engine.

- build_facts_from_toolcalls: normalize incoming tool_calls into a facts dict of tool_name -> tool_output_dict
- find_tool_output: safe getter for facts
- extract_provenance_from_facts: discover sources/doc ids across facts (defensive)
- compute_confidence: conservative heuristic to compute confidence for a result
- safe_get: nested-key safe retrieval
- normalize: simple clamp/normalize helper
"""


from typing import List, Dict, Any, Optional, Iterable
import logging
from collections import OrderedDict
from pydantic import ValidationError

# Import the strict models to parse / validate tool outputs
try:
    from ..models import ToolCall
except ImportError:
    # Fallback for direct execution
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from models import ToolCall

logger = logging.getLogger("decision_engine.utils.helpers")
logger.addHandler(logging.NullHandler())

SOURCE_TYPE_WEIGHTS = {
    "government": 1.00,
    "research_institute": 0.95,
    "state_agri_university": 0.92,
    "market_portal": 0.90,
    "seed_catalog": 0.80,
    "dataset_portal": 0.78,
    "vendor": 0.60,
    "news_blog": 0.35,
    "unknown": 0.50
}

from collections import OrderedDict
from typing import Iterable, Dict, Any
import logging

logger = logging.getLogger(__name__)

def build_facts_from_toolcalls(tool_calls: Iterable) -> Dict[str, Dict[str, Any]]:
    """
    Convert a list of tool_calls (each either a dict or a ToolCall model instance)
    into a normalized facts dict:
        facts[tool_name] = <tool_output_as_plain_dict>

    - Attempts to parse each entry into ToolCall; on any error includes raw output under tool key.
    - Preserves insertion order.
    """
    facts: Dict[str, Dict[str, Any]] = OrderedDict()
    for idx, tc in enumerate(tool_calls or []):
        parsed = None
        try:
            if isinstance(tc, dict):
                # Validate/parse to ToolCall model (may raise ValidationError or ValueError)
                parsed = ToolCall.parse_obj(tc)
            elif isinstance(tc, ToolCall):
                parsed = tc
            else:
                parsed = ToolCall.parse_obj(tc)
        except Exception as exc:
            # catch any parse error (ValidationError, ValueError, TypeError, etc.)
            logger.warning("ToolCall at index %s failed to parse; including raw output. Error: %s", idx, exc)
            # best-effort extract tool name and raw output
            tool_name = None
            raw_out = None
            if isinstance(tc, dict):
                tool_name = tc.get("tool") or tc.get("name")
                raw_out = tc.get("output") or tc.get("result") or tc.get("response") or tc.get("data") or {}
            else:
                # attempt to get attributes
                tool_name = getattr(tc, "tool", None) or getattr(tc, "name", None)
                raw_out = getattr(tc, "output", None) or getattr(tc, "result", None) or {}
            if tool_name:
                facts[tool_name] = raw_out if isinstance(raw_out, dict) else {"value": raw_out}
            else:
                # fallback: store under tool_idx key
                facts[f"tool_{idx}"] = raw_out if isinstance(raw_out, dict) else {"value": raw_out}
            continue

        # At this point parsed is a ToolCall object
        tool_name = parsed.tool
        out = parsed.output
        # convert pydantic model -> plain dict safely
        try:
            if out is None:
                out_dict = {}
            elif hasattr(out, "model_dump"):
                out_dict = out.model_dump()
            elif hasattr(out, "dict"):
                out_dict = out.dict()
            elif isinstance(out, dict):
                out_dict = out
            else:
                out_dict = {"value": out}
        except Exception:
            out_dict = out if isinstance(out, dict) else {"value": out}

        facts[tool_name] = out_dict

    return facts


def find_tool_output(facts: Dict[str, Dict[str, Any]], tool_name: str) -> Optional[Dict[str, Any]]:
    """
    Safe getter: return facts[tool_name] if present, else None.
    """
    if not facts or not tool_name:
        return None
    return facts.get(tool_name)

def extract_provenance_from_facts(facts: Dict[str, Dict[str, Any]]) -> List[Dict[str, Optional[str]]]:
    """
    Deterministically extract provenance entries from validated facts.

    Returns a list of provenance dicts in first-seen order:
      [{'source_id': str_or_None, 'source_type': str_or_None, 'tool': tool_name}, ...]
    If a tool output contains nested 'results' with their own 'source_id'/'source_type', they are included too.
    """
    if not facts:
        return []

    provenance_list: List[Dict[str, Optional[str]]] = []
    seen = set()

    def add_prov(source_id: Optional[str], source_type: Optional[str], tool_name: str):
        key = f"{tool_name}||{source_id}||{source_type}"
        if key in seen:
            return
        seen.add(key)
        provenance_list.append({
            "source_id": source_id,
            "source_type": source_type,
            "tool": tool_name
        })

    for tool, out in facts.items():
        if not isinstance(out, dict):
            continue
        # prefer explicit top-level fields
        sid = out.get("source_id") or out.get("source")
        stype = out.get("source_type") or out.get("providere")
        add_prov(sid, stype, tool)

        # If the output has lists of items that may have their own sources (e.g., results, varieties, matched)
        for list_key in ("results", "varieties", "matched", "items", "series"):
            if list_key in out and isinstance(out[list_key], list):
                for item in out[list_key]:
                    if isinstance(item, dict):
                        sid_i = item.get("source_id") or item.get("source") or None
                        stype_i = item.get("source_type") or item.get("source_type") or None
                        add_prov(sid_i, stype_i, f"{tool}.{list_key}")

    return provenance_list


def safe_get(d: Any, path: Any, default: Any = None) -> Any:
    """
    Safely retrieve nested values.

    - d: dict-like or object
    - path: either a dot-separated string 'a.b.c' or a list/tuple of keys/indexes
    - default: return if any access fails

    Returns default on any exception.
    """
    if d is None:
        return default

    if isinstance(path, str):
        keys = path.split(".")
    else:
        keys = list(path)

    current = d
    try:
        for k in keys:
            if current is None:
                return default
            # allow numeric indices for lists if key is int-like
            if isinstance(current, list):
                # try to convert k to int
                try:
                    idx = int(k)
                    current = current[idx]
                except Exception:
                    return default
            elif isinstance(current, dict):
                current = current.get(k, default)
            else:
                # unknown object type; attempt attribute access then dict-like
                if hasattr(current, k):
                    current = getattr(current, k)
                elif isinstance(current, dict):
                    current = current.get(k, default)
                else:
                    return default
        return current
    except Exception:
        return default


def normalize(value: Optional[float], min_value: float = 0.0, max_value: float = 1.0) -> float:
    """
    Clamp a numeric value into [min_value, max_value] and scale into [0,1] range.
    If `value` is None or non-numeric, returns 0.0.
    """
    try:
        if value is None:
            return 0.0
        v = float(value)
        if min_value >= max_value:
            # avoid division by zero
            return 0.0
        # clamp
        if v <= min_value:
            return 0.0
        if v >= max_value:
            return 1.0
        # scale to 0-1
        return (v - min_value) / (max_value - min_value)
    except Exception:
        return 0.0


def compute_confidence(signals: Optional[Dict[str, float]] = None,
                       facts: Optional[Dict[str, Dict[str, Any]]] = None,
                       required_tools: Optional[List[str]] = None,
                       *args, **kwargs) -> float:
    """
    Canonical confidence combiner.

    - signals: numeric signals provided by handler/orchestrator. Expected keys (examples):
        - "handler_confidence" (0..1), "items_mean_score" (0..1), "facts_mean_confidence" (0..1),
          "items_max_score", "n_facts", "n_items"
    - facts: dict of tool outputs (used to check missing required_tools and read per-tool confidences)
    - required_tools: list of tool names that are required for this intent (penalize if missing)

    Returns a float in [0,1].
    """
    try:
        signals = dict(signals or {})
    except Exception:
        signals = {}

    facts = facts or {}
    required_tools = required_tools or []

    # Read canonical signals (may be absent)
    handler_conf = signals.get("handler_confidence")
    items_mean = signals.get("items_mean_score")
    facts_mean = signals.get("facts_mean_confidence")
    items_max = signals.get("items_max_score")
    items_list = signals.get("items", [])
    n_items = signals.get("n_items", len(items_list) if isinstance(items_list, list) else 0)
    n_facts = float(len(facts or {}))

    # Normalize numeric values where present
    def _to_float(x, default=None):
        try:
            return float(x) if x is not None else default
        except Exception:
            return default

    handler_conf = _to_float(handler_conf, None)
    items_mean = _to_float(items_mean, None)
    facts_mean = _to_float(facts_mean, None)
    items_max = _to_float(items_max, None)

    # If required tools missing, penalize heavily
    missing_tools = [t for t in (required_tools or []) if t not in (facts or {})]
    if missing_tools:
        # if there are other signals, reduce confidence proportional to missing fraction
        miss_frac = len(missing_tools) / max(1.0, len(required_tools))
        base = 0.0
        # if items_mean provided use it as weak signal else 0.0
        if items_mean is not None:
            base = items_mean * (1.0 - miss_frac)
        elif handler_conf is not None:
            base = handler_conf * (1.0 - miss_frac)
        else:
            base = max(0.0, 0.5 * (1.0 - miss_frac))
        return max(0.0, min(1.0, base))

    # Aggregate available signals with conservative weights
    parts = []
    weights = []

    # Prefer handler_conf if provided (it represents domain knowledge)
    if handler_conf is not None:
        parts.append(handler_conf)
        weights.append(0.45)

    # items_mean is a direct quality indicator of returned choices
    if items_mean is not None:
        parts.append(items_mean)
        weights.append(0.35)

    # facts_mean is how confident the inputs are
    if facts_mean is not None:
        parts.append(facts_mean)
        weights.append(0.20)

    # If nothing present, fallback to examining facts for per-tool confidences
    if not parts:
        # compute mean of per-tool confidences if present
        tool_confs = []
        for tname, tout in (facts or {}).items():
            try:
                if isinstance(tout, dict):
                    c = tout.get("confidence") or tout.get("conf") or tout.get("score")
                    if c is not None:
                        tool_confs.append(float(c))
            except Exception:
                continue
        if tool_confs:
            return float(sum(tool_confs) / len(tool_confs))
        # ultimate fallback: neutral 0.5
        return 0.5

    # weighted average
    try:
        total_w = sum(weights)
        conf = sum(p * w for p, w in zip(parts, weights)) / total_w if total_w > 0 else float(sum(parts) / len(parts))
    except Exception:
        conf = float(sum(parts) / len(parts))

    # modest boost if many facts / items (evidence richness)
    try:
        boost = 1.0 + min(0.1, (n_facts / 10.0)) + min(0.05, (float(n_items) / 20.0))
        conf = conf * boost
    except Exception:
        pass

    # clamp
    conf = max(0.0, min(1.0, float(conf)))
    return conf