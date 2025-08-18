import Crop from "../models/crop.model.js";
import { ApiResponse } from "../util/ApiResponse.js";
import { ApiError } from "../util/ApiError.js";
import asyncErrorHandler from "../util/asyncErrorHandler.js";

// Create a new crop
const createCrop = asyncErrorHandler(async (req, res) => {
    const {
        crop_name,
        season,
        variety,
        sowing_date,
        area_acres,
        irrigation_source,
        location_override,
        is_late_registered,
        growth_stage
    } = req.body;

    // Validate required fields
    if (!crop_name || !season || !variety || !sowing_date || !area_acres) {
        throw new ApiError(400, "Missing required fields: crop_name, season, variety, sowing_date, area_acres");
    }

    // Create crop data with owner_id from authenticated user
    const cropData = {
        owner_id: req.user._id,
        crop_name,
        season,
        variety,
        sowing_date: new Date(sowing_date),
        area_acres,
        irrigation_source,
        location_override
    };
    
    // Handle late-registered crops with manually selected growth stage
    if (is_late_registered && growth_stage) {
        // Validate the growth stage value
        const validStages = ["germination", "seedling", "vegetative", "tillering", "flowering", "grain_filling", "maturity"];
        if (!validStages.includes(growth_stage)) {
            throw new ApiError(400, `Invalid growth stage. Must be one of: ${validStages.join(', ')}`);
        }
        
        // Set the manually selected growth stage
        cropData.derived = { stage: growth_stage };
    }
    
    // Create the crop instance
    const crop = new Crop(cropData);

    await crop.save();

    res.status(201).json(
        new ApiResponse(201, crop, "Crop created successfully")
    );
});

// Get all crops for authenticated user
const getUserCrops = asyncErrorHandler(async (req, res) => {
    const { status, crop_name, limit = 10, page = 1 } = req.query;
    
    const query = { owner_id: req.user._id };
    if (status) query.status = status;
    if (crop_name) query.crop_name = new RegExp(crop_name, 'i');

    const skip = (page - 1) * limit;

    const crops = await Crop.find(query)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate('owner_id', 'firstName lastName phoneNumber');

    const total = await Crop.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            crops,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        }, "Crops retrieved successfully")
    );
});

// Get single crop by ID
const getCropById = asyncErrorHandler(async (req, res) => {
    const { cropId } = req.params;

    const crop = await Crop.findOne({
        _id: cropId,
        owner_id: req.user._id
    }).populate('owner_id', 'firstName lastName phoneNumber location');

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    res.status(200).json(
        new ApiResponse(200, crop, "Crop retrieved successfully")
    );
});

// Update crop
const updateCrop = asyncErrorHandler(async (req, res) => {
    const { cropId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.owner_id;
    delete updateData.created_at;
    delete updateData.updated_at;

    const crop = await Crop.findOneAndUpdate(
        { _id: cropId, owner_id: req.user._id },
        updateData,
        { new: true, runValidators: true }
    );

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    res.status(200).json(
        new ApiResponse(200, crop, "Crop updated successfully")
    );
});

// Update crop growth percentage
const updateCropGrowth = asyncErrorHandler(async (req, res) => {
    const { cropId } = req.params;
    const { growth_percent } = req.body;

    if (growth_percent === undefined || growth_percent < 0 || growth_percent > 100) {
        throw new ApiError(400, "growth_percent must be between 0 and 100");
    }

    const crop = await Crop.findOne({
        _id: cropId,
        owner_id: req.user._id
    });

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    await crop.updateGrowth(growth_percent);

    res.status(200).json(
        new ApiResponse(200, crop, "Crop growth updated successfully")
    );
});

// Mark crop as irrigated
const markCropIrrigated = asyncErrorHandler(async (req, res) => {
    const { cropId } = req.params;

    const crop = await Crop.findOne({
        _id: cropId,
        owner_id: req.user._id
    });

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    await crop.markIrrigated();

    res.status(200).json(
        new ApiResponse(200, crop, "Crop marked as irrigated")
    );
});

// Complete crop (harvest)
const completeCrop = asyncErrorHandler(async (req, res) => {
    const { cropId } = req.params;

    const crop = await Crop.findOne({
        _id: cropId,
        owner_id: req.user._id
    });

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    if (crop.status !== 'active') {
        throw new ApiError(400, "Only active crops can be completed");
    }

    await crop.completeCrop();

    res.status(200).json(
        new ApiResponse(200, crop, "Crop completed successfully")
    );
});

// Abandon crop
const abandonCrop = asyncErrorHandler(async (req, res) => {
    const { cropId } = req.params;

    const crop = await Crop.findOne({
        _id: cropId,
        owner_id: req.user._id
    });

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    if (crop.status !== 'active') {
        throw new ApiError(400, "Only active crops can be abandoned");
    }

    await crop.abandonCrop();

    res.status(200).json(
        new ApiResponse(200, crop, "Crop abandoned successfully")
    );
});

// Delete crop
const deleteCrop = asyncErrorHandler(async (req, res) => {
    const { cropId } = req.params;

    const crop = await Crop.findOneAndDelete({
        _id: cropId,
        owner_id: req.user._id
    });

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    res.status(200).json(
        new ApiResponse(200, {}, "Crop deleted successfully")
    );
});

// Get crop statistics for user
const getCropStats = asyncErrorHandler(async (req, res) => {
    const userId = req.user._id;

    const stats = await Crop.aggregate([
        { $match: { owner_id: userId } },
        {
            $group: {
                _id: null,
                total_crops: { $sum: 1 },
                active_crops: {
                    $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
                },
                completed_crops: {
                    $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                },
                abandoned_crops: {
                    $sum: { $cond: [{ $eq: ["$status", "abandoned"] }, 1, 0] }
                },
                total_area: { $sum: "$area_acres" },
                avg_growth: { $avg: "$growth_percent" }
            }
        }
    ]);

    const cropsByType = await Crop.aggregate([
        { $match: { owner_id: userId } },
        {
            $group: {
                _id: "$crop_name",
                count: { $sum: 1 },
                total_area: { $sum: "$area_acres" },
                avg_growth: { $avg: "$growth_percent" }
            }
        },
        { $sort: { count: -1 } }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            overview: stats[0] || {
                total_crops: 0,
                active_crops: 0,
                completed_crops: 0,
                abandoned_crops: 0,
                total_area: 0,
                avg_growth: 0
            },
            by_crop_type: cropsByType
        }, "Crop statistics retrieved successfully")
    );
});

