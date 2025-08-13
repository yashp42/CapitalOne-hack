#!/usr/bin/env bash
echo "Run these in separate terminals:"
echo "1) cd apps/server && npm install && npm run dev"
echo "2) cd py/ai_engine && uvicorn app:app --reload --port 7001"
echo "3) cd py/decision_engine && uvicorn app:app --reload --port 7002"
echo "4) cd py/llm2 && uvicorn app:app --reload --port 7003"
