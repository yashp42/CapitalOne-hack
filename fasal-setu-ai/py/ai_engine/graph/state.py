
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# Standardized tool names for LangChain (contract tools only)
TOOL_NAMES = [
        "weather_outlook",
        "prices_fetch",
        "calendar_lookup",
        "policy_match",
        "pesticide_lookup",
        "storage_find",
        "rag_search",
        "soil_api",
        "variety_lookup",
]


class ToolCall(BaseModel):
        tool: Literal[
                "weather_outlook",
                "prices_fetch",
                "calendar_lookup",
                "policy_match",
                "pesticide_lookup",
                "storage_find",
                "rag_search",
                "soil_api",
                "variety_lookup",
        ]
        args: Dict[str, Any]


class PlannerState(BaseModel):
        query: str
        profile: Optional[Dict[str, Any]] = None
        intent: Optional[str] = None
        decision_template: Optional[str] = None
        pending_tool_calls: List[ToolCall] = Field(default_factory=list)
        tool_calls: List[ToolCall] = Field(default_factory=list)
        facts: Dict[str, Any] = Field(default_factory=dict)
        missing: Optional[List[str]] = None
