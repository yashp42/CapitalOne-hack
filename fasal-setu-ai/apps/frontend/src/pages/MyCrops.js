import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { FaPlus, FaSeedling, FaWater, FaSun, FaTrash, FaEdit } from 'react-icons/fa';

const MyCrops = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    } else {
      // Load mock data
      setLoading(true);
      setTimeout(() => {
        setCrops(mockCrops);
        setLoading(false);
      }, 800);
    }
  }, [isAuthenticated, navigate]);

  // Mock crop data (will be replaced with API call)
  const mockCrops = [
    {
      id: '1',
      name: 'Wheat',
      variety: 'HD-2967',
      season: 'Rabi',
      sowing_date: '2025-02-15',
      growth_percent: 65,
      area_acres: 2.5,
      irrigation_source: 'Canal',
      last_irrigated: '2025-07-20',
      expected_yield: '12 quintals',
      status: 'growing'
    },
    {
      id: '2',
      name: 'Rice',
      variety: 'Pusa Basmati',
      season: 'Kharif',
      sowing_date: '2025-06-05',
      growth_percent: 40,
      area_acres: 3,
      irrigation_source: 'Tube Well',
      last_irrigated: '2025-08-10',
      expected_yield: '18 quintals',
      status: 'growing'
    },
    {
      id: '3',
      name: 'Cotton',
      variety: 'Bt Cotton',
      season: 'Kharif',
      sowing_date: '2025-05-20',
      growth_percent: 80,
      area_acres: 5,
      irrigation_source: 'Rain-fed',
      last_irrigated: '2025-08-05',
      expected_yield: '8 quintals',
      status: 'growing'
    }
  ];

  const handleAddCrop = () => {
    setIsAddModalOpen(true);
  };

  const [newCrop, setNewCrop] = useState({
    name: '',
    variety: '',
    season: 'Kharif',
    sowing_date: '',
    area_acres: '',
    irrigation_source: 'Tube Well',
    is_late_registered: false,
    growth_stage: 'germination'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCrop({
      ...newCrop,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // In a real app, this would be an API call
    const mockId = Math.floor(Math.random() * 10000).toString();
    
    // Set growth percent based on selected stage if it's a late-registered crop
    let initialGrowth = 0;
    if (newCrop.is_late_registered) {
      switch (newCrop.growth_stage) {
        case 'seedling':
          initialGrowth = 15; // Middle of 10-25% range
          break;
        case 'vegetative':
          initialGrowth = 35; // Middle of 25-45% range
          break;
        case 'tillering':
          initialGrowth = 55; // Middle of 45-65% range
          break;
        case 'flowering':
          initialGrowth = 75; // Middle of 65-85% range
          break;
        case 'grain_filling':
          initialGrowth = 90; // Middle of 85-100% range
          break;
        case 'maturity':
          initialGrowth = 100; // Full maturity
          break;
        default:
          initialGrowth = 0;
      }
    }
    
    const cropToAdd = {
      ...newCrop,
      id: mockId,
      growth_percent: initialGrowth,
      last_irrigated: newCrop.sowing_date,
      expected_yield: 'Calculating...',
      status: initialGrowth > 0 ? 'growing' : 'sowing'
    };
    
    setCrops([...crops, cropToAdd]);
    setIsAddModalOpen(false);
    
    // Reset form
    setNewCrop({
      name: '',
      variety: '',
      season: 'Kharif',
      sowing_date: '',
      area_acres: '',
      irrigation_source: 'Tube Well',
      is_late_registered: false,
      growth_stage: 'germination'
    });
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 md:px-8 bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              My Crops
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and monitor all your farm crops
            </p>
          </div>
          <motion.button
            onClick={handleAddCrop}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="mt-4 md:mt-0 flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
          >
            <FaPlus />
            <span>Add Crop</span>
          </motion.button>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading your crops...</p>
          </div>
        ) : crops.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/70 p-8 text-center">
            <div className="flex justify-center mb-4">
              <FaSeedling className="text-5xl text-gray-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No crops found</h3>
            <p className="text-gray-500 mb-6">You haven't added any crops to your farm yet.</p>
            <motion.button
              onClick={handleAddCrop}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200"
            >
              <FaPlus />
              <span>Add Your First Crop</span>
            </motion.button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {crops.map(crop => (
              <motion.div 
                key={crop.id}
                variants={itemVariants}
                className="bg-white rounded-xl shadow-sm border border-gray-200/70 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">{crop.name}</h3>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">
                      {crop.status === 'growing' ? 'Growing' : 'Sowing'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-4">
                    <p>Variety: {crop.variety}</p>
                    <p>Season: {crop.season}</p>
                  </div>
                  
                  {/* Growth Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-600">Growth Progress</span>
                      <span className="text-xs font-medium text-primary-600">{crop.growth_percent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-500 h-2 rounded-full" 
                        style={{ width: `${crop.growth_percent}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="flex items-center space-x-1">
                      <FaWater className="text-blue-500" />
                      <span>Last watered: {new Date(crop.last_irrigated).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FaSun className="text-yellow-500" />
                      <span>Area: {crop.area_acres} acres</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-3 border-t border-gray-100">
                    <button className="text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                      <FaEdit className="inline mr-1" />
                      Edit
                    </button>
                    <button className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      <FaTrash className="inline mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Add Crop Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Add New Crop</h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Crop Name*</label>
                  <select
                    id="name"
                    name="name"
                    value={newCrop.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select crop</option>
                    <option value="Rice">Rice</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Cotton">Cotton</option>
                    <option value="Maize">Maize</option>
                    <option value="Sugarcane">Sugarcane</option>
                    <option value="Potato">Potato</option>
                    <option value="Tomato">Tomato</option>
                    <option value="Soybean">Soybean</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="variety" className="block text-sm font-medium text-gray-700 mb-1">Variety</label>
                  <input
                    type="text"
                    id="variety"
                    name="variety"
                    value={newCrop.variety}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Pusa Basmati"
                  />
                </div>
                
                <div>
                  <label htmlFor="season" className="block text-sm font-medium text-gray-700 mb-1">Season*</label>
                  <select
                    id="season"
                    name="season"
                    value={newCrop.season}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="Kharif">Kharif (Monsoon)</option>
                    <option value="Rabi">Rabi (Winter)</option>
                    <option value="Zaid">Zaid (Summer)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="sowing_date" className="block text-sm font-medium text-gray-700 mb-1">Sowing Date*</label>
                  <input
                    type="date"
                    id="sowing_date"
                    name="sowing_date"
                    value={newCrop.sowing_date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="area_acres" className="block text-sm font-medium text-gray-700 mb-1">Area (acres)*</label>
                  <input
                    type="number"
                    id="area_acres"
                    name="area_acres"
                    value={newCrop.area_acres}
                    onChange={handleInputChange}
                    required
                    min="0.1"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 2.5"
                  />
                </div>
                
                <div>
                  <label htmlFor="irrigation_source" className="block text-sm font-medium text-gray-700 mb-1">Irrigation Source*</label>
                  <select
                    id="irrigation_source"
                    name="irrigation_source"
                    value={newCrop.irrigation_source}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="Tube Well">Tube Well</option>
                    <option value="Canal">Canal</option>
                    <option value="Rain-fed">Rain-fed</option>
                    <option value="Pond">Pond</option>
                    <option value="River">River</option>
                    <option value="Drip Irrigation">Drip Irrigation</option>
                  </select>
                </div>
                
                {/* Crop Registration Type */}
                <div className="pt-3 border-t border-gray-200">
                  <p className="block text-sm font-medium text-gray-700 mb-2">Registration Type</p>
                  <div className="flex flex-col space-y-2">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="is_late_registered"
                        checked={!newCrop.is_late_registered}
                        onChange={() => setNewCrop(prev => ({ ...prev, is_late_registered: false }))}
                        className="form-radio text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">New crop (just planted)</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="is_late_registered"
                        checked={newCrop.is_late_registered}
                        onChange={() => setNewCrop(prev => ({ ...prev, is_late_registered: true }))}
                        className="form-radio text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Existing crop (planted earlier)</span>
                    </label>
                  </div>
                </div>
                
                {/* Growth Stage Selection (only shown for late registered crops) */}
                {newCrop.is_late_registered && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <label htmlFor="growth_stage" className="block text-sm font-medium text-blue-700 mb-1">
                      Current Growth Stage*
                    </label>
                    <select
                      id="growth_stage"
                      name="growth_stage"
                      value={newCrop.growth_stage}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="germination">Germination (0-10%)</option>
                      <option value="seedling">Seedling (10-25%)</option>
                      <option value="vegetative">Vegetative (25-45%)</option>
                      <option value="tillering">Tillering (45-65%)</option>
                      <option value="flowering">Flowering (65-85%)</option>
                      <option value="grain_filling">Grain Filling (85-100%)</option>
                      <option value="maturity">Maturity (100%)</option>
                    </select>
                    <p className="mt-1 text-xs text-blue-600">Select the current growth stage of your crop</p>
                  </div>
                )}
                
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg mr-2 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                  >
                    Add Crop
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MyCrops;
