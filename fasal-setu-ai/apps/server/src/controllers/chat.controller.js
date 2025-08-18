import { ApiResponse } from "../util/ApiResponse.js";
import { ApiError } from "../util/ApiError.js";
import asyncErrorHandler from "../util/asyncErrorHandler.js";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

// Import the service clients
import { callAIEngine } from "../services/aiEngine.client.js";
import { callDecision } from "../services/decision.client.js";
import { saveConversation } from "./conversation.controller.js";

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_SECRET || process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

// LLM2 System Prompt
const LLM2_SYSTEM_PROMPT = `You are LLM2, the final answerer for Fasal-Setu (agricultural advisory).
You will receive:
1) The user's conversation and latest query.
2) LLM1 planner output (intent, decision_template, facts, tool calls).
3) Decision Engine output (may be valid, invalid, or absent).

Rules:
- If LLM1.missing has values: do not hallucinate. Instead, politely ask the user for those specific values before giving a recommendation.
- If intent is "other": ignore Decision Engine, answer reasonably using LLM1 facts + user query.
- If Decision Engine output is valid and consistent with LLM1 facts: base your plain-text answer on it.
- If Decision Engine is missing/invalid: answer from LLM1 facts and user query, clearly state uncertainty, and give safe fallback advice.
- Be concise, farmer-friendly, ≤180 words. Do not output JSON. Plain text only.
- Never invent numbers or weather. Only use facts provided. If data is insufficient, say what is missing.
- Always output in the role of an advisor, not as a system log.
- Lastly if you could not figure out an answer, use your capabilities now but also acknowledge the limitations of the information available.`;

// Timeout utilities
const withTimeout = (promise, timeoutMs, operation) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Retry utility
const withRetry = async (fn, retries = 2, delay = 1000) => {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  throw lastError;
};

// Enhanced AI Engine client
const callAIEngineEnhanced = async (payload, requestId) => {
  const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:7001';
  
  console.log(`[${requestId}] Calling LLM1 at ${AI_ENGINE_URL}/act`);
  
  const aiEngineCall = async () => {
    const response = await fetch(`${AI_ENGINE_URL}/act`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`AI Engine responded with ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`[${requestId}] LLM1 response:`, JSON.stringify(data, null, 2));
    return data;
  };

  return await withTimeout(
    withRetry(aiEngineCall, 2), 
    30000, 
    'LLM1 call'
  );
};

// Enhanced Decision Engine client
const callDecisionEngineEnhanced = async (payload, requestId) => {
  const DECISION_ENGINE_URL = process.env.DECISION_ENGINE_URL || 'http://localhost:7002';
  
  console.log(`[${requestId}] Calling Decision Engine at ${DECISION_ENGINE_URL}/decision`);
  
  const decisionCall = async () => {
    const response = await fetch(`${DECISION_ENGINE_URL}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Decision Engine responded with ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`[${requestId}] Decision Engine response:`, JSON.stringify(data, null, 2));
    return data;
  };

  return await withTimeout(
    withRetry(decisionCall, 2), 
    25000, 
    'Decision Engine call'
  );
};

