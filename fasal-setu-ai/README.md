# Fasal‑Setu AI
Two‑LLM agricultural advisory system delivering intent detection, data gathering, deterministic decisions, and natural‑language responses.

High‑Level Flow
Frontend (React) → Server (Express) → LLM‑1 Planner (/act) → domain tools → Decision Engine (/decide) → LLM‑2 Formatter (/format) → Server → Frontend.

Repository Layout
```
fasal-setu-ai/
├── apps/
│   ├── server/          # Express backend orchestrator
│   └── frontend/        # React farmer UI
├── py/
│   ├── ai_engine/       # LLM‑1 + tool graph (planner + tools)
│   ├── decision_engine/ # Deterministic rule engine
│   └── llm2/            # LLM‑2 formatter
├── contracts/           # JSON schemas & sample requests/responses
├── docker-compose.yml   # Optional multi‑service launcher (backend + python services)
└── README.md
```

Core Services
- apps/frontend: React UI (chat, my farm, profile management).
- apps/server: Node 20 Express gateway (auth, DB, STT/TTS, orchestration).
- py/ai_engine: LLM‑1 planner (/act) + tools (weather, prices, policy, pesticide, storage, web/RAG search, geocode).
- py/decision_engine: Rules convert facts → structured decision JSON (/decide).
- py/llm2: LLM‑2 formats decision to farmer‑friendly prose/cards (/format).

Data & Knowledge Sources
- Static JSON in `py/ai_engine/data/static_json/` (crop calendars, geo centroids, policy, pesticides, storage, mandi refs, soil).
- Optional RAG (Pinecone) built from `py/ai_engine/tools/rag_data/`.

## 1. Prerequisites
- Python 3.11 (match Docker images; local 3.11+ recommended)
- Node.js 20
- pip & npm
- MongoDB (for server persistence) running at `mongodb://localhost:27017` (or adjust)
- (Optional) Docker & Docker Compose
- (Optional) Pinecone account & API key for RAG

## 2. Clone
```bash
git clone <repo-url> fasal-setu-ai
cd fasal-setu-ai
```

## 3. Environment Configuration
You may keep per‑service `.env` files OR a root `.env` for shared URLs. Minimum required for local dev: service URLs + server secrets.

### 3.1 Root (optional convenience)
Create `.env` at repo root (referenced manually / by your shell):
```
TIMEZONE=Asia/Kolkata
SERVER_PORT=3000
AI_ENGINE_URL=http://localhost:7001
DECISION_ENGINE_URL=http://localhost:7002
LLM2_URL=http://localhost:7003
```

### 3.2 Server API (`apps/server/.env`)
Copy `.env.example` → `.env` then edit:
```
PORT=3000
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017
AI_ENGINE_URL=http://localhost:7001
DECISION_ENGINE_URL=http://localhost:7002
LLM2_URL=http://localhost:7003

# CORS
FRONTEND_URL=http://localhost:3000
ADDITIONAL_CORS_ORIGINS=
DEBUG_CORS=false
ALLOW_ALL_ORIGINS=false

# JWT
ACCESS_TOKEN_SECRET=change_me
REFRESH_TOKEN_SECRET=change_me
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=10d
```

### 3.3 Frontend (`apps/frontend/.env`)
```
REACT_APP_SERVER_URL=http://localhost:3000
```

### 3.4 AI Engine Tool/API Keys (`py/ai_engine/.env` or export in shell)
```
GEMINI_API_KEY=your_google_genai_key          # LLM‑1 planner
PINECONE_API_KEY=your_pinecone_key            # Enable RAG (optional)
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PINECONE_INDEX=rag-llm1
PINECONE_NAMESPACE=default
EMBED_MODEL=llama-text-embed-v2
SERPER_API_KEY=...                            # web search (Google SERP)
BRAVE_API_KEY=...                             # web search
BING_API_KEY=...                              # fallback web search (optional)
DATA_GOV_IN_API_KEY=...                       # mandi prices (if required by dataset)
CHUNK_SIZE=1000                               # RAG chunk params (optional)
CHUNK_OVERLAP=120
TOP_K=5
```

> Missing keys: Non‑critical tools degrade (e.g. RAG disabled) except GEMINI_API_KEY which is required for planning.

## 4. Installation
Use a single Python venv for all Python services.
```bash
cd py
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
```

Install per service:
```bash
pip install -r ai_engine/requirements.txt
pip install -r decision_engine/requirements.txt
pip install -r llm2/requirements.txt

cd ../apps/server && npm install
cd ../frontend && npm install
```

## 5. Default Ports
| Service | Port |
|---------|------|
| Server (Node) | 3000 |
| Frontend (React dev) | 3000 / 3001 (if 3000 taken) |
| AI Engine | 7001 |
| Decision Engine | 7002 |
| LLM‑2 | 7003 |

