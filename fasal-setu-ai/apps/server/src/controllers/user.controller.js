import User from "../models/user.model.js";
import { auth } from "../firebase/firebaseClient.js";
import { signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import {ApiResponse} from "../util/ApiResponse.js";
import {ApiError} from "../util/ApiError.js";
import asyncErrorHandler from "../util/asyncErrorHandler.js";
import { verifyRefreshToken } from "../util/jwt.js";
import { 
  getVillageCoordinates, 
  validateKeralaDistrict, 
  validateKeralaVillage 
} from "../util/keralaVillages.js";

// Send OTP
export const sendOTP = asyncErrorHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ApiError(400, "Phone number is required");
  }

  // Validate Kerala phone number format (Kerala farmers only)
  const phoneRegex = /^\+91[6-9]\d{9}$/;
  if (!phoneRegex.test(phoneNumber)) {
    throw new ApiError(400, "Please provide a valid Kerala phone number (+91xxxxxxxxxx)");
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

// Helper function to validate Kerala location and get village coordinates
const validateKeralaLocationAndGetCoordinates = async (state, district, village) => {
  try {
    // Ensure user is from Kerala only
    if (state?.toLowerCase() !== 'kerala') {
      throw new ApiError(400, "This app is currently available only for farmers in Kerala");
    }

    // Validate Kerala district
    if (!validateKeralaDistrict(district)) {
      throw new ApiError(400, `Invalid Kerala district: ${district}`);
    }

    // Validate Kerala village and get coordinates
    if (!validateKeralaVillage(district, village)) {
      throw new ApiError(400, `Invalid village "${village}" for district ${district}`);
    }

    const coordinates = getVillageCoordinates(district, village);
    if (!coordinates) {
      throw new ApiError(500, `Unable to get coordinates for village ${village} in ${district}`);
    }

    return {
      lat: coordinates.lat,
      lon: coordinates.lon,
      coordinate_source: 'kerala_village_precise'
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Error validating Kerala location:', error);
    throw new ApiError(500, "Error validating location data");
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
    // If user exists, return a more helpful response suggesting login
    return res.status(200).json(
      new ApiResponse(200, {
        userExists: true,
        shouldLogin: true,
        user: {
          id: existingUser._id,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          phoneNumber: existingUser.phoneNumber,
          hasCompleteProfile: existingUser.hasCompleteProfile()
        }
      }, "User already exists. Please login instead.")
    );
  }

  // Prepare user data with defaults and Kerala-specific validation
  const userData = {
    firstName: firstName.trim(),
    lastName: lastName ? lastName.trim() : undefined,
    phoneNumber,
    firebaseUid,
    isPhoneVerified: true,
    preferred_language: preferred_language || 'malayalam' // Default to Malayalam for Kerala farmers
  };

  // Add Kerala-specific location data (required for all users)
  if (!location || !location.state || !location.district || !location.village) {
    throw new ApiError(400, "Complete location (state, district, and village) is required for Kerala farmers");
  }

  // Validate and process Kerala location with village-level precision
  const locationData = await validateKeralaLocationAndGetCoordinates(
    location.state.trim(),
    location.district.trim(), 
    location.village.trim()
  );

  userData.location = {
    state: location.state.trim(),
    district: location.district.trim(),
    village: location.village.trim(),
    lat: locationData.lat,
    lon: locationData.lon,
    coordinate_source: locationData.coordinate_source
  };

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
    httpOnly: true, // Changed to true for security - frontend should not access directly
    secure: process.env.NODE_ENV === 'production', // Only use secure cookies in production (HTTPS)
    sameSite: 'none', // 'none' for cross-origin in production
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
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
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
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
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
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none'
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
  console.log('Profile update request body:', req.body); // Debug log
  
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

  console.log('Current user data:', {
    id: user._id,
    phoneNumber: user.phoneNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    location: user.location
  }); // Debug log

  // Update basic info
  if (firstName && firstName.trim()) {
    user.firstName = firstName.trim();
  }
  if (lastName !== undefined) {
    user.lastName = lastName && lastName.trim() ? lastName.trim() : undefined;
  }
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
    
    // Only update state and district if they have valid non-empty values
    if (location.state && location.state.trim()) {
      user.location.state = location.state.trim();
    }
    if (location.district && location.district.trim()) {
      user.location.district = location.district.trim();
    }
    
    // Handle coordinates - prioritize provided coordinates, then auto-fetch
    if (location.lat !== undefined && location.lon !== undefined) {
      // Use provided coordinates only if they are valid numbers
      const lat = parseFloat(location.lat);
      const lon = parseFloat(location.lon);
      
      if (!isNaN(lat) && !isNaN(lon) && 
          lat >= -90 && lat <= 90 && 
          lon >= -180 && lon <= 180 && 
          isFinite(lat) && isFinite(lon)) {
        user.location.lat = lat;
        user.location.lon = lon;
        console.log('Set coordinates:', { lat, lon }); // Debug log
      } else {
        console.warn('Invalid coordinates provided:', { lat: location.lat, lon: location.lon, parsedLat: lat, parsedLon: lon });
        // Don't modify existing coordinates if new ones are invalid
      }
    } else if (location.state && location.district && (!user.location.lat || !user.location.lon)) {
      // Auto-fetch coordinates if not already set
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
    
    // Mark location as modified for mongoose
    user.markModified('location');
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

  console.log('About to save user with data:', {
    firstName: user.firstName,
    lastName: user.lastName,
    location: user.location,
    profile_version: user.profile_version,
    phoneNumber: user.phoneNumber, // Check if phone is still valid
    preferred_language: user.preferred_language // Check if language is still valid
  }); // Debug log

  try {
    // Use validateBeforeSave: false to bypass validation temporarily for debugging
    await user.save({ validateBeforeSave: false });
  } catch (validationError) {
    console.error('Mongoose validation error:', validationError);
    if (validationError.name === 'ValidationError') {
      const errors = Object.values(validationError.errors).map(e => e.message);
      throw new ApiError(400, `Validation failed: ${errors.join(', ')}`);
    }
    throw validationError;
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

  // Update location with coordinates
  user.location = {
    state: location.state.trim(),
    district: location.district.trim()
  };

  // Handle coordinates - prioritize provided coordinates, then auto-fetch
  if (location.lat !== undefined && location.lon !== undefined) {
    // Use provided coordinates
    user.location.lat = parseFloat(location.lat);
    user.location.lon = parseFloat(location.lon);
  } else {
    // Auto-fetch coordinates
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

  // Validate coordinates if they exist
  if (user.location.lat !== undefined && user.location.lon !== undefined) {
    if (user.location.lat < -90 || user.location.lat > 90) {
      console.warn('Invalid latitude value:', user.location.lat);
      delete user.location.lat;
    }
    if (user.location.lon < -180 || user.location.lon > 180) {
      console.warn('Invalid longitude value:', user.location.lon);
      delete user.location.lon;
    }
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
