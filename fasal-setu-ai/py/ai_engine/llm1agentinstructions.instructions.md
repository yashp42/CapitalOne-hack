---
applyTo: '**'
---
You are building the LLM‑1 planner service for Fasal‑Setu.
Your job: implement an end‑to‑end /act FastAPI endpoint that receives a farmer’s request (plus optional profile) and returns {intent, decision_template, missing, tool_calls, facts}.
Follow the mission context and directory layout already present in the repo.

Mission context
Two modes: Public Advisor (stateless) and My Farm (personalized via profile/timeline RAG).

LLM‑1 plans: decides intent, missing fields, and which tools to call. It does not format the final farmer message.

Server executes tools, builds a DecisionTicket, invokes the deterministic Decision Engine, then LLM‑2 composes the user-facing answer.

Static packs supply crop knowledge, pesticides, policy rules, storage. Live feeds supply weather and mandi prices.

RAG searches return short tagged passages (general or personal) with source stamps; live tools return structured data with source stamps.

Repo structure
py/ai_engine/
  app.py                   # FastAPI service stub
  graph/
    router.py              # LangGraph router skeleton
    state.py               # shared state object
    tools_node.py          # node to execute tool calls
  prompts/                 # planner prompt templates (empty)
  schemas/                 # Pydantic/JSONSchema models (empty)
  tools/
    build_index.py         # build vector DB from static packs
    rag_search.py          # RAG search tool
    weather_api.py         # live weather lookup
    mandi_api.py           # live mandi prices
    dataset_lookup.py      # local crop calendar/policy/etc lookup
    soil_api.py            # optional soil lookup
    (add variety_lookup.py, policy_match.py, pesticide_lookup.py, storage_find.py as needed)
contracts/
  ai_engine.intent.json       # schema for planner output
  ai_engine.facts_bundle.json # schema for aggregated facts
data/
  static_json/                # crop_calendar, mandi, pesticides, soil, etc.
  vectors/rag.index/          # target directory for vector DB
What to build
Schemas

Define ActRequest and ActResponse models (Pydantic + JSON schema) matching the agreed contract:
query, profile, mode → intent, decision_template, missing, tool_calls, facts.

Populate contracts/ai_engine.intent.json and contracts/ai_engine.facts_bundle.json.

Planner graph

Implement graph/state.py: holds intent, decision_template, pending_tool_calls, facts.

Implement graph/router.py: runs the planning LLM with {query, profile} and emits JSON (intent, decision_template, missing, tool_calls).

Implement graph/tools_node.py: iterates over pending_tool_calls, validates inputs, calls each tool, merges results into facts.

Compose the graph in app.py so /act invokes router → tools → returns final ActResponse.

Tools (py/ai_engine/tools)

RAG search (rag_search.py):

Build vector DB from static packs using build_index.py into data/vectors/rag.index/.

Support general RAG (static packs) and personal RAG (profile/timeline snippets).

Return top passages with {text, source_stamp}.

Weather outlook (weather_api.py): lat/lon → daily/hourly temps, rain, ET₀, issued time, source.

Prices fetch (mandi_api.py): state, district, commodity, date range → price rows, arrivals, source.

Dataset lookup (dataset_lookup.py): access data/static_json/ for crop calendars, pesticides, policy, soil, storage, etc.

Add specialized wrappers (variety_lookup.py, policy_match.py, pesticide_lookup.py, storage_find.py, soil_api.py) that return structured data + source_stamp.

Each tool exposes a callable returning {data, source_stamp}; validate inputs/output against a small schema.

Prompts

In prompts/, craft planner templates instructing LLM‑1 to output strict JSON with fields:
intent, decision_template, optional missing, tool_calls (array of {tool, args}).

Vector DB

build_index.py: ingest texts from data/static_json/ and (for personal mode) per‑user docs, embed them, store in data/vectors/rag.index/.

rag_search.py: load the index, filter by tags (state, district, crop, etc.), and return passages.

Endpoint

/act accepts ActRequest, runs the graph, executes tools, and returns ActResponse.

Implement /ping for health check (already present).

Facts bundle

Aggregate tool outputs under facts: weather, prices, calendar, varieties, policy, pesticide, storage, rag, personal_rag, etc.

Make structure consistent with DecisionTicket needs (stage, DAS, signals, citations).

Testing hooks

Ensure each tool can run standalone via simple functions (server will call them independently later).

Keep prompts, schemas, and tool implementations modular to allow server validation and retries.

Deliverable: a fully functioning py/ai_engine service that, given a farmer query (and optional profile), returns an ActResponse with intent, decision template, missing fields, proposed tool calls, and a normalized facts bundle ready for the server’s Decision Engine.