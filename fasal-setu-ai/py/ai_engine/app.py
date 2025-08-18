from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Dict

app = FastAPI(title="AI Engine (LLM-1 + Tools)")

class ActRequest(BaseModel):
    query: str | None = None
    profile: Dict[str, Any] | None = None

class ActResponse(BaseModel):
    intent: str
    facts: Dict[str, Any]

@app.post("/act", response_model=ActResponse)
def act(req: ActRequest):
    # TODO: LangGraph + tools; stub for now
    return ActResponse(intent="irrigation_advice", facts={"stub": True})

@app.get("/ping")
def ping():
    return {"ok": True}
