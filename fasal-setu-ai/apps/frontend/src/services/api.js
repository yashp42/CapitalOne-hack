const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081/api';

// Simple token management using localStorage
const tokenManager = {
  // Get access token
  getAccessToken: () => {
    return localStorage.getItem('accessToken');
  },
  
  // Get refresh token
  getRefreshToken: () => {
    return localStorage.getItem('refreshToken');
  },
  
  // Set tokens
  setTokens: (accessToken, refreshToken) => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      console.log('Access token saved to localStorage');
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
      console.log('Refresh token saved to localStorage');
    }
  },
  
  // Check if user has access token
  hasAccessToken: () => {
    const token = tokenManager.getAccessToken();
    console.log('Checking access token:', !!token);
    return !!token;
  },
  
  // Check if user is authenticated
  isAuthenticated: () => {
    return tokenManager.hasAccessToken();
  },
  
  // Clear all tokens
  clearTokens: () => {
    console.log('Clearing tokens...');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    console.log('Tokens cleared from localStorage');
  }
};

// API utility function with automatic token refresh
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const makeRequest = async () => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for server-side handling
      ...options,
    };

    const response = await fetch(url, config);
    return response;
  };

  try {
    // Make request (cookies are automatically included)
    let response = await makeRequest();
    
    // If unauthorized and we have tokens, try to refresh
    if (response.status === 401 && tokenManager.hasAccessToken()) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/users/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include refresh token cookie
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          
          // Update cookies with new tokens
          if (refreshData.data && refreshData.data.accessToken) {
            tokenManager.setTokens(refreshData.data.accessToken, refreshData.data.refreshToken);
          }
          
          // Retry original request
          response = await makeRequest();
        } else {
          // Refresh failed, clear tokens and redirect to login
          tokenManager.clearTokens();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return;
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        tokenManager.clearTokens();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return;
      }
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }
    
    return data;
  } catch (error) {
    throw new Error(error.message || 'Network error');
  }
};

// Auth API calls
export const authAPI = {
  // Send OTP (for backend logging, actual OTP is sent via Firebase)
  sendOTP: async (phoneNumber) => {
    return apiRequest('/users/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  },

  // Signup user
  signup: async (userData) => {
    const response = await apiRequest('/users/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    // Store tokens from response and cookies
    if (response.success && response.data) {
      if (response.data.accessToken) {
        tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
      }
    }
    
    return response;
  },

  // Login user
  login: async (firebaseUid) => {
    const response = await apiRequest('/users/login', {
      method: 'POST',
      body: JSON.stringify({ firebaseUid }),
    });
    
    // Store tokens from response and cookies
    if (response.success && response.data) {
      if (response.data.accessToken) {
        tokenManager.setTokens(response.data.accessToken, response.data.refreshToken);
      }
    }
    
    return response;
  },

  // Logout user
  logout: async () => {
    try {
      await apiRequest('/users/logout', {
        method: 'POST',
      });
    } finally {
      // Always clear tokens, even if API call fails
      tokenManager.clearTokens();
    }
  },

  // Get current user (for protected routes)
  getCurrentUser: async () => {
    return apiRequest('/users/me');
  },

  // Get user profile
  getProfile: async () => {
    return apiRequest('/users/profile');
  },

  // Update user profile
  updateProfile: async (userData) => {
    return apiRequest('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  // Complete profile setup
  completeProfile: async (profileData) => {
    return apiRequest('/users/complete-profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  },

  // Check if user is authenticated (check for access token cookie)
  isAuthenticated: () => {
    return tokenManager.hasAccessToken();
  },

  // Refresh tokens
  refreshToken: async () => {
    return apiRequest('/users/refresh-token', {
      method: 'POST',
    });
  },

  // Get coordinates for location
  getCoordinates: async (state, district) => {
    return apiRequest('/users/get-coordinates', {
      method: 'POST',
      body: JSON.stringify({ state, district }),
    });
  }
};

// Crop API calls
export const cropAPI = {
  // Create a new crop
  createCrop: async (cropData) => {
    return apiRequest('/crops', {
      method: 'POST',
      body: JSON.stringify(cropData),
    });
  },

  // Get user's crops
  getCrops: async (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = queryParams ? `/crops?${queryParams}` : '/crops';
    return apiRequest(endpoint);
  },

  // Get crop statistics
  getCropStats: async () => {
    return apiRequest('/crops/stats');
  },

  // Get specific crop
  getCrop: async (cropId) => {
    return apiRequest(`/crops/${cropId}`);
  },

  // Update crop
  updateCrop: async (cropId, cropData) => {
    return apiRequest(`/crops/${cropId}`, {
      method: 'PUT',
      body: JSON.stringify(cropData),
    });
  },

  // Update crop growth
  updateCropGrowth: async (cropId, growthPercent) => {
    return apiRequest(`/crops/${cropId}/growth`, {
      method: 'PATCH',
      body: JSON.stringify({ growth_percent: growthPercent }),
    });
  },

  // Mark crop as irrigated
  irrigateCrop: async (cropId) => {
    return apiRequest(`/crops/${cropId}/irrigate`, {
      method: 'PATCH',
    });
  },

  // Complete crop (harvest)
  completeCrop: async (cropId) => {
    return apiRequest(`/crops/${cropId}/complete`, {
      method: 'PATCH',
    });
  },

  // Abandon crop
  abandonCrop: async (cropId) => {
    return apiRequest(`/crops/${cropId}/abandon`, {
      method: 'PATCH',
    });
  },

  // Delete crop
  deleteCrop: async (cropId) => {
    return apiRequest(`/crops/${cropId}`, {
      method: 'DELETE',
    });
  }
};

export { tokenManager };
export default apiRequest;
