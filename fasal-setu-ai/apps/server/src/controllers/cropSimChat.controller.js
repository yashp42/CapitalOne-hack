import asyncErrorHandler from "../util/asyncErrorHandler.js";
import { ApiResponse } from "../util/ApiResponse.js";
import { ApiError } from "../util/ApiError.js";
import Crop from "../models/crop.model.js";
import User from "../models/user.model.js";
import { getCropDuration } from "../util/cropDuration.js";
import fetch from "node-fetch";

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_SECRET || process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

// Retry function for Gemini API calls with exponential backoff
const retryGeminiCall = async (callFn, maxRetries = 3, baseDelay = 1000) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await callFn();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries - 1;
            const is503Error = error.message && error.message.includes('503');
            const isOverloadedError = error.message && error.message.includes('overloaded');
            
            if (isLastAttempt || (!is503Error && !isOverloadedError)) {
                throw error;
            }
            
            // Exponential backoff: 1s, 2s, 4s
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`Gemini API call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// LLM2 System Prompt for Crop Simulation
const CROP_SIM_LLM2_SYSTEM_PROMPT = `You are an expert agricultural advisor for Fasal-Setu crop simulation.

Your role is to:
1. Analyze the specific crop data and user profile provided to give personalized advice
2. Answer general queries like "How are my crops doing?" by thoroughly assessing:
   - Current crop growth percentage and stage
   - Days since sowing vs expected timeline
   - Recent farming activities (irrigation, fertilization, pest checks)
   - Weather conditions and their impact
   - Upcoming recommended activities
3. Provide farming advice specific to the crop type, variety, and growth stage
4. Give recommendations based on current weather, soil conditions, and farm location
5. Help with timing of agricultural activities and explain the reasoning

Guidelines for assessment queries:
- When asked "How are my crops doing?" or similar general questions, provide a comprehensive crop health assessment
- Analyze growth rate: Compare current growth % with expected growth for days after sowing
- Evaluate recent care: Check last irrigation, fertilization, and pest management dates
- Consider environmental factors: Weather, soil moisture, temperature impacts
- Predict upcoming needs: What activities are due soon and why
- Give specific insights about the crop variety and its typical behavior
- Rate overall crop health as Excellent/Good/Fair/Poor with clear reasoning

Communication style:
- Be specific and actionable in your advice
- Use simple, farmer-friendly language
- Keep responses comprehensive but under 250 words for assessments
- Use emojis sparingly for emphasis
- Format important points with **bold** text
- Always reference the specific crop name and variety when available
- Include growth percentage and stage in your assessments

Always respond as a knowledgeable farming expert who has analyzed the provided crop and user data to give personalized recommendations.`;

// Call Gemini API for LLM2 responses
const callGeminiLLM2 = async (messages, systemPrompt = CROP_SIM_LLM2_SYSTEM_PROMPT) => {
    try {
        if (!GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }

        const prompt = `${systemPrompt}\n\nUser Query: ${messages[messages.length - 1].content}`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        console.log('Calling Gemini API for LLM2...');
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Gemini API response received');

        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.error('Unexpected Gemini response structure:', result);
            throw new Error('Invalid response structure from Gemini');
        }
    } catch (error) {
        console.error('Gemini LLM2 error:', error);
        throw error;
    }
};

// Format final response using Gemini with all context
const formatFinalResponse = async ({
    aiEngineResponse,
    decisionEngineResponse,
    userProfile,
    cropContext,
    query,
    hasEvent = false,
    eventType = null,
    eventDetails = null
}) => {
    try {
        // Build comprehensive context for Gemini formatting
        let contextPrompt = `You are an expert agricultural advisor. Format a comprehensive response for a farmer based on the following analysis:

**ORIGINAL QUERY:** "${query}"

**USER CONTEXT:**
- Location: ${userProfile.location?.state || 'Unknown'}, ${userProfile.location?.district || 'Unknown'}
- Farm Size: ${userProfile.farm_size_acres || 0} acres
- Experience: ${userProfile.farming_experience || 'intermediate'}
- Primary Crops: ${userProfile.primary_crops?.join(', ') || 'Not specified'}

**CROP DETAILS:**
- Crop: **${cropContext.crop_name}** (${cropContext.variety || 'standard variety'})
- Current Growth: **${cropContext.current_status?.growth_percent || 0}%**
- Stage: ${cropContext.current_status?.stage || 'unknown'}
- Days After Sowing: ${cropContext.current_status?.days_after_sowing || 0}
- Season: ${cropContext.season || 'unknown'}
- Area: ${cropContext.area_acres || 0} acres
- Irrigation: ${cropContext.irrigation_source || 'unknown'}

**AI ANALYSIS:**
- Intent Detected: ${aiEngineResponse.intent || 'general_information'}
- Key Facts: ${JSON.stringify(aiEngineResponse.facts || {}, null, 2)}
- AI Recommendation: ${aiEngineResponse.decision_template || aiEngineResponse.general_answer || 'No specific recommendation'}`;

        // Add Decision Engine response if available
        if (decisionEngineResponse) {
            contextPrompt += `\n\n**DECISION ENGINE ANALYSIS:**
${JSON.stringify(decisionEngineResponse, null, 2)}`;
        }

        // Add event information if applicable
        if (hasEvent && eventType && eventDetails) {
            contextPrompt += `\n\n**FARM EVENT RECORDED:**
- Event Type: ${eventType}
- Event Details: ${JSON.stringify(eventDetails, null, 2)}
- This event was recorded along with the query above`;
        }

        contextPrompt += `\n\n**FORMATTING INSTRUCTIONS:**
- Create a concise, farmer-friendly response
- Use **bold text** for important information using double asterisks (**)
- Include appropriate emojis (🌱🌾💧🚜📅⚠️✅)
- Structure the response clearly with sections if needed
- Keep the tone encouraging and supportive
- Include specific actionable advice
- Reference the crop name and current status
- If both AI and Decision Engine provided recommendations, synthesize them coherently
- Make sure the response directly addresses the farmer's original query
- **CRITICAL: Keep response under 180 words - be concise but informative**