Override Python service port via `PORT` or uvicorn flag.

## 6. Run (Manual Sequence)
AI Engine:
```bash
cd py/ai_engine
uvicorn app:app --host 0.0.0.0 --port 7001 --reload
```
Decision Engine:
```bash
cd py/decision_engine
uvicorn app:app --host 0.0.0.0 --port 7002 --reload
```
LLM‑2:
```bash
cd py/llm2
uvicorn app:app --host 0.0.0.0 --port 7003 --reload
```
Server:
```bash
cd apps/server
npm run dev
```
Frontend:
```bash
cd apps/frontend
npm run start:local
```

Flow: Frontend → Server → /act (7001) → /decide (7002) → /format (7003) → UI.

## 7. Docker Compose (Backend + Python Services)
```bash
docker compose up --build
```
Starts: server:3000, ai_engine:7001, decision_engine:7002, llm2:7003. (Frontend not defined; run separately.)

## 8. RAG Index (Optional Pinecone)
Place .txt / .json under `py/ai_engine/tools/rag_data/` then build:
```bash
cd py/ai_engine/tools
python rag_search.py build --namespace default
```
Search:
```bash
python rag_search.py search -q "paddy irrigation schedule" --top-k 5
```
If `PINECONE_API_KEY` absent the script may exit (add a key or implement a local fallback).

## 9. Example Requests
Planner:
```bash
curl -X POST http://localhost:7001/act -H "Content-Type: application/json" -d '{"query":"weather at Kolhapur","mode":"public_advisor"}'
```
Decision Engine:
```bash
curl -X POST http://localhost:7002/decide -H "Content-Type: application/json" -d @contracts/decision.request.json
```
LLM‑2:
```bash
curl -X POST http://localhost:7003/format -H "Content-Type: application/json" -d '{"intent":"irrigation_decision","decision_template":"irrigation_now_or_wait","facts":{}}'
```

## 10. Data Updates
Edit / add JSON under `py/ai_engine/data/static_json/` (follow schemas in `contracts/datasets/*.schema.json`). Rebuild RAG if those files feed retrieval.

## 11. Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 404 /act | AI Engine not running | Start uvicorn on 7001 |
| Geocode error | Planner missing district/state | Ensure prompt forces both fields |
| RAG build exit | Missing Pinecone key | Add key or skip RAG tool usage |
| Empty web results | No API keys (Serper/Brave) | Provide at least one key |
| CORS blocked | FRONTEND_URL mismatch | Align frontend URL in server .env |
| Auth failures | Bad JWT secrets | Regenerate ACCESS/REFRESH keys |
| Mongo connect error | DB not running / wrong URL | Start Mongo or adjust DATABASE_URL |

## 12. Production Notes
- Pin dependency versions (current ai_engine uses broad `>=`).
- Use process manager (systemd/PM2) or containers.
- Harden CORS, disable `ALLOW_ALL_ORIGINS`.
- Store secrets outside repo (.env not committed).
- Add structured logging & metrics (e.g. request timings per tool).
- Consider local embedding fallback to avoid hard dependency on Pinecone.

## 13. Extending
Add a tool: implement in `py/ai_engine/tools/`, register in tools_node map, update planner prompt with purpose.
Add intent: update planner prompt + decision rules + LLM‑2 templates.

## 14. License / Attribution
Add license details here.

---
For enhancements (local vector fallback, batch mandi ingestion, caching) open an issue or extend this file.

## 1. Clone
```bash
git clone <repo-url> fasal-setu-ai
cd fasal-setu-ai
```

## 2. Environment Overview
You can run everything:
1. Locally (recommended during development).
2. With Docker Compose (quick multi-service spin‑up).
3. Mixed (e.g. Node locally, Python services via Docker).

### Ports (default)
| Service | Port |
|---------|------|
| Frontend | 3000 (same as server in dev if proxied) |
| Server (Node) | 3000 |
| AI Engine (LLM‑1) | 7001 |
| Decision Engine | 7002 |
| LLM‑2 | 7003 |

Adjust via env `PORT` for each Python service or `PORT` in server .env.

## 3. Node Server Setup (`apps/server`)
### 3.1 Create env file
Copy `.env.example` → `.env` and fill secrets:
```
PORT=3000
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017
AI_ENGINE_URL=http://localhost:7001
DECISION_ENGINE_URL=http://localhost:7002
LLM2_URL=http://localhost:7003
FRONTEND_URL=http://localhost:3000
ALLOW_ALL_ORIGINS=true
ACCESS_TOKEN_SECRET=replace-me
REFRESH_TOKEN_SECRET=replace-me
```
Optional: set `ADDITIONAL_CORS_ORIGINS`, disable `ALLOW_ALL_ORIGINS` for production.

