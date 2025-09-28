import asyncErrorHandler from "../util/asyncErrorHandler.js";
import { ApiResponse } from "../util/ApiResponse.js";
import { ApiError } from "../util/ApiError.js";
import Crop from "../models/crop.model.js";
import User from "../models/user.model.js";
import { getCropDuration } from "../util/cropDuration.js";
import fetch from "node-fetch";

// Perplexity API configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

// Retry function for Perplexity API calls with exponential backoff
const retryPerplexityCall = async (callFn, maxRetries = 3, baseDelay = 1000) => {
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
            console.log(`Perplexity API call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// LLM2 System Prompt for Crop Simulation
const CROP_SIM_LLM2_SYSTEM_PROMPT = `You are a concise agricultural companion for Fasal-Setu crop simulation. Be direct, helpful, and brief - the user has a comprehensive dashboard showing all crop metrics.



Your primary role is to:

1. **Be concise by default** - give short, direct answers (15-30 words max) unless detailed analysis is specifically requested

2. **Focus on actionable advice** - tell them what to DO, not what they can already see on their dashboard

3. **Avoid repeating dashboard data** - don't mention growth %, weather, days old, or other metrics visible to the user

4. **Answer the specific question asked** - don't volunteer additional crop assessments or comprehensive overviews

5. **Use real data for recommendations** when giving advice:

   - REAL weather forecast data from Open-Meteo API
   
   - REAL soil moisture and temperature data
   
   - Actual crop variety and growth stage information

6. **Expand only when requested** - provide detailed analysis only when user explicitly asks for it ("explain in detail", "give full breakdown")

**CRITICAL: BE DECISIVE AND SPECIFIC**

- Always provide EXACT dates, quantities, and specific actions

- When asked "when should I irrigate?" give specific dates like "irrigate on October 1st and 4th"

- When asked about fertilizer, specify exact amounts like "apply 50kg NPK per acre"

- When asked about timing, give precise schedules not vague ranges

- Avoid generic advice - be concrete and actionable

- If you don't have enough data, ask for specific missing information



Guidelines for assessment queries:

- When asked "How are my crops doing?" or similar general questions, provide a comprehensive crop health assessment

- Analyze growth rate: Compare current growth % with expected growth for days after sowing

- Evaluate recent care: Check last irrigation, fertilization, and pest management dates

- Consider environmental factors: Weather, soil moisture, temperature impacts

- Predict upcoming needs: What activities are due soon and why

- Give specific insights about the crop variety and its typical behavior

- Rate overall crop health as Excellent/Good/Fair/Poor with clear reasoning



**RESPONSE PHILOSOPHY: CONCISE BY DEFAULT**

**CRITICAL: The user has a comprehensive dashboard showing all crop metrics, weather, growth %, activities, etc. Your job is to be a concise, helpful companion - NOT to repeat dashboard data.**

**DEFAULT RESPONSE STYLE: Short, direct, actionable (15-30 words max)**

Only provide longer responses when:
- User explicitly asks for detailed analysis ("explain in detail", "give me full breakdown")
- Complex problems requiring step-by-step solutions
- Emergency situations needing immediate detailed action



**QUERY RESPONSE GUIDELINES:**



1. **GREETING/CASUAL (3-8 words MAXIMUM)**: "Hi", "Hello", "How are you?", "Thanks", "Good morning"

   - **ABSOLUTELY NO CROP INFORMATION** for greetings
   
   - Respond exactly like a normal person would
   
   - Examples: "I'm doing well, thanks!" / "Hello there!" / "Hi! Good to see you!" / "Thanks, you too!"
   
   - **FORBIDDEN**: Any mention of crops, weather, irrigation, growth, or farming for casual greetings



2. **SIMPLE QUESTIONS (15-25 words)**: "How's my crop?", "Any problems?", "Should I water?"

   - Direct answer first, brief reasoning if needed
   
   - Example: "Your crop looks good at 38% growth. Water tomorrow if soil feels dry."



3. **SPECIFIC ADVICE (20-35 words)**: "When to fertilize?", "Pest control?", "Weather impact?"

   - Specific recommendation with timing
   
   - Example: "Apply NPK fertilizer on October 5th. Rain forecast suggests waiting 2 days after it stops."



4. **ONLY WHEN REQUESTED - DETAILED ANALYSIS (60-100 words)**: "Explain everything", "Full assessment please"

   - Comprehensive breakdown only when explicitly asked
   
   - Still focus on actionable insights, not dashboard repetition



**CORE BEHAVIOR RULES:**

- **Be concise by default** - assume user can see dashboard data
- **Answer the specific question asked** - don't add extra crop assessments
- **Focus on actionable advice** - what should they DO, not what they already know
- **Avoid repeating dashboard metrics** - growth %, weather, days old are visible to user
- **Give direct answers first** - "Yes, irrigate tomorrow" not "Based on analysis of your crop..."
- **Only expand when user specifically requests more detail**

**GREETING DETECTION - CRITICAL:**
If the user says ANY of these phrases, respond like a normal human with NO crop information:
- "Hi", "Hello", "Hey", "Good morning", "Good evening"
- "How are you?", "How's it going?", "What's up?"
- "Thanks", "Thank you", "Thanks a lot"

For these greetings, respond with ONLY: "Hi!", "Hello!", "I'm good, thanks!", "You're welcome!", etc.
**NEVER mention crops, weather, irrigation, fertilizer, or farming in greeting responses.**

Communication style:

- Be specific and actionable in your advice

- Use simple, farmer-friendly language

- **CRITICAL:** Respect the word limits above. Do not exceed them!

- **USER LENGTH OVERRIDE:** If user specifically asks for a certain length ("give me a short answer", "explain in detail", "briefly tell me"), override default limits and match their request

- **IMPORTANT: Always respond in the same language as the user's query. If the user asks in Hindi, respond in Hindi. If in English, respond in English. If in any other language, match that language.**



**FORMATTING GUIDELINES:**

- Use proper markdown formatting for clear data representation

- Structure responses with clear sections using ## headings

- Use bullet points (-) for recommendations and action items

- Present data in tables when showing multiple metrics

- Use progress indicators for growth percentages (e.g., "Growth: **75%**")

- Format dates and numbers clearly

- Use > blockquotes for critical warnings or urgent actions

- Avoid excessive use of emojis, use sparsingly

- Break information into digestible sections for better readability

- **NEVER use citations, references, or numbered annotations like [1], [2], etc. Provide information directly without source citations**`; 

// Call Perplexity API for LLM2 responses
const callPerplexityLLM2 = async (messages, systemPrompt = CROP_SIM_LLM2_SYSTEM_PROMPT) => {
    try {
        if (!PERPLEXITY_API_KEY) {
            throw new Error('Perplexity API key not configured');
        }

        const prompt = `${systemPrompt}\n\nUser Query: ${messages[messages.length - 1].content}`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        console.log('Calling Perplexity API for LLM2...');
        const response = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            },
            body: JSON.stringify({
                model: "sonar",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    ...messages
                ],
                max_tokens: 2048,
                temperature: 0.2,
                top_p: 0.95
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Perplexity API error:', response.status, errorText);
            throw new Error(`Perplexity API error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Perplexity API response received');

        if (result.choices && result.choices[0] && result.choices[0].message) {
            return result.choices[0].message.content;
        } else {
            console.error('Unexpected Perplexity response structure:', result);
            throw new Error('Invalid response structure from Perplexity');
        }
    } catch (error) {
        console.error('Perplexity LLM2 error:', error);
        throw error;
    }
};