Generate a well-formatted response that combines all the analysis above into helpful farming advice:`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: contextPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 256, // Reduced to enforce shorter responses (~180 words)
            }
        };

        console.log('Calling Gemini for final response formatting...');
        const response = await retryGeminiCall(async () => {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini formatting error:', response.status, errorText);
                throw new Error(`Gemini formatting error: ${response.status}`);
            }
            
            return response;
        });

        const result = await response.json();
        
        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
            const formattedResponse = result.candidates[0].content.parts[0].text;
            console.log('Final formatted response generated successfully');
            return formattedResponse;
        } else {
            throw new Error('Invalid Gemini response structure');
        }
    } catch (error) {
        console.error('Error formatting final response:', error);
        
        // Fallback to basic response when Gemini formatting fails
        let fallbackResponse = `**${cropContext.crop_name} Analysis**\n\n`;
        
        if (aiEngineResponse.general_answer) {
            fallbackResponse += aiEngineResponse.general_answer;
        } else {
            // Create a meaningful response based on intent and decision template
            if (aiEngineResponse.intent === 'pesticide_advice') {
                fallbackResponse += `🌾 **Pesticide Recommendation**\n\n`;
                
                // Extract pesticide information from facts if available
                if (aiEngineResponse.facts?.pesticide?.data && Array.isArray(aiEngineResponse.facts.pesticide.data)) {
                    const pesticides = aiEngineResponse.facts.pesticide.data;
                    if (pesticides.length > 0) {
                        fallbackResponse += `Recommended for your ${cropContext.crop_name}:\n\n`;
                        pesticides.slice(0, 2).forEach((pesticide, index) => {
                            fallbackResponse += `**${index + 1}. ${pesticide.name || pesticide.product_name || 'Safe Pesticide'}**\n`;
                            if (pesticide.application_rate) {
                                fallbackResponse += `Rate: ${pesticide.application_rate}\n`;
                            }
                            if (pesticide.target_pest) {
                                fallbackResponse += `Target: ${pesticide.target_pest}\n`;
                            }
                            fallbackResponse += '\n';
                        });
                    } else {
                        fallbackResponse += `Use organic methods for your ${cropContext.crop_name}:\n- Neem-based pesticides\n- Bio-friendly pest control\n\n`;
                    }
                } else {
                    fallbackResponse += `Consult local experts for suitable pesticide options based on current pest pressure.\n\n`;
                }
                
                fallbackResponse += `⚠️ **Safety:** Follow label instructions, use protective gear, respect pre-harvest intervals.`;
                
            } else if (aiEngineResponse.intent === 'fertilizer_advice') {
                fallbackResponse += `🌱 **Fertilizer Recommendation**\n\nFor optimal ${cropContext.crop_name} growth, use balanced NPK fertilizers based on soil test results. Consult local agricultural experts for specific recommendations.`;
                
            } else if (aiEngineResponse.intent === 'irrigation_advice') {
                fallbackResponse += `💧 **Irrigation Guidance**\n\nMonitor soil moisture for your ${cropContext.crop_name}. Water when top 2-3 inches are dry. Adjust based on weather conditions.`;
                
            } else if (aiEngineResponse.intent === 'other' || aiEngineResponse.intent === 'irrigation_decision') {
                // General crop assessment for "How are my crops doing?" type queries
                fallbackResponse += `🌾 **${cropContext.crop_name} Status**\n\n`;
                
                // Growth status
                if (cropContext.growth_percent !== undefined) {
                    const growthStatus = cropContext.growth_percent;
                    let statusEmoji = '🌱';
                    let statusText = 'developing well';
                    
                    if (growthStatus >= 80) {
                        statusEmoji = '🌾';
                        statusText = 'nearing maturity';
                    } else if (growthStatus >= 60) {
                        statusEmoji = '🌿';
                        statusText = 'growing strongly';
                    }
                    
                    fallbackResponse += `${statusEmoji} **Growth**: ${growthStatus.toFixed(1)}% - ${statusText}\n`;
                }
                
                // Stage and variety info
                if (cropContext.current_stage) {
                    fallbackResponse += `📅 **Stage**: ${cropContext.current_stage}\n`;
                }
                if (cropContext.variety) {
                    fallbackResponse += `🌾 **Variety**: ${cropContext.variety}\n`;
                }
                
                // Concise recommendations
                fallbackResponse += `\n💡 **Keep up**: Regular monitoring, proper watering, and timely fertilization.\n\n`;
                fallbackResponse += `✅ Your ${cropContext.crop_name} is progressing well!`;
                
            } else {
                fallbackResponse += `I've analyzed your query about "${query}". `;
                if (aiEngineResponse.intent) {
                    fallbackResponse += `Intent: ${aiEngineResponse.intent}. `;
                }
                fallbackResponse += `Please let me know if you need more specific information about your **${cropContext.crop_name}** crop.`;
            }
        }
        
        if (decisionEngineResponse && decisionEngineResponse.result) {
            fallbackResponse += `\n\n**Decision Engine Analysis:**\n`;
            if (decisionEngineResponse.result.recommendation) {
                fallbackResponse += decisionEngineResponse.result.recommendation;
            } else if (decisionEngineResponse.status === 'success') {
                fallbackResponse += `Analysis completed successfully with confidence: ${decisionEngineResponse.confidence || 'moderate'}`;
            } else {
                fallbackResponse += `Additional analysis available based on current conditions.`;
            }
        }
        
        return fallbackResponse;
    }
};

