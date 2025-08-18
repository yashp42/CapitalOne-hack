# orchestrator.py
"""
Decision Engine main orchestrator (updated for centralized confidence).

Key changes:
- Handlers may return `handler_confidence` (float) as a signal.
- Orchestrator centrally computes final envelope confidence using:
    helpers.compute_confidence(signals: dict, facts: dict, required_tools: list)
- DecisionResponseModel.provenance (top-level) is set using provenance.merge_provenance(...)
- DecisionItem.sources are structured dicts; if missing, we attempt to extract via helpers.extract_provenance_from_facts
"""

from __future__ import annotations

import logging
import uuid
import sys
import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

# Robust imports with fallbacks
try:
    from models import (
        ActIntentModel,
        DecisionResponseModel,
        DecisionResult as DecisionResultModel,
        DecisionItem as DecisionItemModel,
        EvidenceItem as EvidenceItemModel,
        AuditStep as AuditStepModel,
    )
except ImportError:
    try:
        from .models import (
            ActIntentModel,
            DecisionResponseModel,
            DecisionResult as DecisionResultModel,
            DecisionItem as DecisionItemModel,
            EvidenceItem as EvidenceItemModel,
            AuditStep as AuditStepModel,
        )
    except ImportError as e:
        print(f"Models import failed: {e}")
        # Simple fallback models
        from pydantic import BaseModel
        
        class ActIntentModel(BaseModel):
            intent: str
            decision_template: str
            tool_calls: List[Dict[str, Any]] = []
            facts: Dict[str, Any] = {}
            request_id: Optional[str] = None

try:
    from utils.helpers import (
        build_facts_from_toolcalls,
        extract_provenance_from_facts,
        compute_confidence,
        safe_get,
        SOURCE_TYPE_WEIGHTS,
    )
    from utils.provenance import merge_provenance, prioritize_provenance
    from utils import helpers, provenance
except ImportError:
    try:
        from .utils.helpers import (
            build_facts_from_toolcalls,
            extract_provenance_from_facts,
            compute_confidence,
            safe_get,
            SOURCE_TYPE_WEIGHTS,
        )
        from .utils.provenance import merge_provenance, prioritize_provenance
        from .utils import helpers, provenance
    except ImportError as e:
        print(f"Utils import failed: {e}")
        # Minimal fallback helpers
        def build_facts_from_toolcalls(tool_calls):
            facts = {}
            for tc in tool_calls or []:
                if isinstance(tc, dict) and 'tool' in tc and 'output' in tc:
                    facts[tc['tool']] = tc['output']
            return facts
        
        def compute_confidence(signals=None, facts=None, required_tools=None):
            return 0.8
        
        def safe_get(d, *keys, default=None):
            for key in keys:
                if isinstance(d, dict) and key in d:
                    d = d[key]
                else:
                    return default
            return d
        
        def extract_provenance_from_facts(facts):
            return []
        
        def merge_provenance(handler_prov=None, facts=None):
            return []

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

# Intent -> handler module + required tools mapping
INTENT_ROUTING = {
    "irrigation_decision": {"module": "rules.irrigation_decision", "required_tools": ["weather_outlook", "calendar_lookup"]},
    "variety_selection": {"module": "rules.variety_selection", "required_tools": ["variety_lookup", "calendar_lookup"]},
    "temperature_risk": {"module": "rules.temperature_risk", "required_tools": ["weather_outlook", "calendar_lookup"]},
    "market_advice": {"module": "rules.market_advice", "required_tools": ["prices_fetch"]},
    "credit_policy_match": {"module": "rules.policies", "required_tools": ["policy_match"]},
    "pesticide_advice": {"module": "rules.pesticide_advice", "required_tools": ["pesticide_lookup"]},
}

ALLOWED_STATUSES = {"complete", "incomplete", "invalid_input", "handler_not_found"}

# Import rules with fallbacks
try:
    from rules import (
        irrigation_decision,
        market_advice,
        pesticide_advice,
        temperature_risk,
        variety_selection,
    )
    
    HANDLER_MAP = {
        "irrigation_decision": irrigation_decision.handle,
        "variety_selection": variety_selection.handle,
        "temperature_risk": temperature_risk.handle,
        "market_advice": market_advice.handle,
        "pesticide_advice": pesticide_advice.handle,
    }