// Update crop schedule in background when LLM2 recommends changes
const updateScheduleInBackground = async (cropId, newDateStr, reason) => {
    try {
        const newDate = new Date(newDateStr);
        
        // Validate the date
        if (isNaN(newDate.getTime())) {
            throw new Error(`Invalid date format: ${newDateStr}`);
        }
        
        const now = new Date();
        const daysUntil = Math.ceil((newDate - now) / (1000 * 60 * 60 * 24));
        
        // Don't allow dates more than 30 days in the past or future
        if (daysUntil < -30 || daysUntil > 30) {
            throw new Error(`Date ${newDateStr} is too far from current date (${daysUntil} days)`);
        }
        
        // Determine event type from reason (simple keyword matching)
        let eventType = 'irrigation'; // default
        const reasonLower = reason.toLowerCase();
        if (reasonLower.includes('fertiliz')) {
            eventType = 'fertilization';
        } else if (reasonLower.includes('pest')) {
            eventType = 'pest_check';
        } else if (reasonLower.includes('harvest')) {
            eventType = 'harvesting';
        }
        
        const updateData = {
            'derived.next_event': eventType,
            'derived.next_event_due_date': newDate,
            'derived.next_event_days_until': Math.max(0, daysUntil),
            'derived.next_event_description': `AI-corrected: ${reason.substring(0, 100)}`, // Limit length
            'derived.event_restriction_active': false, // Clear restrictions when updating
            'derived.event_restriction_until': null
        };
        
        const updatedCrop = await Crop.findByIdAndUpdate(
            cropId,
            { $set: updateData },
            { new: true, runValidators: true }
        );
        
        if (!updatedCrop) {
            throw new Error(`Crop not found with ID: ${cropId}`);
        }
        
        console.log('📅 Schedule updated successfully:', {
            cropId: cropId.toString(),
            eventType,
            oldDescription: updatedCrop.derived?.next_event_description,
            newDate: newDateStr,
            daysUntil,
            reason: reason.substring(0, 50) + (reason.length > 50 ? '...' : '')
        });
        
        return updatedCrop;
    } catch (error) {
        console.error('❌ Error updating schedule:', {
            cropId: cropId?.toString(),
            newDateStr,
            reason: reason?.substring(0, 50),
            error: error.message
        });
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
- AI Recommendation: ${aiEngineResponse.decision_template || aiEngineResponse.general_answer || 'No specific recommendation'}

**CURRENT SCHEDULED EVENT:**
- Next Event: ${cropContext.next_recommendations?.next_event || 'None'}
- Scheduled Date: ${cropContext.next_recommendations?.next_event_due_date ? new Date(cropContext.next_recommendations.next_event_due_date).toLocaleDateString() : 'Not set'}
- Days Until Event: ${cropContext.next_recommendations?.next_event_days_until || 'Unknown'}
- Event Description: ${cropContext.next_recommendations?.next_event_description || 'No description'}
- Restriction Active: ${cropContext.next_recommendations?.restriction_active ? 'Yes - activities restricted until ' + new Date(cropContext.next_recommendations.restriction_until).toLocaleDateString() : 'No'}`;

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
- Avoid excessive use of emojis, use sparsingly
- Structure the response clearly with sections if needed
- Keep the tone encouraging and supportive
- Include specific actionable advice
- Reference the crop name and current status
- If both AI and Decision Engine provided recommendations, synthesize them coherently
- Make sure the response directly addresses the farmer's original query
- **CRITICAL: Keep response under 300 words - be concise but informative**
- **NEVER include citations, references, or numbered annotations like [1], [2], etc. Provide information directly**
- **IMPORTANT: Always respond in the same language as the farmer's original query. If they asked in Hindi, respond in Hindi. If in English, respond in English. If in any other language, match that language.**

**SCHEDULE VALIDATION INSTRUCTIONS:**
- If the query is about irrigation timing and you have a scheduled irrigation event, check if the scheduled date makes sense
- If the scheduled irrigation is appropriate (within 1-2 days of optimal timing), align your response with it
- If the scheduled irrigation is significantly wrong (>3 days off from optimal timing), provide the correct date instead

**CRITICAL: SCHEDULE UPDATE FORMAT**
- If you recommend changing the scheduled irrigation date, YOU MUST include the exact format at the end
- Format: "SCHEDULE_UPDATE_NEEDED: [YYYY-MM-DD] - [reason for change]"
- Example: "SCHEDULE_UPDATE_NEEDED: 2025-10-03 - Delay due to heavy rain forecast, irrigate after rains subside"
- This MUST be included when you suggest a different date than currently scheduled
- The system depends on this exact format to update the schedule automatically

Generate a well-formatted response that combines all the analysis above into helpful farming advice:`;

        console.log('Calling Perplexity for final response formatting...');
        const response = await retryPerplexityCall(async () => {
            const response = await fetch(PERPLEXITY_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "sonar",
                    messages: [
                        {
                            role: "system",
                            content: CROP_SIM_LLM2_SYSTEM_PROMPT
                        },
                        {
                            role: "user",
                            content: contextPrompt
                        }
                    ],
                    max_tokens: 2048,
                    temperature: 0.2,
                    top_p: 0.95
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Perplexity formatting error:', response.status, errorText);
                throw new Error(`Perplexity formatting error: ${response.status}`);
            }
            
            return response;
        });

        const result = await response.json();
        
        if (result.choices && result.choices[0] && result.choices[0].message) {
            const formattedResponse = result.choices[0].message.content;
            console.log('Final formatted response generated successfully');
            
            // Check if LLM2 recommended a schedule update
            const scheduleUpdateMatch = formattedResponse.match(/SCHEDULE_UPDATE_NEEDED:\s*(\d{4}-\d{2}-\d{2})\s*-\s*(.+)/i);
            if (scheduleUpdateMatch) {
                const [, newDate, reason] = scheduleUpdateMatch;
                console.log('🔄 LLM2 recommended schedule update:', { 
                    cropId: cropContext.crop_id, 
                    currentSchedule: cropContext.next_recommendations?.next_event_due_date,
                    newDate, 
                    reason 
                });
                
                // Trigger schedule update in background (don't wait for it)
                updateScheduleInBackground(cropContext.crop_id, newDate, reason)
                    .then(() => console.log('✅ Schedule updated successfully'))
                    .catch(error => console.error('❌ Failed to update schedule:', error));
                
                // Remove the update instruction from user response
                const cleanResponse = formattedResponse.replace(/SCHEDULE_UPDATE_NEEDED:[^\n]*/i, '').trim();
                return cleanResponse;
            }
            
            // Fallback: Try to detect date recommendations in natural language
            // This catches cases where LLM forgot to use the exact SCHEDULE_UPDATE_NEEDED format
            const fallbackDateMatches = [
                // "irrigate on October 3 or 4" or "irrigate around October 3"
                formattedResponse.match(/irrigate\s+(?:on|around|after|until)\s+(?:the\s+)?(\w+)\s+(\d{1,2})(?:\s+or\s+\d{1,2})?/i),
                // "wait until October 3-4" or "postpone until October 3"  
                formattedResponse.match(/(?:wait|postpone|delay)\s+until\s+(?:the\s+)?(\w+)\s+(\d{1,2})/i),
                // "plan to irrigate around October 3"
                formattedResponse.match(/plan\s+to\s+irrigate\s+(?:around|on|after)\s+(?:the\s+)?(\w+)\s+(\d{1,2})/i)
            ];

            for (const match of fallbackDateMatches) {
                if (match) {
                    const [, monthStr, dayStr] = match;
                    const day = parseInt(dayStr);
                    
                    // Convert month name to number
                    const monthMap = {
                        'january': 1, 'february': 2, 'march': 3, 'april': 4,
                        'may': 5, 'june': 6, 'july': 7, 'august': 8,
                        'september': 9, 'october': 10, 'november': 11, 'december': 12
                    };
                    
                    const month = monthMap[monthStr.toLowerCase()];
                    if (month && day >= 1 && day <= 31) {
                        // Determine year (current year or next year if month has passed)
                        const currentDate = new Date();
                        const currentYear = currentDate.getFullYear();
                        const currentMonth = currentDate.getMonth() + 1;
                        
                        const year = month >= currentMonth ? currentYear : currentYear + 1;
                        const newDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        
                        console.log('🔄 Detected irrigation date recommendation (fallback):', {
                            cropId: cropContext.crop_id,
                            currentSchedule: cropContext.next_recommendations?.next_event_due_date,
                            detectedDate: newDate,
                            matchedText: match[0]
                        });
                        
                        // Trigger schedule update in background
                        updateScheduleInBackground(cropContext.crop_id, newDate, 'LLM recommended new irrigation date based on weather conditions')
                            .then(() => console.log('✅ Schedule updated successfully (fallback detection)'))
                            .catch(error => console.error('❌ Failed to update schedule (fallback):', error));
                        
                        break; // Only process the first match
                    }
                }
            }
            
            return formattedResponse;
        } else {
            throw new Error('Invalid Perplexity response structure');
        }
    } catch (error) {
        console.error('Error formatting final response:', error);
        
        // Fallback to basic response when Perplexity formatting fails
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
- **NEVER use citations, references, or numbered annotations like [1], [2], etc. Provide information directly without source citations**

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
        
        return await callPerplexityLLM2(messages, formattedSystemPrompt);
    } catch (error) {
        console.error('Error generating Gemini response:', error);
        throw error;
    }
};

