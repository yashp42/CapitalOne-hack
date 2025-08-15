from fastapi import FastAPI
from fastapi.responses import JSONResponse

from schemas.act_request import ActRequest
from schemas.act_response import ActResponse
from graph.state import PlannerState
from graph.router import router_node
from graph.tools_node import tools_node

app = FastAPI(title="AI Engine (LLM-1 + Tools)")

@app.get("/ping")
def ping():
    return {"status": "ok"}

@app.post("/act", response_model=ActResponse)
def act_endpoint(request: ActRequest):
    # Build initial planner state, respecting mode
    profile = request.profile if request.mode != "public_advisor" else None
    state = PlannerState(query=request.query or "", profile=profile)
    state = router_node(state)
    state = tools_node(state)
    # Build response
    response = ActResponse(
        intent=state.intent,
        decision_template=state.decision_template,
        missing=state.missing,
        tool_calls=state.tool_calls,
        facts=state.facts,
    )
    return response
