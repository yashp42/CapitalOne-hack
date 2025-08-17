from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# Standardized tool names for LangChain (contract tools only)
TOOL_NAMES = [
                "geocode_tool",
                "weather_outlook", 
                "prices_fetch",
                "regional_crop_info",
                "policy_match",
                "pesticide_lookup",
                "storage_find",
                "rag_search",
                "soil_api",
                "web_search",
]


class ToolCall(BaseModel):
        tool: Literal[
                "geocode_tool",
                "weather_outlook",
                "prices_fetch",
                "regional_crop_info",
                "policy_match",
                "pesticide_lookup",
                "storage_find",
                "rag_search",
                "soil_api",
                "web_search",
        ]
        args: Dict[str, Any]


class PlannerState(BaseModel):
        query: str
        profile: Optional[Dict[str, Any]] = None
        intent: Optional[str] = None
        mode: str="public_advisor"
        decision_template: Optional[str] = None
        pending_tool_calls: List[ToolCall] = Field(default_factory=list)
        tool_calls: List[ToolCall] = Field(default_factory=list)
        facts: Dict[str, Any] = Field(default_factory=dict)
        missing: Optional[List[str]] = None
        general_answer: Optional[str] = None