### 3.2 Install & run
```bash
cd apps/server
npm install
npm run dev
```
Server runs on http://localhost:3000 .

## 4. Frontend Setup (`apps/frontend`)
### 4.1 Env
Copy `.env.example` → `.env` (or `.env.local`). Adjust if server not on 3000.
```
REACT_APP_SERVER_URL=http://localhost:3000
```
### 4.2 Install & run
```bash
cd apps/frontend
npm install
npm run start:local
```
Visit http://127.0.0.1:3000 (or displayed host) for UI.

## 5. Python Services Common Setup
You can use one shared virtual environment for all Python services.
```bash
cd py
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
```

### 5.1 AI Engine (`py/ai_engine`)
Install deps:
```bash
pip install -r ai_engine/requirements.txt
```
Env (.env in `py/ai_engine/` or repo root) typical keys:
```
GEMINI_API_KEY=your_google_genai_key
PINECONE_API_KEY=your_pinecone_key   # (optional if RAG off)
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PINECONE_INDEX=rag-llm1
PINECONE_NAMESPACE=default
EMBED_MODEL=llama-text-embed-v2
SERPER_API_KEY=...        # optional web search
BRAVE_API_KEY=...         # optional web search
```
Run service:
```bash
cd ai_engine
uvicorn app:app --reload --port 7001
```
Health: GET http://localhost:7001/ping
Plan+tools: POST http://localhost:7001/act

### 5.2 Decision Engine (`py/decision_engine`)
```bash
pip install -r decision_engine/requirements.txt
cd decision_engine
uvicorn app:app --reload --port 7002
```
Health: `GET /ping` (if implemented) else directly test `POST /decide` with sample in `contracts/decision.request.json`.

### 5.3 LLM‑2 Composer (`py/llm2`)
```bash
pip install -r llm2/requirements.txt
cd llm2
uvicorn app:app --reload --port 7003
```
Format endpoint: `POST /format`.

## 6. RAG Index (Optional)
Place corpus files under `py/ai_engine/tools/rag_data/` (txt/json). Then:
```bash
cd py/ai_engine/tools
python rag_search.py build --namespace default
```
Search test:
```bash
python rag_search.py search -q "paddy irrigation schedule" --top-k 5
```
If you skip Pinecone keys the current script may exit; add the key or implement a local fallback.

## 7. Tooling Summary
| Tool | Purpose | Endpoint / Invocation |
|------|---------|-----------------------|
| /act | LLM‑1 planner + tool exec | FastAPI ai_engine |
| /decide | Decision logic | decision_engine |
| /format | Natural language answer | llm2 |

## 8. Running All via Docker Compose
Ensure Docker is installed, then from repo root:
```bash
docker compose up --build
```
Services exposed: 3000 (server), 7001, 7002, 7003. Edit compose env variables or pass overrides with `--env-file` if needed. Frontend still runs separately (compose currently defines only backend & Python services; run frontend locally or add a service block).

## 9. Typical Dev Loop
1. Start Python services (7001,7002,7003).
2. Start Node server (3000).
3. Start frontend (if distinct) or use server endpoints directly.
4. Issue chat request: frontend → /api/chat → orchestrates /act → /decide → /format.

## 10. Example Requests
LLM‑1 planning:
```bash
curl -X POST http://localhost:7001/act -H "Content-Type: application/json" -d '{"query":"weather at Kolhapur","mode":"public_advisor"}'
```
Decision Engine:
```bash
curl -X POST http://localhost:7002/decide -H "Content-Type: application/json" -d @contracts/decision.request.json
```
LLM‑2 formatting:
```bash
curl -X POST http://localhost:7003/format -H "Content-Type: application/json" -d '{"intent":"irrigation_decision","decision_template":"irrigation_now_or_wait","facts":{}}'
```

## 11. Data Updates
Add or modify static JSON under `py/ai_engine/data/static_json/`. Keep schemas aligned with those in `contracts/datasets/*.schema.json`.

## 12. Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 on /act | Service not started | Run uvicorn for ai_engine |
| Geocode errors | Missing district/state in request | Ensure planner prompt forces both |
| RAG build exit | Missing Pinecone key | Add key or skip RAG integration |
| CORS blocked | FRONTEND_URL mismatch | Update server .env FRONTEND_URL |
| Token errors | Bad JWT secrets | Regenerate ACCESS/REFRESH secrets |

## 13. Production Notes
- Use process managers (systemd, PM2) or containers.
- Pin Python dependency versions if reproducibility required.
- Configure logging & monitoring (e.g., Prometheus exporters per service).
- Harden CORS and secrets; disable `ALLOW_ALL_ORIGINS`.

## 14. License / Attribution
Add your license info here.

---
For advanced setup (local embeddings fallback, batch price ingestion) open an issue or extend this README.
