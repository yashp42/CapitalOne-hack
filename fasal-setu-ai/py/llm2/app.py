from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Dict, List

app = FastAPI(title="LLM-2 Formatter")

class FormatRequest(BaseModel):
    structuredDecision: Dict[str, Any]
    audienceHints: Dict[str, Any] | None = None

class FormatResponse(BaseModel):
    message: str
    cards: List[Dict[str, Any]] = []

@app.post("/format", response_model=FormatResponse)
def format_(req: FormatRequest):
    # TODO: prompt + formatting; stub for now
    return FormatResponse(message="Stub formatted response", cards=[])

@app.get("/ping")
def ping():
    return {"ok": True}
