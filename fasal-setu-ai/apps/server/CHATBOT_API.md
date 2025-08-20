# Fasal-Setu Chatbot Flow Documentation

## Overview

The Fasal-Setu Chatbot Flow provides an intelligent agricultural advisory system that orchestrates three AI services to deliver personalized farming recommendations.

## Architecture

```
Frontend → Express Server → LLM1 (AI Engine) → Decision Engine → LLM2 (Gemini) → Frontend
```

### Flow Sequence

1. **Input Validation**: Validate message, mode, profile, and conversation
2. **LLM1 Processing**: Intent classification and data extraction
3. **Branching Logic**: Decide whether to call Decision Engine
4. **Decision Engine**: Generate specific recommendations (if applicable)
5. **LLM2 Generation**: Create final user-friendly response
6. **Response Assembly**: Combine all outputs with metadata

## API Endpoints

### POST /api/chat

Main chatbot endpoint that processes user messages and returns AI-generated responses.

#### Request Format

```json
{
  "message": "What crops should I plant this season?",
  "mode": "general",
  "profile": {
    "location": "Karnataka, India",
    "farm_size": "2 acres",
    "soil_type": "red_soil"
  },
  "conversation": [
    {
      "role": "user",
      "content": "Hello, I need farming advice"
    },
    {
      "role": "assistant",
      "content": "Hello! I'd be happy to help you with farming advice."
    }
  ]
}
```

#### Request Parameters

- **message** (string, required): User's current message/question
- **mode** (string, optional): Either "general" or "public_advisor" (default: "general")
- **profile** (object, optional): User profile information for personalized advice
- **conversation** (array, optional): Previous conversation history (default: [])

#### Response Format

```json
{
  "status": 200,
  "success": true,
  "message": "Chat response generated successfully",
  "data": {
    "answer": "Based on your location in Karnataka and red soil conditions...",
    "llm1": {
      "intent": "crop_recommendation",
      "decision_template": "crop_selection",
      "missing": [],
      "facts": {
        "location": "Karnataka, India",
        "soil_type": "red_soil",
        "season": "current"
      }
    },
    "decision": {
      "recommendation": "cotton",
      "confidence": 0.85,
      "reasoning": "Suitable for red soil in Karnataka"
    },
    "_meta": {
      "requestId": "uuid-here",
      "timings": {
        "llm1_ms": 1200,
        "decision_ms": 800,
        "llm2_ms": 1500,
        "total_ms": 3500
      },
      "mode": "general",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### GET /api/chat/health

Health check endpoint to verify all AI services are operational.

#### Response Format

```json
{
  "status": 200,
  "success": true,
  "message": "Chat service is healthy",
  "data": {
    "status": "healthy",
    "services": {
      "ai_engine": "healthy",
      "decision_engine": "healthy", 
      "gemini": "configured"
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Service Dependencies

### AI Engine (LLM1)
- **URL**: `AI_ENGINE_URL` environment variable
- **Endpoint**: `POST /act`
- **Purpose**: Intent classification and data extraction
- **Timeout**: 30 seconds

### Decision Engine
- **URL**: `DECISION_ENGINE_URL` environment variable  
- **Endpoint**: `POST /decision`
- **Purpose**: Generate specific agricultural recommendations
- **Timeout**: 25 seconds

### Gemini LLM2
- **URL**: Google Generative AI API
- **Purpose**: Generate final user-friendly responses
- **Timeout**: 20 seconds
- **Requires**: `GEMINI_API_KEY` or `GEMINI_API_SECRET`

## Error Handling

### Common Error Responses

```json
{
  "status": 400,
  "success": false,
  "message": "Message is required and must be a string"
}
```

```json
{
  "status": 500,
  "success": false,
  "message": "LLM1_INVALID_RESPONSE: Response structure is invalid"
}
```

### Error Types

1. **Validation Errors (400)**:
   - Missing or invalid message
   - Invalid mode value
   - Invalid conversation format

2. **Service Errors (500)**:
   - LLM1_INVALID_RESPONSE: AI Engine returned invalid data
   - Decision Engine timeout or failure
   - Gemini API authentication or response errors

3. **Timeout Errors (500)**:
   - Individual service timeouts
   - Overall flow timeout

## Branching Logic

The system uses intelligent branching to optimize performance:

1. **Skip Decision Engine if**:
   - Intent is "other" (general conversation)
   - LLM1 indicates missing required fields

2. **Call Decision Engine if**:
   - Intent is agricultural (crop, pest, weather, etc.)
   - All required fields are present

3. **Always call LLM2 (Gemini)** for final response generation

## Environment Variables

### Required
- `GEMINI_API_KEY` or `GEMINI_API_SECRET`: Google Gemini API key

### Optional  
- `AI_ENGINE_URL`: AI Engine service URL (default: http://localhost:7001)
- `DECISION_ENGINE_URL`: Decision Engine URL (default: http://localhost:7002)

## Performance Considerations

### Timeouts
- LLM1: 30 seconds
- Decision Engine: 25 seconds
- LLM2: 20 seconds
- Total maximum: ~75 seconds

### Retry Logic
- All services use exponential backoff retry (2 attempts)
- Automatic fallback responses for critical failures

### Response Times
- Typical: 3-8 seconds
- With Decision Engine: 5-12 seconds
- Error cases: 1-3 seconds

## Testing

Run the test script to verify functionality:

```bash
node test-chat.js
```

Test with different SERVER_URL:
```bash
SERVER_URL=https://your-production-url.com node test-chat.js
```

## Deployment Notes

1. **Environment Variables**: Ensure all required env vars are set in production
2. **Service URLs**: Update AI_ENGINE_URL and DECISION_ENGINE_URL for production
3. **Monitoring**: Monitor the /api/chat/health endpoint
4. **Rate Limiting**: Consider implementing rate limiting for production use
5. **Logging**: All requests include unique request IDs for tracing

## Security Considerations

1. **API Keys**: Store Gemini API key securely
2. **Input Validation**: All inputs are validated before processing
3. **Error Messages**: Avoid exposing internal service details
4. **Request IDs**: Use for tracking without exposing sensitive data

## Troubleshooting

### Common Issues

1. **"LLM1_INVALID_RESPONSE"**: Check AI Engine is running and accessible
2. **"Gemini API error"**: Verify API key is valid and has quota
3. **Timeout errors**: Check service availability and network connectivity
4. **CORS errors**: Ensure proper CORS configuration for frontend

### Debug Mode

Enable detailed logging by checking the server console output - each request shows:
- Request ID and timing
- Service call results
- Error details
- Response summaries
