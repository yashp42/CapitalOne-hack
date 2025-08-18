from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Dict

app = FastAPI(title="Decision Engine")

class DecideRequest(BaseModel):
    intent: str
    facts: Dict[str, Any]
    profile: Dict[str, Any] | None = None

@app.post("/decide")
def decide(req: DecideRequest):
    # TODO: rules; stub for now
    return {"task": req.intent, "recommendation": {"action": "Wait", "reason": "stub"}}

@app.get("/ping")
def ping():
    return {"ok": True}
