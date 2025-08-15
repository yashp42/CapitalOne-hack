# NOTE: This file imports some tools from Jupyter notebooks (weather_api.ipynb, mandi_api.ipynb).
# To use these imports in a pure Python environment, you must install nbimporter and ensure the notebooks are in the correct location.
# If running in Jupyter or with nbimporter, the tools will be available as modules. Otherwise, stub functions are used.

import logging

# Import notebook tools using nbimporter or direct notebook execution
try:
        import nbimporter
except ImportError:
        nbimporter = None

from ..tools.dataset_lookup import calendar_lookup
from ..tools.pesticide_lookup import pesticide_lookup
from ..tools.storage_find import storage_find
from ..tools.policy_match import policy_match
from ..tools.soil_api import soil_api
from ..tools.variety_lookup import variety_lookup
from ..tools.web_search import web_search
from .state import PlannerState, ToolCall

logger = logging.getLogger(__name__)

# Import weather tool from notebook
try:
        if nbimporter:
                from ..tools.weather_api import LC_TOOL as weather_outlook
        else:
                from ..tools.weather_api import LC_TOOL as weather_outlook
except ImportError:
        def weather_outlook(args):
                return {"data": {}, "source_stamp": "weather_stub"}

# Import mandi tool from notebook
try:
        if nbimporter:
                from ..tools.mandi_api import prices_fetch
        else:
                from ..tools.mandi_api import prices_fetch
except ImportError:
        def prices_fetch(args):
                return {"data": [], "source_stamp": "mandi_stub"}

# Import rag tool from module (fallback to stub if unavailable)
try:
        from ..tools.rag_search import rag_search
except Exception:  # pragma: no cover - provide graceful fallback
        def rag_search(args):
                return {"data": [], "source_stamp": "rag_stub"}

# Register tools with LangChain (contract tools only)
TOOL_MAP = {
        "weather_outlook": weather_outlook,
        "prices_fetch": prices_fetch,
        "calendar_lookup": calendar_lookup,
        "variety_lookup": variety_lookup,
        "policy_match": policy_match,
        "pesticide_lookup": pesticide_lookup,
        "storage_find": storage_find,
        "rag_search": rag_search,
        "soil_api": soil_api,
        "web_search": web_search,
}

def tools_node(state: PlannerState) -> PlannerState:
        executed_calls = list(state.pending_tool_calls)
        # Iterate over pending_tool_calls and execute each tool using TOOL_MAP
        for call in executed_calls:
                tool = TOOL_MAP.get(call.tool)
                if tool:
                        try:
                                # Support both LangChain Tool/StructuredTool and plain function
                                if hasattr(tool, "invoke"):
                                        result = tool.invoke(call.args)
                                elif hasattr(tool, "run"):
                                        result = tool.run(call.args)
                                else:
                                        result = tool(call.args)
                        except Exception as exc:  # pragma: no cover - log and continue
                                logger.exception("Tool %s failed", call.tool)
                                result = {"error": str(exc)}
                        state.facts[call.tool] = result
                else:
                        state.facts[call.tool] = {"error": "Tool not found"}
        state.tool_calls.extend(executed_calls)
        state.pending_tool_calls.clear()  # Clear after execution
        return state
