import Crop from "../models/crop.model.js";
import { ApiResponse } from "../util/ApiResponse.js";
import { ApiError } from "../util/ApiError.js";
import asyncErrorHandler from "../util/asyncErrorHandler.js";
import { getCropDuration } from "../util/cropDuration.js";

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

    // Get duration_days based on crop type
    const duration_days = getCropDuration(crop_name);

    // Create crop data with owner_id from authenticated user
    const cropData = {
        owner_id: req.user._id,
        crop_name,
        season,
        variety,
        sowing_date: new Date(sowing_date),
        area_acres,
        irrigation_source,
        location_override,
        derived: {
            duration_days: duration_days
        }
    };
    
    // Handle late-registered crops with manually selected growth stage
    if (is_late_registered && growth_stage) {
        // Validate the growth stage value
        const validStages = ["germination", "seedling", "vegetative", "tillering", "flowering", "grain_filling", "maturity"];
        if (!validStages.includes(growth_stage)) {
            throw new ApiError(400, `Invalid growth stage. Must be one of: ${validStages.join(', ')}`);
        }
        
        // Set the manually selected growth stage
        cropData.derived.stage = growth_stage;
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

    // Use duration_days from the crop if available, otherwise fallback to utility function
    let maturityDays = crop.derived?.duration_days;
    
    if (!maturityDays) {
        // Fallback for old crops that don't have duration_days set
        maturityDays = getCropDuration(crop.crop_name);
    }
    
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
