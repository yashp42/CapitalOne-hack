from fastapi import FastAPI
from typing import Any, Dict, List

try:  # package-relative imports
    from .schemas.act_request import ActRequest  # type: ignore
    from .schemas.act_response import ActResponse  # type: ignore
    from .graph.state import PlannerState, Message  # type: ignore
    from .graph.router import router_node  # type: ignore
    from .graph.tools_node import tools_node  # type: ignore
except Exception:  # fallback for script execution inside folder
    from schemas.act_request import ActRequest  # type: ignore
    from schemas.act_response import ActResponse  # type: ignore
    from graph.state import PlannerState, Message  # type: ignore
    from graph.router import router_node  # type: ignore
    from graph.tools_node import tools_node  # type: ignore

app = FastAPI(title="AI Engine (LLM-1 + Tools)")

@app.get("/ping")
def ping():
    return {"status": "ok"}

from fastapi.encoders import jsonable_encoder  # noqa: F401 (import kept if future encoding needed)

@app.post("/act", response_model=ActResponse, response_model_exclude_none=True)
def act_endpoint(request: ActRequest):
    # Build initial planner state, respecting mode
    profile = request.profile if request.mode != "public_advisor" else None
    raw_q = request.query
    # Normalize raw_q into str | List[str] | List[Message]
    if raw_q is None:
        norm_q = ""
    elif isinstance(raw_q, str):
        norm_q = raw_q
    elif isinstance(raw_q, list):
        if not raw_q:
            norm_q = ""
        elif all(isinstance(x, str) for x in raw_q):
            from typing import cast
            norm_q = cast(List[str], raw_q)
        elif all(isinstance(x, dict) and isinstance(x.get("content"), str) for x in raw_q):
            from typing import cast
            msgs: List[Message] = []
            for d in cast(List[Dict[str, Any]], raw_q):
                role_val = d.get("role") if isinstance(d.get("role"), str) else "user"
                if role_val not in {"system", "user", "assistant"}:
                    role_val = "user"
                msgs.append(Message(role=role_val, content=d.get("content", "")))
            norm_q = msgs
        else:
            norm_q = " ".join(str(x) for x in raw_q)
    else:
        norm_q = str(raw_q)

    state = PlannerState(query=norm_q, profile=profile)
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
    return {k: v for k, v in response.model_dump(exclude_none=True).items() if v is not None}


def create_app() -> FastAPI:
    """Factory for ASGI servers (uvicorn, hypercorn)."""
    return app


if __name__ == "__main__":  # Allow running via: python -m py.ai_engine.app
    import uvicorn
    import os
    
    # Get port from environment variable or use default
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    
    # When this package is on PYTHONPATH, module path is 'ai_engine.app:app'
    # Fallback: if executed via python path/to/app.py, direct app object is used
    try:
        uvicorn.run("ai_engine.app:app", host=host, port=port, reload=False)
    except Exception:
        uvicorn.run(app, host=host, port=port, reload=False)
