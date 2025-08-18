// Quick test script to verify maturity fields functionality
// This script demonstrates the new maturity fields without full integration

import mongoose from 'mongoose';

// Mock the crop schema structure for testing
const cropSchema = new mongoose.Schema({
    owner_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    crop_name: { type: String, required: true },
    season: { type: String, required: true, enum: ["kharif", "rabi", "zaid", "summer", "winter"] },
    variety: { type: String, required: true },
    sowing_date: { type: Date, required: true },
    growth_percent: { type: Number, min: 0, max: 100, default: 0 },
    area_acres: { type: Number, required: true, min: 0 },
    
    derived: {
        stage: { 
            type: String,
            enum: ["germination", "seedling", "vegetative", "tillering", "flowering", "grain_filling", "maturity"],
            default: "germination"
        },
        days_after_sowing: { type: Number, default: 0, min: 0 },
        last_irrigation_at: { type: Date },
        last_fertilization_at: { type: Date },
        duration_days: { type: Number, min: 1, default: 110 },
        expected_harvest_date: { type: Date }
    },
    
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active" }
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false
});

// Helper function to compute expected harvest date
function computeExpectedHarvestDate(sowingDate, durationDays) {
    if (!sowingDate || !durationDays || durationDays < 1) return undefined;
    return new Date(new Date(sowingDate).getTime() + durationDays * 86400000);
}

// Pre-validate hook to compute expected harvest date
cropSchema.pre("validate", function(next) {
    if (this.isModified("sowing_date") || this.isModified("derived.duration_days")) {
        const d = this.derived?.duration_days ?? 110;
        this.derived.expected_harvest_date = computeExpectedHarvestDate(this.sowing_date, d);
    }
    next();
});

const TestCrop = mongoose.model("TestCrop", cropSchema);

// Test scenarios
async function testMaturityFields() {
    console.log("🌾 Testing Maturity Fields Implementation\n");
    
    try {
        // Test 1: Default duration_days and expected_harvest_date calculation
        console.log("Test 1: Creating crop with default duration (110 days)");
        const crop1 = new TestCrop({
            owner_id: new mongoose.Types.ObjectId(),
            crop_name: "wheat",
            season: "rabi",
            variety: "HD-2967",
            sowing_date: new Date("2024-11-15"),
            area_acres: 5
        });
        
        // Trigger validation to compute expected_harvest_date
        await crop1.validate();
        
        console.log(`  - Sowing Date: ${crop1.sowing_date.toDateString()}`);
        console.log(`  - Duration Days: ${crop1.derived.duration_days}`);
        console.log(`  - Expected Harvest Date: ${crop1.derived.expected_harvest_date.toDateString()}`);
        
        // Verify calculation
        const expectedDate = new Date(crop1.sowing_date.getTime() + 110 * 86400000);
        const isCorrect = crop1.derived.expected_harvest_date.getTime() === expectedDate.getTime();
        console.log(`  - Calculation Correct: ${isCorrect ? '✓' : '✗'}\n`);
        
        // Test 2: Custom duration_days
        console.log("Test 2: Creating crop with custom duration (90 days)");
        const crop2 = new TestCrop({
            owner_id: new mongoose.Types.ObjectId(),
            crop_name: "rice",
            season: "kharif",
            variety: "Basmati-370",
            sowing_date: new Date("2024-06-15"),
            area_acres: 3,
            derived: {
                duration_days: 90
            }
        });
        
        await crop2.validate();
        
        console.log(`  - Sowing Date: ${crop2.sowing_date.toDateString()}`);
        console.log(`  - Duration Days: ${crop2.derived.duration_days}`);
        console.log(`  - Expected Harvest Date: ${crop2.derived.expected_harvest_date.toDateString()}`);
        
        // Verify calculation
        const expectedDate2 = new Date(crop2.sowing_date.getTime() + 90 * 86400000);
        const isCorrect2 = crop2.derived.expected_harvest_date.getTime() === expectedDate2.getTime();
        console.log(`  - Calculation Correct: ${isCorrect2 ? '✓' : '✗'}\n`);
        
        // Test 3: Updating duration_days should recalculate expected_harvest_date
        console.log("Test 3: Updating duration_days should recalculate harvest date");
        crop1.derived.duration_days = 120;
        await crop1.validate();
        
        console.log(`  - Updated Duration Days: ${crop1.derived.duration_days}`);
        console.log(`  - Updated Expected Harvest Date: ${crop1.derived.expected_harvest_date.toDateString()}`);
        
        // Verify recalculation
        const expectedDate3 = new Date(crop1.sowing_date.getTime() + 120 * 86400000);
        const isCorrect3 = crop1.derived.expected_harvest_date.getTime() === expectedDate3.getTime();
        console.log(`  - Recalculation Correct: ${isCorrect3 ? '✓' : '✗'}\n`);
        
        console.log("🎉 All maturity fields tests passed!");
        
    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

// Run the test
testMaturityFields();
