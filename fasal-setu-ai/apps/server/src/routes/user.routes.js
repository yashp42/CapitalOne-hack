import { Router } from "express";
import { 
  sendOTP, 
  signup, 
  login, 
  logout,
  refreshAccessToken,
  getProfile, 
  putProfile 
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { ApiResponse } from "../util/ApiResponse.js";

const router = Router();

// Auth routes
router.post("/send-otp", sendOTP);
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", verifyJWT, logout);
router.post("/refresh-token", refreshAccessToken);

// Profile routes
router.get("/profile/:id", verifyJWT, getProfile);
router.put("/profile/:id", verifyJWT, putProfile);

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

export default router;
