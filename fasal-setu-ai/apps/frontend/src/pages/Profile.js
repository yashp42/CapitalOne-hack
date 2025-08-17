import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, cropAPI } from '../services/api';
import { 
  FaUser, 
  FaEdit, 
  FaPhone, 
  FaMapMarkerAlt, 
  FaSeedling, 
  FaCalendarAlt, 
  FaSave, 
  FaTimes,
  FaUserCircle,
  FaEnvelope,
  FaBuilding,
  FaHome,
  FaTractor,
  FaChartLine
} from 'react-icons/fa';

const Profile = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [cropStats, setCropStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  // Load profile data
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Load both profile data and crop statistics in parallel
        const [profileResponse, cropStatsResponse] = await Promise.allSettled([
          authAPI.getProfile(),
          cropAPI.getCropStats()
        ]);
        
        // Handle profile data
        if (profileResponse.status === 'fulfilled' && profileResponse.value.success) {
          const profileData = profileResponse.value.data;
          console.log('Profile data received:', profileData);
          
          // If some fields are missing, try the /users/me endpoint
          if (!profileData.location?.state || !profileData.location?.district || !profileData.created_at) {
            try {
              const meResponse = await authAPI.me();
              if (meResponse.success) {
                console.log('Me response data:', meResponse.data);
                // Merge data from both endpoints, preferring more complete data
                const mergedData = {
                  ...profileData,
                  ...meResponse.data,
                  // Map nested location fields to top level for easier access
                  state: profileData.location?.state || meResponse.data.location?.state,
                  district: profileData.location?.district || meResponse.data.location?.district,
                  createdAt: profileData.created_at || meResponse.data.created_at,
                };
                console.log('Merged profile data:', mergedData);
                setProfile(mergedData);
                setEditForm(mergedData);
              } else {
                // Map the profile data with nested location fields
                const mappedData = {
                  ...profileData,
                  state: profileData.location?.state,
                  district: profileData.location?.district,
                  createdAt: profileData.created_at,
                };
                console.log('Mapped profile data (me failed):', mappedData);
                setProfile(mappedData);
                setEditForm(mappedData);
              }
            } catch (meError) {
              console.log('Me endpoint not available, using profile data only');
              // Map the profile data with nested location fields
              const mappedData = {
                ...profileData,
                state: profileData.location?.state,
                district: profileData.location?.district,
                createdAt: profileData.created_at,
              };
              console.log('Mapped profile data (me error):', mappedData);
              setProfile(mappedData);
              setEditForm(mappedData);
            }
          } else {
            // Map the profile data with nested location fields
            const mappedData = {
              ...profileData,
              state: profileData.location?.state,
              district: profileData.location?.district,
              createdAt: profileData.created_at,
            };
            console.log('Mapped profile data (direct):', mappedData);
            setProfile(mappedData);
            setEditForm(mappedData);
          }
        } else {
          setError('Failed to load profile data');
        }
        
        // Handle crop statistics - map backend field names to frontend expectations
        if (cropStatsResponse.status === 'fulfilled' && cropStatsResponse.value.success) {
          const statsData = cropStatsResponse.value.data.overview;
          console.log('Crop stats received:', cropStatsResponse.value.data);
          const mappedStats = {
            totalCrops: statsData?.total_crops || 0,
            activeCrops: statsData?.active_crops || 0,
            completedCrops: statsData?.completed_crops || 0,
            averageGrowth: statsData?.avg_growth || 0,
            totalArea: statsData?.total_area || 0,
          };
          console.log('Mapped crop stats:', mappedStats);
          setCropStats(mappedStats);
        } else {
          console.log('Crop stats failed:', cropStatsResponse);
          // Set default stats if endpoint fails
          setCropStats({
            totalCrops: 0,
            activeCrops: 0,
            completedCrops: 0,
            averageGrowth: 0,
            totalArea: 0,
          });
        }
        
        setStatsLoading(false);
        
      } catch (error) {
        console.error('Profile load error:', error);
        setError('Failed to load profile data');
        setStatsLoading(false);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      loadProfileData();
    }
  }, [isAuthenticated]);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setError('');
    setSuccess('');
    if (!isEditing) {
      setEditForm({ ...profile });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setUpdating(true);
      setError('');
      setSuccess('');

      // Prepare data in the format expected by backend
      const updateData = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        location: {
          state: editForm.state,
          district: editForm.district,
          lat: profile.location?.lat,
          lon: profile.location?.lon,
        }
      };

      // Only include email if it's available and changed
      if (editForm.email !== undefined) {
        updateData.email = editForm.email;
      }

      const response = await authAPI.updateProfile(updateData);
      
      if (response.success) {
        // Map the response back to frontend format
        const updatedProfile = {
          ...response.data,
          state: response.data.location?.state,
          district: response.data.location?.district,
          createdAt: response.data.created_at,
        };
        setProfile(updatedProfile);
        setIsEditing(false);
        setSuccess('Profile updated successfully!');
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setError('Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-200/60 via-white to-secondary-700/30 pt-24 pb-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="text-center">
              <div className="h-10 bg-gray-200 rounded-lg w-64 mx-auto mb-2 animate-pulse"></div>
              <div className="h-5 bg-gray-200 rounded w-96 mx-auto animate-pulse"></div>
            </div>

            {/* Profile Dashboard Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Overview Card Skeleton - Second on mobile, first on desktop */}
              <div className="lg:col-span-2 order-2 lg:order-1 bg-primary/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded-xl w-32 animate-pulse"></div>
                </div>

                {/* Profile Info Grid Skeleton */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Profile Info Items */}
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div key={item} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                        <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
                          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Additional item for member since */}
                    <div className="md:col-span-2 flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                        <div className="h-5 bg-gray-200 rounded w-40 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Stats Sidebar Skeleton - First on mobile, second on desktop */}
              <div className="order-1 lg:order-2 space-y-6">
                {/* Profile Picture Card Skeleton */}
                <div className="bg-primary/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6 text-center">
                  <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 animate-pulse"></div>
                  <div className="h-6 bg-gray-200 rounded w-32 mx-auto mb-2 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-16 mx-auto animate-pulse"></div>
                </div>

                {/* Quick Stats Skeleton */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6">
                  <div className="h-6 bg-gray-200 rounded w-28 mb-4 animate-pulse"></div>
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((stat) => (
                      <div key={stat} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                        </div>
                        <div className="h-5 bg-gray-200 rounded w-8 animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions Skeleton */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6">
                  <div className="h-6 bg-gray-200 rounded w-28 mb-4 animate-pulse"></div>
                  <div className="space-y-3">
                    <div className="w-full h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                    <div className="w-full h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50 pt-24 pb-8">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Profile Not Found</h2>
            <p className="text-gray-600 mb-6">Unable to load your profile information.</p>
            <button
              onClick={() => navigate('/my-farm')}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to My Farm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-200/60 via-white to-secondary-700/30 pt-24 pb-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              My Profile
            </h1>
            <p className="text-gray-600">
              Manage your account information and farming details
            </p>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl">
              {success}
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Profile Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Overview Card - Second on mobile, first on desktop */}
            <div className="lg:col-span-2 order-2 lg:order-1 bg-primary/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Profile Information</h2>
                <button
                  onClick={handleEditToggle}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                    isEditing 
                      ? 'bg-gray-500 hover:bg-gray-600 text-white' 
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  {isEditing ? <FaTimes /> : <FaEdit />}
                  <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
                </button>
              </div>

              {isEditing ? (
                // Edit Form
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={editForm.firstName || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={editForm.lastName || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        name="state"
                        value={editForm.state || ''}
                        onChange={handleInputChange}
                        placeholder="Enter your state"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        District
                      </label>
                      <input
                        type="text"
                        name="district"
                        value={editForm.district || ''}
                        onChange={handleInputChange}
                        placeholder="Enter your district"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Additional fields if available */}
                  {(editForm.email !== undefined || editForm.phoneNumber) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {editForm.email !== undefined && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email (if available)
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={editForm.email || ''}
                            onChange={handleInputChange}
                            placeholder="Enter your email"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {editForm.phoneNumber && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            name="phoneNumber"
                            value={editForm.phoneNumber || ''}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl cursor-not-allowed"
                            disabled
                            title="Phone number cannot be changed"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleEditToggle}
                      className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-medium transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={updating}
                      className="flex items-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
                    >
                      <FaSave />
                      <span>{updating ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                // Display Profile Info
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <FaUser className="text-primary-600 text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Full Name</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {profile.firstName} {profile.lastName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <FaPhone className="text-blue-600 text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Phone Number</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {profile.phoneNumber}
                        </p>
                      </div>
                    </div>

                    {profile.email && (
                      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                          <FaEnvelope className="text-indigo-600 text-xl" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Email</p>
                          <p className="text-lg font-semibold text-gray-800">
                            {profile.email}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <FaMapMarkerAlt className="text-green-600 text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">State</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {profile.state || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                        <FaBuilding className="text-yellow-600 text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">District</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {profile.district || 'Not specified'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <FaCalendarAlt className="text-purple-600 text-xl" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Member Since</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {profile.createdAt || profile.created_at ? 
                          new Date(profile.createdAt || profile.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 
                          'Recently joined'
                        }
                      </p>
                    </div>
                  </div>

                  {profile.location && profile.location.coordinates && (
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <FaMapMarkerAlt className="text-green-600 text-xl" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Farm Location</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {profile.location.coordinates[1].toFixed(4)}, {profile.location.coordinates[0].toFixed(4)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Stats Sidebar - First on mobile, second on desktop */}
            <div className="order-1 lg:order-2 space-y-6">
              {/* Profile Picture Card */}
              <div className="bg-primary/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6 text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaUserCircle className="text-white text-4xl" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {profile.firstName} {profile.lastName}
                </h3>
                <p className="text-gray-600 text-sm">Farmer</p>
              </div>

              {/* Quick Stats */}
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Farming Stats</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FaSeedling className="text-green-600" />
                      <span className="text-sm text-gray-600">Total Crops</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {statsLoading ? (
                        <div className="w-8 h-5 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        cropStats ? cropStats.totalCrops || 0 : 0
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FaTractor className="text-blue-600" />
                      <span className="text-sm text-gray-600">Active Crops</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {statsLoading ? (
                        <div className="w-8 h-5 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        cropStats ? cropStats.activeCrops || 0 : 0
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FaChartLine className="text-purple-600" />
                      <span className="text-sm text-gray-600">Avg Growth</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {statsLoading ? (
                        <div className="w-8 h-4 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        cropStats && cropStats.averageGrowth !== undefined ? 
                          `${Math.round(cropStats.averageGrowth)}%` : '0%'
                      )}
                    </span>
                  </div>

                  {cropStats && cropStats.totalArea !== undefined && cropStats.totalArea > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FaHome className="text-green-600" />
                        <span className="text-sm text-gray-600">Total Area</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {cropStats.totalArea.toFixed(1)} acres
                      </span>
                    </div>
                  )}

                  {!statsLoading && cropStats && cropStats.completedCrops !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FaCalendarAlt className="text-orange-600" />
                        <span className="text-sm text-gray-600">Completed</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {cropStats.completedCrops}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/my-farm')}
                    className="w-full flex items-center space-x-3 px-4 py-3 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl transition-all duration-200"
                  >
                    <FaTractor />
                    <span>Go to My Farm</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/chatbot')}
                    className="w-full flex items-center space-x-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-all duration-200"
                  >
                    <FaUser />
                    <span>Ask AI Assistant</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
