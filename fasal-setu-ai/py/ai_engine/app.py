from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Support both relative and absolute imports for different deployment scenarios
try:
    from .schemas.act_request import ActRequest
    from .schemas.act_response import ActResponse
    from .graph.state import PlannerState
    from .graph.router import router_node
    from .graph.tools_node import tools_node
except ImportError:
    # Fallback for direct execution
    from schemas.act_request import ActRequest
    from schemas.act_response import ActResponse
    from graph.state import PlannerState
    from graph.router import router_node
    from graph.tools_node import tools_node

app = FastAPI(title="AI Engine (LLM-1 + Tools)")

@app.get("/ping")
def ping():
    return {"status": "ok"}

from fastapi.encoders import jsonable_encoder

@app.post("/act", response_model=ActResponse, response_model_exclude_none=True)
def act_endpoint(request: ActRequest):
    # Build initial planner state, respecting mode
    profile = request.profile if request.mode != "public_advisor" else None
    state = PlannerState(query=request.query or "", profile=profile)
    state = router_node(state)
    state = tools_node(state)
    # Build response
    response = ActResponse(
        intent=state.intent or "unknown_intent",
        decision_template=state.decision_template or "unknown_template",
        missing=state.missing,
        tool_calls=state.tool_calls,
        facts=state.facts,
        general_answer=state.general_answer,
    )
    # Remove null fields from the response dict
    resp_dict = {k: v for k, v in response.model_dump(exclude_none=True).items() if v is not None}
    return resp_dict
