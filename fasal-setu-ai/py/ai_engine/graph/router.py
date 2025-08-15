from .state import PlannerState, ToolCall, TOOL_NAMES

import os
import json
from pathlib import Path

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()


def _get_llm():
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set.")
    return ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=gemini_key)

model = _get_llm()

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
        tools=list(TOOL_NAMES),
        query=state.query,
        profile=json.dumps(state.profile or {}, ensure_ascii=False),
    )
    return f"{system_prompt}\n\n{instruction}"


def router_node(state: PlannerState) -> PlannerState:
    prompt = _build_planner_prompt(state)
    try:
        print("[LLM-1 Planner] Calling Gemini LLM with prompt:\n", prompt)
        response = model.invoke(prompt)
        plan = None
        resp_text = None
        # LangChain Gemini returns an object with .content for text output
        if hasattr(response, 'content'):
            content = response.content
            if isinstance(content, list):
                resp_text = "\n".join(str(x) for x in content).strip()
            elif isinstance(content, str):
                resp_text = content.strip()
        elif isinstance(response, dict):
            plan = response
            print("[LLM-1 Planner] Gemini LLM response (dict):", plan)
        else:
            resp_text = str(response).strip()
        if resp_text:
            print("[LLM-1 Planner] Gemini LLM response (raw):", resp_text)
            if resp_text.startswith('```'):
                resp_text = resp_text.lstrip('`')
                if resp_text.startswith('json'):
                    resp_text = resp_text[4:]
                resp_text = resp_text.strip()
                if resp_text.endswith('```'):
                    resp_text = resp_text[:-3].strip()
            plan = json.loads(resp_text)
        if plan is None:
            raise ValueError("LLM did not return a valid plan.")
        # Ensure intent and decision_template are always valid strings
        state.intent = plan.get("intent") or "irrigation_decision"
        state.decision_template = plan.get("decision_template") or "irrigation_now_or_wait"
        state.missing = plan.get("missing")
        state.pending_tool_calls = [ToolCall(**tc) for tc in plan.get("tool_calls", [])]
        # Handle general_answer for general/greeting queries
        state.general_answer = plan.get("general_answer")
    except Exception as e:
        print("[LLM-1 Planner] Exception occurred:", e)
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