// Generate Gemini response with formatting instructions for crop simulation
const generateGeminiResponse = async (query, profile) => {
    try {
        // Enhanced system prompt with formatting instructions
        const formattedSystemPrompt = `${CROP_SIM_LLM2_SYSTEM_PROMPT}

**FORMATTING INSTRUCTIONS:**
- Use **bold text** for important terms, names, and key points using double asterisks (**)
- Use emojis appropriately to make the response engaging (🌱 for growth, 💧 for water, 🌾 for harvest, etc.)
- Structure your response with clear sections when needed
- Keep responses concise but informative
- Always be encouraging and supportive to the farmer

**USER PROFILE:**
Farmer: ${profile.user?.name || 'Farmer'}
Location: ${profile.user?.location || 'Unknown'}
Farm Size: ${profile.user?.farmSize || 'Not specified'} acres
Experience: ${profile.user?.experience || 'intermediate'}

**CURRENT CROPS:**
${profile.crops?.map(crop => `
- **${crop.cropType}** (${crop.variety || 'standard variety'})
  - Growth: ${crop.growth || 0}% - Stage: ${crop.currentStage || 'unknown'}
  - Days after planting: ${crop.growthDays || 0}
  - Health: ${crop.health || 'good'}
  - Soil: ${crop.soilType || 'Unknown'}
  - Irrigation: ${crop.irrigationSchedule || 'Unknown'}
`).join('') || 'No crop information available'}

Respond to the farmer's query with the above context in mind. Use formatting to make your response clear and engaging.`;

        const messages = [{ content: query }];
        
        return await callGeminiLLM2(messages, formattedSystemPrompt);
    } catch (error) {
        console.error('Error generating Gemini response:', error);
        throw error;
    }
};

// Gemini-based Event and Query Detection
const detectEventAndQueryWithGemini = async (message) => {
    try {
        if (!GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }

        const classificationPrompt = `You are an AI classifier for farming messages. Analyze the following user message and classify it for:

1. **EVENT DETECTION**: Determine if the user is reporting that they have ALREADY PERFORMED a farming activity (past tense or current action).
   - Events are actions the user has done/is doing: "I watered my crops", "just applied fertilizer", "checked for pests today"
   - Events are NOT questions or future plans: "what fertilizer should I use?", "when should I water?"
   
   Event types:
   - irrigation: watering, sprinkling, irrigating crops
   - fertilization: applying fertilizer, manure, nutrients
   - pest_check: checking for pests, spraying pesticides, disease inspection
   - harvest: harvesting, reaping, collecting crops

2. **QUERY DETECTION**: Determine if the user is asking a question or seeking advice about farming.
   - Queries are questions: "what fertilizer is best?", "how are my crops?", "when should I harvest?"
   - Queries include requests for advice, recommendations, or information

**IMPORTANT**: A single message can contain BOTH an event and a query.

User message: "${message}"

Respond in this EXACT JSON format:
{
  "hasEvent": boolean,
  "eventType": "irrigation|fertilization|pest_check|harvest|null",
  "eventConfidence": 0.0-1.0,
  "hasQuery": boolean,
  "query": "the question part of the message or full message if only query",
  "queryConfidence": 0.0-1.0
}

Examples:
- "I watered my crops. What's the weather tomorrow?" → {"hasEvent": true, "eventType": "irrigation", "eventConfidence": 0.9, "hasQuery": true, "query": "What's the weather tomorrow?", "queryConfidence": 0.8}
- "What fertilizer should I use?" → {"hasEvent": false, "eventType": null, "eventConfidence": 0.0, "hasQuery": true, "query": "What fertilizer should I use?", "queryConfidence": 0.9}
- "Just applied NPK fertilizer" → {"hasEvent": true, "eventType": "fertilization", "eventConfidence": 0.9, "hasQuery": false, "query": null, "queryConfidence": 0.0}`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: classificationPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.1, // Low temperature for consistent classification
                topK: 1,
                topP: 0.1,
                maxOutputTokens: 256,
            }
        };

        console.log('Calling Gemini for event/query classification...');
        const response = await retryGeminiCall(async () => {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini classification error:', response.status, errorText);
                throw new Error(`Gemini classification error: ${response.status}`);
            }
            
            return response;
        });

        const result = await response.json();
        
        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
            const classificationText = result.candidates[0].content.parts[0].text;
            console.log('Gemini classification response:', classificationText);
            
            // Parse JSON response - handle markdown code blocks
            try {
                // Remove markdown code blocks if present
                let cleanJson = classificationText.trim();
                if (cleanJson.startsWith('```json')) {
                    cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                } else if (cleanJson.startsWith('```')) {
                    cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
                }
                
                const classification = JSON.parse(cleanJson);
                console.log('Parsed classification:', classification);
                return classification;
            } catch (parseError) {
                console.error('Failed to parse Gemini classification JSON:', parseError);
                console.error('Raw response text:', classificationText);
                // Fallback to query-only classification
                return {
                    hasEvent: false,
                    eventType: null,
                    eventConfidence: 0.0,
                    hasQuery: true,
                    query: message,
                    queryConfidence: 0.5
                };
            }
        } else {
            throw new Error('Invalid Gemini response structure');
        }
    } catch (error) {
        console.error('Gemini classification error:', error);
        // Fallback to treating everything as a query
        return {
            hasEvent: false,
            eventType: null,
            eventConfidence: 0.0,
            hasQuery: true,
            query: message,
            queryConfidence: 0.5
        };
    }
};

