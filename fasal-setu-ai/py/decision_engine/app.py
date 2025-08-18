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
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from fastapi.encoders import jsonable_encoder

# Add current directory to path for imports
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# imports for models + orchestrator with simple fallback
try:
    from models import ActIntentModel, DecisionResponseModel
    from orchestrator import process_act_intent
except ImportError as e:
    print(f"Import error: {e}")
    print("Creating minimal fallback implementations...")
    
    # Minimal fallback implementations
    from pydantic import BaseModel
    from typing import Dict, Any, List, Optional
    
    class ActIntentModel(BaseModel):
        intent: str
        decision_template: str
        tool_calls: List[Dict[str, Any]] = []
        facts: Dict[str, Any] = {}
        request_id: Optional[str] = None
    
    class DecisionResponseModel(BaseModel):
        request_id: str
        intent: str
        decision_template: str
        status: str
        notes: Optional[str] = None
        result: Dict[str, Any] = {}
        confidence: Optional[float] = None
        timestamp: str
    
    def process_act_intent(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Minimal fallback orchestrator"""
        return {
            "request_id": payload.get("request_id", "fallback"),
            "intent": payload.get("intent", "unknown"),
            "decision_template": payload.get("decision_template", "unknown"),
            "status": "fallback_mode",
            "notes": "Running in fallback mode - imports failed",
            "result": {},
            "confidence": 0.0,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("decision_engine_app")

# create FastAPI app
app = FastAPI(title="Decision Engine API", version="1.0")

# CORS: allow all origins as requested
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------
# Helper: structured error response generator
# ----------------------
def _iso_now() -> str:
    """Return current timestamp in ISO format."""
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
    """Generate a structured response matching DecisionResponseModel schema."""
    return {
        "request_id": request_id or str(uuid.uuid4()),
        "intent": intent or "unknown",
        "decision_template": decision_template or "unknown",
        "status": status,
        "notes": notes,
        "result": result or {},
        "provenance": provenance or [],
        "evidence": evidence or [],
        "audit_trace": audit_trace or [],
        "confidence": confidence,
        "missing": missing or [],
        "timestamp": _iso_now(),
    }


def _validate_and_return_response(response_dict: dict):
    """Validate response against DecisionResponseModel and return JSONResponse."""
    try:
        # Validate with Pydantic model
        validated_response = DecisionResponseModel(**response_dict)
        return JSONResponse(
            content=jsonable_encoder(validated_response.model_dump()),
            status_code=200
        )
    except ValidationError as e:
        logger.error(f"Response validation error: {e}")
        # Return a basic valid response if validation fails
        fallback_response = _make_structured_response(
            request_id=response_dict.get("request_id"),
            intent=response_dict.get("intent"),
            decision_template=response_dict.get("decision_template"),
            status="validation_error",
            notes=f"Response validation failed: {str(e)}"
        )
        return JSONResponse(content=fallback_response, status_code=200)


# ----------------------
# Exception handlers to return structured responses instead of raw 422/500
# ----------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    
    response = _make_structured_response(
        request_id=request_id,
        intent=None,
        decision_template=None,
        status="invalid_input",
        notes=f"Request validation failed: {str(exc)}"
    )
    
    return JSONResponse(content=response, status_code=400)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    
    response = _make_structured_response(
        request_id=request_id,
        intent=None,
        decision_template=None,
        status="internal_error",
        notes=f"Internal server error: {str(exc)}"
    )
    
    return JSONResponse(content=response, status_code=500)


# ----------------------
# Main endpoint
# ----------------------
@app.post("/decision", response_model=DecisionResponseModel)
async def decision_endpoint(
    body: ActIntentModel,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID")
):
    """
    Main decision endpoint that processes ActIntent and returns DecisionResponse.
    
    This endpoint accepts a JSON request body with:
    - intent: The type of decision to make (e.g., "temperature_risk", "irrigation_decision")
    - decision_template: The specific template for the decision (e.g., "frost_or_heat_risk_assessment")
    - tool_calls: Array of tool outputs from external APIs/databases
    - facts: Optional pre-processed facts dictionary
    - request_id: Optional request identifier (will be generated if not provided)
    """
    # Generate request ID if not provided
    request_id = x_request_id or body.request_id or str(uuid.uuid4())
    
    try:
        # Convert validated Pydantic model to dict
        payload = body.model_dump()
        logger.info(f"Received request {request_id}: {payload}")
        
        # Add request_id to payload
        payload["request_id"] = request_id
        
        # Forward to orchestrator
        logger.info(f"Processing request {request_id} with orchestrator")
        result = process_act_intent(payload)
        
        # Ensure result has required fields
        if not isinstance(result, dict):
            logger.error(f"Orchestrator returned non-dict result: {type(result)}")
            response = _make_structured_response(
                request_id=request_id,
                intent=payload.get("intent"),
                decision_template=payload.get("decision_template"),
                status="internal_error",
                notes="Orchestrator returned invalid result type"
            )
            return JSONResponse(content=response, status_code=500)
        
        # Add request_id to result if not present
        result["request_id"] = request_id
        
        # Validate and return response
        return _validate_and_return_response(result)
        
    except Exception as e:
        logger.error(f"Error processing request {request_id}: {e}", exc_info=True)
        # Safely get intent and decision_template from body
        intent = getattr(body, 'intent', None) if body else None
        decision_template = getattr(body, 'decision_template', None) if body else None
        
        response = _make_structured_response(
            request_id=request_id,
            intent=intent,
            decision_template=decision_template,
            status="internal_error",
            notes=f"Processing failed: {str(e)}"
        )
        return JSONResponse(content=response, status_code=500)


# ----------------------
# Root and Health check endpoints
# ----------------------
@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Decision Engine API",
        "version": "1.0",
        "status": "running", 
        "timestamp": _iso_now(),
        "endpoints": {
            "decision": "POST /decision",
            "health": "GET /ping",
            "docs": "GET /docs"
        }
    }

@app.get("/ping")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": _iso_now()}


# ----------------------
# Development server
# ----------------------
if __name__ == "__main__":
    import uvicorn
    import os
    
    # Get port from environment variable or use default
    port = int(os.getenv("PORT", 8080))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting Decision Engine API server on {host}:{port}...")
    uvicorn.run(app, host=host, port=port, reload=False, log_level="info")