import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cropAPI } from '../services/api';
import { motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import { FaPlus, FaSeedling, FaWater, FaSun, FaTrash, FaEdit, FaLeaf, FaTractor, FaCloudRain, FaChartLine } from 'react-icons/fa';

// 3D Model Component with rotation
function CropModel({ ...props }) {
  const { scene } = useGLTF('./assets/low_poly_farm_v2.glb');
  const groupRef = useRef();
  
  // Add rotation animation
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15; // Slower rotation speed
    }
  });
  
  return (
    <group ref={groupRef} {...props}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

const MyFarm = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeason, setFilterSeason] = useState('all');
  const [filterStage, setFilterStage] = useState('all');

  // Load crops from API
  const loadCrops = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await cropAPI.getCrops();
      console.log('getCrops response:', response); // Debug log
      if (response.success) {
        // Backend returns data.crops array, not just data
        const cropsData = Array.isArray(response.data?.crops) ? response.data.crops : [];
        console.log('Loaded crops:', cropsData); // Debug log
        setCrops(cropsData);
      } else {
        setError('Failed to load crops');
        setCrops([]); // Set empty array on error
      }
    } catch (err) {
      console.error('Error loading crops:', err);
      setError('Failed to load crops');
      setCrops([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    } else {
      loadCrops();
    }
  }, [isAuthenticated, navigate]);

  const [newCrop, setNewCrop] = useState({
    crop_name: '',
    variety: '',
    season: 'kharif',
    sowing_date: '',
    area_acres: '',
    irrigation_source: 'tube_well',
    is_late_registered: false,
    growth_stage: 'germination',
    location_override: {
      enabled: false,
      state: '',
      district: '',
      lat: '',
      lon: ''
    }
  });

  // Function to detect if crop is late registered based on sowing date
  const detectLateRegistration = (sowingDate) => {
    if (!sowingDate) return false;
    
    const sowingDateObj = new Date(sowingDate);
    const currentDate = new Date();
    const daysDifference = Math.floor((currentDate - sowingDateObj) / (1000 * 60 * 60 * 24));
    
    // Consider crop as late registered if sowing was more than 7 days ago
    return daysDifference > 7;
  };

  // Function to estimate growth stage based on days since sowing and crop type
  const estimateGrowthStage = (sowingDate, cropType = '') => {
    if (!sowingDate) return 'germination';
    
    const sowingDateObj = new Date(sowingDate);
    const currentDate = new Date();
    const daysDifference = Math.floor((currentDate - sowingDateObj) / (1000 * 60 * 60 * 24));
    
    // Crop-specific growth timelines (in days)
    const cropTimelines = {
      // Cereals
      'rice': { seedling: 15, vegetative: 45, tillering: 75, flowering: 105, grain_filling: 135 },
      'wheat': { seedling: 12, vegetative: 35, tillering: 65, flowering: 95, grain_filling: 125 },
      'maize': { seedling: 10, vegetative: 30, tillering: 50, flowering: 70, grain_filling: 100 },
      'barley': { seedling: 12, vegetative: 35, tillering: 65, flowering: 90, grain_filling: 120 },
      'sorghum': { seedling: 8, vegetative: 25, tillering: 45, flowering: 75, grain_filling: 105 },
      'pearl_millet': { seedling: 7, vegetative: 20, tillering: 35, flowering: 55, grain_filling: 75 },
      'finger_millet': { seedling: 10, vegetative: 30, tillering: 50, flowering: 70, grain_filling: 100 },
      
      // Pulses
      'chickpea': { seedling: 15, vegetative: 35, tillering: 65, flowering: 85, grain_filling: 110 },
      'pigeon_pea': { seedling: 12, vegetative: 40, tillering: 80, flowering: 120, grain_filling: 160 },
      'black_gram': { seedling: 8, vegetative: 20, tillering: 35, flowering: 50, grain_filling: 70 },
      'green_gram': { seedling: 8, vegetative: 20, tillering: 35, flowering: 50, grain_filling: 70 },
      'lentil': { seedling: 12, vegetative: 30, tillering: 55, flowering: 75, grain_filling: 100 },
      'field_pea': { seedling: 10, vegetative: 25, tillering: 45, flowering: 65, grain_filling: 85 },
      
      // Oilseeds
      'groundnut': { seedling: 10, vegetative: 25, tillering: 45, flowering: 65, grain_filling: 95 },
      'soybean': { seedling: 10, vegetative: 25, tillering: 45, flowering: 65, grain_filling: 95 },
      'mustard': { seedling: 8, vegetative: 20, tillering: 40, flowering: 60, grain_filling: 85 },
      'sunflower': { seedling: 10, vegetative: 25, tillering: 45, flowering: 65, grain_filling: 90 },
      'sesame': { seedling: 8, vegetative: 20, tillering: 35, flowering: 55, grain_filling: 80 },
      'safflower': { seedling: 12, vegetative: 30, tillering: 55, flowering: 80, grain_filling: 110 },
      
      // Cash Crops
      'cotton': { seedling: 15, vegetative: 45, tillering: 85, flowering: 115, grain_filling: 145 },
      'sugarcane': { seedling: 20, vegetative: 60, tillering: 120, flowering: 240, grain_filling: 300 },
      'jute': { seedling: 10, vegetative: 30, tillering: 60, flowering: 90, grain_filling: 120 },
      'tobacco': { seedling: 15, vegetative: 35, tillering: 55, flowering: 75, grain_filling: 100 },
      
      // Vegetables
      'potato': { seedling: 10, vegetative: 25, tillering: 45, flowering: 65, grain_filling: 85 },
      'onion': { seedling: 15, vegetative: 40, tillering: 70, flowering: 100, grain_filling: 130 },
      'tomato': { seedling: 15, vegetative: 35, tillering: 55, flowering: 75, grain_filling: 105 },
      'cabbage': { seedling: 12, vegetative: 30, tillering: 50, flowering: 70, grain_filling: 90 },
      'cauliflower': { seedling: 12, vegetative: 30, tillering: 50, flowering: 70, grain_filling: 90 },
      'eggplant': { seedling: 15, vegetative: 35, tillering: 55, flowering: 80, grain_filling: 110 },
      'okra': { seedling: 8, vegetative: 20, tillering: 35, flowering: 50, grain_filling: 70 },
      'carrot': { seedling: 10, vegetative: 25, tillering: 45, flowering: 65, grain_filling: 85 },
      'chili': { seedling: 15, vegetative: 35, tillering: 55, flowering: 80, grain_filling: 110 },
      
      // Spices
      'turmeric': { seedling: 20, vegetative: 60, tillering: 120, flowering: 180, grain_filling: 240 },
      'ginger': { seedling: 20, vegetative: 50, tillering: 100, flowering: 150, grain_filling: 200 },
      'garlic': { seedling: 15, vegetative: 40, tillering: 70, flowering: 100, grain_filling: 130 },
      'coriander': { seedling: 8, vegetative: 20, tillering: 35, flowering: 50, grain_filling: 70 },
      'cumin': { seedling: 10, vegetative: 25, tillering: 45, flowering: 65, grain_filling: 90 },
      'fennel': { seedling: 12, vegetative: 30, tillering: 55, flowering: 80, grain_filling: 110 },
      
      // Fodder Crops
      'alfalfa': { seedling: 10, vegetative: 25, tillering: 40, flowering: 60, grain_filling: 80 },
      'berseem': { seedling: 8, vegetative: 20, tillering: 35, flowering: 50, grain_filling: 70 },
      'oat_fodder': { seedling: 8, vegetative: 20, tillering: 35, flowering: 50, grain_filling: 70 },
      'maize_fodder': { seedling: 8, vegetative: 20, tillering: 35, flowering: 50, grain_filling: 70 },
      
      'default': { seedling: 12, vegetative: 35, tillering: 65, flowering: 95, grain_filling: 125 }
    };
    
    const timeline = cropTimelines[cropType.toLowerCase()] || cropTimelines.default;
    
    if (daysDifference <= 7) return 'germination';
    if (daysDifference <= timeline.seedling) return 'seedling';
    if (daysDifference <= timeline.vegetative) return 'vegetative';
    if (daysDifference <= timeline.tillering) return 'tillering';
    if (daysDifference <= timeline.flowering) return 'flowering';
    if (daysDifference <= timeline.grain_filling) return 'grain_filling';
    return 'maturity';
  };

  // Function to validate registration type against sowing date
  const validateRegistrationType = () => {
    if (!newCrop.sowing_date) return { isValid: true, message: '' };
    
    const isLateByDate = detectLateRegistration(newCrop.sowing_date);
    const userSelectedLate = newCrop.is_late_registered;
    
    if (isLateByDate && !userSelectedLate) {
      return {
        isValid: false,
        message: 'This crop was planted more than 7 days ago and should be registered as "Existing crop"'
      };
    }
    
    // Validate location override if enabled
    if (newCrop.location_override.enabled) {
      if (!newCrop.location_override.state || !newCrop.location_override.district) {
        return {
          isValid: false,
          message: 'Please select both state and district for location override'
        };
      }
      
      // Validate GPS coordinates if provided
      const lat = parseFloat(newCrop.location_override.lat);
      const lon = parseFloat(newCrop.location_override.lon);
      
      if (newCrop.location_override.lat && (isNaN(lat) || lat < -90 || lat > 90)) {
        return {
          isValid: false,
          message: 'Latitude must be between -90 and 90 degrees'
        };
      }
      
      if (newCrop.location_override.lon && (isNaN(lon) || lon < -180 || lon > 180)) {
        return {
          isValid: false,
          message: 'Longitude must be between -180 and 180 degrees'
        };
      }
    }
    
    return { isValid: true, message: '' };
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    let updatedCrop = {
      ...newCrop,
      [name]: value
    };

    // Auto-detect late registration when sowing date changes
    if (name === 'sowing_date') {
      const isLateRegistered = detectLateRegistration(value);
      updatedCrop = {
        ...updatedCrop,
        is_late_registered: isLateRegistered,
        growth_stage: isLateRegistered ? estimateGrowthStage(value, updatedCrop.crop_name) : 'germination'
      };
    }

    // Re-estimate growth stage when crop type changes for late registered crops
    if (name === 'crop_name' && updatedCrop.is_late_registered && updatedCrop.sowing_date) {
      updatedCrop = {
        ...updatedCrop,
        growth_stage: estimateGrowthStage(updatedCrop.sowing_date, value)
      };
    }

    setNewCrop(updatedCrop);
  };

  const handleAddCrop = () => {
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError('');
      
      // Prepare crop data for API
      const cropData = {
        crop_name: newCrop.crop_name,
        variety: newCrop.variety,
        season: newCrop.season,
        sowing_date: newCrop.sowing_date,
        area_acres: parseFloat(newCrop.area_acres),
        irrigation_source: newCrop.irrigation_source,
        is_late_registered: newCrop.is_late_registered
      };

      // Add location override if enabled
      if (newCrop.location_override.enabled) {
        cropData.location_override = {
          state: newCrop.location_override.state,
          district: newCrop.location_override.district,
          lat: newCrop.location_override.lat ? parseFloat(newCrop.location_override.lat) : null,
          lon: newCrop.location_override.lon ? parseFloat(newCrop.location_override.lon) : null
        };
      }

      // Add growth stage for late registered crops
      if (newCrop.is_late_registered) {
        cropData.growth_stage = newCrop.growth_stage;
      }

      // Call API to create crop
      const response = await cropAPI.createCrop(cropData);
      
      if (response.success) {
        // Reload crops to get updated list
        await loadCrops();
        setIsAddModalOpen(false);
        
        // Reset form
        setNewCrop({
          crop_name: '',
          variety: '',
          season: 'kharif',
          sowing_date: '',
          area_acres: '',
          irrigation_source: 'tube_well',
          is_late_registered: false,
          growth_stage: 'germination',
          location_override: {
            enabled: false,
            state: '',
            district: '',
            lat: '',
            lon: ''
          }
        });
      } else {
        setError(response.message || 'Failed to add crop');
      }
    } catch (err) {
      console.error('Error adding crop:', err);
      setError('Failed to add crop. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete crop function
  const handleDeleteCrop = async (cropId) => {
    try {
      setSubmitting(true);
      const response = await cropAPI.deleteCrop(cropId);
      if (response.success) {
        // Reload crops to get updated list
        await loadCrops();
        setDeleteConfirmId(null);
      } else {
        setError(response.message || 'Failed to delete crop');
      }
    } catch (err) {
      console.error('Error deleting crop:', err);
      setError('Failed to delete crop. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit crop function
  const handleEditCrop = (crop) => {
    setEditingCrop(crop);
    setNewCrop({
      crop_name: crop.crop_name,
      variety: crop.variety,
      season: crop.season,
      sowing_date: crop.sowing_date,
      area_acres: crop.area_acres,
      irrigation_source: crop.irrigation_source,
      is_late_registered: crop.is_late_registered,
      growth_stage: crop.growth_stage,
      location_override: crop.location_override || {
        enabled: false,
        state: '',
        district: '',
        lat: '',
        lon: ''
      }
    });
    setIsEditModalOpen(true);
  };

  // Update crop function
  const handleUpdateCrop = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      
      const response = await cropAPI.updateCrop(editingCrop._id, newCrop);
      if (response.success) {
        // Reload crops to get updated list
        await loadCrops();
        setIsEditModalOpen(false);
        setEditingCrop(null);
        
        // Reset form
        setNewCrop({
          crop_name: '',
          variety: '',
          season: 'kharif',
          sowing_date: '',
          area_acres: '',
          irrigation_source: 'tube_well',
          is_late_registered: false,
          growth_stage: 'germination',
          location_override: {
            enabled: false,
            state: '',
            district: '',
            lat: '',
            lon: ''
          }
        });
      } else {
        setError(response.message || 'Failed to update crop');
      }
    } catch (err) {
      console.error('Error updating crop:', err);
      setError('Failed to update crop. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'germination':
      case 'seedling':
        return <FaSeedling className="text-green-400" />;
      case 'vegetative':
      case 'tillering':
        return <FaLeaf className="text-green-500" />;
      case 'flowering':
        return <FaSun className="text-yellow-500" />;
      case 'grain_filling':
      case 'maturity':
        return <FaTractor className="text-orange-500" />;
      default:
        return <FaSeedling className="text-green-400" />;
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'germination':
        return 'bg-green-100 text-green-800';
      case 'seedling':
        return 'bg-green-200 text-green-800';
      case 'vegetative':
        return 'bg-blue-100 text-blue-800';
      case 'tillering':
        return 'bg-blue-200 text-blue-800';
      case 'flowering':
        return 'bg-yellow-100 text-yellow-800';
      case 'grain_filling':
        return 'bg-orange-100 text-orange-800';
      case 'maturity':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter crops based on search and filters
  const filteredCrops = Array.isArray(crops) ? crops.filter(crop => {
    const matchesSearch = crop.crop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         crop.variety.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeason = filterSeason === 'all' || crop.season === filterSeason;
    const matchesStage = filterStage === 'all' || (crop.derived?.stage || 'sowing') === filterStage;
    
    return matchesSearch && matchesSeason && matchesStage;
  }) : [];

  // Calculate farm statistics
  const farmStats = {
    totalCrops: Array.isArray(crops) ? crops.length : 0,
    totalArea: Array.isArray(crops) ? crops.reduce((sum, crop) => sum + parseFloat(crop.area_acres || 0), 0) : 0,
    activeCrops: Array.isArray(crops) ? crops.filter(crop => crop.status === 'active').length : 0,
    avgGrowth: Array.isArray(crops) && crops.length > 0 ? crops.reduce((sum, crop) => sum + (crop.growth_percent || 0), 0) / crops.length : 0
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-200 via-white to-secondary-200 overflow-hidden">
      {/* 3D Model Header Section */}
      <div className="relative pt-20 pb-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100/50 via-secondary-50/30 to-primary-50/20" />
        
        {/* 3D Model */}
        <div className="relative z-10 h-[500px] mb-12">
          <Canvas
            camera={{ position: [0, 2, 10], fov: 60 }}
            style={{ height: '100%', background: 'transparent' }}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[10, 30, 0]} intensity={0.9} />
            <Suspense fallback={null}>
              <CropModel scale={[0.2, 0.2, 0.2]} position={[0, 0.5, 0]} />
            </Suspense>
          </Canvas>
        </div>

        {/* Hero Content */}
        <div className="relative z-0 max-w-6xl mx-auto px-4 sm:px-6 md:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary-700 to-secondary-600 bg-clip-text text-transparent mb-4">
              Welcome to Your Farm, {user?.firstName}!
            </h1>
            <p className="text-lg sm:text-xl text-gray-700 mb-8">
              Manage your crops, track growth, and optimize your farming operations
            </p>
          </motion.div>
        </div>
      </div>

      {/* Farm Statistics */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 mb-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 backdrop-blur-sm rounded-xl p-4 border border-primary-200/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-600 font-medium">Total Crops</p>
                <p className="text-2xl font-bold text-primary-800">{farmStats.totalCrops}</p>
              </div>
              <FaSeedling className="text-2xl text-primary-500" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 backdrop-blur-sm rounded-xl p-4 border border-secondary-200/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-600 font-medium">Total Area</p>
                <p className="text-2xl font-bold text-secondary-800">{farmStats.totalArea.toFixed(1)} acres</p>
              </div>
              <FaTractor className="text-2xl text-secondary-500" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 backdrop-blur-sm rounded-xl p-4 border border-green-200/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Active Crops</p>
                <p className="text-2xl font-bold text-green-800">{farmStats.activeCrops}</p>
              </div>
              <FaLeaf className="text-2xl text-green-500" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 backdrop-blur-sm rounded-xl p-4 border border-blue-200/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Avg Growth</p>
                <p className="text-2xl font-bold text-blue-800">{farmStats.avgGrowth.toFixed(0)}%</p>
              </div>
              <FaChartLine className="text-2xl text-blue-500" />
            </div>
          </div>
        </motion.div>

        {/* Add Crop Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-700 to-secondary-600 bg-clip-text text-transparent">Your Crops</h2>
            <p className="text-gray-600">Monitor and manage all your farm crops</p>
          </div>
          <motion.button
            onClick={handleAddCrop}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg"
          >
            <FaPlus />
            <span>Add New Crop</span>
          </motion.button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search crops by name or variety..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-primary-300 rounded-xl bg-white/80 backdrop-blur-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                />
                <FaSeedling className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-500" />
              </div>
            </div>
            
            {/* Season Filter */}
            <div className="w-full md:w-48">
              <select
                value={filterSeason}
                onChange={(e) => setFilterSeason(e.target.value)}
                className="w-full px-4 py-3 border border-primary-300 rounded-xl bg-white/80 backdrop-blur-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              >
                <option value="all">All Seasons</option>
                <option value="kharif">Kharif</option>
                <option value="rabi">Rabi</option>
                <option value="zaid">Zaid</option>
                <option value="year_round">Year Round</option>
              </select>
            </div>
            
            {/* Growth Stage Filter */}
            <div className="w-full md:w-48">
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="w-full px-4 py-3 border border-primary-300 rounded-xl bg-white/80 backdrop-blur-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              >
                <option value="all">All Stages</option>
                <option value="germination">Germination</option>
                <option value="seedling">Seedling</option>
                <option value="vegetative">Vegetative</option>
                <option value="tillering">Tillering</option>
                <option value="flowering">Flowering</option>
                <option value="grain_filling">Grain Filling</option>
                <option value="maturity">Maturity</option>
              </select>
            </div>
          </div>
          
          {/* Results Info */}
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>
              Showing {filteredCrops.length} of {crops.length} crops
            </span>
            {(searchTerm || filterSeason !== 'all' || filterStage !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterSeason('all');
                  setFilterStage('all');
                }}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Crops Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading your farm...</p>
          </div>
        ) : !Array.isArray(crops) || crops.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white/90 to-secondary-50/40 backdrop-blur-sm rounded-2xl shadow-sm border border-secondary-200/30 p-12 text-center"
          >
            <div className="flex justify-center mb-6">
              <FaSeedling className="text-6xl text-secondary-300" />
            </div>
            <h3 className="text-2xl font-semibold bg-gradient-to-r from-primary-700 to-secondary-600 bg-clip-text text-transparent mb-3">Start Your Farming Journey</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              You haven't added any crops to your farm yet. Add your first crop to begin tracking your farming progress.
            </p>
            <motion.button
              onClick={handleAddCrop}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg"
            >
              <FaPlus />
              <span>Add Your First Crop</span>
            </motion.button>
          </motion.div>
        ) : filteredCrops.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white/90 to-yellow-50/40 backdrop-blur-sm rounded-2xl shadow-sm border border-yellow-200/30 p-12 text-center"
          >
            <div className="flex justify-center mb-6">
              <FaLeaf className="text-6xl text-yellow-300" />
            </div>
            <h3 className="text-2xl font-semibold bg-gradient-to-r from-yellow-700 to-orange-600 bg-clip-text text-transparent mb-3">No Crops Found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              No crops match your current search or filter criteria. Try adjusting your filters or add a new crop.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterSeason('all');
                setFilterStage('all');
              }}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear all filters
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredCrops.map((crop, index) => (
              <motion.div 
                key={crop._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-white/90 to-primary-50/40 backdrop-blur-sm rounded-2xl shadow-sm border border-primary-200/30 overflow-hidden hover:shadow-lg hover:from-white/95 hover:to-primary-50/60 transition-all duration-300"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-1 capitalize">{crop.crop_name}</h3>
                      <p className="text-sm text-gray-500">{crop.variety}</p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${getStageColor(crop.derived?.stage || 'sowing')}`}>
                        {crop.derived?.stage || 'sowing'}
                      </span>
                      {getStageIcon(crop.derived?.stage || 'sowing')}
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Season:</span>
                      <span className="font-medium text-gray-800 capitalize">{crop.season}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Area:</span>
                      <span className="font-medium text-gray-800">{crop.area_acres} acres</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Irrigation:</span>
                      <span className="font-medium text-gray-800">{crop.irrigation_source}</span>
                    </div>
                  </div>
                  
                  {/* Growth Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-600">Growth Progress</span>
                      <span className="text-sm font-bold text-primary-600">{crop.growth_percent || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-primary-500 to-green-500 h-3 rounded-full transition-all duration-500" 
                        style={{ width: `${crop.growth_percent || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <FaWater className="text-blue-500" />
                      <span>Last: {crop.derived?.last_irrigation_at ? new Date(crop.derived.last_irrigation_at).toLocaleDateString() : 'Never'}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEditCrop(crop)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit crop"
                      >
                        <FaEdit className="text-sm" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(crop._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete crop"
                      >
                        <FaTrash className="text-sm" />
                      </button>
                    </div>
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
            className="bg-primary-300 backdrop-blur-sm rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-primary-200/50"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-primary">Add New Crop</h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="crop_name" className="block text-sm font-medium text-gray-700 mb-2">Crop Name*</label>
                  <select
                    id="crop_name"
                    name="crop_name"
                    value={newCrop.crop_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select crop</option>
                    
                    {/* Cereals */}
                    <optgroup label="Cereals">
                      <option value="rice">Rice</option>
                      <option value="wheat">Wheat</option>
                      <option value="maize">Maize</option>
                      <option value="barley">Barley</option>
                      <option value="sorghum">Sorghum</option>
                      <option value="pearl_millet">Pearl Millet</option>
                      <option value="finger_millet">Finger Millet</option>
                      <option value="foxtail_millet">Foxtail Millet</option>
                      <option value="oats">Oats</option>
                    </optgroup>

                    {/* Pulses */}
                    <optgroup label="Pulses">
                      <option value="chickpea">Chickpea</option>
                      <option value="pigeon_pea">Pigeon Pea</option>
                      <option value="black_gram">Black Gram</option>
                      <option value="green_gram">Green Gram</option>
                      <option value="lentil">Lentil</option>
                      <option value="field_pea">Field Pea</option>
                      <option value="black_eyed_pea">Black Eyed Pea</option>
                      <option value="kidney_bean">Kidney Bean</option>
                      <option value="horse_gram">Horse Gram</option>
                    </optgroup>

                    {/* Oilseeds */}
                    <optgroup label="Oilseeds">
                      <option value="groundnut">Groundnut</option>
                      <option value="soybean">Soybean</option>
                      <option value="mustard">Mustard</option>
                      <option value="sunflower">Sunflower</option>
                      <option value="sesame">Sesame</option>
                      <option value="safflower">Safflower</option>
                      <option value="castor">Castor</option>
                      <option value="niger">Niger</option>
                      <option value="linseed">Linseed</option>
                    </optgroup>

                    {/* Cash Crops */}
                    <optgroup label="Cash Crops">
                      <option value="cotton">Cotton</option>
                      <option value="sugarcane">Sugarcane</option>
                      <option value="jute">Jute</option>
                      <option value="tobacco">Tobacco</option>
                      <option value="rubber">Rubber</option>
                      <option value="tea">Tea</option>
                      <option value="coffee">Coffee</option>
                      <option value="coconut">Coconut</option>
                    </optgroup>

                    {/* Vegetables */}
                    <optgroup label="Vegetables">
                      <option value="potato">Potato</option>
                      <option value="onion">Onion</option>
                      <option value="tomato">Tomato</option>
                      <option value="cabbage">Cabbage</option>
                      <option value="cauliflower">Cauliflower</option>
                      <option value="eggplant">Eggplant</option>
                      <option value="okra">Okra</option>
                      <option value="carrot">Carrot</option>
                      <option value="radish">Radish</option>
                      <option value="turnip">Turnip</option>
                      <option value="beetroot">Beetroot</option>
                      <option value="spinach">Spinach</option>
                      <option value="fenugreek">Fenugreek</option>
                      <option value="coriander">Coriander</option>
                      <option value="chili">Chili</option>
                      <option value="garlic">Garlic</option>
                      <option value="ginger">Ginger</option>
                      <option value="turmeric">Turmeric</option>
                    </optgroup>

                    {/* Fruits */}
                    <optgroup label="Fruits">
                      <option value="mango">Mango</option>
                      <option value="banana">Banana</option>
                      <option value="orange">Orange</option>
                      <option value="apple">Apple</option>
                      <option value="grapes">Grapes</option>
                      <option value="pomegranate">Pomegranate</option>
                      <option value="papaya">Papaya</option>
                      <option value="guava">Guava</option>
                      <option value="watermelon">Watermelon</option>
                      <option value="muskmelon">Muskmelon</option>
                      <option value="lemon">Lemon</option>
                      <option value="lime">Lime</option>
                    </optgroup>

                    {/* Spices */}
                    <optgroup label="Spices">
                      <option value="cardamom">Cardamom</option>
                      <option value="black_pepper">Black Pepper</option>
                      <option value="cumin">Cumin</option>
                      <option value="fennel">Fennel</option>
                      <option value="ajwain">Ajwain</option>
                      <option value="clove">Clove</option>
                      <option value="cinnamon">Cinnamon</option>
                      <option value="nutmeg">Nutmeg</option>
                    </optgroup>

                    {/* Fodder Crops */}
                    <optgroup label="Fodder Crops">
                      <option value="alfalfa">Alfalfa</option>
                      <option value="berseem">Berseem</option>
                      <option value="oat_fodder">Oat Fodder</option>
                      <option value="maize_fodder">Maize Fodder</option>
                      <option value="sorghum_fodder">Sorghum Fodder</option>
                      <option value="cowpea_fodder">Cowpea Fodder</option>
                    </optgroup>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="variety" className="block text-sm font-medium text-gray-700 mb-2">Variety</label>
                  <input
                    type="text"
                    id="variety"
                    name="variety"
                    value={newCrop.variety}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., Pusa Basmati"
                  />
                </div>
                
                <div>
                  <label htmlFor="season" className="block text-sm font-medium text-gray-700 mb-2">Season*</label>
                  <select
                    id="season"
                    name="season"
                    value={newCrop.season}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="kharif">Kharif (Monsoon)</option>
                    <option value="rabi">Rabi (Winter)</option>
                    <option value="zaid">Zaid (Summer)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="sowing_date" className="block text-sm font-medium text-gray-700 mb-2">Sowing Date*</label>
                  <input
                    type="date"
                    id="sowing_date"
                    name="sowing_date"
                    value={newCrop.sowing_date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  />
                  {newCrop.sowing_date && newCrop.is_late_registered && (
                    <p className="mt-2 text-xs text-orange-600 flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>Auto-detected as late registration. Estimated growth stage: {newCrop.growth_stage}</span>
                    </p>
                  )}
                  {newCrop.sowing_date && !newCrop.is_late_registered && (
                    <p className="mt-2 text-xs text-green-600 flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>New crop registration</span>
                    </p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="area_acres" className="block text-sm font-medium text-gray-700 mb-2">Area (acres)*</label>
                  <input
                    type="number"
                    id="area_acres"
                    name="area_acres"
                    value={newCrop.area_acres}
                    onChange={handleInputChange}
                    required
                    min="0.1"
                    step="0.1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., 2.5"
                  />
                </div>
                
                <div>
                  <label htmlFor="irrigation_source" className="block text-sm font-medium text-gray-700 mb-2">Irrigation Source*</label>
                  <select
                    id="irrigation_source"
                    name="irrigation_source"
                    value={newCrop.irrigation_source}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="tube_well">Tube Well</option>
                    <option value="canal">Canal</option>
                    <option value="rainfed">Rain-fed</option>
                    <option value="drip">Drip Irrigation</option>
                    <option value="sprinkler">Sprinkler</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                {/* Registration Type */}
                <div className="pt-3 border-t border-gray-200">
                  <p className="block text-sm font-medium text-gray-700 mb-3">
                    Registration Type 
                    {newCrop.sowing_date && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({detectLateRegistration(newCrop.sowing_date) ? 'Auto-detected as late' : 'Auto-detected as new'})
                      </span>
                    )}
                  </p>
                  
                  {/* Validation Warning */}
                  {!validateRegistrationType().isValid && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-red-600 font-medium">{validateRegistrationType().message}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {(() => {
                      const isLateByDate = newCrop.sowing_date ? detectLateRegistration(newCrop.sowing_date) : false;
                      const shouldDisableNew = isLateByDate;
                      
                      return (
                        <>
                          <label className={`flex items-center p-3 border rounded-xl transition-colors ${
                            shouldDisableNew 
                              ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60' 
                              : !newCrop.is_late_registered 
                                ? 'border-green-300 bg-green-50 cursor-pointer hover:bg-green-100' 
                                : 'border-gray-200 cursor-pointer hover:bg-gray-50'
                          }`}>
                            <input
                              type="radio"
                              name="is_late_registered"
                              checked={!newCrop.is_late_registered}
                              disabled={shouldDisableNew}
                              onChange={() => setNewCrop(prev => ({ ...prev, is_late_registered: false, growth_stage: 'germination' }))}
                              className="form-radio text-primary-600 disabled:opacity-50"
                            />
                            <div className="ml-3">
                              <span className={`text-sm font-medium ${shouldDisableNew ? 'text-gray-400' : 'text-gray-700'}`}>
                                New crop (just planted)
                              </span>
                              <p className={`text-xs ${shouldDisableNew ? 'text-gray-400' : 'text-gray-500'}`}>
                                Crop was recently planted (within 7 days)
                              </p>
                              {shouldDisableNew && (
                                <p className="text-xs text-red-500 mt-1">
                                  Not available - crop was planted too long ago
                                </p>
                              )}
                            </div>
                          </label>
                          
                          <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${
                            newCrop.is_late_registered ? 'border-orange-300 bg-orange-50 hover:bg-orange-100' : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                            <input
                              type="radio"
                              name="is_late_registered"
                              checked={newCrop.is_late_registered}
                              onChange={() => setNewCrop(prev => ({ 
                                ...prev, 
                                is_late_registered: true,
                                growth_stage: prev.sowing_date ? estimateGrowthStage(prev.sowing_date, prev.crop_name) : 'germination'
                              }))}
                              className="form-radio text-primary-600"
                            />
                            <div className="ml-3">
                              <span className="text-sm text-gray-700 font-medium">Existing crop (planted earlier)</span>
                              <p className="text-xs text-gray-500">Crop was planted more than 7 days ago</p>
                              {isLateByDate && (
                                <p className="text-xs text-green-600 mt-1">
                                  ✓ Recommended for this sowing date
                                </p>
                              )}
                            </div>
                          </label>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Growth Stage Selection */}
                {newCrop.is_late_registered && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <label htmlFor="growth_stage" className="block text-sm font-medium text-blue-700 mb-2">
                      Current Growth Stage*
                      {newCrop.sowing_date && (
                        <span className="ml-2 text-xs text-blue-600 font-normal">
                          (Estimated: {estimateGrowthStage(newCrop.sowing_date, newCrop.crop_name)})
                        </span>
                      )}
                    </label>
                    <select
                      id="growth_stage"
                      name="growth_stage"
                      value={newCrop.growth_stage}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-blue-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="germination">Germination (0-10%)</option>
                      <option value="seedling">Seedling (10-25%)</option>
                      <option value="vegetative">Vegetative (25-45%)</option>
                      <option value="tillering">Tillering (45-65%)</option>
                      <option value="flowering">Flowering (65-85%)</option>
                      <option value="grain_filling">Grain Filling (85-100%)</option>
                      <option value="maturity">Maturity (100%)</option>
                    </select>
                    <p className="mt-2 text-xs text-blue-600">Select the current growth stage of your crop</p>
                  </div>
                )}
                
                {/* Location Override Section */}
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-yellow-700">
                      Location Override
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCrop.location_override.enabled}
                        onChange={(e) => setNewCrop(prev => ({
                          ...prev,
                          location_override: {
                            ...prev.location_override,
                            enabled: e.target.checked,
                            state: '',
                            district: '',
                            lat: '',
                            lon: ''
                          }
                        }))}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer transition-colors ${
                        newCrop.location_override.enabled ? 'bg-yellow-500' : 'bg-gray-200'
                      }`}>
                        <div className={`absolute top-[2px] left-[2px] bg-white border border-gray-300 rounded-full h-5 w-5 transition-transform ${
                          newCrop.location_override.enabled ? 'transform translate-x-full' : ''
                        }`}></div>
                      </div>
                    </label>
                  </div>
                  <p className="text-xs text-yellow-600 mb-3">
                    Enable to specify a different location for this crop instead of using your current location
                  </p>
                  
                  {newCrop.location_override.enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="override_state" className="block text-sm font-medium text-yellow-700 mb-2">
                            State*
                          </label>
                          <select
                            id="override_state"
                            value={newCrop.location_override.state}
                            onChange={(e) => setNewCrop(prev => ({
                              ...prev,
                              location_override: {
                                ...prev.location_override,
                                state: e.target.value,
                                district: '' // Reset district when state changes
                              }
                            }))}
                            required
                            className="w-full px-4 py-3 border border-yellow-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                          >
                            <option value="">Select State</option>
                            <option value="andhra_pradesh">Andhra Pradesh</option>
                            <option value="arunachal_pradesh">Arunachal Pradesh</option>
                            <option value="assam">Assam</option>
                            <option value="bihar">Bihar</option>
                            <option value="chhattisgarh">Chhattisgarh</option>
                            <option value="goa">Goa</option>
                            <option value="gujarat">Gujarat</option>
                            <option value="haryana">Haryana</option>
                            <option value="himachal_pradesh">Himachal Pradesh</option>
                            <option value="jharkhand">Jharkhand</option>
                            <option value="karnataka">Karnataka</option>
                            <option value="kerala">Kerala</option>
                            <option value="madhya_pradesh">Madhya Pradesh</option>
                            <option value="maharashtra">Maharashtra</option>
                            <option value="manipur">Manipur</option>
                            <option value="meghalaya">Meghalaya</option>
                            <option value="mizoram">Mizoram</option>
                            <option value="nagaland">Nagaland</option>
                            <option value="odisha">Odisha</option>
                            <option value="punjab">Punjab</option>
                            <option value="rajasthan">Rajasthan</option>
                            <option value="sikkim">Sikkim</option>
                            <option value="tamil_nadu">Tamil Nadu</option>
                            <option value="telangana">Telangana</option>
                            <option value="tripura">Tripura</option>
                            <option value="uttar_pradesh">Uttar Pradesh</option>
                            <option value="uttarakhand">Uttarakhand</option>
                            <option value="west_bengal">West Bengal</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="override_district" className="block text-sm font-medium text-yellow-700 mb-2">
                            District*
                          </label>
                          <input
                            type="text"
                            id="override_district"
                            value={newCrop.location_override.district}
                            onChange={(e) => setNewCrop(prev => ({
                              ...prev,
                              location_override: {
                                ...prev.location_override,
                                district: e.target.value
                              }
                            }))}
                            placeholder="Enter district name"
                            required
                            className="w-full px-4 py-3 border border-yellow-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="override_lat" className="block text-sm font-medium text-yellow-700 mb-2">
                            Latitude (Optional)
                          </label>
                          <input
                            type="number"
                            id="override_lat"
                            value={newCrop.location_override.lat}
                            onChange={(e) => setNewCrop(prev => ({
                              ...prev,
                              location_override: {
                                ...prev.location_override,
                                lat: e.target.value
                              }
                            }))}
                            placeholder="e.g., 28.6139"
                            step="any"
                            min="-90"
                            max="90"
                            className="w-full px-4 py-3 border border-yellow-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="override_lon" className="block text-sm font-medium text-yellow-700 mb-2">
                            Longitude (Optional)
                          </label>
                          <input
                            type="number"
                            id="override_lon"
                            value={newCrop.location_override.lon}
                            onChange={(e) => setNewCrop(prev => ({
                              ...prev,
                              location_override: {
                                ...prev.location_override,
                                lon: e.target.value
                              }
                            }))}
                            placeholder="e.g., 77.2090"
                            step="any"
                            min="-180"
                            max="180"
                            className="w-full px-4 py-3 border border-yellow-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                      </div>
                      
                      <p className="text-xs text-yellow-600">
                        💡 Tip: GPS coordinates help provide more accurate weather and soil data for your specific location
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-6 py-3 border border-secondary-300 rounded-xl text-secondary-700 hover:bg-secondary-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !validateRegistrationType().isValid}
                    className={`px-6 py-3 text-white rounded-xl transition-colors flex items-center space-x-2 ${
                      submitting || !validateRegistrationType().isValid
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                  >
                    {submitting && (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    )}
                    <span>{submitting ? 'Adding...' : 'Add Crop'}</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Crop Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-primary-300 backdrop-blur-sm rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-primary-200/50"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-primary">Edit Crop</h3>
                <button 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingCrop(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleUpdateCrop} className="space-y-4">
                {/* Same form fields as add modal but for editing */}
                <div>
                  <label htmlFor="edit_crop_name" className="block text-sm font-medium text-primary mb-2">
                    Crop Name*
                  </label>
                  <select
                    id="edit_crop_name"
                    name="crop_name"
                    value={newCrop.crop_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-primary-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select a crop</option>
                    {/* Include all crop options - shortened for brevity */}
                    <optgroup label="Cereals">
                      <option value="rice">Rice</option>
                      <option value="wheat">Wheat</option>
                      <option value="maize">Maize (Corn)</option>
                      <option value="barley">Barley</option>
                      <option value="sorghum">Sorghum (Jowar)</option>
                      <option value="pearl_millet">Pearl Millet (Bajra)</option>
                      <option value="finger_millet">Finger Millet (Ragi)</option>
                    </optgroup>
                    <optgroup label="Pulses">
                      <option value="chickpea">Chickpea (Chana)</option>
                      <option value="black_gram">Black Gram (Urad)</option>
                      <option value="green_gram">Green Gram (Moong)</option>
                      <option value="pigeon_pea">Pigeon Pea (Tur/Arhar)</option>
                      <option value="lentil">Lentil (Masur)</option>
                      <option value="field_pea">Field Pea</option>
                    </optgroup>
                    <optgroup label="Cash Crops">
                      <option value="cotton">Cotton</option>
                      <option value="sugarcane">Sugarcane</option>
                      <option value="tobacco">Tobacco</option>
                      <option value="jute">Jute</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit_variety" className="block text-sm font-medium text-primary mb-2">
                    Variety
                  </label>
                  <input
                    type="text"
                    id="edit_variety"
                    name="variety"
                    value={newCrop.variety}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-primary-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., Basmati, Hybrid"
                  />
                </div>

                <div>
                  <label htmlFor="edit_area_acres" className="block text-sm font-medium text-primary mb-2">
                    Area (acres)*
                  </label>
                  <input
                    type="number"
                    id="edit_area_acres"
                    name="area_acres"
                    value={newCrop.area_acres}
                    onChange={handleInputChange}
                    required
                    min="0.1"
                    step="0.1"
                    className="w-full px-4 py-3 border border-primary-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., 2.5"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingCrop(null);
                    }}
                    className="px-6 py-3 border border-secondary-300 rounded-xl text-secondary-700 hover:bg-secondary-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-6 py-3 text-white rounded-xl transition-colors flex items-center space-x-2 ${
                      submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                  >
                    {submitting && (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    )}
                    <span>{submitting ? 'Updating...' : 'Update Crop'}</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-red-200"
          >
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <FaTrash className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Crop</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete this crop? All associated data will be permanently removed.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCrop(deleteConfirmId)}
                  disabled={submitting}
                  className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center space-x-2 ${
                    submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  )}
                  <span>{submitting ? 'Deleting...' : 'Delete'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MyFarm;
