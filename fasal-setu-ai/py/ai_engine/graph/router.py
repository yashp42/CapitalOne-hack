from .state import PlannerState, ToolCall

import os
import json
from pathlib import Path
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()

# Configure Gemini once at import time
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY environment variable not set.")
genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-1.5-flash")

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
        "pesticide_advice": "pesticide_safe_recommendation",
    }

    prompts_dir = Path(__file__).resolve().parent.parent / "prompts"
    system_prompt = (prompts_dir / "system.txt").read_text()
    instruction_template = (prompts_dir / "instruction.txt").read_text()
    instruction = instruction_template.format(
        intents=list(intent_templates.keys()),
        templates=list(intent_templates.values()),
        query=state.query,
        profile=json.dumps(state.profile or {}, ensure_ascii=False),
    )
    return f"{system_prompt}\n\n{instruction}"

def router_node(state: PlannerState) -> PlannerState:
    prompt = _build_planner_prompt(state)
    try:
        response = model.generate_content(prompt)
        plan = json.loads(response.text)
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