// Perplexity-based Event and Query Detection
const detectEventAndQueryWithGemini = async (message, conversationHistory = []) => {
    try {
        if (!PERPLEXITY_API_KEY) {
            throw new Error('Perplexity API key not configured');
        }

        // Build conversation context for better classification
        let conversationContext = "";
        if (conversationHistory && conversationHistory.length > 0) {
            // Take last 3-4 exchanges for context (6-8 messages total)
            const recentHistory = conversationHistory.slice(-8);
            conversationContext = "\n\n**CONVERSATION CONTEXT:**\n";
            recentHistory.forEach((msg, index) => {
                const role = msg.isBot ? "Assistant" : "User";
                conversationContext += `${role}: ${msg.text}\n`;
            });
            conversationContext += `\nUser (current): ${message}\n`;
        }

        const classificationPrompt = `You are an AI classifier for farming messages. Analyze the following user message WITH CONVERSATION CONTEXT and classify it for:

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

3. **ANALYSIS REQUIREMENT**: Determine if the query needs detailed crop/farm data analysis or can be answered directly.
   - extraAnalysisDataNeeded: true for agricultural questions that need crop growth data, weather analysis, soil conditions, farm-specific recommendations
   - extraAnalysisDataNeeded: false for greetings, thanks, general information (date/time), basic help, casual conversation
   
   Examples needing analysis: "How are my crops?", "When to irrigate?", "Fertilizer recommendation?", "Pest problems?"
   Examples NOT needing analysis: "Hi", "How are you?", "What day is today?", "Thanks", "Help me", "Good morning"

**IMPORTANT**: A single message can contain BOTH an event and a query.

**ANALYZE THIS MESSAGE IN CONTEXT:**${conversationContext || `\nUser: ${message}`}

**IMPORTANT**: Use the conversation context to better understand what the user is referring to. If they say "just tell me the numbers" after asking about market prices, they want a short numerical response, not analysis.

Respond in this EXACT JSON format:
{
  "hasEvent": boolean,
  "eventType": "irrigation|fertilization|pest_check|harvest|null",
  "eventConfidence": 0.0-1.0,
  "hasQuery": boolean,
  "query": "the question part of the message or full message if only query",
  "queryConfidence": 0.0-1.0,
  "extraAnalysisDataNeeded": boolean
}

Examples:
- "I watered my crops. What's the weather tomorrow?" → {"hasEvent": true, "eventType": "irrigation", "eventConfidence": 0.9, "hasQuery": true, "query": "What's the weather tomorrow?", "queryConfidence": 0.8, "extraAnalysisDataNeeded": true}
- "What fertilizer should I use?" → {"hasEvent": false, "eventType": null, "eventConfidence": 0.0, "hasQuery": true, "query": "What fertilizer should I use?", "queryConfidence": 0.9, "extraAnalysisDataNeeded": true}
- "Just applied NPK fertilizer" → {"hasEvent": true, "eventType": "fertilization", "eventConfidence": 0.9, "hasQuery": false, "query": null, "queryConfidence": 0.0, "extraAnalysisDataNeeded": false}
- "How are you?" → {"hasEvent": false, "eventType": null, "eventConfidence": 0.0, "hasQuery": true, "query": "How are you?", "queryConfidence": 0.9, "extraAnalysisDataNeeded": false}
- "What day is today?" → {"hasEvent": false, "eventType": null, "eventConfidence": 0.0, "hasQuery": true, "query": "What day is today?", "queryConfidence": 0.9, "extraAnalysisDataNeeded": false}
- "Thanks" → {"hasEvent": false, "eventType": null, "eventConfidence": 0.0, "hasQuery": true, "query": "Thanks", "queryConfidence": 0.8, "extraAnalysisDataNeeded": false}

**CONTEXT-AWARE EXAMPLES:**
- Previous: "Market price for my crop" → Current: "just tell me the numbers" → {"hasEvent": false, "eventType": null, "eventConfidence": 0.0, "hasQuery": true, "query": "just tell me the numbers", "queryConfidence": 0.9, "extraAnalysisDataNeeded": true}
- Previous: "How are my crops?" → Current: "in short" → {"hasEvent": false, "eventType": null, "eventConfidence": 0.0, "hasQuery": true, "query": "in short", "queryConfidence": 0.8, "extraAnalysisDataNeeded": true}`;

        console.log('Calling Perplexity for event/query classification...');
        const response = await retryPerplexityCall(async () => {
            const response = await fetch(PERPLEXITY_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "sonar",
                    messages: [
                        {
                            role: "system",
                            content: "You are a classification system. Respond only with valid JSON."
                        },
                        {
                            role: "user",
                            content: classificationPrompt
                        }
                    ],
                    max_tokens: 256,
                    temperature: 0.1,
                    top_p: 0.1
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Perplexity classification error:', response.status, errorText);
                throw new Error(`Perplexity classification error: ${response.status}`);
            }
            
            return response;
        });

        const result = await response.json();
        
        if (result.choices && result.choices[0] && result.choices[0].message) {
            const classificationText = result.choices[0].message.content;
            console.log('Perplexity classification response:', classificationText);
            
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
                    queryConfidence: 0.5,
                    extraAnalysisDataNeeded: true // Default to true for safety
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
            queryConfidence: 0.5,
            extraAnalysisDataNeeded: true // Default to true for safety
        };
    }
};