except ImportError:
    try:
        from decision_engine.rules import (
            irrigation_decision,
            market_advice,
            pesticide_advice,
            temperature_risk,
            variety_selection,
        )
        
        HANDLER_MAP = {
            "irrigation_decision": irrigation_decision.handle,
            "variety_selection": variety_selection.handle,
            "temperature_risk": temperature_risk.handle,
            "market_advice": market_advice.handle,
            "pesticide_advice": pesticide_advice.handle,
        }
    except ImportError as e:
        print(f"Rules import failed: {e}")
        
        # Fallback handler function
        def fallback_handler(intent, facts):
            return {
                "action": "require_more_info",
                "items": [],
                "notes": f"Handler for {intent} not available",
                "confidence": 0.0,
                "missing": ["handler_implementation"]
            }
        
        HANDLER_MAP = {
            "irrigation_decision": fallback_handler,
            "variety_selection": fallback_handler,
            "temperature_risk": fallback_handler,
            "market_advice": fallback_handler,
            "pesticide_advice": fallback_handler,
        }

# ---------- normalize items helper ----------
def _normalize_items(items: Optional[List[Any]]) -> List[Dict[str, Any]]:
    """
    Canonicalize each item to a dict with numeric 'score' where possible.
    Accepts dicts, pydantic model instances (with .dict()), or raw values.
    """
    out = []
    for it in items or []:
        if hasattr(it, "dict"):
            itd = it.dict()
        elif isinstance(it, dict):
            itd = it.copy()
        else:
            itd = {"value": it}
        # prefer canonical 'score'; if only 'raw_score' exists, copy it
        if "score" not in itd and "raw_score" in itd:
            try:
                itd["score"] = float(itd["raw_score"])
            except Exception:
                itd["score"] = 0.0
        else:
            try:
                itd["score"] = float(itd.get("score", 0.0))
            except Exception:
                itd["score"] = 0.0
        out.append(itd)
    return out
# -------------------------------------------------------------------------

