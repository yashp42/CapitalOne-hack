import User from "../models/user.model.js";
import { auth } from "../firebase/firebaseClient.js";
import { signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import {ApiResponse} from "../util/ApiResponse.js";
import {ApiError} from "../util/ApiError.js";
import asyncErrorHandler from "../util/asyncErrorHandler.js";
import { verifyRefreshToken } from "../util/jwt.js";

// Send OTP
export const sendOTP = asyncErrorHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ApiError(400, "Phone number is required");
  }

  // Validate Indian phone number format
  const phoneRegex = /^\+91[6-9]\d{9}$/;
  if (!phoneRegex.test(phoneNumber)) {
    throw new ApiError(400, "Please provide a valid Indian phone number (+91xxxxxxxxxx)");
  }

  try {
    // Note: For production, you'll need to handle reCAPTCHA on frontend
    // This is a simplified version for testing
    res.status(200).json(
      new ApiResponse(200, { phoneNumber }, "OTP sent successfully. Please verify on frontend.")
    );
  } catch (error) {
    throw new ApiError(500, "Failed to send OTP");
  }
});

// Helper function to fetch coordinates for location
const fetchCoordinatesForLocation = async (state, district) => {
  try {
    // Using a simple mapping for major Indian districts
    const locationMap = {
      // Punjab
      'punjab_ludhiana': { lat: 30.9010, lon: 75.8573 },
      'punjab_amritsar': { lat: 31.6340, lon: 74.8723 },
      'punjab_jalandhar': { lat: 31.3260, lon: 75.5762 },
      'punjab_patiala': { lat: 30.3365, lon: 76.3922 },
      
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
      
      // Maharashtra
      'maharashtra_mumbai': { lat: 19.0760, lon: 72.8777 },
      'maharashtra_pune': { lat: 18.5204, lon: 73.8567 },
      'maharashtra_nagpur': { lat: 21.1458, lon: 79.0882 },
      'maharashtra_nashik': { lat: 19.9975, lon: 73.7898 },
      
      // Tamil Nadu
      'tamil nadu_chennai': { lat: 13.0827, lon: 80.2707 },
      'tamil nadu_coimbatore': { lat: 11.0168, lon: 76.9558 },
      'tamil nadu_madurai': { lat: 9.9252, lon: 78.1198 },
      
      // Karnataka
      'karnataka_bangalore': { lat: 12.9716, lon: 77.5946 },
      'karnataka_mysore': { lat: 12.2958, lon: 76.6394 },
      'karnataka_hubli': { lat: 15.3647, lon: 75.1240 },
      
      // Add more states and districts as needed
    };
    
    const key = `${state.toLowerCase()}_${district.toLowerCase()}`;
    return locationMap[key] || null;
    
  } catch (error) {
    console.error('Error fetching coordinates:', error);
    return null;
  }
};

