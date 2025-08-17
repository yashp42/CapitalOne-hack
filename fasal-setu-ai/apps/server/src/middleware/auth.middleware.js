import { verifyAccessToken } from "../util/jwt.js";
import { ApiError } from "../util/ApiError.js";
import asyncErrorHandler from "../util/asyncErrorHandler.js";
import User from "../models/user.model.js";

export const verifyJWT = asyncErrorHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        
        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        const decodedToken = verifyAccessToken(token);
        
        const user = await User.findById(decodedToken?._id).select("-refreshToken");
        
        if (!user) {
            throw new ApiError(401, "Invalid Access Token");
        }

        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});

export const optionalAuth = asyncErrorHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        
        if (token) {
            const decodedToken = verifyAccessToken(token);
            const user = await User.findById(decodedToken?._id).select("-refreshToken");
            req.user = user;
        }
        
        next();
    } catch (error) {
        // Don't throw error for optional auth
        next();
    }
});