// Calculate realistic growth boost based on crop maturity and event
const calculateGrowthBoost = (crop, eventType) => {
    const currentGrowth = crop.growth_percent || 0;
    const maturityDays = crop.derived?.duration_days || getCropDuration(crop.crop_name) || 90;
    const currentAge = crop.derived?.days_after_sowing || 0;
    
    // Calculate expected growth based on time progression
    const expectedGrowthAtAge = Math.min(100, (currentAge / maturityDays) * 100);
    
    // Base daily growth rate (should reach 100% over maturity period)
    const baseDailyGrowthRate = 100 / maturityDays; // % per day
    
    // Event multipliers (how many days worth of growth this event provides)
    const eventDaysEquivalent = {
        irrigation: 1.5,      // 1.5 days worth of growth
        fertilization: 3.0,   // 3 days worth of growth  
        pest_check: 0.8,      // 0.8 days worth of growth
        daily_care: 1.0       // 1 day worth of growth
    };
    
    const daysEquivalent = eventDaysEquivalent[eventType] || 0.5;
    
    // Calculate base boost as days worth of natural growth
    let baseBoost = baseDailyGrowthRate * daysEquivalent;
    
    // Growth efficiency decreases as plant matures (diminishing returns)
    let efficiencyMultiplier = 1.0;
    if (currentGrowth < 20) {
        efficiencyMultiplier = 1.3; // High efficiency in early stages
    } else if (currentGrowth < 50) {
        efficiencyMultiplier = 1.1; // Good efficiency in vegetative stage
    } else if (currentGrowth < 80) {
        efficiencyMultiplier = 0.9; // Reduced efficiency in reproductive stage
    } else {
        efficiencyMultiplier = 0.4; // Very low efficiency near maturity
    }
    
    // Consider timing - better growth if plant is behind schedule
    let timingMultiplier = 1.0;
    const growthGap = currentGrowth - expectedGrowthAtAge;
    
    if (growthGap < -15) {
        // Plant is significantly behind schedule
        timingMultiplier = 1.4;
    } else if (growthGap < -5) {
        // Plant is slightly behind schedule
        timingMultiplier = 1.2;
    } else if (growthGap > 15) {
        // Plant is significantly ahead of schedule
        timingMultiplier = 0.3;
    } else if (growthGap > 5) {
        // Plant is slightly ahead of schedule
        timingMultiplier = 0.6;
    }
    
    // Apply all multipliers
    const finalBoost = baseBoost * efficiencyMultiplier * timingMultiplier;
    
    // Ensure we don't exceed 100% and growth is realistic
    const maxPossibleGrowth = Math.min(100, expectedGrowthAtAge + 20); // Allow some advancement
    const newGrowth = Math.min(maxPossibleGrowth, currentGrowth + finalBoost);
    const actualBoost = Math.max(0, newGrowth - currentGrowth);
    
    console.log(`Growth calculation for ${eventType}:`, {
        cropName: crop.crop_name,
        maturityDays,
        currentAge,
        currentGrowth,
        expectedGrowthAtAge,
        baseDailyGrowthRate: baseDailyGrowthRate.toFixed(3),
        daysEquivalent,
        baseBoost: baseBoost.toFixed(3),
        efficiencyMultiplier,
        timingMultiplier,
        finalBoost: actualBoost.toFixed(3)
    });
    
    return Math.round(actualBoost * 100) / 100; // Round to 2 decimals
};

// Get next recommended event and timing based on crop stage and last activities
const getNextRecommendedEvent = (crop, completedEventType = null) => {
    const currentAge = crop.derived?.days_after_sowing || 0;
    const maturityDays = crop.derived?.duration_days || getCropDuration(crop.crop_name) || 90;
    const currentGrowth = crop.growth_percent || 0;
    const stage = crop.derived?.stage || "germination";
    
    // Get last activity dates
    const lastIrrigation = crop.derived?.last_irrigation_at ? new Date(crop.derived.last_irrigation_at) : null;
    const lastFertilization = crop.derived?.last_fertilization_at ? new Date(crop.derived.last_fertilization_at) : null;
    const lastPestCheck = crop.derived?.last_pest_check_at ? new Date(crop.derived.last_pest_check_at) : null;
    
    const now = new Date();
    
    // Calculate days since last activities - for new crops, use crop age as baseline
    const cropAge = crop.derived?.days_after_sowing || 0;
    const defaultDaysSince = Math.min(cropAge, 7); // Use crop age but cap at 7 days for new crops
    
    const daysSinceIrrigation = lastIrrigation ? Math.floor((now - lastIrrigation) / (1000 * 60 * 60 * 24)) : defaultDaysSince;
    const daysSinceFertilization = lastFertilization ? Math.floor((now - lastFertilization) / (1000 * 60 * 60 * 24)) : defaultDaysSince;
    const daysSincePestCheck = lastPestCheck ? Math.floor((now - lastPestCheck) / (1000 * 60 * 60 * 24)) : defaultDaysSince;
    
    // Stage-specific recommendations
    const stageRecommendations = {
        germination: {
            irrigation: { frequency: 2, description: "Keep soil moist for germination" },
            fertilization: { frequency: 7, description: "Light starter fertilizer" },
            pest_check: { frequency: 5, description: "Check for seedling pests" }
        },
        seedling: {
            irrigation: { frequency: 3, description: "Regular watering for growth" },
            fertilization: { frequency: 10, description: "Balanced NPK fertilizer" },
            pest_check: { frequency: 7, description: "Monitor for early pest attacks" }
        },
        vegetative: {
            irrigation: { frequency: 3, description: "Deep watering for root development" },
            fertilization: { frequency: 14, description: "Nitrogen-rich fertilizer for foliage" },
            pest_check: { frequency: 10, description: "Regular pest and disease monitoring" }
        },
        tillering: {
            irrigation: { frequency: 4, description: "Moderate watering during tillering" },
            fertilization: { frequency: 14, description: "Balanced fertilizer for tiller development" },
            pest_check: { frequency: 7, description: "Check for stem borers and leaf diseases" }
        },
        flowering: {
            irrigation: { frequency: 2, description: "Critical watering during flowering" },
            fertilization: { frequency: 21, description: "Potassium-rich fertilizer for flower development" },
            pest_check: { frequency: 5, description: "Monitor for flower pests and pollination issues" }
        },
        grain_filling: {
            irrigation: { frequency: 3, description: "Consistent moisture for grain filling" },
            fertilization: { frequency: 28, description: "Light fertilizer if needed" },
            pest_check: { frequency: 7, description: "Watch for grain pests and diseases" }
        },
        maturity: {
            irrigation: { frequency: 7, description: "Reduced watering before harvest" },
            fertilization: { frequency: 999, description: "No fertilization needed" },
            pest_check: { frequency: 10, description: "Final pest check before harvest" }
        }
    };
    
    // If near harvest (95%+ growth), recommend harvesting
    if (currentGrowth >= 95 || currentAge >= maturityDays - 5) {
        return {
            nextEvent: "harvesting",
            daysUntilNext: Math.max(0, maturityDays - currentAge),
            description: "Crop is ready for harvesting!",
            restrictionDays: 0,
            restrictionMessage: ""
        };
    }
    
    const currentRecommendations = stageRecommendations[stage] || stageRecommendations.vegetative;
    
    // Determine which event is most urgently needed
    const eventPriorities = [];
    
    // Check irrigation priority
    const irrigationFreq = currentRecommendations.irrigation.frequency;
    if (daysSinceIrrigation >= irrigationFreq) {
        eventPriorities.push({
            event: "irrigation",
            urgency: daysSinceIrrigation - irrigationFreq,
            description: currentRecommendations.irrigation.description,
            restrictionDays: irrigationFreq
        });
    }
    
    // Check fertilization priority
    const fertilizationFreq = currentRecommendations.fertilization.frequency;
    if (daysSinceFertilization >= fertilizationFreq) {
        eventPriorities.push({
            event: "fertilization",
            urgency: daysSinceFertilization - fertilizationFreq,
            description: currentRecommendations.fertilization.description,
            restrictionDays: fertilizationFreq
        });
    }
    
    // Check pest check priority
    const pestCheckFreq = currentRecommendations.pest_check.frequency;
    if (daysSincePestCheck >= pestCheckFreq) {
        eventPriorities.push({
            event: "pest_check",
            urgency: daysSincePestCheck - pestCheckFreq,
            description: currentRecommendations.pest_check.description,
            restrictionDays: pestCheckFreq
        });
    }
    
    // If no urgent events, find the next upcoming one
    if (eventPriorities.length === 0) {
        const timeToIrrigation = irrigationFreq - daysSinceIrrigation;
        const timeToFertilization = fertilizationFreq - daysSinceFertilization;
        const timeToPestCheck = pestCheckFreq - daysSincePestCheck;
        
        const nextTimes = [
            { event: "irrigation", days: timeToIrrigation, description: currentRecommendations.irrigation.description, restrictionDays: irrigationFreq },
            { event: "fertilization", days: timeToFertilization, description: currentRecommendations.fertilization.description, restrictionDays: fertilizationFreq },
            { event: "pest_check", days: timeToPestCheck, description: currentRecommendations.pest_check.description, restrictionDays: pestCheckFreq }
        ].filter(item => item.days > 0).sort((a, b) => a.days - b.days);
        
        if (nextTimes.length > 0) {
            const next = nextTimes[0];
            return {
                nextEvent: next.event,
                daysUntilNext: next.days,
                description: next.description,
                restrictionDays: next.restrictionDays,
                restrictionMessage: `Wait ${next.days} more days before ${next.event}`
            };
        }
    }
    
    // Sort by urgency (most urgent first)
    eventPriorities.sort((a, b) => b.urgency - a.urgency);
    
    if (eventPriorities.length > 0) {
        const mostUrgent = eventPriorities[0];
        // Cap urgency at reasonable levels for display
        const displayUrgency = Math.min(mostUrgent.urgency, 7);
        const isReasonablyOverdue = mostUrgent.urgency <= 3;
        
        return {
            nextEvent: mostUrgent.event,
            daysUntilNext: isReasonablyOverdue ? 0 : -Math.abs(displayUrgency), // Negative for overdue
            description: mostUrgent.description,
            restrictionDays: mostUrgent.restrictionDays,
            restrictionMessage: isReasonablyOverdue ? 
                `${mostUrgent.event} is due now` : 
                `${mostUrgent.event} is overdue by ${displayUrgency} days`
        };
    }
    
    // Default fallback
    return {
        nextEvent: "irrigation",
        daysUntilNext: 1,
        description: "Regular watering maintenance",
        restrictionDays: 3,
        restrictionMessage: "Wait 3 days between irrigation events"
    };
};

