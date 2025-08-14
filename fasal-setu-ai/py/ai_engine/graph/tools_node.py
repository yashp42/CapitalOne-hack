


from .state import PlannerState, ToolCall
from langchain.tools import Tool
from ..tools.rag_search import rag_search
from ..tools.weather_api import weather_outlook
from ..tools.mandi_api import prices_fetch
from ..tools.dataset_lookup import calendar_lookup

from ..tools.pesticide_lookup import pesticide_lookup
from ..tools.storage_find import storage_find

# Register tools with LangChain (contract tools only)
TOOL_MAP = {
	"weather_outlook": Tool.from_function(weather_outlook, name="weather_outlook", description="Get weather outlook for a location."),
	"prices_fetch": Tool.from_function(prices_fetch, name="prices_fetch", description="Fetch mandi prices for a commodity."),
	"calendar_lookup": Tool.from_function(calendar_lookup, name="calendar_lookup", description="Lookup crop calendar information."),
	"pesticide_lookup": Tool.from_function(pesticide_lookup, name="pesticide_lookup", description="Lookup pesticide information."),
	"storage_find": Tool.from_function(storage_find, name="storage_find", description="Find storage options."),
	"rag_search": Tool.from_function(rag_search, name="rag_search", description="Retrieve relevant knowledge passages (RAG)."),
}

def tools_node(state: PlannerState) -> PlannerState:
	# TODO: Replace stub with LangChain tool execution logic
	# Iterate over pending_tool_calls and execute each tool using LangChain's tool registry
	for call in state.pending_tool_calls:
		tool = TOOL_MAP.get(call.tool)
		if tool:
			result = tool.run(call.args)
			state.facts[call.tool] = result
		else:
			state.facts[call.tool] = {"error": "Tool not found"}
	state.pending_tool_calls = []  # Clear after execution
	return state
