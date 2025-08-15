from .state import PlannerState, ToolCall

# --- LLM-1 planner logic using LangChain and OpenRouter ---
import os
import json
from langchain.chat_models import ChatOpenAI

def _build_planner_prompt(state: PlannerState) -> str:
    """
    Compose the planner prompt for LLM-1. Instructs the LLM to output strict JSON with:
    intent, decision_template, missing (optional), tool_calls (array of {tool, args}).
    """
    intent_templates = {
        "irrigation_decision": "irrigation_now_or_wait",
        "variety_selection": "variety_ranked_list",
        "temperature_risk": "frost_or_heat_risk_assessment",
        "market_advice": "sell_or_hold_decision",
        "credit_policy_match": "ranked_credit_options",
        "pesticide_advice": "pesticide_safe_recommendation"
    }
    prompt = f"""
You are the LLM-1 planner for a farm advisory system. Given a farmer's query and profile, output a JSON object with:
- intent: one of {list(intent_templates.keys())}
- decision_template: one of {list(intent_templates.values())}
- missing: (optional) list of missing fields
- tool_calls: array of {{tool, args}} to fetch facts needed for the decision

Query: {state.query}
Profile: {json.dumps(state.profile or {}, ensure_ascii=False)}

Respond ONLY with a JSON object with keys: intent, decision_template, missing (optional), tool_calls.
"""
    return prompt

def router_node(state: PlannerState) -> PlannerState:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    api_url = os.environ.get("OPENROUTER_API_URL")
    llm = ChatOpenAI(
        openai_api_key=api_key,
        openai_api_base=api_url,
        model="gpt-oss-20b",
        temperature=0.0,
    )

    prompt = _build_planner_prompt(state)
    try:
        response = llm.predict(prompt)
        plan = json.loads(response)
        state.intent = plan.get("intent")
        state.decision_template = plan.get("decision_template")
        state.missing = plan.get("missing")
        state.pending_tool_calls = [ToolCall(**tc) for tc in plan.get("tool_calls", [])]
    except Exception as e:
        # Fallback: hardcoded plan for demo or error
        state.intent = "irrigation_decision"
        state.decision_template = "irrigation_now_or_wait"
        state.missing = ["crop"] if not state.profile or "crop" not in (state.profile or {}) else []
        state.pending_tool_calls = []
        if state.profile and "crop" in state.profile:
            state.pending_tool_calls = [
                ToolCall(tool="weather_outlook", args={"lat": 25.6, "lon": 85.1})
            ]
    return state