// Generate enhanced event response using Gemini LLM2
const generateEventResponse = async (eventType, cropData, growthIncrease, nextEventData) => {
    try {
        const contextPrompt = `Farm Event Completed: ${eventType}

Crop Details:
- Name: ${cropData.crop_name} (${cropData.variety || 'standard variety'})
- Current Growth: ${cropData.growth_percent}%
- Growth Increase from this event: ${growthIncrease}%
- Stage: ${cropData.derived?.stage || 'unknown'}
- Days after sowing: ${cropData.derived?.days_after_sowing || 0}

Next Recommended Activity:
- Activity: ${nextEventData.nextEvent}
- Due in: ${nextEventData.daysUntilNext} days
- Purpose: ${nextEventData.description}
- Restriction period: ${nextEventData.restrictionDays} days

Generate a brief, encouraging response (≤100 words) acknowledging the completed farm activity, mentioning the growth increase, and providing the next recommendation. Use farmer-friendly language with appropriate emojis and **bold** text for emphasis.`;

        const messages = [{ content: contextPrompt }];
        const response = await callGeminiLLM2(messages);
        return response;
    } catch (error) {
        console.error('Error generating event response:', error);
        // Fallback to simple response
        const eventMessages = {
            irrigation: `🌧️ **Great!** I've recorded your irrigation. Your crop's growth increased by **${growthIncrease.toFixed(1)}%**! Current growth: **${cropData.growth_percent.toFixed(1)}%**`,
            fertilization: `🌱 **Excellent!** Fertilization applied. This boosted growth by **${growthIncrease.toFixed(1)}%**! Current growth: **${cropData.growth_percent.toFixed(1)}%**`,
            pest_check: `🔍 **Good farming practice!** Pest check completed. Growth boost: **${growthIncrease.toFixed(1)}%**. Current growth: **${cropData.growth_percent.toFixed(1)}%**`
        };
        
        return eventMessages[eventType] || `✅ Farm activity recorded. Growth boost: **${growthIncrease.toFixed(1)}%**`;
    }
};

// Initialize next event data for crops that don't have it
const initializeNextEventData = async (crop) => {
    if (!crop.derived?.next_event) {
        const nextEventData = getNextRecommendedEvent(crop);
        const nextEventDue = new Date();
        nextEventDue.setDate(nextEventDue.getDate() + nextEventData.daysUntilNext);
        
        const eventUpdateData = {
            'derived.next_event': nextEventData.nextEvent,
            'derived.next_event_due_date': nextEventDue,
            'derived.next_event_days_until': nextEventData.daysUntilNext,
            'derived.next_event_description': nextEventData.description,
            'derived.event_restriction_active': false,
            'derived.event_restriction_until': null,
            'derived.event_restriction_message': null
        };
        
        try {
            const updatedCrop = await Crop.findByIdAndUpdate(
                crop._id,
                { $set: eventUpdateData },
                { new: true, runValidators: true }
            );
            console.log('Next event data initialized for crop:', crop._id);
            return updatedCrop;
        } catch (error) {
            console.error('Failed to initialize next event data:', error);
            return crop;
        }
    }
    return crop;
};

