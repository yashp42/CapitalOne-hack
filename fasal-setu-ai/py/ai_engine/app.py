from fastapi import FastAPI
from .schemas.act_request import ActRequest
from .schemas.act_response import ActResponse

app = FastAPI(title="AI Engine (LLM-1 + Tools)")

@app.post("/act", response_model=ActResponse)
def act(req: ActRequest):
    # TODO: Integrate router_node and tools_node pipeline here
    # For now, return a minimal contract-compliant stub
    return ActResponse(
        intent="stub_intent",
        decision_template="stub_template",
        missing=None,
        tool_calls=None,
        facts={}
    )

@app.get("/ping")
def ping():
    return {"ok": True}
