import mongoose from "mongoose";
import { generateAccessToken, generateRefreshToken } from "../util/jwt.js";

const userSchema = new mongoose.Schema({
    // Firebase Authentication
    firebaseUid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    firstName: {
        type: String,
        trim: true
    },

    lastName: {
        type: String,
        trim: true
    },

    // Phone Authentication (India only)
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [/^\+91[6-9]\d{9}$/, 'Please provide a valid Indian phone number (+91xxxxxxxxxx)']
    },
    
    isPhoneVerified: {
        type: Boolean,
        default: false
    },

    refreshToken: {
        type: String
    },

    // Language and Location Preferences
    preferred_language: {
        type: String,
        default: "en",
        enum: ["en", "hi", "bn", "te", "ta", "gu", "kn", "ml", "mr", "pa", "or"]
    },

    location: {
        state: { type: String, trim: true },      // for prices_fetch, policy_match, calendar_lookup
        district: { type: String, trim: true },
        lat: { type: Number },        // for weather_outlook
        lon: { type: Number }
    },

    // Farm Information
    land_area_acres: {
        type: Number,
        min: 0,
        default: null
    },

    // Financial Information
    finance: {
        has_kcc: { type: Boolean, default: null },
        receives_pm_kisan: { type: Boolean, default: null },
        collateral_available: { type: Boolean, default: null }
    },

    // Profile Management
    profile_version: {
        type: Number,
        default: 1
    } // bump on confirmed updates
    
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false
});

// Indexes
userSchema.index({ phoneNumber: 1 });
userSchema.index({ firebaseUid: 1 });
userSchema.index({ "location.state": 1, "location.district": 1 });
userSchema.index({ preferred_language: 1 });
userSchema.index({ profile_version: 1 });

// Instance methods for generating tokens
userSchema.methods.generateAccessToken = function() {
    return generateAccessToken(this);
};

userSchema.methods.generateRefreshToken = function() {
    return generateRefreshToken(this);
};

userSchema.methods.generateTokens = async function() {
    const accessToken = this.generateAccessToken();
    const refreshToken = this.generateRefreshToken();
    
    // Save refresh token to database
    this.refreshToken = refreshToken;
    await this.save({ validateBeforeSave: false });
    
    return { accessToken, refreshToken };
};

// Static methods
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
    return this.findOne({ firebaseUid });
};

userSchema.statics.findByPhoneNumber = function(phoneNumber) {
    return this.findOne({ phoneNumber });
};

userSchema.statics.findByLocation = function(state, district = null) {
    const query = { "location.state": state };
    if (district) query["location.district"] = district;
    return this.find(query);
};

userSchema.statics.findByLanguage = function(language) {
    return this.find({ preferred_language: language });
};

// Instance methods
userSchema.methods.verifyPhone = function() {
    this.isPhoneVerified = true;
    return this.save();
};

userSchema.methods.updateLocation = function(locationData) {
    this.location = { ...this.location, ...locationData };
    this.profile_version += 1;
    return this.save();
};

userSchema.methods.updateFinance = function(financeData) {
    this.finance = { ...this.finance, ...financeData };
    this.profile_version += 1;
    return this.save();
};

userSchema.methods.updateProfile = function(profileData) {
    Object.keys(profileData).forEach(key => {
        if (key !== 'profile_version' && key !== '_id' && key !== 'firebaseUid') {
            this[key] = profileData[key];
        }
    });
    this.profile_version += 1;
    return this.save();
};

userSchema.methods.hasCompleteProfile = function() {
    return !!(
        this.firstName &&
        this.lastName &&
        this.location?.state &&
        this.location?.district &&
        this.land_area_acres !== null
    );
};

const User = mongoose.model('User', userSchema);

export default User;
