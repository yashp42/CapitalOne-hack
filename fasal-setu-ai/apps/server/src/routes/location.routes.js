import { Router } from "express";
import { 
    getKeralaDistricts, 
    getVillagesForDistrict, 
    searchVillages,
    validateVillage,
    getVillageCoordinates 
} from "../util/keralaVillages.js";
import { ApiResponse } from "../util/ApiResponse.js";
import { ApiError } from "../util/ApiError.js";

const router = Router();

// Get all Kerala districts
router.get('/districts', (req, res) => {
    try {
        const districts = getKeralaDistricts();
        res.json(new ApiResponse(200, { districts }, "Kerala districts fetched successfully"));
    } catch (error) {
        console.error('Error fetching districts:', error);
        res.status(500).json(new ApiError(500, "Failed to fetch districts"));
    }
});

// Get villages for a specific district
router.get('/districts/:district/villages', (req, res) => {
    try {
        const { district } = req.params;
        const villages = getVillagesForDistrict(district);
        
        if (villages.length === 0) {
            return res.status(404).json(new ApiError(404, "District not found or no villages available"));
        }
        
        res.json(new ApiResponse(200, { district, villages }, "Villages fetched successfully"));
    } catch (error) {
        console.error('Error fetching villages:', error);
        res.status(500).json(new ApiError(500, "Failed to fetch villages"));
    }
});

// Search villages
router.get('/search', (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json(new ApiError(400, "Search term must be at least 2 characters"));
        }
        
        const results = searchVillages(q.trim());
        res.json(new ApiResponse(200, { results, count: results.length }, "Search completed successfully"));
    } catch (error) {
        console.error('Error searching villages:', error);
        res.status(500).json(new ApiError(500, "Failed to search villages"));
    }
});

// Validate village in district
router.post('/validate', (req, res) => {
    try {
        const { district, village } = req.body;
        
        if (!district || !village) {
            return res.status(400).json(new ApiError(400, "District and village are required"));
        }
        
        const isValid = validateVillage(district, village);
        res.json(new ApiResponse(200, { 
            valid: isValid,
            district,
            village 
        }, isValid ? "Village is valid" : "Village not found in the specified district"));
    } catch (error) {
        console.error('Error validating village:', error);
        res.status(500).json(new ApiError(500, "Failed to validate village"));
    }
});

// Get coordinates for Kerala village
router.post('/coordinates', (req, res) => {
    try {
        const { state, district, village } = req.body;
        
        // Validate that it's Kerala
        if (state !== 'Kerala') {
            return res.status(400).json(new ApiError(400, "This endpoint only supports Kerala locations"));
        }
        
        if (!district || !village) {
            return res.status(400).json(new ApiError(400, "District and village are required for Kerala coordinates"));
        }
        
        // Get village coordinates
        const coordinates = getVillageCoordinates(district, village);
        
        if (!coordinates.found) {
            return res.status(404).json(new ApiError(404, `Village "${village}" not found in district "${district}"`));
        }
        
        res.json(new ApiResponse(200, {
            lat: coordinates.lat,
            lon: coordinates.lon,
            district,
            village,
            coordinate_source: 'kerala_village_precise'
        }, "Village coordinates fetched successfully"));
        
    } catch (error) {
        console.error('Error fetching village coordinates:', error);
        res.status(500).json(new ApiError(500, "Failed to fetch village coordinates"));
    }
});

export default router;