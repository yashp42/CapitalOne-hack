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
    # Build initial planner state
    state = PlannerState(query=request.query or "", profile=request.profile)
    # Run planner LLM
    state = router_node(state)
    # Run tools
    state = tools_node(state)
    # Build response
    response = ActResponse(
        intent=state.intent,
        decision_template=state.decision_template,
        missing=state.missing,
        tool_calls=[call for call in state.pending_tool_calls] if state.pending_tool_calls else None,
        facts=state.facts,
    )
    return response
