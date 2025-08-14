from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from ..graph.state import ToolCall

class ActResponse(BaseModel):
    intent: str
    decision_template: str
    missing: Optional[List[str]] = None
    tool_calls: Optional[List[ToolCall]] = None
    facts: Dict[str, Any]
