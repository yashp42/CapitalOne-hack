# app.py
"""
FastAPI app that exposes POST /decision and forwards requests to orchestrator.process_act_intent.

Behavior (per user instructions):
- Endpoint: POST /decision
- Validates incoming JSON against ActIntentModel (pydantic) if available.
- Attaches/propagates a request_id header (X-Request-ID) — if header absent, generates a UUID4.
- Forwards the payload (as dict) to orchestrator.process_act_intent(payload: dict).
- Validates/normalizes the response with DecisionResponseModel (pydantic) if available.
- CORS: allow all origins.
- On validation errors or unexpected exceptions, returns a structured DecisionResponseModel-like response
  with an appropriate `status` ("invalid_input" / "handler_not_found" / etc.) rather than raising raw HTTP 500.
- Includes an optional `uvicorn` run block for local execution on port 8000.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional
import logging
from fastapi.encoders import jsonable_encoder
from datetime import timezone

from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

# imports for models + orchestrator (use package absolute imports)
# imports for models + orchestrator (use package absolute imports)
try:
    from decision_engine.models import ActIntentModel, DecisionResponseModel
except Exception as e:
    import sys
    print("Failed to import decision_engine.models; ensure package has __init__.py and run with -m from parent dir", file=sys.stderr)
    raise

try:
    # orchestrator entrypoint: import and alias to `process_act_intent` used below
    from decision_engine.orchestrator import process_act_intent
except Exception as e:
    import sys
    print("Failed to import decision_engine.orchestrator.orchestrate_act_intent", file=sys.stderr)
    raise


# configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("decision_engine_app")

# create FastAPI app
app = FastAPI(title="Decision Engine API", version="1.0")

# CORS: allow all origins as requested
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------
# Helper: structured error response generator
# ----------------------
def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_structured_response(
    request_id: Optional[str],
    intent: Optional[str],
    decision_template: Optional[str],
    status: str,
    notes: Optional[str] = None,
    result: Optional[dict] = None,
    provenance: Optional[list] = None,
    evidence: Optional[list] = None,
    audit_trace: Optional[list] = None,
    confidence: Optional[float] = None,
    missing: Optional[list] = None,
) -> dict:
    """
    Build a dictionary shaped like DecisionResponseModel for error/normal replies.
    If DecisionResponseModel is available, we'll try to instantiate it later for validation.
    """
    payload = {
        "request_id": request_id,
        "intent": intent or "",
        "decision_template": decision_template or "",
        "decision_timestamp": _iso_now(),
        "status": status,
        "result": result or None,
        "evidence": evidence or [],
        "provenance": provenance or [],
        "audit_trace": audit_trace or [],
        "confidence": confidence,
        "missing": missing or [],
        "source_id": None,
        "source_type": None,
    }
    if notes:
        # attach notes inside result if present, to match model shape more directly
        if payload["result"] is None:
            payload["result"] = {"action": status, "items": [], "confidence": confidence or 0.0, "notes": notes}
        else:
            if isinstance(payload["result"], dict):
                payload["result"].setdefault("notes", notes)
            else:
                payload["result"] = {"action": status, "items": [], "confidence": confidence or 0.0, "notes": notes}
    return payload


def _validate_and_return_response(response_dict: dict):
    """
    If DecisionResponseModel is available, validate by instantiating; otherwise return raw dict.
    On validation failure, return the raw dict (but log debug).
    """
    if DecisionResponseModel is None:
        return JSONResponse(content=jsonable_encoder(response_dict), status_code=200)
    try:
        # DecisionResponseModel will coerce types where possible
        model = DecisionResponseModel(**response_dict)
        return JSONResponse(content=jsonable_encoder(response_dict), status_code=200)
    except Exception as e:
        logger.debug("DecisionResponseModel validation failed: %s", e, exc_info=True)
        # Return raw dict to avoid raising server error
        safe_payload = jsonable_encoder(model)
        return JSONResponse(content=safe_payload, status_code=200)


# ----------------------
# Exception handlers to return structured responses instead of raw 422/500
# ----------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    This catches FastAPI / pydantic validation errors for request body / query params.
    We return a structured DecisionResponseModel-like payload with status 'invalid_input'.
    """
    # attempt to extract request_id and minimal intent info from the request body if present
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    intent = None
    decision_template = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            intent = body.get("intent")
            decision_template = body.get("decision_template")
    except Exception:
        pass

    payload = _make_structured_response(
        request_id=request_id,
        intent=intent,
        decision_template=decision_template,
        status="invalid_input",
        notes=f"Request validation error: {exc}",
    )
    return _validate_and_return_response(payload)