// Enhanced Signup with comprehensive profile data
export const signup = asyncErrorHandler(async (req, res) => {
  const { 
    firstName, 
    lastName, 
    phoneNumber, 
    firebaseUid,
    preferred_language,
    location,
    land_area_acres,
    finance
  } = req.body;

  if (!firstName || !phoneNumber || !firebaseUid) {
    throw new ApiError(400, "First name, phone number, and Firebase UID are required");
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ phoneNumber }, { firebaseUid }]
  });

  if (existingUser) {
    throw new ApiError(409, "User with this phone number or Firebase UID already exists");
  }

  // Prepare user data with defaults and validation
  const userData = {
    firstName: firstName.trim(),
    lastName: lastName ? lastName.trim() : undefined,
    phoneNumber,
    firebaseUid,
    isPhoneVerified: true,
    preferred_language: preferred_language || 'en'
  };

  // Add location data if provided
  if (location) {
    userData.location = {};
    
    if (location.state) userData.location.state = location.state.trim();
    if (location.district) userData.location.district = location.district.trim();
    
    // Auto-fetch coordinates if state and district provided but no coordinates
    if (location.state && location.district && !location.lat && !location.lon) {
      try {
        const coordinates = await fetchCoordinatesForLocation(location.state, location.district);
        if (coordinates) {
          userData.location.lat = coordinates.lat;
          userData.location.lon = coordinates.lon;
        }
      } catch (error) {
        console.warn('Failed to fetch coordinates:', error.message);
        // Continue without coordinates - they can be added later
      }
    } else if (location.lat && location.lon) {
      userData.location.lat = parseFloat(location.lat);
      userData.location.lon = parseFloat(location.lon);
    }
  }

  // Add land area if provided
  if (land_area_acres !== undefined && land_area_acres !== null) {
    userData.land_area_acres = parseFloat(land_area_acres);
    if (userData.land_area_acres < 0) {
      throw new ApiError(400, "Land area cannot be negative");
    }
  }

  // Add finance data if provided
  if (finance) {
    userData.finance = {};
    
    if (finance.has_kcc !== undefined) userData.finance.has_kcc = Boolean(finance.has_kcc);
    if (finance.receives_pm_kisan !== undefined) userData.finance.receives_pm_kisan = Boolean(finance.receives_pm_kisan);
    if (finance.collateral_available !== undefined) userData.finance.collateral_available = Boolean(finance.collateral_available);
  }

  // Create new user
  const newUser = await User.create(userData);

  // Generate tokens
  const { accessToken, refreshToken } = await newUser.generateTokens();

  // Remove sensitive data from response
  const userResponse = {
    id: newUser._id,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    phoneNumber: newUser.phoneNumber,
    isPhoneVerified: newUser.isPhoneVerified,
    preferred_language: newUser.preferred_language,
    location: newUser.location,
    land_area_acres: newUser.land_area_acres,
    finance: newUser.finance,
    profile_version: newUser.profile_version,
    hasCompleteProfile: newUser.hasCompleteProfile(),
    createdAt: newUser.created_at
  };

  const options = {
    httpOnly: false, // Allow JavaScript access for cross-domain issues
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-site in production
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(201, {
        user: userResponse,
        accessToken,
        refreshToken
      }, "User registered successfully")
    );
});

// Login
export const login = asyncErrorHandler(async (req, res) => {
  const { firebaseUid } = req.body;

  if (!firebaseUid) {
    throw new ApiError(400, "Firebase UID is required");
  }

  // Find user by Firebase UID
  const user = await User.findByFirebaseUid(firebaseUid);

  if (!user) {
    throw new ApiError(404, "User not found. Please signup first.");
  }

  // Generate tokens
  const { accessToken, refreshToken } = await user.generateTokens();

  // Remove sensitive data from response
  const userResponse = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    isPhoneVerified: user.isPhoneVerified,
    preferred_language: user.preferred_language,
    location: user.location,
    land_area_acres: user.land_area_acres,
    finance: user.finance,
    profile_version: user.profile_version,
    hasCompleteProfile: user.hasCompleteProfile(),
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };

  const options = {
    httpOnly: false, // Allow JavaScript access for cross-domain issues
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-site in production
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, {
        user: userResponse,
        accessToken,
        refreshToken
      }, "Login successful")
    );
});

// Refresh Access Token
export const refreshAccessToken = asyncErrorHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = verifyRefreshToken(incomingRefreshToken);
    
    const user = await User.findById(decodedToken?._id);
    
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken: newRefreshToken } = await user.generateTokens();

    const options = {
      httpOnly: false, // Allow JavaScript access for cross-domain issues
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-site in production
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(200, {
          accessToken,
          refreshToken: newRefreshToken
        }, "Access token refreshed")
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// Logout
export const logout = asyncErrorHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1 // this removes the field from document
      }
    },
    {
      new: true
    }
  );

  const options = {
    httpOnly: false, // Allow JavaScript access for cross-domain issues
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Allow cross-site in production
  };

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

// Get user profile
export const getProfile = asyncErrorHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-refreshToken");
  
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const userResponse = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    isPhoneVerified: user.isPhoneVerified,
    preferred_language: user.preferred_language,
    location: user.location,
    land_area_acres: user.land_area_acres,
    finance: user.finance,
    profile_version: user.profile_version,
    hasCompleteProfile: user.hasCompleteProfile(),
    created_at: user.created_at,
    updated_at: user.updated_at
  };

  res.status(200).json(
    new ApiResponse(200, userResponse, "Profile retrieved successfully")
  );
});

