import { Router } from "express";
import { 
  sendOTP, 
  signup, 
  login, 
  logout,
  refreshAccessToken,
  getProfile, 
  putProfile,
  completeProfile
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { ApiResponse } from "../util/ApiResponse.js";
import User from "../models/user.model.js";

const router = Router();

// Auth routes
router.post("/send-otp", sendOTP);
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", verifyJWT, logout);
router.post("/refresh-token", refreshAccessToken);

// Check if user exists (for better UX)
router.post("/check-user", async (req, res) => {
  try {
    const { phoneNumber, firebaseUid } = req.body;
    
    const existingUser = await User.findOne({
      $or: [
        ...(phoneNumber ? [{ phoneNumber }] : []),
        ...(firebaseUid ? [{ firebaseUid }] : [])
      ]
    });

    if (existingUser) {
      res.status(200).json(
        new ApiResponse(200, {
          exists: true,
          user: {
            id: existingUser._id,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            phoneNumber: existingUser.phoneNumber,
            hasCompleteProfile: existingUser.hasCompleteProfile()
          }
        }, "User exists")
      );
    } else {
      res.status(200).json(
        new ApiResponse(200, { exists: false }, "User does not exist")
      );
    }
  } catch (error) {
    res.status(500).json(
      new ApiResponse(500, null, "Error checking user existence")
    );
  }
});

// Profile routes
router.get("/profile", verifyJWT, getProfile);
router.put("/profile", verifyJWT, putProfile);
router.post("/complete-profile", verifyJWT, completeProfile);

// Current user route
router.get("/me", verifyJWT, (req, res) => {
  const userResponse = {
    id: req.user._id,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    phoneNumber: req.user.phoneNumber,
    isPhoneVerified: req.user.isPhoneVerified,
    createdAt: req.user.createdAt,
    updatedAt: req.user.updatedAt
  };
  
  res.json(new ApiResponse(200, userResponse, "Current user fetched successfully"));
});

// Get coordinates for a location
router.post("/get-coordinates", async (req, res) => {
  try {
    const { state, district } = req.body;
    
    if (!state || !district) {
      return res.status(400).json(
        new ApiResponse(400, null, "State and district are required")
      );
    }

    // Simple mapping for major Indian districts (same as in controller)
    const locationMap = {
      // Punjab
      'punjab_ludhiana': { lat: 30.9010, lon: 75.8573 },
      'punjab_amritsar': { lat: 31.6340, lon: 74.8723 },
      'punjab_jalandhar': { lat: 31.3260, lon: 75.5762 },
      'punjab_patiala': { lat: 30.3365, lon: 76.3922 },
      'punjab_bathinda': { lat: 30.2110, lon: 74.9455 },
      
      // Haryana
      'haryana_gurgaon': { lat: 28.4595, lon: 77.0266 },
      'haryana_faridabad': { lat: 28.4089, lon: 77.3178 },
      'haryana_rohtak': { lat: 28.8955, lon: 76.6066 },
      
      // Uttar Pradesh
      'uttar pradesh_lucknow': { lat: 26.8467, lon: 80.9462 },
      'uttar pradesh_kanpur': { lat: 26.4499, lon: 80.3319 },
      'uttar pradesh_agra': { lat: 27.1767, lon: 78.0081 },
      'uttar pradesh_varanasi': { lat: 25.3176, lon: 82.9739 },
      'uttar pradesh_meerut': { lat: 28.9845, lon: 77.7064 },
      'uttar pradesh_faizabad': { lat: 26.7751, lon: 82.1409 },
      'uttar pradesh_mirzapur': { lat: 25.1463, lon: 82.5644 },
      'uttar pradesh_sultanpur': { lat: 26.2640, lon: 82.0730 },
      
      // Maharashtra
      'maharashtra_mumbai': { lat: 19.0760, lon: 72.8777 },
      'maharashtra_pune': { lat: 18.5204, lon: 73.8567 },
      'maharashtra_nagpur': { lat: 21.1458, lon: 79.0882 },
      'maharashtra_nashik': { lat: 19.9975, lon: 73.7898 },
      'maharashtra_kolhapur': { lat: 16.7050, lon: 74.2433 },
      'maharashtra_bhandara': { lat: 21.1681, lon: 79.6512 },
      
      // Tamil Nadu
      'tamil nadu_chennai': { lat: 13.0827, lon: 80.2707 },
      'tamil nadu_coimbatore': { lat: 11.0168, lon: 76.9558 },
      'tamil nadu_madurai': { lat: 9.9252, lon: 78.1198 },
      
      // Karnataka
      'karnataka_bangalore': { lat: 12.9716, lon: 77.5946 },
      'karnataka_mysore': { lat: 12.2958, lon: 76.6394 },
      'karnataka_hubli': { lat: 15.3647, lon: 75.1240 },
      
      // Bihar
      'bihar_patna': { lat: 25.5941, lon: 85.1376 },
      'bihar_buxar': { lat: 25.5648, lon: 83.9918 },
      
      // Rajasthan
      'rajasthan_jaipur': { lat: 26.9124, lon: 75.7873 },
      'rajasthan_jodhpur': { lat: 26.2389, lon: 73.0243 },
      
      // Odisha
      'odisha_bhubaneswar': { lat: 20.2961, lon: 85.8245 }
    };
    
    const key = `${state.toLowerCase()}_${district.toLowerCase()}`;
    const coordinates = locationMap[key];
    
    if (coordinates) {
      res.status(200).json(
        new ApiResponse(200, {
          state,
          district,
          latitude: coordinates.lat,
          longitude: coordinates.lon,
          coordinates
        }, "Coordinates found successfully")
      );
    } else {
      res.status(404).json(
        new ApiResponse(404, {
          state,
          district,
          availableLocations: Object.keys(locationMap)
        }, "Coordinates not found for this location")
      );
    }
  } catch (error) {
    res.status(500).json(
      new ApiResponse(500, null, "Error fetching coordinates")
    );
  }
});

export default router;