def process_act_intent(raw_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Core orchestrator entry point.
    - Validates ActIntentModel
    - Builds `facts` from act.tool_calls[*].output and overlays act.facts
    - Dispatches to the single handler mapped from act.intent
    - Normalizes handler items, computes handler confidence (precedence: handler_confidence else computed)
    - Aggregates overall confidence (probabilistic OR)
    - Returns final response dict (optionally validated by DecisionResponseModel)
    """
    trace_id = raw_payload.get("trace_id") or str(uuid.uuid4())

    # 1) Validate incoming ActIntent
    try:
        act = ActIntentModel.model_validate(raw_payload)
    except ValidationError as e:
        logger.exception("Invalid ActIntentModel")
        return {
            "request_id": raw_payload.get("request_id", trace_id),
            "intent": raw_payload.get("intent", "unknown"),
            "decision_template": raw_payload.get("decision_template", "unknown"),
            "decision_timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "invalid_input",
            "result": None,
            "evidence": [],
            "provenance": [],
            "audit_trace": [],
            "confidence": 0.0,
            "missing": [],
            "source_id": None,
            "source_type": None,
            "error": "invalid_act_intent", 
            "details": e.errors(), 
            "trace_id": trace_id
        }

    # 2) Build facts from tool_calls[*].output (DE must NOT fetch data)
    # Use helper build_facts_from_toolcalls which expects list of {"tool":name, "output":...}
    tool_outputs = []
    for tc in getattr(act, "tool_calls", []) or []:
        # Use the parsed output if present; else fallback to empty dict
        out = getattr(tc, "output", None)
        tool_outputs.append({"tool": tc.tool, "output": out if out is not None else {}})

    facts_from_toolcalls = build_facts_from_toolcalls(tool_outputs)
    # Overlay explicit top-level act.facts (act.facts wins on conflicts)
    explicit_facts = act.facts or {}
    facts = dict(facts_from_toolcalls)
    for k, v in explicit_facts.items():
        facts[k] = v

    # 3) Extract provenance from the facts (use helpers.extract_provenance_from_facts defensively)
    try:
        fact_prov = extract_provenance_from_facts(facts)
        if not isinstance(fact_prov, list):
            fact_prov = list(fact_prov)
    except Exception:
        logger.exception("extract_provenance_from_facts failed; continuing with empty provenance")
        fact_prov = []

    # 4) Find the handler for the intent
    handler = None
    try:
        handler = HANDLER_MAP.get(act.intent)
    except Exception:
        handler = None

    if handler is None:
        logger.error("No handler found for intent: %s", act.intent)
        return {
            "request_id": act.request_id or trace_id,
            "intent": act.intent,
            "decision_template": act.decision_template,
            "decision_timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "handler_not_found",
            "result": None,
            "evidence": [],
            "provenance": [],
            "audit_trace": [],
            "confidence": 0.0,
            "missing": [],
            "source_id": None,
            "source_type": None,
            "error": "unknown_intent", 
            "trace_id": trace_id
        }

    # 5) Safe handler invocation
    try:
        # contract: handler(facts=facts, intent=act, tool_calls=act.tool_calls)
        handler_result = handler(intent=act, facts=facts)
        if not isinstance(handler_result, dict):
            raise ValueError("handler must return a dict")
    except Exception as exc:
        logger.exception("Handler %s failed", act.intent)
        handler_result = {
            "action": None,
            "items": [],
            "handler_confidence": 0.0,
            "confidence": 0.0,
            "notes": f"handler error: {type(exc).__name__}: {str(exc)}"
        }

    # Ensure result has canonical keys and normalized items
    handler_result.setdefault("action", None)
    handler_result["items"] = _normalize_items(handler_result.get("items", []))
    handler_result.setdefault("handler_confidence", None)
    handler_result.setdefault("confidence", None)
    handler_result.setdefault("notes", "")

    # 6) Merge provenance: combine any handler-provided prov with facts provenance
    handler_prov = handler_result.get("provenance") or handler_result.get("prov") or None
    try:
        merged_prov = merge_provenance(handler_prov, facts)
    except Exception:
        logger.exception("merge_provenance failed; falling back to fact_prov only")
        merged_prov = fact_prov

    # If you want to prioritize a top-K (ensure prioritize_provenance exists)
    try:
        prioritized_prov = prioritize_provenance(merged_prov)
    except Exception:
        prioritized_prov = merged_prov or []

    # 7) Compute handler confidence using precedence: handler_confidence -> compute_confidence(signals, prov_entries)
    if handler_result.get("handler_confidence") is not None:
        try:
            final_handler_conf = float(handler_result["handler_confidence"])
        except Exception:
            final_handler_conf = 0.0
    else:
        # compute_confidence expects signals (handler_result) and prov_entries
        try:
            final_handler_conf = compute_confidence(signals=handler_result, prov_entries=prioritized_prov)
        except Exception:
            logger.exception("compute_confidence failed; defaulting to 0.0")
            final_handler_conf = 0.0

    handler_result["confidence"] = max(0.0, min(1.0, float(final_handler_conf)))

    # 8) Aggregate overall confidence (here only one handler since map is intent->handler; still use OR)
    conf_list = [handler_result.get("confidence", 0.0)]
    prod = 1.0
    for c in conf_list:
        prod *= (1.0 - float(max(0.0, min(1.0, c))))
    overall_confidence = 1.0 - prod

    # 9) Build final response structure
    final_response = {
        "request_id": act.request_id or trace_id,  # Add request_id
        "intent": act.intent,
        "decision_template": act.decision_template,
        "decision_timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "complete",  # Add explicit status
        "result": {
            "action": handler_result.get("action"),
            "items": handler_result.get("items"),
            "confidence": overall_confidence,
            "notes": handler_result.get("notes"),
        },
        "evidence": [],  # Add evidence array
        "provenance": prioritized_prov,
        "audit_trace": [],  # Add audit_trace array
        "confidence": overall_confidence,  # Add top-level confidence
        "missing": [],  # Add missing array
        "source_id": None,  # Add source_id
        "source_type": None,  # Add source_type
        "trace_id": trace_id,
    }

    # Drop debug fields not in schema
    final_response.pop("handlers", None)
    # # Ensure timestamp is ISO string
    # ts = final_response.get("decision_timestamp")
    # if not isinstance(ts, str):
    #     try:
    #         final_response["decision_timestamp"] = ts.isoformat() + "Z"
    #     except Exception:
    #         from datetime import datetime
    #         final_response["decision_timestamp"] = datetime.utcnow().isoformat() + "Z"

    # Final validation
    if DecisionResponseModel is not None:
        try:
            return DecisionResponseModel.model_validate(final_response).model_dump()
        except Exception as e:
            final_response["_validation_error"] = f"DecisionResponseModel validation failed: {e}"
    return final_response
# -------------------------------------------------------------------------

