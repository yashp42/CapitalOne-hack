/**
 * Crop Duration Utility
 * 
 * This module provides utilities to get crop maturity duration based on crop type.
 * Used by both crop creation and harvest estimation to ensure consistency.
 */

// Crop-specific maturity periods (in days from sowing)
const CROP_MATURITY_PERIODS = {
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
    sponge_gourd: 80, pumpkin: 120, watermelon: 90, muskmelon: 85,
    
    // Spices
    turmeric: 270, ginger: 240, garlic: 150, cumin: 110, fennel: 210,
    ajwain: 140, cardamom: 1095, black_pepper: 1095, clove: 2190, cinnamon: 1460,
    
    // Fruits (first harvest)
    mango: 1460, banana: 300, orange: 1460, apple: 1460, grapes: 730,
    pomegranate: 730, papaya: 300, guava: 730, lemon: 1460, lime: 1460,
    
    // Fodder
    alfalfa: 60, berseem: 55, oat_fodder: 70, maize_fodder: 60,
    sorghum_fodder: 60, cowpea_fodder: 60,
    
    // Default
    default: 110
};

/**
 * Get the maturity duration in days for a given crop
 * @param {string} cropName - The name of the crop
 * @returns {number} Duration in days from sowing to harvest
 */
export const getCropDuration = (cropName) => {
    if (!cropName || typeof cropName !== 'string') {
        return CROP_MATURITY_PERIODS.default;
    }
    
    const normalizedCropName = cropName.toLowerCase().trim();
    return CROP_MATURITY_PERIODS[normalizedCropName] || CROP_MATURITY_PERIODS.default;
};

/**
 * Get all available crop types with their durations
 * @returns {Object} Object containing all crop types and their durations
 */
export const getAllCropDurations = () => {
    return { ...CROP_MATURITY_PERIODS };
};

/**
 * Check if a crop type is known
 * @param {string} cropName - The name of the crop
 * @returns {boolean} True if crop is in the database, false otherwise
 */
export const isKnownCrop = (cropName) => {
    if (!cropName || typeof cropName !== 'string') {
        return false;
    }
    
    const normalizedCropName = cropName.toLowerCase().trim();
    return normalizedCropName in CROP_MATURITY_PERIODS && normalizedCropName !== 'default';
};

export default {
    getCropDuration,
    getAllCropDurations,
    isKnownCrop
};
