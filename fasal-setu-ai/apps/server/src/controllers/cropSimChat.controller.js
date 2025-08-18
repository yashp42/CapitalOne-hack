import asyncErrorHandler from "../util/asyncErrorHandler.js";
import { ApiResponse } from "../util/ApiResponse.js";
import { ApiError } from "../util/ApiError.js";
import Crop from "../models/crop.model.js";
import { getCropDuration } from "../util/cropDuration.js";

// LLM2 Event Detection Function (Local Implementation)
const detectEventAndQuery = (message) => {
    const lowerMessage = message.toLowerCase();
    
    // Event detection patterns
    const eventPatterns = {
        irrigation: [
            /\b(water|irrigat|sprinkl)\w*\b/,
            /\b(wet|moist)\w*\b/,
            /\bgiv\w*\s+(water|drink)\b/
        ],
        fertilization: [
            /\b(fertiliz|manur|compost|nutrient)\w*\b/,
            /\b(feed|nourish)\w*\b/,
            /\b(npk|nitrogen|phosphorus|potassium)\b/
        ],
        pest_check: [
            /\b(pest|insect|bug|spray|pesticid)\w*\b/,
            /\b(check|inspect|examin)\w*\b/,
            /\b(diseas|infect|treatment)\w*\b/
        ],
        harvest: [
            /\b(harvest|reap|collect|pick)\w*\b/,
            /\b(cut|gather)\w*\b/
        ]
    };
    
    // Action verbs that indicate events
    const actionVerbs = [
        /\b(did|done|applied|gave|watered|fertilized|sprayed|checked)\b/,
        /\b(just|already|today|yesterday|now)\b/,
        /\b(i\s+(will|am|have))\b/
    ];
    
    let detectedEvent = null;
    let eventConfidence = 0.0;
    let hasAction = false;
    
    // Check for action indicators
    for (const pattern of actionVerbs) {
        if (pattern.test(lowerMessage)) {
            hasAction = true;
            break;
        }
    }
    
    // Check for event types
    for (const [eventType, patterns] of Object.entries(eventPatterns)) {
        for (const pattern of patterns) {
            if (pattern.test(lowerMessage)) {
                detectedEvent = eventType;
                eventConfidence = hasAction ? 0.8 : 0.6;
                break;
            }
        }
        if (detectedEvent) break;
    }
    
    // Determine if it's a query
    const queryIndicators = [
        /\b(what|when|how|why|should|can|will|is|are)\b/,
        /\?/,
        /\b(help|advice|suggest|recommend)\w*\b/,
        /\b(tell|explain|show)\w*\b/
    ];
    
    const hasQuery = queryIndicators.some(pattern => pattern.test(lowerMessage));
    
    // If no clear event detected but has query indicators, treat as query only
    if (!detectedEvent && hasQuery) {
        return {
            hasEvent: false,
            eventType: null,
            hasQuery: true,
            query: message,
            confidence: 0.7
        };
    }
    
    // If event detected
    if (detectedEvent) {
        return {
            hasEvent: true,
            eventType: detectedEvent,
            hasQuery: hasQuery,
            query: hasQuery ? message : null,
            confidence: eventConfidence
        };
    }
    
    // Default case - treat as query
    return {
        hasEvent: false,
        eventType: null,
        hasQuery: true,
        query: message,
        confidence: 0.5
    };
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
    
    // Calculate days since last activities
    const daysSinceIrrigation = lastIrrigation ? Math.floor((now - lastIrrigation) / (1000 * 60 * 60 * 24)) : 999;
    const daysSinceFertilization = lastFertilization ? Math.floor((now - lastFertilization) / (1000 * 60 * 60 * 24)) : 999;
    const daysSincePestCheck = lastPestCheck ? Math.floor((now - lastPestCheck) / (1000 * 60 * 60 * 24)) : 999;
    
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
        return {
            nextEvent: mostUrgent.event,
            daysUntilNext: 0, // Overdue
            description: mostUrgent.description,
            restrictionDays: mostUrgent.restrictionDays,
            restrictionMessage: `${mostUrgent.event} is overdue by ${mostUrgent.urgency} days`
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

// Call AI Engine for query processing
const processQuery = async (query, cropData, farmContext, userId) => {
    try {
        // Prepare comprehensive user profile and crop context
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

        const response = await fetch('http://localhost:5000/act', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mode: "my_farm", // Changed from farming_advisor to my_farm
                query: query,
                user_profile: userProfile,
                crop_context: cropContext,
                farm_context: {
                    weather: farmContext.weather,
                    soil: farmContext.soil,
                    market_prices: farmContext.market_prices
                },
                formatting_instructions: {
                    use_bold: true,
                    bold_marker: "**",
                    structure_response: true,
                    include_emojis: true
                }
            })
        });

        if (!response.ok) {
            throw new Error('AI Engine request failed');
        }

        const result = await response.json();
        
        // Ensure response includes formatting instructions for bold text
        let formattedMessage = result.message || "I'm here to help with your farming needs!";
        
        // Add formatting instruction reminder to LLM1 response if not already formatted
        if (!formattedMessage.includes('**')) {
            // If LLM1 didn't use formatting, we can add some basic formatting
            formattedMessage = formattedMessage.replace(/\b(Important|Note|Warning|Tip|Recommendation)\b/gi, '**$1**');
        }
        
        return formattedMessage;
    } catch (error) {
        console.error('AI Engine error:', error);
        return "I'm experiencing some technical difficulties. Please try again later.";
    }
};

