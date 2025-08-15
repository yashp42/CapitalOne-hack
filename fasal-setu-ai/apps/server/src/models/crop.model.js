import mongoose from "mongoose";

const cropSchema = new mongoose.Schema({
    owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    crop_name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    season: {
        type: String,
        required: true,
        enum: ["kharif", "rabi", "zaid", "summer", "winter"],
        trim: true
    },

    variety: {
        type: String,
        required: true,
        trim: true
    },

    sowing_date: {
        type: Date,
        required: true,
        index: true
    },

    growth_percent: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },

    area_acres: {
        type: Number,
        required: true,
        min: 0
    },

    irrigation_source: {
        type: String,
        enum: ["canal", "tube_well", "rainfed", "drip", "sprinkler", "other", null],
        default: null
    },

    location_override: {
        state: { type: String, trim: true },
        district: { type: String, trim: true },
        lat: { type: Number },
        lon: { type: Number }
    },

    derived: {
        stage: { 
            type: String,
            enum: ["germination", "seedling", "vegetative", "tillering", "flowering", "grain_filling", "maturity"],
            default: "germination"
        },
        days_after_sowing: { 
            type: Number, 
            default: 0,
            min: 0
        },
        last_irrigation_at: { type: Date }
    },

    status: {
        type: String,
        enum: ["active", "completed", "abandoned"],
        default: "active",
        index: true
    }

}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false
});

// Indexes for performance
cropSchema.index({ owner_id: 1, status: 1 });
cropSchema.index({ owner_id: 1, crop_name: 1, "location_override.district": 1 });
cropSchema.index({ sowing_date: 1, status: 1 });
cropSchema.index({ "derived.stage": 1 });

// Virtual for calculating days after sowing
cropSchema.virtual('calculated_days_after_sowing').get(function() {
    if (!this.sowing_date) return 0;
    const now = new Date();
    const sowingDate = new Date(this.sowing_date);
    const diffTime = Math.abs(now - sowingDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update derived fields
cropSchema.pre('save', function(next) {
    // Update days after sowing
    if (this.sowing_date) {
        this.derived.days_after_sowing = this.calculated_days_after_sowing;
    }

    // Auto-update growth stage based on growth percent
    if (this.growth_percent !== undefined) {
        if (this.growth_percent < 10) {
            this.derived.stage = "germination";
        } else if (this.growth_percent < 25) {
            this.derived.stage = "seedling";
        } else if (this.growth_percent < 45) {
            this.derived.stage = "vegetative";
        } else if (this.growth_percent < 65) {
            this.derived.stage = "tillering";
        } else if (this.growth_percent < 85) {
            this.derived.stage = "flowering";
        } else if (this.growth_percent < 100) {
            this.derived.stage = "grain_filling";
        } else {
            this.derived.stage = "maturity";
        }
    }

    next();
});

// Static methods
cropSchema.statics.findByOwner = function(ownerId, status = null) {
    const query = { owner_id: ownerId };
    if (status) query.status = status;
    return this.find(query).sort({ created_at: -1 });
};

cropSchema.statics.findActiveCrops = function(ownerId) {
    return this.find({ owner_id: ownerId, status: "active" }).sort({ sowing_date: -1 });
};

cropSchema.statics.findByCropName = function(ownerId, cropName) {
    return this.find({ owner_id: ownerId, crop_name: cropName }).sort({ sowing_date: -1 });
};

// Instance methods
cropSchema.methods.updateGrowth = function(growthPercent) {
    this.growth_percent = Math.max(0, Math.min(100, growthPercent));
    return this.save();
};

cropSchema.methods.markIrrigated = function() {
    this.derived.last_irrigation_at = new Date();
    return this.save();
};

cropSchema.methods.completeCrop = function() {
    this.status = "completed";
    this.growth_percent = 100;
    return this.save();
};

cropSchema.methods.abandonCrop = function() {
    this.status = "abandoned";
    return this.save();
};

const Crop = mongoose.model("Crop", cropSchema);

export default Crop;