// Update crop with event data
const updateCropWithEvent = async (crop, eventType) => {
    const growthBoost = calculateGrowthBoost(crop, eventType);
    const newGrowthPercent = Math.min(100, crop.growth_percent + growthBoost);
    
    // Build update object with proper nested field handling
    const updateData = {
        growth_percent: newGrowthPercent
    };
    
    const currentDate = new Date();
    
    // Handle derived field updates properly
    switch (eventType) {
        case 'irrigation':
            updateData['derived.last_irrigation_at'] = currentDate;
            break;
        case 'fertilization':
            updateData['derived.last_fertilization_at'] = currentDate;
            break;
        case 'pest_check':
            updateData['derived.last_pest_check_at'] = currentDate;
            break;
    }
    
    console.log(`Updating crop ${crop._id} with data:`, {
        oldGrowth: crop.growth_percent,
        growthBoost,
        newGrowth: newGrowthPercent,
        eventType,
        updateFields: Object.keys(updateData)
    });
    
    try {
        // Update the crop in database with proper options
        const updatedCrop = await Crop.findByIdAndUpdate(
            crop._id,
            { $set: updateData },
            { 
                new: true, 
                runValidators: true,
                upsert: false // Don't create if not exists
            }
        );
        
        if (!updatedCrop) {
            throw new Error('Failed to update crop - crop not found after update');
        }
        
        console.log(`Crop updated successfully:`, {
            cropId: updatedCrop._id,
            oldGrowth: crop.growth_percent,
            newGrowth: updatedCrop.growth_percent,
            actualIncrease: updatedCrop.growth_percent - crop.growth_percent
        });
        
        return updatedCrop;
    } catch (error) {
        console.error('Error updating crop:', error);
        throw new ApiError(500, `Failed to update crop: ${error.message}`);
    }
};

// Call AI Engine for query processing with Gemini LLM2 fallback
const processQuery = async (query, cropData, farmContext, userId, eventInfo = null) => {
    try {
        console.log('ProcessQuery called with:', { query, hasCropData: !!cropData, hasEventInfo: !!eventInfo });
        
        // Try AI Engine first - crop simulation is ALWAYS my_farm mode
        try {
            // Prepare comprehensive user profile and crop context for AI Engine
            const userProfile = {
                user_id: userId,
                location: {
                    state: cropData.location_override?.state || farmContext.location?.state || "Unknown",
                    district: cropData.location_override?.district || farmContext.location?.district || "Unknown",
                    coordinates: {
                        lat: cropData.location_override?.lat || farmContext.location?.lat,
                        lon: cropData.location_override?.lon || farmContext.location?.lon
                    }
                },
                farming_experience: farmContext.farming_experience || "intermediate",
                farm_size_acres: cropData.area_acres || 0,
                primary_crops: [cropData.crop_name],
                irrigation_methods: [cropData.irrigation_source || "unknown"],
                farming_season: cropData.season
            };

            const cropContext = {
                crop_id: cropData._id,
                crop_name: cropData.crop_name,
                variety: cropData.variety,
                season: cropData.season,
                sowing_date: cropData.sowing_date,
                area_acres: cropData.area_acres,
                irrigation_source: cropData.irrigation_source,
                current_status: {
                    growth_percent: cropData.growth_percent,
                    stage: cropData.derived?.stage,
                    days_after_sowing: cropData.derived?.days_after_sowing,
                    expected_harvest_date: cropData.derived?.expected_harvest_date,
                    duration_days: cropData.derived?.duration_days
                },
                recent_activities: {
                    last_irrigation: cropData.derived?.last_irrigation_at,
                    last_fertilization: cropData.derived?.last_fertilization_at,
                    last_pest_check: cropData.derived?.last_pest_check_at
                },
                next_recommendations: {
                    next_event: cropData.derived?.next_event,
                    next_event_due_date: cropData.derived?.next_event_due_date,
                    next_event_days_until: cropData.derived?.next_event_days_until,
                    next_event_description: cropData.derived?.next_event_description,
                    restriction_active: cropData.derived?.event_restriction_active,
                    restriction_until: cropData.derived?.event_restriction_until
                }
            };

            // AI Engine payload - match ActRequest schema
            const requestBody = {
                query: query,
                mode: "my_farm", // Crop simulation is always my_farm mode
                profile: {
                    user: userProfile,
                    crop: cropContext,
                    weather: farmContext.weather,
                    soil: farmContext.soil,
                    market_prices: farmContext.market_prices
                }
            };

            console.log('Sending request to AI Engine:', { 
                query: requestBody.query,
                profileKeys: Object.keys(requestBody.profile)
            });

            const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8080';
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 40000);
            
            const response = await fetch(`${AI_ENGINE_URL}/act`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                const aiEngineResult = await response.json();
                console.log('AI Engine response received successfully:', aiEngineResult);
                
                // AI Engine returns ActResponse format: { intent, decision_template, general_answer, facts, tool_calls, missing }
                let decisionEngineResponse = null;
                
                // Step 1: Check if we need to call Decision Engine
                if (aiEngineResult.intent && aiEngineResult.intent !== "other") {
                    console.log(`Intent "${aiEngineResult.intent}" detected, calling Decision Engine...`);
                    
                    try {
                        const DECISION_ENGINE_URL = process.env.DECISION_ENGINE_URL || 'http://127.0.0.1:5000';
                        
                        // Prepare decision engine payload - match ActIntentModel schema
                        const decisionPayload = {
                            intent: aiEngineResult.intent,
                            decision_template: aiEngineResult.decision_template || 'generic_recommendation',
                            tool_calls: aiEngineResult.tool_calls || [],
                            facts: aiEngineResult.facts || {}
                        };
                        
                        const decisionResponse = await fetch(`${DECISION_ENGINE_URL}/decision`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(decisionPayload),
                            signal: controller.signal
                        });
                        
                        if (decisionResponse.ok) {
                            decisionEngineResponse = await decisionResponse.json();
                            console.log('Decision Engine response received:', decisionEngineResponse);
                        } else {
                            console.error('Decision Engine failed with status:', decisionResponse.status);
                        }
                    } catch (decisionError) {
                        console.error('Decision Engine error:', decisionError);
                    }
                }
                
                // Step 2: Format final response using Gemini
                const finalFormattedResponse = await formatFinalResponse({
                    aiEngineResponse: aiEngineResult,
                    decisionEngineResponse: decisionEngineResponse,
                    userProfile: userProfile,
                    cropContext: cropContext,
                    query: query,
                    hasEvent: eventInfo ? eventInfo.wasProcessed : false,
                    eventType: eventInfo ? eventInfo.eventType : null,
                    eventDetails: eventInfo ? {
                        confidence: eventInfo.eventConfidence,
                        response: eventInfo.eventResponse
                    } : null
                });
                
                return finalFormattedResponse;
            } else {
                console.error('AI Engine failed with status:', response.status);
                throw new Error(`AI Engine error: ${response.status}`);
            }
        } catch (aiEngineError) {
            console.error('AI Engine error, falling back to Gemini:', aiEngineError);
            
            // Fallback to Gemini LLM2 with proper formatting instructions
            try {
                return await generateGeminiResponse(query, {
                    user: {
                        name: farmContext.userName || 'Farmer',
                        location: cropData.location_override?.state || farmContext.location?.state || 'Unknown',
                        farmSize: cropData.area_acres || 'Not specified',
                        experience: farmContext.farming_experience || 'intermediate'
                    },
                    crops: [{
                        cropType: cropData.crop_name,
                        variety: cropData.variety,
                        plantingDate: cropData.sowing_date,
                        currentStage: cropData.derived?.stage,
                        growth: cropData.growth_percent,
                        health: cropData.health || 'good',
                        location: cropData.location_override?.state || 'Unknown',
                        soilType: farmContext.soil?.type || 'Unknown',
                        irrigationSchedule: cropData.irrigation_source,
                        growthDays: cropData.derived?.days_after_sowing || 0
                    }]
                });
            } catch (geminiError) {
                console.error('Gemini fallback failed:', geminiError);
                return "I'm sorry, I'm having trouble processing your request right now. Please try again.";
            }
        }
    } catch (error) {
        console.error('Complete query processing error:', error);
        return "I'm experiencing some technical difficulties. Please try again later.";
    }
};