// Main chat endpoint
const handleCropSimChat = asyncErrorHandler(async (req, res) => {
    const { message, cropId, farmContext = {} } = req.body;
    const userId = req.user._id;

    if (!message || !message.trim()) {
        throw new ApiError(400, "Message is required");
    }

    if (!cropId) {
        throw new ApiError(400, "Crop ID is required");
    }

    // Get the crop
    const crop = await Crop.findOne({
        _id: cropId,
        owner_id: userId
    });

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    // Initialize next event data if not present
    const initializedCrop = await initializeNextEventData(crop);

    // Step 1: Use LLM2 to detect events and queries
    const detection = detectEventAndQuery(message);
    
    let updatedCrop = initializedCrop;
    let eventResponse = null;
    let queryResponse = null;

    // Step 2: Check for event restrictions if event is detected
    if (detection.hasEvent && detection.eventType) {
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
            nextEventDue.setDate(nextEventDue.getDate() + nextEventData.daysUntilNext);
            
            const eventUpdateData = {
                'derived.next_event': nextEventData.nextEvent,
                'derived.next_event_due_date': nextEventDue,
                'derived.next_event_days_until': nextEventData.daysUntilNext,
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
            
            // Generate event confirmation message with next steps
            const eventMessages = {
                irrigation: `🌧️ **Great!** I've recorded your irrigation. Your crop's growth increased by **${growthIncrease.toFixed(1)}%**! Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`,
                fertilization: `🌱 **Excellent!** Fertilization applied. This boosted growth by **${growthIncrease.toFixed(1)}%**! Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`,
                pest_check: `🔍 **Good farming practice!** Pest check completed. Growth boost: **${growthIncrease.toFixed(1)}%**. Current growth: **${updatedCrop.growth_percent.toFixed(1)}%**`
            };
            
            const baseEventResponse = eventMessages[detection.eventType] || `✅ Farm activity recorded. Growth boost: **${growthIncrease.toFixed(1)}%**`;
            
            // Add next event information
            let nextEventInfo = "";
            if (nextEventData.daysUntilNext === 0) {
                nextEventInfo = `\n\n⚠️ **${nextEventData.nextEvent}** is **due now!** ${nextEventData.description}`;
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

    // Step 3: Handle queries if detected
    if (detection.hasQuery && detection.query) {
        queryResponse = await processQuery(detection.query, updatedCrop.toObject(), farmContext, userId);
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
                hasQuery: detection.hasQuery,
                wasRestricted: detection.hasEvent && crop.derived?.event_restriction_active && 
                              crop.derived?.event_restriction_until && 
                              new Date() < new Date(crop.derived.event_restriction_until)
            }
        }, "Chat response generated successfully")
    );
});

export { handleCropSimChat };