// Estimate harvest date based on crop timeline
const estimateHarvestDate = asyncErrorHandler(async (req, res) => {
    const { cropId } = req.params;

    const crop = await Crop.findOne({
        _id: cropId,
        owner_id: req.user._id
    });

    if (!crop) {
        throw new ApiError(404, "Crop not found");
    }

    // Crop-specific maturity periods (in days from sowing)
    const cropMaturityPeriods = {
        // Cereals
        rice: 130, wheat: 130, maize: 100, barley: 120, sorghum: 110,
        pearl_millet: 80, finger_millet: 110, foxtail_millet: 85, oats: 100,
        
        // Pulses  
        chickpea: 110, pigeon_pea: 160, black_gram: 80, green_gram: 75,
        lentil: 120, field_pea: 110, kidney_bean: 120, cowpea: 95,
        black_eyed_pea: 95, horse_gram: 105,
        
        // Oilseeds
        groundnut: 110, soybean: 100, mustard: 135, sunflower: 95,
        sesame: 90, safflower: 130, castor: 150, niger: 100, linseed: 135,
        
        // Fiber/Cash crops
        cotton: 165, jute: 120, tobacco: 120,
        
        // Vegetables
        potato: 90, onion: 130, tomato: 105, cabbage: 90, cauliflower: 90,
        eggplant: 110, okra: 65, carrot: 95, radish: 45, turnip: 60,
        beetroot: 90, spinach: 40, fenugreek: 40, fenugreek_seed: 145,
        coriander: 40, coriander_seed: 100, chili: 120,
        
        // Cucurbits
        cucumber: 65, bottle_gourd: 90, bitter_gourd: 95, ridge_gourd: 85,
        sponge_gourd: 80, pumpkin: 120, watermelon: 90, muskmelon: 85,
        
        // Spices
        turmeric: 270, ginger: 240, garlic: 150, cumin: 110, fennel: 210,
        ajwain: 140, cardamom: 1095, black_pepper: 1095, clove: 2190, cinnamon: 1460,
        
        // Fruits (first harvest)
        mango: 1460, banana: 300, orange: 1460, apple: 1460, grapes: 730,
        pomegranate: 730, papaya: 300, guava: 730, lemon: 1460, lime: 1460,
        
        // Fodder
        alfalfa: 60, berseem: 55, oat_fodder: 70, maize_fodder: 60,
        sorghum_fodder: 60, cowpea_fodder: 60,
        
        // Default
        default: 125
    };

    const maturityDays = cropMaturityPeriods[crop.crop_name.toLowerCase()] || cropMaturityPeriods.default;
    
    // Calculate harvest date from sowing date
    const sowingDate = new Date(crop.sowing_date);
    const harvestDate = new Date(sowingDate);
    harvestDate.setDate(harvestDate.getDate() + maturityDays);
    
    // Calculate current growth percentage
    const currentDate = new Date();
    const daysSinceSowing = Math.floor((currentDate - sowingDate) / (1000 * 60 * 60 * 24));
    const growthPercentage = Math.min(100, Math.max(0, (daysSinceSowing / maturityDays) * 100));
    
    // Calculate days remaining
    const daysRemaining = Math.max(0, maturityDays - daysSinceSowing);
    
    res.status(200).json(
        new ApiResponse(200, {
            crop_id: crop._id,
            crop_name: crop.crop_name,
            sowing_date: crop.sowing_date,
            estimated_harvest_date: harvestDate.toISOString().split('T')[0],
            maturity_days: maturityDays,
            days_since_sowing: daysSinceSowing,
            growth_percentage: Math.round(growthPercentage * 100) / 100,
            days_remaining: daysRemaining,
            status: daysRemaining === 0 ? 'ready_for_harvest' : 'growing'
        }, "Harvest date estimated successfully")
    );
});

export {
    createCrop,
    getUserCrops,
    getCropById,
    updateCrop,
    updateCropGrowth,
    markCropIrrigated,
    completeCrop,
    abandonCrop,
    deleteCrop,
    getCropStats,
    estimateHarvestDate
};