// Gemini LLM2 client with enhanced error handling
const callGeminiLLM2 = async (conversation, llm1Response, decisionOutput, requestId) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key') {
    throw new Error('Gemini API key not configured');
  }

  console.log(`[${requestId}] Calling Gemini LLM2 (1.5 Pro)`);

  // Extract useful information even from error responses
  const extractUsefulData = (data) => {
    const extracted = {};
    
    if (data && typeof data === 'object') {
      // Extract intent if available
      if (data.intent) extracted.intent = data.intent;
      
      // Extract facts even if partial
      if (data.facts) {
        extracted.facts = data.facts;
      }
      
      // Extract missing fields
      if (data.missing && Array.isArray(data.missing)) {
        extracted.missing = data.missing;
      }
      
      // Extract any crop/location data
      if (data.crop) extracted.crop = data.crop;
      if (data.location) extracted.location = data.location;
      if (data.season) extracted.season = data.season;
      
      // Extract error messages for context
      if (data._error || data.error) {
        extracted.error_context = data._message || data.message || 'Service temporarily unavailable';
      }
    }
    
    return extracted;
  };

  // Build comprehensive context from available data
  const conversationText = conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  
  // Extract useful data from both services
  const llm1Data = extractUsefulData(llm1Response);
  const decisionData = extractUsefulData(decisionOutput);
  
  // Build intelligent context
  const contextSummary = {
    user_query: conversation[conversation.length - 1]?.content || "No recent query",
    llm1_insights: llm1Data,
    decision_insights: decisionData,
    has_llm1_error: !llm1Response || llm1Response._error,
    has_decision_error: !decisionOutput || decisionOutput._error,
    available_data: Object.keys({...llm1Data, ...decisionData}).join(', ')
  };

  const prompt = `${LLM2_SYSTEM_PROMPT}

**User Conversation:**
${conversationText}

**Available Context:**
- Intent: ${llm1Data.intent || 'unknown'}
- Missing Info: ${llm1Data.missing?.join(', ') || 'none identified'}
- Available Facts: ${JSON.stringify(llm1Data.facts || {}, null, 2)}
- Decision Status: ${decisionOutput?._error ? 'Error - using fallback knowledge' : 'Available'}
- Decision Data: ${JSON.stringify(decisionData, null, 2)}

**Service Status:**
- LLM1 Analysis: ${contextSummary.has_llm1_error ? 'Partial/Error' : 'Success'}
- Decision Engine: ${contextSummary.has_decision_error ? 'Unavailable' : 'Available'}

**Your Task:**
Based on the user's latest query and ANY available context above, provide expert agricultural advice. 
Use your knowledge to fill gaps where services failed. Be practical and helpful.

**Remember:** Use **bold** formatting for key terms and actions!`;

  const geminiCall = async () => {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
          topP: 0.95,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid Gemini response structure');
    }

    const text = data.candidates[0].content.parts[0].text;
    console.log(`[${requestId}] Gemini response: ${text.substring(0, 100)}...`);
    return text;
  };

  return await withTimeout(
    withRetry(geminiCall, 3), // Increased retries to 3
    30000, // Increased timeout to 30 seconds
    'Gemini LLM2 call'
  );
};

// Validate LLM1 response structure
const validateLLM1Response = (response) => {
  if (!response || typeof response !== 'object') {
    return false;
  }
  
  // Check required fields
  const hasIntent = typeof response.intent === 'string';
  const hasDecisionTemplate = typeof response.decision_template === 'string';
  const hasMissing = Array.isArray(response.missing);
  const hasToolCalls = Array.isArray(response.tool_calls);
  const hasFacts = response.facts && typeof response.facts === 'object';

  return hasIntent && hasDecisionTemplate && hasMissing && hasToolCalls && hasFacts;
};

// Helper function to get user ID from token (optional, for conversation saving)
const getUserIdFromRequest = (req) => {
  try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return null;
    
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    return decodedToken._id;
  } catch (error) {
    return null; // Not authenticated, but allow chat to continue
  }
};

