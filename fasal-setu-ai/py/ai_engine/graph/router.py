
from .state import PlannerState, ToolCall

def router_node(state: PlannerState) -> PlannerState:
	# TODO: Replace stub with LangChain LLM-1 planner logic
	# Compose prompt for LLM-1 and parse output
	# For now, return a hardcoded plan for demo
	state.intent = "irrigation_decision"
	state.decision_template = "irrigation_now_or_wait"
	state.missing = ["crop"] if not state.profile or "crop" not in (state.profile or {}) else []
	state.pending_tool_calls = []
	# Example: if crop is present, plan to call weather tool
	if state.profile and "crop" in state.profile:
		state.pending_tool_calls = [
			ToolCall(tool="weather_outlook", args={"lat": 25.6, "lon": 85.1})
		]
	return state
