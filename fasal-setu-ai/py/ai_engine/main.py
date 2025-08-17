#!/usr/bin/env python3
"""
Alternative entry point for deployments that need absolute imports
"""
import sys
import os

# Add the ai_engine directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import uvicorn
    from app import app
    
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
