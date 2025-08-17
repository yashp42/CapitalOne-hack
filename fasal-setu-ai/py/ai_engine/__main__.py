#!/usr/bin/env python3
"""
Entry point for running the AI Engine as a standalone application.
"""

if __name__ == "__main__":
    import uvicorn
    from .app import app
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