// Main chatbot endpoint
export const chatFlow = asyncErrorHandler(async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  console.log(`[${requestId}] Chatbot flow started`);

  try {
    // Validate input
    const { message, mode = "public_advisor", profile = null, conversation = [] } = req.body;

    if (!message || typeof message !== 'string') {
      throw new ApiError(400, "Message is required and must be a string");
    }

    if (!["public_advisor", "my_farm"].includes(mode)) {
      throw new ApiError(400, "Mode must be 'public_advisor' or 'my_farm'");
    }

    if (!Array.isArray(conversation)) {
      throw new ApiError(400, "Conversation must be an array");
    }

    console.log(`[${requestId}] Input - Mode: ${mode}, Message: ${message.substring(0, 50)}...`);

    // Step 1: Build payload for LLM1
    const fullConversation = [...conversation, { role: "user", content: message }];
    
    const llm1Payload = {
      query: fullConversation,
      profile: mode === "public_advisor" ? null : profile,
      mode: mode
    };

    let llm1StartTime = Date.now();
    
    // Step 2: Call LLM1
    let llm1Response;
    try {
      llm1Response = await callAIEngineEnhanced(llm1Payload, requestId);
    } catch (error) {
      console.error(`[${requestId}] LLM1 call failed:`, error);
      
      // Return user-friendly error message
      if (error.message.includes('timeout')) {
        throw new ApiError(500, "Our AI is taking longer than usual to respond. Please try again.");
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        throw new ApiError(500, "AI services are temporarily unavailable. Please try again in a moment.");
      } else {
        throw new ApiError(500, "Unable to process your request right now. Please try again.");
      }
    }

    const llm1Duration = Date.now() - llm1StartTime;

    // Validate LLM1 response
    if (!validateLLM1Response(llm1Response)) {
      console.error(`[${requestId}] Invalid LLM1 response structure:`, llm1Response);
      throw new ApiError(500, "I'm having trouble understanding your request. Please try rephrasing your question.");
    }

    console.log(`[${requestId}] LLM1 completed in ${llm1Duration}ms - Intent: ${llm1Response.intent}, Missing: ${llm1Response.missing.length} items`);

    // Step 3: Branching Logic
    let decisionOutput = null;
    let decisionDuration = 0;
    let shouldCallDecisionEngine = false;

    // Determine if we should call Decision Engine
    if (llm1Response.intent === "other") {
      console.log(`[${requestId}] Skipping Decision Engine - intent is 'other'`);
    } else if (llm1Response.missing && llm1Response.missing.length > 0) {
      console.log(`[${requestId}] Skipping Decision Engine - missing values: ${llm1Response.missing.join(', ')}`);
    } else {
      shouldCallDecisionEngine = true;
    }

    // Call Decision Engine if needed
    if (shouldCallDecisionEngine) {
      const decisionStartTime = Date.now();
      
      try {
        decisionOutput = await callDecisionEngineEnhanced(llm1Response, requestId);
        decisionDuration = Date.now() - decisionStartTime;
        console.log(`[${requestId}] Decision Engine completed in ${decisionDuration}ms`);
      } catch (error) {
        decisionDuration = Date.now() - decisionStartTime;
        console.warn(`[${requestId}] Decision Engine failed in ${decisionDuration}ms:`, error.message);
        decisionOutput = { 
          _error: true, 
          _message: error.message,
          _timestamp: new Date().toISOString()
        };
      }
    }

    // Step 4: Call LLM2 (Gemini) - Always called with enhanced fallback
    const llm2StartTime = Date.now();
    let finalAnswer;
    
    try {
      finalAnswer = await callGeminiLLM2(fullConversation, llm1Response, decisionOutput, requestId);
    } catch (error) {
      console.error(`[${requestId}] LLM2 (Gemini) call failed:`, error);
      
      // Enhanced fallback response using available data
      const userQuery = fullConversation[fullConversation.length - 1]?.content || '';
      
      // Try to extract useful info for fallback
      let fallbackInfo = {};
      if (llm1Response) {
        if (llm1Response.intent) fallbackInfo.intent = llm1Response.intent;
        if (llm1Response.missing) fallbackInfo.missing = llm1Response.missing;
        if (llm1Response.facts) fallbackInfo.facts = llm1Response.facts;
      }
      
      // Generate intelligent fallback based on available data
      if (fallbackInfo.missing && fallbackInfo.missing.length > 0) {
        finalAnswer = `I need more information to provide specific advice. Please share: **${fallbackInfo.missing.join(', ')}**. This will help me give you targeted recommendations for your farming needs.`;
      } else if (fallbackInfo.intent === 'crop_recommendation' || userQuery.toLowerCase().includes('crop')) {
        finalAnswer = `For **crop selection**, consider your local soil type, climate, and market demand. I recommend consulting with your local **agricultural extension officer** for region-specific advice. Popular options in India include **rice, wheat, cotton, and pulses** depending on your area and season.`;
      } else if (fallbackInfo.intent === 'pesticide_advice' || userQuery.toLowerCase().includes('pest')) {
        finalAnswer = `For **pest management**, always use **integrated pest management (IPM)** approaches. Start with **neem-based organic solutions**, ensure proper **crop rotation**, and consult your local agricultural officer for approved pesticides. Regular **field monitoring** is key to early detection.`;
      } else if (userQuery.toLowerCase().includes('fertilizer')) {
        finalAnswer = `For **fertilizer recommendations**, get a **soil test** done first. Generally, use **organic compost** as base nutrition, followed by **NPK fertilizers** based on soil test results. Your local **Krishi Vigyan Kendra** can provide specific guidance for your crops and soil type.`;
      } else {
        finalAnswer = `I'm here to help with your farming questions. For specific advice, please share details about your **location, crop, soil type, and current issue**. You can also contact your local **agricultural extension officer** or **Krishi Vigyan Kendra** for immediate assistance.`;
      }
    }

    const llm2Duration = Date.now() - llm2StartTime;
    const totalDuration = Date.now() - startTime;

    console.log(`[${requestId}] LLM2 completed in ${llm2Duration}ms`);
    console.log(`[${requestId}] Total flow completed in ${totalDuration}ms`);

    // Step 5: Build response
    const responseData = {
      answer: finalAnswer,
      llm1: {
        intent: llm1Response.intent,
        decision_template: llm1Response.decision_template,
        missing: llm1Response.missing,
        facts: llm1Response.facts
      },
      decision: decisionOutput,
      _meta: {
        requestId,
        timings: {
          llm1_ms: llm1Duration,
          decision_ms: decisionDuration,
          llm2_ms: llm2Duration,
          total_ms: totalDuration
        },
        mode,
        timestamp: new Date().toISOString()
      }
    };

    // Step 6: Save conversation for authenticated users
    const userId = getUserIdFromRequest(req);
    let savedConversation = null;
    
    if (userId) {
      try {
        // Build complete conversation with the new messages
        const conversationToSave = [
          ...conversation.map(msg => ({
            type: msg.role === 'user' ? 'user' : 'bot',
            content: msg.content,
            timestamp: new Date(msg.timestamp || Date.now())
          })),
          {
            type: 'user',
            content: message,
            timestamp: new Date()
          },
          {
            type: 'bot',
            content: finalAnswer,
            timestamp: new Date(),
            metadata: {
              intent: llm1Response.intent,
              requestId,
              timings: {
                llm1_ms: llm1Duration,
                decision_ms: decisionDuration,
                llm2_ms: llm2Duration,
                total_ms: totalDuration
              }
            }
          }
        ];

        // Get conversationId from request body if updating existing conversation
        const existingConversationId = req.body.conversationId || null;
        
        savedConversation = await saveConversation(
          userId, 
          conversationToSave, 
          mode, 
          existingConversationId
        );
        
        if (savedConversation) {
          console.log(`[${requestId}] Conversation saved with ID: ${savedConversation._id}`);
          responseData.conversationId = savedConversation._id;
        }
      } catch (error) {
        console.error(`[${requestId}] Failed to save conversation:`, error);
        // Don't fail the chat request if conversation saving fails
      }
    }

    // Log the completion
    console.log(`[${requestId}] Flow completed successfully - Intent: ${llm1Response.intent}, Answer length: ${finalAnswer.length} chars`);

    res.status(200).json(
      new ApiResponse(200, responseData, "Chat response generated successfully")
    );

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[${requestId}] Chat flow failed after ${totalDuration}ms:`, error);
    
    if (error instanceof ApiError) {
      throw error; // These already have user-friendly messages
    }
    
    // Convert technical errors to user-friendly messages
    let userMessage = "I'm experiencing technical difficulties. Please try again.";
    
    if (error.message.includes('timeout')) {
      userMessage = "I'm taking longer than usual to respond. Please try again.";
    } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      userMessage = "I'm having trouble connecting to our services. Please try again in a moment.";
    }
    
    throw new ApiError(500, userMessage);
  }
});

// Health check for chat service
export const chatHealth = asyncErrorHandler(async (req, res) => {
  const healthChecks = {
    ai_engine: null,
    decision_engine: null,
    gemini: null
  };

  // Check AI Engine
  try {
    const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:7001';
    const response = await fetch(`${AI_ENGINE_URL}/ping`, { 
      method: 'GET',
      timeout: 5000 
    });
    healthChecks.ai_engine = response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthChecks.ai_engine = 'unreachable';
  }

  // Check Decision Engine  
  try {
    const DECISION_ENGINE_URL = process.env.DECISION_ENGINE_URL || 'http://localhost:7002';
    const response = await fetch(`${DECISION_ENGINE_URL}/ping`, { 
      method: 'GET',
      timeout: 5000 
    });
    healthChecks.decision_engine = response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthChecks.decision_engine = 'unreachable';
  }

  // Check Gemini API key
  healthChecks.gemini = (GEMINI_API_KEY && GEMINI_API_KEY !== 'your-gemini-api-key') ? 'configured' : 'not_configured';

  const allHealthy = Object.values(healthChecks).every(status => 
    status === 'healthy' || status === 'configured'
  );

  res.status(allHealthy ? 200 : 503).json(
    new ApiResponse(
      allHealthy ? 200 : 503, 
      {
        status: allHealthy ? 'healthy' : 'degraded',
        services: healthChecks,
        timestamp: new Date().toISOString()
      }, 
      `Chat service is ${allHealthy ? 'healthy' : 'degraded'}`
    )
  );
});