// Main chat endpoint
const handleCropSimChat = asyncErrorHandler(async (req, res) => {
    const { message, cropId, mode = 'my_farm' } = req.body;
    const userId = req.user._id;

    console.log('Received chat request:', { message, cropId, mode: 'my_farm', userId });

    if (!message || !message.trim()) {
        throw new ApiError(400, "Message is required");
    }

    // Crop simulation ALWAYS runs in my_farm mode and requires cropId
    if (!cropId) {
        throw new ApiError(400, "Crop ID is required for Crop Simulation");
    }

    console.log('Processing crop simulation for crop:', cropId);

    // Get the crop and user data
    const [crop, user] = await Promise.all([
        Crop.findOne({
            _id: cropId,
            owner_id: userId
        }),
        User.findById(userId)
    ]);

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Build comprehensive farmContext from user data
    const farmContext = {
        location: {
            state: user.location?.state || "Unknown",
            district: user.location?.district || "Unknown", 
            lat: user.location?.lat,
            lon: user.location?.lon
        },
        farming_experience: "intermediate", // Default value - could be added to user model
        farm_size_acres: user.land_area_acres || 0,
        weather: {
            // Placeholder - could be populated from weather API
            current_conditions: "Unknown"
        },
        soil: {
            // Placeholder - could be populated from soil data
            type: crop.soil_type || "Unknown"
        },
        market_prices: {
            // Placeholder - could be populated from market data
            current_prices: {}
        }
    };

    // Initialize next event data if not present
    const initializedCrop = await initializeNextEventData(crop);

    // Step 1: Use Gemini AI to intelligently detect events and queries
    const detection = await detectEventAndQueryWithGemini(message);
    
    let updatedCrop = initializedCrop;
    let eventResponse = null;
    let queryResponse = null;

    // Step 2: Check for event restrictions if event is detected
    if (detection.hasEvent && detection.eventType && detection.eventConfidence > 0.5) {
        const now = new Date();
        
        // Check if there's an active restriction
        if (initializedCrop.derived?.event_restriction_active && 
            initializedCrop.derived?.event_restriction_until && 
            now < new Date(initializedCrop.derived.event_restriction_until)) {
            
            const restrictionEndDate = new Date(initializedCrop.derived.event_restriction_until);
            const daysLeft = Math.ceil((restrictionEndDate - now) / (1000 * 60 * 60 * 24));
            
            // Event is restricted - reject with LLM2 response
            eventResponse = `🚫 **${initializedCrop.derived.event_restriction_message || 'Action restricted'}**\n\n` +
                          `You need to wait **${daysLeft} more day${daysLeft !== 1 ? 's' : ''}** before performing any farm activities. ` +
                          `**Next recommended activity**: ${initializedCrop.derived.next_event} on **${restrictionEndDate.toLocaleDateString()}**.\n\n` +
                          `⏰ **Proper timing ensures optimal crop health and prevents over-treatment!**`;
        } else {
            // No restriction - proceed with event
            updatedCrop = await updateCropWithEvent(initializedCrop, detection.eventType);
            
            const growthIncrease = updatedCrop.growth_percent - crop.growth_percent;
            
            // Get next recommended event after this action
            const nextEventData = getNextRecommendedEvent(updatedCrop, detection.eventType);
            
            // Update crop with next event information and restrictions
            const restrictionUntil = new Date();
            restrictionUntil.setDate(restrictionUntil.getDate() + nextEventData.restrictionDays);
            
            const nextEventDue = new Date();
            nextEventDue.setDate(nextEventDue.getDate() + Math.max(0, nextEventData.daysUntilNext));
            
            const eventUpdateData = {
                'derived.next_event': nextEventData.nextEvent,
                'derived.next_event_due_date': nextEventDue,
                'derived.next_event_days_until': Math.max(0, nextEventData.daysUntilNext), // Store positive days for database
                'derived.next_event_description': nextEventData.description,
                'derived.event_restriction_active': nextEventData.restrictionDays > 0,
                'derived.event_restriction_until': nextEventData.restrictionDays > 0 ? restrictionUntil : null,
                'derived.event_restriction_message': nextEventData.restrictionMessage || `Wait ${nextEventData.restrictionDays} days before next activity`
            };
            
            updatedCrop = await Crop.findByIdAndUpdate(
                updatedCrop._id,
                { $set: eventUpdateData },
                { new: true, runValidators: true }
            );
            
            // Generate enhanced event confirmation message
            try {
                const baseEventResponse = await generateEventResponse(
                    detection.eventType, 
                    updatedCrop.toObject(), 
                    growthIncrease, 
                    nextEventData
                );
                
                // Add next event information
                let nextEventInfo = "";
                if (nextEventData.daysUntilNext <= 0) {
                    // Event is due now or overdue
                    if (nextEventData.daysUntilNext === 0) {
                        nextEventInfo = `\n\n⚠️ **${nextEventData.nextEvent}** is **due now!** ${nextEventData.description}`;
                    } else {
                        const overdueDays = Math.abs(nextEventData.daysUntilNext);
                        nextEventInfo = `\n\n⚠️ **${nextEventData.nextEvent}** is **overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}!** ${nextEventData.description}`;
                    }
                } else if (nextEventData.daysUntilNext <= 3) {
                    nextEventInfo = `\n\n📅 **Next activity**: ${nextEventData.nextEvent} in **${nextEventData.daysUntilNext} day${nextEventData.daysUntilNext !== 1 ? 's' : ''}** (${nextEventDue.toLocaleDateString()})\n` +
                                  `💡 **Purpose**: ${nextEventData.description}`;
                } else {
                    nextEventInfo = `\n\n📅 **Next activity**: ${nextEventData.nextEvent} in **${nextEventData.daysUntilNext} days** on ${nextEventDue.toLocaleDateString()}\n` +
                                  `💡 **Purpose**: ${nextEventData.description}`;
                }
                
                if (nextEventData.restrictionDays > 0) {
                    nextEventInfo += `\n\n🚫 **Farm activities are now restricted for ${nextEventData.restrictionDays} days** to allow proper timing between treatments.`;
                }
                
                eventResponse = baseEventResponse + nextEventInfo;
            } catch (error) {
                console.error('Error generating enhanced event response:', error);
                
                // Fallback to simple response
                const eventMessages = {
                    irrigation: `🌧️ **Great!** I've recorded your irrigation. Your crop's growth increased by **${growthIncrease.toFixed(1)}%**! Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`,
                    fertilization: `🌱 **Excellent!** Fertilization applied. This boosted growth by **${growthIncrease.toFixed(1)}%**! Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`,
                    pest_check: `🔍 **Good farming practice!** Pest check completed. Growth boost: **${growthIncrease.toFixed(1)}%**. Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`
                };
                
                const baseEventResponse = eventMessages[detection.eventType] || `✅ Farm activity recorded. Growth boost: **${growthIncrease.toFixed(1)}%**`;
                
                // Add next event information
                let nextEventInfo = "";
                if (nextEventData.daysUntilNext <= 0) {
                    // Event is due now or overdue
                    if (nextEventData.daysUntilNext === 0) {
                        nextEventInfo = `\n\n⚠️ **${nextEventData.nextEvent}** is **due now!** ${nextEventData.description}`;
                    } else {
                        const overdueDays = Math.abs(nextEventData.daysUntilNext);
                        nextEventInfo = `\n\n⚠️ **${nextEventData.nextEvent}** is **overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}!** ${nextEventData.description}`;
                    }
                } else if (nextEventData.daysUntilNext <= 3) {
                    nextEventInfo = `\n\n📅 **Next activity**: ${nextEventData.nextEvent} in **${nextEventData.daysUntilNext} day${nextEventData.daysUntilNext !== 1 ? 's' : ''}** (${nextEventDue.toLocaleDateString()})\n` +
                                  `💡 **Purpose**: ${nextEventData.description}`;
                } else {
                    nextEventInfo = `\n\n📅 **Next activity**: ${nextEventData.nextEvent} in **${nextEventData.daysUntilNext} days** on ${nextEventDue.toLocaleDateString()}\n` +
                                  `💡 **Purpose**: ${nextEventData.description}`;
                }
                
                if (nextEventData.restrictionDays > 0) {
                    nextEventInfo += `\n\n🚫 **Farm activities are now restricted for ${nextEventData.restrictionDays} days** to allow proper timing between treatments.`;
                }
                
                eventResponse = baseEventResponse + nextEventInfo;
            }
        }
    }

    // Step 3: Handle queries if detected
    if (detection.hasQuery && detection.queryConfidence > 0.3) {
        const queryToProcess = detection.query || message;
        
        // Prepare event details if both event and query are present
        let eventInfo = null;
        if (detection.hasEvent && detection.eventType && detection.eventConfidence > 0.5) {
            eventInfo = {
                eventType: detection.eventType,
                eventConfidence: detection.eventConfidence,
                wasProcessed: !!eventResponse,
                eventResponse: eventResponse
            };
        }
        
        queryResponse = await processQuery(queryToProcess, updatedCrop.toObject(), farmContext, userId, eventInfo);
    }

    // Step 4: Combine responses
    let finalResponse = "";
    if (eventResponse && queryResponse) {
        finalResponse = `${eventResponse}\n\n${queryResponse}`;
    } else if (eventResponse) {
        finalResponse = eventResponse;
    } else if (queryResponse) {
        finalResponse = queryResponse;
    } else {
        finalResponse = "I'm here to help with your farming needs!";
    }

    console.log('Sending final response:', finalResponse);

    res.status(200).json(
        new ApiResponse(200, {
            response: finalResponse,
            crop: {
                _id: updatedCrop._id,
                growth_percent: updatedCrop.growth_percent,
                derived: updatedCrop.derived
            },
            detection: {
                hasEvent: detection.hasEvent,
                eventType: detection.eventType,
                eventConfidence: detection.eventConfidence,
                hasQuery: detection.hasQuery,
                queryConfidence: detection.queryConfidence,
                wasRestricted: detection.hasEvent && detection.eventConfidence > 0.5 && crop.derived?.event_restriction_active && 
                              crop.derived?.event_restriction_until && 
                              new Date() < new Date(crop.derived.event_restriction_until)
            }
        }, "Chat response generated successfully")
    );
});

export { handleCropSimChat };
