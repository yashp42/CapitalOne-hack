# Fasal Setu AI — Capital One Hackathon Edition

Fasal Setu AI is a rules-first, AI-assisted platform built during the **Capital One Hackathon**. It empowers farmers and agri-communities with localized decision support using LLMs, domain tools, and rule-based engines.

# Demo Credentials for deployed link
```Number: 9004246233 OTP: 123456```

---

## Getting Started

### 1) Clone the repository
```bash
git clone https://github.com/yashp42/CapitalOne-hack
cd CapitalOne-hack/fasal-setu-ai
```

### 2) Create environment files
Copy example env files and fill in secrets.
```bash
# Frontend
cp apps/frontend/.env.example apps/frontend/.env

# Server (Node.js API)
cp apps/server/.env.example apps/server/.env

# Global (for Python services / RAG)
cp .env.example .env

# If present
# cp py/ai_engine/.env.example py/ai_engine/.env
# cp py/decision_engine/.env.example py/decision_engine/.env
```

### 3) Prerequisites
- Node.js 18+
- Python 3.10+
- Git, pip/venv
- MongoDB (local or Atlas)
- Pinecone account and index
- Firebase project with **Phone Authentication** enabled

> Note: App Server and AI Engine both reference port **8080** in defaults below. If running on the same host, change one port or run on different hosts.

---

## Tech Stack

**Frontend**
- React.js (Framer Motion for micro-interactions)
- Firebase Auth (OTP for login)
- JWT session tokens

**API Gateway / App Server**
- Node.js + Express.js
- Mongoose (MongoDB for personal data only)

**AI Engine Utilities**
- LangChain
- Pinecone
- BeautifulSoup 4

**Decision Engine (rules-first)**
- Python FastAPI, Pydantic

**LLMs & Orchestration**
- LLM-1 (Planner): Gemini 2.0-flash via LangChain for data collection via tool calls
- LLM-2 (Formatter): Server-based & Perplexity Sonar for clear, localized responses and classifications
- RAG: Pinecone (primary) → local FAISS/HF ST fallback

**Domain Tools**
- Open-Meteo (weather)
- Soil/SoilGrids + OpenMeteo APIs
- Govt. mandi prices (data.gov.in)
- Crop calendars, pesticide & policy static packs
- Static CSV from WDRA registered warehouses

**Infra & DevOps**
- Vercel (web), DigitalOcean (APIs)
- `.env` with python-dotenv/decouple
- pytest + pytest-asyncio
- black/flake8/mypy
- logging + psutil for health

---

## What You Need to Initialize Yourself

To run locally, set up the following external dependencies:

1. **MongoDB** — for personal data storage (local or Atlas)
2. **Firebase** — enable **Phone Authentication** and create Web API keys
3. **Pinecone** — create an index and API key for vector storage
4. **API Keys** — as applicable: Gemini, Serper, Data.gov.in (mandi prices)

Populate all keys in the corresponding `.env` files.

---

## Local Development Setup

### Frontend
```bash
cd apps/frontend
npm install
npm start
```
Runs at → **http://localhost:3000**

### Server (Node.js API)
```bash
cd apps/server
npm install
npm run dev
```
Runs at → **http://localhost:8080**

### AI Engine (Python)
```bash
cd py/ai_engine
pip install -r requirements.txt
python app.py
```
Runs at → **http://127.0.0.1:8080**

### Decision Engine (Python)
```bash
cd py/decision_engine
pip install -r requirements.txt
python app.py
```
Runs at → **http://127.0.0.1:5000**

---

## Project Structure (High-Level)
```
CapitalOne-hack/
├── LICENSE
└── fasal-setu-ai/
    ├── apps/
    │   ├── frontend/        # React.js frontend
    │   └── server/          # Node.js + Express API
    ├── contracts/           # API contracts & datasets
    ├── data/                # Static JSON, vectors, models
    ├── py/
    │   ├── ai_engine/       # LLM orchestration
    │   └── decision_engine/ # Rules-first engine
    ├── scripts/             # Dev/start scripts
    └── tests/               # Fixtures & e2e
```

---

## Summary of Local Endpoints
- Frontend: http://localhost:3000 (Run the main app for here)
- Server (API): http://localhost:8080
- AI Engine: http://127.0.0.1:8080
- Decision Engine: http://127.0.0.1:5000
