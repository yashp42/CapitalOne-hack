const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081/api';

// Enhanced token management using both localStorage and cookies as fallback
const tokenManager = {
  // Helper function to get cookie value
  getCookie: (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  },

  // Helper function to set cookie
  setCookie: (name, value, options = {}) => {
    const defaults = {
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      secure: window.location.protocol === 'https:',
      sameSite: 'none'
    };
    
    const opts = { ...defaults, ...options };
    let cookieString = `${name}=${value}`;
    
    Object.keys(opts).forEach(key => {
      if (opts[key] !== null && opts[key] !== undefined) {
        if (typeof opts[key] === 'boolean') {
          if (opts[key]) cookieString += `; ${key}`;
        } else {
          cookieString += `; ${key}=${opts[key]}`;
        }
      }
    });
    
    document.cookie = cookieString;
  },
  
  // Get access token (try localStorage first, then cookies)
  getAccessToken: () => {
    return localStorage.getItem('accessToken') || tokenManager.getCookie('accessToken');
  },
  
  // Get refresh token (try localStorage first, then cookies)
  getRefreshToken: () => {
    return localStorage.getItem('refreshToken') || tokenManager.getCookie('refreshToken');
  },
  
  // Set tokens (save to both localStorage and cookies for redundancy)
  setTokens: (accessToken, refreshToken) => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      tokenManager.setCookie('accessToken', accessToken);
      console.log('Access token saved to localStorage and cookies');
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
      tokenManager.setCookie('refreshToken', refreshToken);
      console.log('Refresh token saved to localStorage and cookies');
    }
  },
  
  // Check if user has access token
  hasAccessToken: () => {
    const token = tokenManager.getAccessToken();
    console.log('Checking access token:', !!token);
    return !!token;
  },
  
  // Check if user is authenticated (and token is not expired)
  isAuthenticated: () => {
    const token = tokenManager.getAccessToken();
    if (!token) return false;
    
    try {
      // Check if token is expired
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isValid = payload.exp > Date.now() / 1000;
      console.log('Token expiry check:', isValid ? 'valid' : 'expired');
      return isValid;
    } catch (error) {
      console.log('Token validation failed:', error);
      return false;
    }
  },
  
  // Clear all tokens (both localStorage and cookies)
  clearTokens: () => {
    console.log('Clearing tokens...');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Clear cookies by setting them with past expiry
    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; secure; samesite=none';
    document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; secure; samesite=none';
    
    console.log('Tokens cleared from localStorage and cookies');
  }
};

// API utility function with automatic token refresh and timeout handling
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const makeRequest = async () => {
    const token = tokenManager.getAccessToken();
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }), // Add Bearer token header
        ...options.headers,
      },
      credentials: 'include', // Include cookies for server-side handling
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000), // 30 second timeout
      ...options,
    };

    const response = await fetch(url, config);
    return response;
  };

  try {
    // Make request (both Authorization header and cookies are sent)
    let response = await makeRequest();
    
    // If unauthorized and we have tokens, try to refresh
    if (response.status === 401 && (tokenManager.hasAccessToken() || tokenManager.getRefreshToken())) {
      console.log('Received 401, attempting token refresh...');
      
      try {
        const refreshToken = tokenManager.getRefreshToken();
        const refreshResponse = await fetch(`${API_BASE_URL}/users/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }), // Send in body as fallback
          credentials: 'include', // Include refresh token cookie
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          
          // Update tokens with new ones
          if (refreshData.data && refreshData.data.accessToken) {
            tokenManager.setTokens(refreshData.data.accessToken, refreshData.data.refreshToken);
            console.log('Token refresh successful, retrying original request...');
            
            // Retry original request with new token
            response = await makeRequest();
          }
        } else {
          console.log('Token refresh failed, clearing tokens...');
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
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection and try again');
    }
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

  // Get current user basic info
  me: async () => {
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
  },

  // Get harvest estimation
  getHarvestEstimate: async (cropId) => {
    return apiRequest(`/crops/${cropId}/harvest-estimate`);
  }
};

export { tokenManager };
export default apiRequest;