@app.exception_handler(ValidationError)
async def pydantic_validation_handler(request: Request, exc: ValidationError):
    # generic pydantic validation errors (safety)
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    payload = _make_structured_response(
        request_id=request_id,
        intent=None,
        decision_template=None,
        status="invalid_input",
        notes=f"Pydantic validation error: {exc}",
    )
    return _validate_and_return_response(payload)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler for unexpected exceptions — return structured payload with status 'invalid_input'.
    """
    logger.exception("Unhandled exception during request processing")
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    intent = None
    decision_template = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            intent = body.get("intent")
            decision_template = body.get("decision_template")
    except Exception:
        pass

    payload = _make_structured_response(
        request_id=request_id,
        intent=intent,
        decision_template=decision_template,
        status="invalid_input",
        notes=f"Internal server error: {str(exc)}",
    )
    return _validate_and_return_response(payload)


# ----------------------
# POST /decision endpoint
# ----------------------
@app.post("/decision")
async def decision_endpoint(
    act_intent: ActIntentModel,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
):
    """
    Receives ActIntentModel (validated by FastAPI/pydantic), forwards dict payload to orchestrator.process_act_intent,
    and returns a DecisionResponseModel-structured JSON response.

    Request ID:
      - If header X-Request-ID present, it is propagated.
      - Otherwise, a UUID4 is generated and injected into the payload as `request_id`.
    """
    # ensure we have a request id
    request_id = x_request_id or str(uuid.uuid4())

    # convert incoming pydantic model to dict
    # If act_intent is a pydantic model, use model_dump() for Pydantic v2
    try:
        payload = act_intent.model_dump()  # pydantic v2
    except Exception:
        # fallback for pydantic v1 or non-model
        try:
            payload = act_intent.dict()
        except Exception:
            payload = dict(act_intent) if isinstance(act_intent, dict) else {}
    # Ensure JSON-safe
    payload = jsonable_encoder(payload)


    # attach request id (overwrites if an incoming field exists)
    payload["request_id"] = request_id

    # Forward to orchestrator
    try:
        result = process_act_intent(payload)
    except Exception as e:
        # If orchestrator raised unexpectedly, return structured error response
        logger.exception("orchestrator.process_act_intent raised an exception")
        resp_payload = _make_structured_response(
            request_id=request_id,
            intent=payload.get("intent"),
            decision_template=payload.get("decision_template"),
            status="invalid_input",
            notes=f"orchestrator failure: {str(e)}",
        )
        return _validate_and_return_response(resp_payload)

    # If orchestrator returned a dict-like response, try to validate with DecisionResponseModel
    if isinstance(result, dict):
        # Ensure some expected top-level fields are present; if not, enrich them
        result.setdefault("request_id", request_id)
        result.setdefault("intent", payload.get("intent"))
        result.setdefault("decision_template", payload.get("decision_template"))
        result.setdefault("decision_timestamp", _iso_now())
        # Validate/create DecisionResponseModel if available
        return _validate_and_return_response(result)

    # If orchestrator returned non-dict (unexpected), wrap it
    resp_payload = _make_structured_response(
        request_id=request_id,
        intent=payload.get("intent"),
        decision_template=payload.get("decision_template"),
        status="invalid_input",
        notes=f"orchestrator returned unexpected type: {type(result).__name__}",
        result={"action": "invalid_output", "items": [], "confidence": 0.0},
    )
    return _validate_and_return_response(resp_payload)

# ----------------------
# Run block for local testing
# ----------------------
if __name__ == "__main__":
    import uvicorn

    # run the FastAPI app directly (use app object to avoid import path issues)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

