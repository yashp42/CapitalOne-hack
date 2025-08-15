# Fasal-Setu AI (Monorepo)
Two-LLM agricultural decision assistant.
Flow: Frontend (React) → Server (Express) → LLM-1/tools (FastAPI) → Decision Engine (FastAPI) → LLM-2 (FastAPI) → Frontend.
Static JSON → optional vector RAG. Local STT/TTS via Vosk + Piper in server.

## Environment Variables
- `OPENAI_API_KEY`: OpenAI key used when no Gemini key is set.
- `GEMINI_API_KEY`: Google Gemini key. When provided, the planner uses Gemini via `langchain-google-genai`.
