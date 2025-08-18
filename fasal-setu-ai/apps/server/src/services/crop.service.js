import Crop from "../models/crop.model.js";
import User from "../models/user.model.js";

/**
 * Calculate crop growth based on days after sowing and crop type
 */
const calculateExpectedGrowth = (crop) => {
    const daysAfterSowing = crop.derived.days_after_sowing;
    
    // Growth timeline varies by crop type (approximate days)
    const growthTimelines = {
        'wheat': { germination: 7, vegetative: 45, flowering: 90, maturity: 120 },
        'rice': { germination: 10, vegetative: 60, flowering: 105, maturity: 140 },
        'maize': { germination: 5, vegetative: 35, flowering: 70, maturity: 100 },
        'cotton': { germination: 8, vegetative: 60, flowering: 120, maturity: 180 },
        'sugarcane': { germination: 15, vegetative: 120, flowering: 300, maturity: 365 }
    };

    const timeline = growthTimelines[crop.crop_name.toLowerCase()] || growthTimelines['wheat'];
    
    if (daysAfterSowing <= timeline.germination) {
        return Math.min(10, (daysAfterSowing / timeline.germination) * 10);
    } else if (daysAfterSowing <= timeline.vegetative) {
        return Math.min(25, 10 + ((daysAfterSowing - timeline.germination) / (timeline.vegetative - timeline.germination)) * 15);
    } else if (daysAfterSowing <= timeline.flowering) {
        return Math.min(65, 25 + ((daysAfterSowing - timeline.vegetative) / (timeline.flowering - timeline.vegetative)) * 40);
    } else if (daysAfterSowing <= timeline.maturity) {
        return Math.min(100, 65 + ((daysAfterSowing - timeline.flowering) / (timeline.maturity - timeline.flowering)) * 35);
    } else {
        return 100;
    }
};

/**
 * Get irrigation recommendations based on crop stage and weather
 */
const getIrrigationRecommendation = (crop) => {
    const stage = crop.derived.stage;
    const daysSinceIrrigation = crop.derived.last_irrigation_at 
        ? Math.floor((new Date() - crop.derived.last_irrigation_at) / (1000 * 60 * 60 * 24))
        : 999;

    const recommendations = {
        'germination': { frequency: 2, amount: '20-25mm', critical: daysSinceIrrigation > 3 },
        'seedling': { frequency: 3, amount: '25-30mm', critical: daysSinceIrrigation > 4 },
        'vegetative': { frequency: 5, amount: '35-40mm', critical: daysSinceIrrigation > 7 },
        'tillering': { frequency: 4, amount: '40-45mm', critical: daysSinceIrrigation > 6 },
        'flowering': { frequency: 3, amount: '45-50mm', critical: daysSinceIrrigation > 4 },
        'grain_filling': { frequency: 4, amount: '35-40mm', critical: daysSinceIrrigation > 5 },
        'maturity': { frequency: 7, amount: '20-25mm', critical: daysSinceIrrigation > 10 }
    };

    return recommendations[stage] || recommendations['vegetative'];
};

/**
 * Get crops that need attention (irrigation, growth monitoring, etc.)
 */
const getCropsNeedingAttention = async (userId) => {
    const crops = await Crop.findActiveCrops(userId);
    const needsAttention = [];

    for (const crop of crops) {
        const issues = [];
        
        // Check irrigation needs
        const irrigationRec = getIrrigationRecommendation(crop);
        if (irrigationRec.critical) {
            issues.push({
                type: 'irrigation',
                priority: 'high',
                message: `Irrigation overdue by ${Math.floor((new Date() - crop.derived.last_irrigation_at) / (1000 * 60 * 60 * 24))} days`
            });
        }

        // Check growth progress
        const expectedGrowth = calculateExpectedGrowth(crop);
        if (crop.growth_percent < expectedGrowth - 15) {
            issues.push({
                type: 'growth',
                priority: 'medium',
                message: `Growth below expected (${crop.growth_percent}% vs ${expectedGrowth.toFixed(1)}% expected)`
            });
        }

        // Check crop stage progression
        if (crop.derived.days_after_sowing > 30 && crop.derived.stage === 'germination') {
            issues.push({
                type: 'stage',
                priority: 'high',
                message: 'Crop should have progressed beyond germination stage'
            });
        }

        if (issues.length > 0) {
            needsAttention.push({
                crop,
                issues,
                totalIssues: issues.length,
                highPriorityIssues: issues.filter(i => i.priority === 'high').length
            });
        }
    }

    return needsAttention.sort((a, b) => b.highPriorityIssues - a.highPriorityIssues);
};

/**
 * Generate crop insights and recommendations
 */
const generateCropInsights = async (userId) => {
    const crops = await Crop.findActiveCrops(userId);
    const user = await User.findById(userId);
    
    const insights = {
        overview: {
            total_active_crops: crops.length,
            total_area: crops.reduce((sum, crop) => sum + crop.area_acres, 0),
            avg_growth: crops.length > 0 ? crops.reduce((sum, crop) => sum + crop.growth_percent, 0) / crops.length : 0
        },
        by_stage: {},
        recommendations: [],
        alerts: []
    };

    // Group by stage
    crops.forEach(crop => {
        const stage = crop.derived.stage;
        if (!insights.by_stage[stage]) {
            insights.by_stage[stage] = { count: 0, crops: [] };
        }
        insights.by_stage[stage].count++;
        insights.by_stage[stage].crops.push(crop._id);
    });

    // Generate recommendations
    const needsAttention = await getCropsNeedingAttention(userId);
    insights.alerts = needsAttention;

    // General recommendations based on season and location
    if (user?.location?.state) {
        insights.recommendations.push({
            type: 'seasonal',
            message: `Consider weather patterns for ${user.location.state} region`,
            priority: 'low'
        });
    }

    return insights;
};

/**
 * Sync crop growth with simulation
 */
const syncCropWithSimulation = async (cropId, simulationData) => {
    const crop = await Crop.findById(cropId);
    if (!crop) throw new Error('Crop not found');

    // Update crop based on simulation data
    if (simulationData.growth_percent !== undefined) {
        crop.growth_percent = simulationData.growth_percent;
    }

    if (simulationData.last_irrigation) {
        crop.derived.last_irrigation_at = new Date(simulationData.last_irrigation);
    }

    await crop.save();
    return crop;
};

export {
    calculateExpectedGrowth,
    getIrrigationRecommendation,
    getCropsNeedingAttention,
    generateCropInsights,
    syncCropWithSimulation
};
