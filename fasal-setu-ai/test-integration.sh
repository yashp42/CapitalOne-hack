#!/bin/bash

echo "=== Testing Crop Simulation Chat Integration ==="

# Start the LLM2 detection service in background
echo "Starting LLM2 Detection Service..."
cd py/llm2_detection
python app.py &
LLM2_PID=$!
sleep 3

# Start the main server
echo "Starting Node.js server..."
cd ../../apps/server
npm start &
SERVER_PID=$!
sleep 5

# Test the endpoint
echo "Testing crop simulation chat endpoint..."
curl -X POST "http://localhost:8080/api/crop-sim/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "message": "I watered my crops today",
    "cropId": "test123",
    "farmContext": {
      "weather": {
        "current": "Sunny",
        "temperature": 25
      }
    }
  }'

echo ""
echo "=== Cleanup ==="
kill $LLM2_PID $SERVER_PID
echo "Services stopped."