// Update user profile
export const putProfile = asyncErrorHandler(async (req, res) => {
  const { 
    firstName, 
    lastName, 
    preferred_language,
    location,
    land_area_acres,
    finance
  } = req.body;

  const user = await User.findById(req.user._id);
  
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Update basic info
  if (firstName) user.firstName = firstName.trim();
  if (lastName !== undefined) user.lastName = lastName ? lastName.trim() : undefined;
  if (preferred_language) user.preferred_language = preferred_language;
  if (land_area_acres !== undefined) {
    const landArea = parseFloat(land_area_acres);
    if (landArea < 0) {
      throw new ApiError(400, "Land area cannot be negative");
    }
    user.land_area_acres = landArea;
  }

  // Update location
  if (location) {
    if (!user.location) user.location = {};
    
    if (location.state) user.location.state = location.state.trim();
    if (location.district) user.location.district = location.district.trim();
    
    // Handle coordinates
    if (location.lat !== undefined && location.lon !== undefined) {
      user.location.lat = parseFloat(location.lat);
      user.location.lon = parseFloat(location.lon);
    } else if (location.state && location.district && !user.location.lat) {
      // Auto-fetch coordinates if not provided
      try {
        const coordinates = await fetchCoordinatesForLocation(location.state, location.district);
        if (coordinates) {
          user.location.lat = coordinates.lat;
          user.location.lon = coordinates.lon;
        }
      } catch (error) {
        console.warn('Failed to fetch coordinates:', error.message);
      }
    }
  }

  // Update finance info
  if (finance) {
    if (!user.finance) user.finance = {};
    
    if (finance.has_kcc !== undefined) user.finance.has_kcc = Boolean(finance.has_kcc);
    if (finance.receives_pm_kisan !== undefined) user.finance.receives_pm_kisan = Boolean(finance.receives_pm_kisan);
    if (finance.collateral_available !== undefined) user.finance.collateral_available = Boolean(finance.collateral_available);
  }

  // Increment profile version
  user.profile_version += 1;

  await user.save();

  const userResponse = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    isPhoneVerified: user.isPhoneVerified,
    preferred_language: user.preferred_language,
    location: user.location,
    land_area_acres: user.land_area_acres,
    finance: user.finance,
    profile_version: user.profile_version,
    hasCompleteProfile: user.hasCompleteProfile(),
    updated_at: user.updated_at
  };

  res.status(200).json(
    new ApiResponse(200, userResponse, "Profile updated successfully")
  );
});

// Complete profile setup (for step-by-step onboarding)
export const completeProfile = asyncErrorHandler(async (req, res) => {
  const { 
    preferred_language,
    location,
    land_area_acres,
    finance
  } = req.body;

  const user = await User.findById(req.user._id);
  
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Validate required fields for complete profile
  if (!location?.state || !location?.district) {
    throw new ApiError(400, "State and district are required for complete profile");
  }

  if (land_area_acres === undefined || land_area_acres === null) {
    throw new ApiError(400, "Land area is required for complete profile");
  }

  const landArea = parseFloat(land_area_acres);
  if (landArea < 0) {
    throw new ApiError(400, "Land area cannot be negative");
  }

  // Update all profile data
  user.preferred_language = preferred_language || user.preferred_language;
  user.land_area_acres = landArea;

  // Update location with auto-coordinates
  user.location = {
    state: location.state.trim(),
    district: location.district.trim()
  };

  // Fetch coordinates
  try {
    const coordinates = await fetchCoordinatesForLocation(location.state, location.district);
    if (coordinates) {
      user.location.lat = coordinates.lat;
      user.location.lon = coordinates.lon;
    }
  } catch (error) {
    console.warn('Failed to fetch coordinates:', error.message);
  }

  // Update finance info if provided
  if (finance) {
    user.finance = {
      has_kcc: finance.has_kcc !== undefined ? Boolean(finance.has_kcc) : null,
      receives_pm_kisan: finance.receives_pm_kisan !== undefined ? Boolean(finance.receives_pm_kisan) : null,
      collateral_available: finance.collateral_available !== undefined ? Boolean(finance.collateral_available) : null
    };
  }

  user.profile_version += 1;
  await user.save();

  const userResponse = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    isPhoneVerified: user.isPhoneVerified,
    preferred_language: user.preferred_language,
    location: user.location,
    land_area_acres: user.land_area_acres,
    finance: user.finance,
    profile_version: user.profile_version,
    hasCompleteProfile: user.hasCompleteProfile(),
    updated_at: user.updated_at
  };

  res.status(200).json(
    new ApiResponse(200, userResponse, "Profile completed successfully")
  );
});