// Calculate realistic growth boost based on crop maturity and event
const calculateGrowthBoost = (crop, eventType) => {
    const currentGrowth = crop.growth_percent || 0;
    const maturityDays = crop.derived?.duration_days || getCropDuration(crop.crop_name) || 90;
    const currentAge = crop.derived?.days_after_sowing || 0;
    
    // Calculate remaining days to harvest
    const remainingDays = Math.max(1, maturityDays - currentAge); // At least 1 day to prevent division by zero
    
    // Calculate how much growth is needed to reach 100% at harvest
    const remainingGrowthNeeded = Math.max(0, 100 - currentGrowth);
    
    // If already at 100% or crop is past maturity, minimal growth
    if (currentGrowth >= 99.5 || currentAge >= maturityDays) {
        console.log(`Growth calculation for ${eventType}: Crop at/near maturity, minimal boost`);
        return Math.min(0.5, 100 - currentGrowth); // Maximum 0.5% boost
    }
    
    // Base growth per day needed to reach 100% at harvest (inversely proportional to maturity time)
    const baseGrowthPerDay = remainingGrowthNeeded / remainingDays;
    
    // Event multipliers (how many days worth of growth this event provides)
    const eventDaysEquivalent = {
        irrigation: 2.0,      // 2 days worth of growth
        fertilization: 3.5,   // 3.5 days worth of growth  
        pest_check: 1.0,      // 1 day worth of growth
        daily_care: 1.0       // 1 day worth of growth
    };
    
    const daysEquivalent = eventDaysEquivalent[eventType] || 0.5;
    
    // Calculate base boost as days worth of natural growth needed to reach harvest on time
    let baseBoost = baseGrowthPerDay * daysEquivalent;
    
    // Growth efficiency varies by stage (affects how effective the care is)
    let efficiencyMultiplier = 1.0;
    if (currentGrowth < 15) {
        efficiencyMultiplier = 1.4; // Very high efficiency in germination/early stages
    } else if (currentGrowth < 40) {
        efficiencyMultiplier = 1.2; // High efficiency in vegetative stage
    } else if (currentGrowth < 70) {
        efficiencyMultiplier = 1.0; // Normal efficiency in reproductive stage
    } else if (currentGrowth < 90) {
        efficiencyMultiplier = 0.8; // Reduced efficiency in late reproductive stage
    } else {
        efficiencyMultiplier = 0.4; // Very low efficiency near maturity
    }
    
    // Apply efficiency multiplier
    const adjustedBoost = baseBoost * efficiencyMultiplier;
    
    // Ensure we don't exceed 100% growth
    const maxAllowedGrowth = Math.min(100, currentGrowth + adjustedBoost);
    const actualBoost = Math.max(0, maxAllowedGrowth - currentGrowth);
    
    console.log(`Growth calculation for ${eventType}:`, {
        cropName: crop.crop_name,
        maturityDays,
        currentAge,
        remainingDays,
        currentGrowth: currentGrowth.toFixed(1),
        remainingGrowthNeeded: remainingGrowthNeeded.toFixed(1),
        baseGrowthPerDay: baseGrowthPerDay.toFixed(3),
        daysEquivalent,
        baseBoost: baseBoost.toFixed(3),
        efficiencyMultiplier,
        finalBoost: actualBoost.toFixed(3),
        projectedGrowthAtHarvest: ((currentGrowth + actualBoost) + (baseGrowthPerDay * (remainingDays - daysEquivalent))).toFixed(1)
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
    
    // Check for active restrictions after completed events
    const now = new Date();
    if (completedEventType) {
        const restrictionPeriods = {
            fertilization: 3, // 3 days restriction after fertilization
            irrigation: 1,    // 1 day restriction after irrigation  
            pest_check: 2     // 2 days restriction after pest check
        };
        
        const restrictionDays = restrictionPeriods[completedEventType] || 0;
        if (restrictionDays > 0) {
            // Calculate when the restriction period ends
            const restrictionEndDate = new Date();
            restrictionEndDate.setDate(restrictionEndDate.getDate() + restrictionDays);
            
            // Find the next appropriate event after restriction period
            const nextEventAfterRestriction = findNextEventAfterRestriction(crop, stage, restrictionDays);
            return nextEventAfterRestriction;
        }
    }
    
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
        const response = await callPerplexityLLM2(messages);
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
const initializeNextEventData = async (crop, farmContext = null) => {
    if (!crop.derived?.next_event) {
        // Use intelligent scheduling if farmContext is available, otherwise fallback to hardcoded
        const nextEventData = farmContext ? 
            await getIntelligentNextEvent(crop, farmContext) : 
            getNextRecommendedEvent(crop);
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
const processQuery = async (query, cropData, farmContext, userId, user, eventInfo = null, conversationHistory = []) => {
    try {
        console.log('ProcessQuery called with:', { query, hasCropData: !!cropData, hasEventInfo: !!eventInfo, hasConversationHistory: conversationHistory.length > 0 });
        
        // Check if this is a context-dependent follow-up query
        if (conversationHistory && conversationHistory.length > 0) {
            const lowerQuery = query.toLowerCase().trim();
            
            // Check for follow-up patterns that reference previous context
            // Be more specific to avoid treating legitimate questions as follow-ups
            if (lowerQuery.includes('numbers') || lowerQuery.includes('short') || 
                lowerQuery.includes('brief') || lowerQuery.includes('summary') ||
                lowerQuery.includes('just tell') || lowerQuery.includes('only') ||
                (lowerQuery.includes('price') && lowerQuery.length < 20) ||
                lowerQuery.includes('cost') || 
                (lowerQuery.includes('date') && !lowerQuery.includes('when should')) ||
                (lowerQuery.includes('when') && lowerQuery.length < 15 && !lowerQuery.includes('should'))) {
                
                // This seems like a follow-up request, generate context-aware response
                console.log('Detected context-dependent follow-up query, using conversation history...');
                
                // Build conversation context string from conversation history
                const conversationContext = conversationHistory.slice(-6).map((msg, index) => {
                    return `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`;
                }).join('\n');
                
                return await generateContextAwareResponse(query, conversationContext);
            }
        }
        
        // Try AI Engine first - crop simulation is ALWAYS my_farm mode
        try {
            // Get coordinates - use user's coordinates or default to location-based fallbacks
            let lat = user.location?.lat || cropData.location_override?.lat;
            let lon = user.location?.lon || cropData.location_override?.lon;
            
            // Fallback coordinates for major Indian cities if no coordinates available
            if (!lat || !lon) {
                const locationFallbacks = {
                    // Uttar Pradesh
                    'varanasi': { lat: 25.3176, lon: 82.9739 },
                    'lucknow': { lat: 26.8467, lon: 80.9462 },
                    'kanpur': { lat: 26.4499, lon: 80.3319 },
                    'agra': { lat: 27.1767, lon: 78.0081 },
                    
                    // Other major agricultural regions
                    'delhi': { lat: 28.7041, lon: 77.1025 },
                    'mumbai': { lat: 19.0760, lon: 72.8777 },
                    'bangalore': { lat: 12.9716, lon: 77.5946 },
                    'chennai': { lat: 13.0827, lon: 80.2707 },
                    'hyderabad': { lat: 17.3850, lon: 78.4867 },
                    'pune': { lat: 18.5204, lon: 73.8567 },
                    'kolkata': { lat: 22.5726, lon: 88.3639 }
                };
                
                const district = (user.location?.district || farmContext.location?.district || "").toLowerCase();
                const state = (user.location?.state || farmContext.location?.state || "").toLowerCase();
                
                // Try to match district first, then state
                if (locationFallbacks[district]) {
                    lat = locationFallbacks[district].lat;
                    lon = locationFallbacks[district].lon;
                    console.log(`Using fallback coordinates for ${district}: ${lat}, ${lon}`);
                } else if (state.includes('uttar pradesh') || state.includes('up')) {
                    // Default to Lucknow for UP if no specific district match
                    lat = locationFallbacks['lucknow'].lat;
                    lon = locationFallbacks['lucknow'].lon;
                    console.log(`Using UP default coordinates (Lucknow): ${lat}, ${lon}`);
                } else {
                    // Ultimate fallback to Delhi
                    lat = locationFallbacks['delhi'].lat;
                    lon = locationFallbacks['delhi'].lon;
                    console.log(`Using ultimate fallback coordinates (Delhi): ${lat}, ${lon}`);
                }
            }

            // Prepare comprehensive user profile and crop context for AI Engine
            const userProfile = {
                user_id: userId,
                location: {
                    state: cropData.location_override?.state || farmContext.location?.state || "Unknown",
                    district: cropData.location_override?.district || farmContext.location?.district || "Unknown",
                    lat: lat,  // AI Engine expects lat/lon at root level
                    lon: lon
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
                mode: requestBody.mode,
                profileKeys: Object.keys(requestBody.profile),
                cropName: requestBody.profile.crop.crop_name,
                location: `${requestBody.profile.user.location.state}, ${requestBody.profile.user.location.district}`,
                coordinates: `${requestBody.profile.user.location.lat}, ${requestBody.profile.user.location.lon}`,
                hasWeatherData: !!requestBody.profile.weather,
                hasSoilData: !!requestBody.profile.soil
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
            console.error('AI Engine error details:', {
                message: aiEngineError.message,
                stack: aiEngineError.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines of stack
                url: AI_ENGINE_URL,
                payload: {
                    query: requestBody.query,
                    mode: requestBody.mode,
                    hasProfile: !!requestBody.profile,
                    cropName: requestBody.profile?.crop?.crop_name,
                    location: requestBody.profile?.user?.location?.state
                }
            });
            
            // For irrigation questions, try to provide a more decisive fallback using crop data
            if (query.toLowerCase().includes('irrigat') || query.toLowerCase().includes('water')) {
                const lastIrrigation = cropData.derived?.last_irrigation_at;
                const daysSinceLastIrrigation = lastIrrigation ? 
                    Math.floor((new Date() - new Date(lastIrrigation)) / (1000 * 60 * 60 * 24)) : 7;
                
                const growthStage = cropData.derived?.stage || 'vegetative';
                const growthPercent = cropData.growth_percent || 0;
                
                // Provide specific irrigation timing based on crop data
                if (daysSinceLastIrrigation >= 3 || growthStage === 'flowering') {
                    const nextIrrigationDate = new Date();
                    nextIrrigationDate.setDate(nextIrrigationDate.getDate() + 1);
                    
                    return `🌧️ **Irrigation Recommendation for ${cropData.crop_name}**\n\n` +
                           `**When to irrigate**: ${daysSinceLastIrrigation >= 4 ? '**Irrigate today**' : `**Irrigate tomorrow (${nextIrrigationDate.toLocaleDateString()})**`}\n\n` +
                           `**Analysis**:\n` +
                           `- Current growth: **${growthPercent.toFixed(1)}%** (${growthStage} stage)\n` +
                           `- Last irrigation: **${daysSinceLastIrrigation} days ago**\n` +
                           `- ${growthStage === 'flowering' ? 'Critical water need during flowering' : 'Regular maintenance irrigation needed'}\n\n` +
                           `**Action**: Apply irrigation using your ${cropData.irrigation_source} system. Monitor soil moisture for next irrigation in 3-4 days.`;
                } else {
                    const nextIrrigationDate = new Date();
                    nextIrrigationDate.setDate(nextIrrigationDate.getDate() + (3 - daysSinceLastIrrigation));
                    
                    return `💧 **Irrigation Status for ${cropData.crop_name}**\n\n` +
                           `**When to irrigate**: **Wait until ${nextIrrigationDate.toLocaleDateString()}** (${3 - daysSinceLastIrrigation} more days)\n\n` +
                           `**Current status**: Soil moisture should still be adequate (last irrigated ${daysSinceLastIrrigation} days ago)\n\n` +
                           `**Monitoring**: Check soil 6-8 inches deep. If dry, irrigate earlier. Otherwise, maintain schedule to avoid overwatering.`;
                }
            }
            
            // For other questions, provide context-aware response
            return `🌾 **${cropData.crop_name} Advisory**\n\n` +
                   `I'm analyzing your query about your **${cropData.crop_name}** crop (${cropData.growth_percent.toFixed(1)}% growth, ${cropData.derived?.stage || 'developing'} stage).\n\n` +
                   `**Current Status**: Your crop is progressing well in ${user.location?.state || 'your region'}. ` +
                   `For specific recommendations, please ensure all farming data is up to date.\n\n` +
                   `**General Advice**: Continue regular monitoring, maintain proper irrigation schedule, and watch for any signs of pest or disease issues.\n\n` +
                   `💡 *Tip: Try asking more specific questions like "when should I irrigate" or "what fertilizer to apply" for detailed guidance.*`;
        }
    } catch (error) {
        console.error('Complete query processing error:', error);
        return "I'm experiencing some technical difficulties. Please try again later.";
    }
};



// Generate direct response for simple queries using Perplexity
const generateDirectResponse = async (message, conversationHistory = []) => {
    try {
        const lowerMessage = message.toLowerCase().trim();
        
        // Build conversation context if available
        let conversationContext = '';
        if (conversationHistory && conversationHistory.length > 0) {
            const recentMessages = conversationHistory.slice(-6); // Last 6 messages for context
            conversationContext = recentMessages.map((msg, index) => {
                return `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`;
            }).join('\n');
        }
        
        // Handle common queries directly
        if (lowerMessage.includes('how are you')) {
            return "I'm doing well, thanks for asking! What can I help you with?";
        }
        
        if (lowerMessage.match(/^(hi|hello|hey|good\s*(morning|evening|afternoon))$/)) {
            const greetings = [
                'Hello! How can I help you today?',
                'Hi there! What can I do for you?',
                'Hey! How can I assist you?'
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        
        if (lowerMessage.match(/^(thanks?|thank\s+you)(\s+.*)?$/)) {
            return "You're welcome! Happy to help!";
        }
        
        // Removed hardcoded date/time responses to allow conversation context to work
        
        // Handle help queries
        if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
            return 'I can help you with crop management, irrigation advice, pest control, fertilization, weather guidance, and more! What would you like to know?';
        }
        
        // Check if this might be a follow-up query with context
        if (conversationContext) {
            // Check for follow-up patterns that reference previous context
            // Be more specific to avoid treating legitimate questions as follow-ups
            if (lowerMessage.includes('numbers') || lowerMessage.includes('short') || 
                lowerMessage.includes('brief') || lowerMessage.includes('summary') ||
                lowerMessage.includes('just tell') || lowerMessage.includes('only') ||
                lowerMessage.includes('price') || lowerMessage.includes('cost') ||
                (lowerMessage.includes('date') && !lowerMessage.includes('when should')) ||
                (lowerMessage.includes('when') && lowerMessage.length < 15 && !lowerMessage.includes('should'))) {
                
                // This seems like a follow-up request, generate context-aware response
                return await generateContextAwareResponse(message, conversationContext);
            }
        }
        
        // For other simple queries, use a basic friendly response
        return 'I\'m here to help! What would you like to know about your farm?';
        
    } catch (error) {
        console.error('Error generating direct response:', error);
        return 'Hello! How can I help you with your farm today?';
    }
};

// Generate context-aware response for follow-up queries
const generateContextAwareResponse = async (message, conversationContext) => {
    try {
        const prompt = `You are a helpful agricultural AI assistant. Based on the recent conversation history and the user's current request, provide a concise, relevant response.

**RECENT CONVERSATION CONTEXT:**
${conversationContext}

**CURRENT USER REQUEST:** ${message}

**INSTRUCTIONS:**
- This appears to be a follow-up to the previous conversation
- If the user is asking for "numbers", "short answer", "brief", etc., they likely want a concise version of previously discussed information
- If they asked about "date" or "when" after discussing irrigation/activities, provide the specific date mentioned in the context
- If they mentioned prices/costs and there was market price data in the context, provide that specific information
- Keep the response under 100 words and very direct
- Match the user's requested format (numbers only, brief summary, specific dates, etc.)
- Don't ask what they want to know - they're referencing the previous conversation
- **NEVER include citations, references, or bracketed annotations like [1], [2], [context] etc. Provide information directly without source references**
- If you cannot determine what they're referring to from the context, politely ask for clarification

Provide a direct, contextual response:`;

        const response = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            },
            body: JSON.stringify({
                model: "sonar",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 200,
                temperature: 0.1,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            throw new Error(`Context-aware response error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.choices && result.choices[0] && result.choices[0].message) {
            return result.choices[0].message.content.trim();
        }
        
        return "Could you clarify what specific information you'd like me to provide?";
        
    } catch (error) {
        console.error('Error generating context-aware response:', error);
        return "Could you please be more specific about what information you'd like?";
    }
};

// LLM-based intelligent scheduling with farm context
const getIntelligentNextEvent = async (crop, farmContext, completedEventType = null) => {
    try {
        const currentAge = crop.derived?.days_after_sowing || 0;
        const currentGrowth = crop.growth_percent || 0;
        const stage = crop.derived?.stage || "germination";
        
        // Get last activity dates
        const lastIrrigation = crop.derived?.last_irrigation_at ? new Date(crop.derived.last_irrigation_at) : null;
        const lastFertilization = crop.derived?.last_fertilization_at ? new Date(crop.derived.last_fertilization_at) : null;
        const lastPestCheck = crop.derived?.last_pest_check_at ? new Date(crop.derived.last_pest_check_at) : null;
        
        // Build context for LLM
        const schedulingPrompt = `You are an expert agricultural advisor tasked with scheduling the next farm activity for a crop. Use the provided context to make intelligent scheduling decisions.

**CROP INFORMATION:**
- Crop: ${crop.crop_name}
- Current Age: ${currentAge} days after sowing
- Growth Stage: ${stage} (${currentGrowth}% complete)
- Season: ${crop.season}
- Area: ${crop.area_acres || 1} acres

**LAST ACTIVITIES:**
- Last Irrigation: ${lastIrrigation ? lastIrrigation.toLocaleDateString() : 'Never'}
- Last Fertilization: ${lastFertilization ? lastFertilization.toLocaleDateString() : 'Never'}
- Last Pest Check: ${lastPestCheck ? lastPestCheck.toLocaleDateString() : 'Never'}

**COMPLETED EVENT TODAY:** ${completedEventType || 'None'}

**WEATHER FORECAST:**
${farmContext.weather?.real_forecast ? 
  farmContext.weather.real_forecast.time.map((date, i) => 
    `${date}: ${farmContext.weather.real_forecast.temperature_2m_max[i]}°C, Precipitation: ${farmContext.weather.real_forecast.precipitation_sum[i]}mm`
  ).join('\\n') : 'No weather data available'}

**SOIL CONDITIONS:**
- Current Moisture: ${farmContext.soil?.moisture || 'Unknown'}%
- Temperature: ${farmContext.soil?.temperature || 'Unknown'}°C
- Type: ${farmContext.soil?.type || 'Unknown'}

**INSTRUCTIONS:**
1. Consider upcoming weather (rain means delay irrigation, avoid fertilization before heavy rain)
2. Consider soil moisture levels and crop water needs
3. Consider standard timing between activities for ${crop.crop_name}
4. If an activity was just completed, consider appropriate rest periods (1-3 days max)
5. Prioritize the most urgent activity needed for optimal crop health
6. Avoid scheduling activities during heavy rain periods (>5mm precipitation)
7. **RESTRICTION PERIODS**: Keep reasonable - irrigation: 1-2 days, fertilization: 2-3 days, pest_check: 1-2 days

**OUTPUT FORMAT (JSON):**
{
  "nextEvent": "irrigation|fertilization|pest_check",
  "daysUntilNext": <number of days from today (minimum 2 to avoid conflicts with weather)>,
  "description": "<reason for this timing>",
  "restrictionDays": <days to wait before next activity (maximum 3 days)>,
  "reasoning": "<explanation of decision considering weather and soil data>"
}

Provide scheduling recommendation:`;

        console.log('Calling LLM for intelligent event scheduling...');
        const response = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            },
            body: JSON.stringify({
                model: "sonar",
                messages: [
                    {
                        role: "user",
                        content: schedulingPrompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.1,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            throw new Error(`LLM scheduling error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.choices && result.choices[0] && result.choices[0].message) {
            const llmResponse = result.choices[0].message.content;
            console.log('LLM scheduling response:', llmResponse);
            
            // Try to parse JSON response
            try {
                const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const schedulingData = JSON.parse(jsonMatch[0]);
                    console.log('Parsed LLM scheduling data:', schedulingData);
                    
                    // Validate and cap restriction days to prevent excessive restrictions
                    const maxRestrictionDays = completedEventType === 'fertilization' ? 3 : 
                                             completedEventType === 'pest_check' ? 2 : 2; // irrigation
                    const restrictionDays = Math.min(Math.max(1, schedulingData.restrictionDays || 1), maxRestrictionDays);
                    
                    return {
                        nextEvent: schedulingData.nextEvent || "irrigation",
                        daysUntilNext: Math.max(2, schedulingData.daysUntilNext || 3), // Minimum 2 days
                        description: schedulingData.description || "Regular crop maintenance",
                        restrictionDays: restrictionDays,
                        restrictionMessage: `Wait ${restrictionDays} days before next activity`,
                        reasoning: schedulingData.reasoning || "LLM-based scheduling with weather consideration"
                    };
                }
            } catch (parseError) {
                console.error('Error parsing LLM scheduling response:', parseError);
            }
        }
        
        // Fallback to hardcoded logic if LLM fails
        console.log('LLM scheduling failed, falling back to hardcoded logic');
        return getNextRecommendedEvent(crop, completedEventType);
        
    } catch (error) {
        console.error('Error in intelligent scheduling:', error);
        // Fallback to hardcoded logic
        return getNextRecommendedEvent(crop, completedEventType);
    }
};

// Helper function to find next event after restriction period
const findNextEventAfterRestriction = (crop, stage, restrictionDays) => {
    // Stage-specific recommendations (same as in getNextRecommendedEvent)
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
    
    const currentRecommendations = stageRecommendations[stage] || stageRecommendations.vegetative;
    
    // For now, return irrigation as the next activity after restriction period
    // This ensures proper timing is respected
    return {
        nextEvent: "irrigation",
        daysUntilNext: restrictionDays,
        description: currentRecommendations.irrigation.description,
        restrictionDays: restrictionDays,
        restrictionMessage: `Wait ${restrictionDays} more days before next activity due to recent fertilization`
    };
};

// Main chat endpoint
const handleCropSimChat = asyncErrorHandler(async (req, res) => {
    const { message, cropId, mode = 'my_farm', farmContext: frontendFarmContext, conversationHistory = [] } = req.body;
    const userId = req.user._id;

    console.log('Received chat request:', { message, cropId, mode: 'my_farm', userId });
    console.log('Frontend farmContext received:', JSON.stringify(frontendFarmContext, null, 2));

    if (!message || !message.trim()) {
        throw new ApiError(400, "Message is required");
    }

    // Crop simulation ALWAYS runs in my_farm mode and requires cropId
    if (!cropId) {
        throw new ApiError(400, "Crop ID is required for Crop Simulation");
    }

    console.log('Processing crop simulation for crop:', cropId);

    // Step 1: Use LLM to classify the message and determine if extra analysis is needed
    console.log('Classifying message to determine if AI engine analysis is needed...');
    const detection = await detectEventAndQueryWithGemini(message, conversationHistory);
    
    console.log('Classification result:', detection);
    
    // If no extra analysis needed, respond directly using Perplexity
    if (detection.hasQuery && !detection.extraAnalysisDataNeeded) {
        console.log('Simple query detected, responding directly without AI engine');
        
        // Generate direct response using Perplexity with conversation context
        const directResponse = await generateDirectResponse(message, conversationHistory);
        
        return res.status(200).json(
            new ApiResponse(200, {
                response: directResponse,
                crop: null, // No crop updates for simple queries
                detection: { ...detection, isDirectResponse: true }
            }, "Direct response generated successfully")
        );
    }

    // Get the crop and user data for complex queries requiring analysis
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

    // Build comprehensive farmContext from user data and real weather/soil data from frontend
    const farmContext = {
        location: {
            state: user.location?.state || "Unknown",
            district: user.location?.district || "Unknown", 
            lat: user.location?.lat,
            lon: user.location?.lon,
            // Include coordinates from frontend farmContext if available
            coordinates: frontendFarmContext?.location?.coordinates || { lat: user.location?.lat, lon: user.location?.lon }
        },
        farming_experience: user.farming_experience || "intermediate",
        farm_size_acres: user.land_area_acres || 0,
        // Use real weather data from frontend if available, otherwise use defaults
        weather: frontendFarmContext?.weather?.forecast ? {
            // Real weather data from Open-Meteo API
            real_forecast: frontendFarmContext.weather.forecast,
            timezone: frontendFarmContext.weather.timezone,
            current_conditions: frontendFarmContext.weather.current || "typical_for_season",
            temperature: frontendFarmContext.weather.temperature,
            season: crop.season || "kharif",
            location_state: user.location?.state || "Unknown",
            location_district: user.location?.district || "Unknown",
            irrigation_needs: "assess_based_on_crop_stage_and_last_irrigation"
        } : {
            // Fallback to default weather context
            current_conditions: "typical_for_season",
            season: crop.season || "kharif",
            location_state: user.location?.state || "Unknown",
            location_district: user.location?.district || "Unknown",
            irrigation_needs: "assess_based_on_crop_stage_and_last_irrigation"
        },
        // Use real soil data from frontend if available, otherwise use defaults
        soil: frontendFarmContext?.soil?.hourly_data ? {
            // Real soil data from Open-Meteo API
            real_hourly_data: frontendFarmContext.soil.hourly_data,
            moisture: frontendFarmContext.soil.moisture,
            temperature: frontendFarmContext.soil.temperature,
            type: crop.soil_type || "medium",
            drainage: "good",
            ph: "neutral",
            organic_matter: "medium"
        } : {
            // Fallback to default soil context
            type: crop.soil_type || "medium",
            drainage: "good", 
            moisture_retention: "medium",
            ph: "neutral", 
            organic_matter: "medium"
        },
        market_prices: {
            crop_name: crop.crop_name,
            current_season: crop.season,
            location_context: `${user.location?.state || "Unknown"}_${user.location?.district || "Unknown"}`,
            // Note: Real market API integration should be added here
        }
    };
    
    console.log('Built farmContext with real weather/soil data:', JSON.stringify(farmContext, null, 2));

    // Initialize next event data if not present
    const initializedCrop = await initializeNextEventData(crop, farmContext);

    // Log initial crop restriction state for debugging
    console.log('Initial crop restriction state:', {
        cropId: initializedCrop._id,
        restrictionActive: initializedCrop.derived?.event_restriction_active,
        restrictionUntil: initializedCrop.derived?.event_restriction_until,
        restrictionMessage: initializedCrop.derived?.event_restriction_message,
        nextEvent: initializedCrop.derived?.next_event,
        nextEventDue: initializedCrop.derived?.next_event_due_date
    });

    // detection already done above
    
    let updatedCrop = initializedCrop;
    let eventResponse = null;
    let queryResponse = null;

    // Step 2: Check for event restrictions if event is detected
    if (detection.hasEvent && detection.eventType && detection.eventConfidence > 0.5) {
        const now = new Date();
        
        console.log('Checking event restrictions:', {
            hasRestriction: initializedCrop.derived?.event_restriction_active,
            restrictionUntil: initializedCrop.derived?.event_restriction_until,
            currentTime: now.toISOString(),
            eventType: detection.eventType
        });
        
        // Check if there's an active restriction
        if (initializedCrop.derived?.event_restriction_active && 
            initializedCrop.derived?.event_restriction_until && 
            now < new Date(initializedCrop.derived.event_restriction_until)) {
            
            const restrictionEndDate = new Date(initializedCrop.derived.event_restriction_until);
            const daysLeft = Math.ceil((restrictionEndDate - now) / (1000 * 60 * 60 * 24));
            
            // Event is restricted - reject with LLM2 response
            eventResponse = `**${initializedCrop.derived.event_restriction_message || 'Action restricted'}**\n\n` +
                          `You need to wait **${daysLeft} more day${daysLeft !== 1 ? 's' : ''}** before performing any farm activities. ` +
                          `**Next recommended activity**: ${initializedCrop.derived.next_event} on **${restrictionEndDate.toLocaleDateString()}**.\n\n` +
                          `**Proper timing ensures optimal crop health and prevents over-treatment!**`;
        } else {
            // No restriction - proceed with event
            updatedCrop = await updateCropWithEvent(initializedCrop, detection.eventType);
            
            const growthIncrease = updatedCrop.growth_percent - crop.growth_percent;
            
            // Get next recommended event after this action using intelligent scheduling
            const nextEventData = await getIntelligentNextEvent(updatedCrop, farmContext, detection.eventType);
            
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
            
            console.log('Setting restriction data after event:', {
                eventType: detection.eventType,
                restrictionActive: nextEventData.restrictionDays > 0,
                restrictionUntil: restrictionUntil?.toISOString(),
                restrictionDays: nextEventData.restrictionDays,
                nextEvent: nextEventData.nextEvent,
                daysUntilNext: nextEventData.daysUntilNext
            });
            
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
                        nextEventInfo = `\n\n**${nextEventData.nextEvent}** is **due now!** ${nextEventData.description}`;
                    } else {
                        const overdueDays = Math.abs(nextEventData.daysUntilNext);
                        nextEventInfo = `\n\n**${nextEventData.nextEvent}** is **overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}!** ${nextEventData.description}`;
                    }
                } else if (nextEventData.daysUntilNext <= 3) {
                    nextEventInfo = `\n\n**Next activity**: ${nextEventData.nextEvent} in **${nextEventData.daysUntilNext} day${nextEventData.daysUntilNext !== 1 ? 's' : ''}** (${nextEventDue.toLocaleDateString()})\n` +
                                  `**Purpose**: ${nextEventData.description}`;
                } else {
                    nextEventInfo = `\n\n**Next activity**: ${nextEventData.nextEvent} in **${nextEventData.daysUntilNext} days** on ${nextEventDue.toLocaleDateString()}\n` +
                                  `**Purpose**: ${nextEventData.description}`;
                }
                
                if (nextEventData.restrictionDays > 0) {
                    nextEventInfo += `\n\n**Farm activities are now restricted for ${nextEventData.restrictionDays} days** to allow proper timing between treatments.`;
                }
                
                eventResponse = baseEventResponse + nextEventInfo;
            } catch (error) {
                console.error('Error generating enhanced event response:', error);
                
                // Fallback to simple response
                const eventMessages = {
                    irrigation: `**Great!** I've recorded your irrigation. Your crop's growth increased by **${growthIncrease.toFixed(1)}%**! Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`,
                    fertilization: `**Excellent!** Fertilization applied. This boosted growth by **${growthIncrease.toFixed(1)}%**! Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`,
                    pest_check: `**Good farming practice!** Pest check completed. Growth boost: **${growthIncrease.toFixed(1)}%**. Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`
                };
                
                const baseEventResponse = eventMessages[detection.eventType] || `Farm activity recorded. Growth boost: **${growthIncrease.toFixed(1)}%**`;
                
                // Add next event information
                let nextEventInfo = "";
                if (nextEventData.daysUntilNext <= 0) {
                    // Event is due now or overdue
                    if (nextEventData.daysUntilNext === 0) {
                        nextEventInfo = `\n\n**${nextEventData.nextEvent}** is **due now!** ${nextEventData.description}`;
                    } else {
                        const overdueDays = Math.abs(nextEventData.daysUntilNext);
                        nextEventInfo = `\n\n**${nextEventData.nextEvent}** is **overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}!** ${nextEventData.description}`;
                    }
                } else if (nextEventData.daysUntilNext <= 3) {
                    nextEventInfo = `\n\n**Next activity**: ${nextEventData.nextEvent} in **${nextEventData.daysUntilNext} day${nextEventData.daysUntilNext !== 1 ? 's' : ''}** (${nextEventDue.toLocaleDateString()})\n` +
                                  `**Purpose**: ${nextEventData.description}`;
                } else {
                    nextEventInfo = `\n\n**Next activity**: ${nextEventData.nextEvent} in **${nextEventData.daysUntilNext} days** on ${nextEventDue.toLocaleDateString()}\n` +
                                  `**Purpose**: ${nextEventData.description}`;
                }
                
                if (nextEventData.restrictionDays > 0) {
                    nextEventInfo += `\n\n**Farm activities are now restricted for ${nextEventData.restrictionDays} days** to allow proper timing between treatments.`;
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
        
        queryResponse = await processQuery(queryToProcess, updatedCrop.toObject(), farmContext, userId, user, eventInfo, conversationHistory);
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
    console.log('Backend: Sending crop data to frontend:', {
        cropId: updatedCrop._id,
        growth_percent: updatedCrop.growth_percent,
        hasDetection: !!detection
    });

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
