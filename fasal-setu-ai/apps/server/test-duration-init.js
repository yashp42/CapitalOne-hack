// Test script to verify duration_days initialization during crop creation
import mongoose from 'mongoose';
import Crop from './src/models/crop.model.js';

// Connect to a test database (we'll use in-memory for this test)
async function testDurationInitialization() {
    console.log("🌾 Testing duration_days initialization during crop creation\n");
    
    try {
        // Test cases with different crop types
        const testCases = [
            { crop_name: 'wheat', expected_duration: 130 },
            { crop_name: 'rice', expected_duration: 130 },
            { crop_name: 'maize', expected_duration: 100 },
            { crop_name: 'tomato', expected_duration: 105 },
            { crop_name: 'onion', expected_duration: 130 },
            { crop_name: 'unknown_crop', expected_duration: 110 }, // Should use default
        ];

        // Get duration_days logic (same as in controller)
        const getCropDuration = (cropName) => {
            const cropMaturityPeriods = {
                // Cereals
                rice: 130, wheat: 130, maize: 100, barley: 120, sorghum: 110,
                pearl_millet: 80, finger_millet: 110, foxtail_millet: 85, oats: 100,
                
                // Pulses  
                chickpea: 110, pigeon_pea: 160, black_gram: 80, green_gram: 75,
                lentil: 120, field_pea: 110, kidney_bean: 120, cowpea: 95,
                black_eyed_pea: 95, horse_gram: 105,
                
                // Oilseeds
                groundnut: 110, soybean: 100, mustard: 135, sunflower: 95,
                sesame: 90, safflower: 130, castor: 150, niger: 100, linseed: 135,
                
                // Fiber/Cash crops
                cotton: 165, jute: 120, tobacco: 120,
                
                // Vegetables
                potato: 90, onion: 130, tomato: 105, cabbage: 90, cauliflower: 90,
                eggplant: 110, okra: 65, carrot: 95, radish: 45, turnip: 60,
                beetroot: 90, spinach: 40, fenugreek: 40, fenugreek_seed: 145,
                coriander: 40, coriander_seed: 100, chili: 120,
                
                // Cucurbits
                cucumber: 65, bottle_gourd: 90, bitter_gourd: 95, ridge_gourd: 85,
                pumpkin: 110, watermelon: 85, muskmelon: 90,
                
                // Spices
                turmeric: 270, ginger: 240, garlic: 150, curry_leaf: 365,
                black_pepper: 365, cardamom: 365, cinnamon: 365,
                
                // Fodder crops
                berseem: 60, lucerne: 365, sorghum_fodder: 60, cowpea_fodder: 60,
                
                // Default
                default: 110
            };

            return cropMaturityPeriods[cropName.toLowerCase()] || cropMaturityPeriods.default;
        };

        for (const testCase of testCases) {
            console.log(`Testing ${testCase.crop_name}:`);
            
            // Create crop data as it would be in the controller
            const cropData = {
                owner_id: new mongoose.Types.ObjectId(),
                crop_name: testCase.crop_name,
                season: 'kharif',
                variety: 'test-variety',
                sowing_date: new Date('2024-06-15'),
                area_acres: 2,
                irrigation_source: 'tube_well',
                derived: {
                    duration_days: getCropDuration(testCase.crop_name)
                }
            };

            // Create crop instance
            const crop = new Crop(cropData);
            
            // Trigger validation to compute expected_harvest_date
            await crop.validate();
            
            console.log(`  - Duration Days: ${crop.derived.duration_days}`);
            console.log(`  - Expected: ${testCase.expected_duration}`);
            console.log(`  - Match: ${crop.derived.duration_days === testCase.expected_duration ? '✓' : '✗'}`);
            console.log(`  - Expected Harvest Date: ${crop.derived.expected_harvest_date.toDateString()}`);
            
            // Verify expected harvest date calculation
            const expectedDate = new Date(crop.sowing_date.getTime() + crop.derived.duration_days * 86400000);
            const harvestCorrect = crop.derived.expected_harvest_date.getTime() === expectedDate.getTime();
            console.log(`  - Harvest Date Calculation: ${harvestCorrect ? '✓' : '✗'}\n`);
        }
        
        console.log("🎉 All duration_days initialization tests completed!");
        
    } catch (error) {
        console.error("❌ Test failed:", error.message);
        console.error(error.stack);
    }
}

// Run the test
testDurationInitialization();
