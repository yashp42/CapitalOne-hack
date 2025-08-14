
from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel




# Standardized tool names for LangChain (contract tools only)
TOOL_NAMES = [
	"weather_outlook",
	"prices_fetch",
	"calendar_lookup",
	"policy_match",
	"pesticide_lookup",
	"storage_find",
	"rag_search"
]


class ToolCall(BaseModel):
	tool: Literal[
		"weather_outlook",
		"prices_fetch",
		"calendar_lookup",
		"policy_match",
		"pesticide_lookup",
		"storage_find",
		"rag_search"
	]
	args: Dict[str, Any]


class PlannerState(BaseModel):
	query: str
	profile: Optional[Dict[str, Any]] = None
	intent: Optional[str] = None
	decision_template: Optional[str] = None
	pending_tool_calls: List[ToolCall] = []
	facts: Dict[str, Any] = {}
	missing: Optional[List[str]] = None
