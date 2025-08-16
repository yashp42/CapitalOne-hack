import express from "express";
import {
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
} from "../controllers/crop.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);

// Crop CRUD operations
router.post("/", createCrop);                    // POST /api/crops
router.get("/", getUserCrops);                   // GET /api/crops
router.get("/stats", getCropStats);              // GET /api/crops/stats
router.get("/:cropId", getCropById);             // GET /api/crops/:cropId
router.put("/:cropId", updateCrop);              // PUT /api/crops/:cropId
router.delete("/:cropId", deleteCrop);           // DELETE /api/crops/:cropId

// Crop specific actions
router.patch("/:cropId/growth", updateCropGrowth);      // PATCH /api/crops/:cropId/growth
router.patch("/:cropId/irrigate", markCropIrrigated);   // PATCH /api/crops/:cropId/irrigate
router.patch("/:cropId/complete", completeCrop);        // PATCH /api/crops/:cropId/complete
router.patch("/:cropId/abandon", abandonCrop);          // PATCH /api/crops/:cropId/abandon

// Harvest estimation
router.get("/:cropId/harvest-estimate", estimateHarvestDate); // GET /api/crops/:cropId/harvest-estimate

export default router;
