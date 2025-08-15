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
    }
    
}, {
    timestamps: true,
    versionKey: false
});

// Indexes
userSchema.index({ phoneNumber: 1 });
userSchema.index({ firebaseUid: 1 });

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

// Instance methods
userSchema.methods.verifyPhone = function() {
    this.isPhoneVerified = true;
    return this.save();
};

const User = mongoose.model('User', userSchema);

export default User;
