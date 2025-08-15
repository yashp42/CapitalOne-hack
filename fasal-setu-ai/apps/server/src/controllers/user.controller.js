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

// Verify OTP and Signup
export const signup = asyncErrorHandler(async (req, res) => {
  const { firstName, lastName, phoneNumber, firebaseUid } = req.body;

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

  // Create new user
  const newUser = await User.create({
    firstName: firstName.trim(),
    lastName: lastName ? lastName.trim() : undefined,
    phoneNumber,
    firebaseUid,
    isPhoneVerified: true // Since Firebase handled the verification
  });

  // Generate tokens
  const { accessToken, refreshToken } = await newUser.generateTokens();

  // Remove sensitive data from response
  const userResponse = {
    id: newUser._id,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    phoneNumber: newUser.phoneNumber,
    isPhoneVerified: newUser.isPhoneVerified,
    createdAt: newUser.createdAt
  };

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
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

// Get Profile
export const getProfile = asyncErrorHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const userResponse = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    isPhoneVerified: user.isPhoneVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  res.status(200).json(
    new ApiResponse(200, userResponse, "Profile retrieved successfully")
  );
});

// Update Profile
export const putProfile = asyncErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Update only allowed fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;

  await user.save();

  const userResponse = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    isPhoneVerified: user.isPhoneVerified,
    updatedAt: user.updatedAt
  };

  res.status(200).json(
    new ApiResponse(200, userResponse, "Profile updated successfully")
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
      sameSite: 'strict'
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
    sameSite: 'strict'
  };

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});
