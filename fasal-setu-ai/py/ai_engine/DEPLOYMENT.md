# AI Engine Deployment

This is the self-contained AI Engine FastAPI application for agricultural advisory services.

## Files for Deployment:

- `app.py` - Main FastAPI application
- `main.py` - Entry point for deployment (handles import paths)
- `requirements.txt` - Python dependencies
- `Procfile` - Process file for Heroku/Railway/etc.
- `runtime.txt` - Python version specification
- `.env` - Environment variables (contains API keys)
- `data/` - Static data files (mandi prices, crop calendar, etc.)
- `graph/` - AI planning logic
- `schemas/` - Pydantic models
- `tools/` - Individual AI tools (weather, soil, geocoding, etc.)

## Environment Variables Required:

- `GEMINI_API_KEY` - Google Gemini API key for LLM
- `PINECONE_API_KEY` - Pinecone vector database key (optional)
- `SERPER_API_KEY` - Serper web search API key (optional)
- `DATA_GOV_IN_API_KEY` - Data.gov.in API key (optional)

## Deployment Commands:

### Heroku:
```bash
git init
git add .
git commit -m "Initial deployment"
heroku create your-app-name
git push heroku main
```

### Railway:
```bash
railway login
railway new
railway up
```

### Local Development:
```bash
python main.py
# or
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints:

- `GET /ping` - Health check
- `POST /act` - Main AI advisory endpoint

The application is now fully self-contained and deployment-ready!
