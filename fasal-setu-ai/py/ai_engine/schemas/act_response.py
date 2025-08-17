from typing import Any, Dict, List

from pydantic import BaseModel, Field

try:
    from ..graph.state import ToolCall
except ImportError:
    from graph.state import ToolCall


class ActResponse(BaseModel):
    intent: str
    decision_template: str
    missing: List[str] | None = None
    tool_calls: List[ToolCall] = Field(default_factory=list)
    facts: Dict[str, Any]
    general_answer: str | None = None
