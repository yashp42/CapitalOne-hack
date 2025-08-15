const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

// Cookie utility functions
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const debugCookies = () => {
  console.log('All cookies:', document.cookie);
  console.log('Access token cookie:', getCookie('accessToken'));
  console.log('Refresh token cookie:', getCookie('refreshToken'));
};

// Token management - primarily relies on httpOnly cookies from backend
const tokenManager = {
  // Check if user has access token cookie (for authentication status)
  hasAccessToken: () => {
    const hasToken = !!getCookie('accessToken');
    console.log('Checking access token:', hasToken);
    debugCookies();
    return hasToken;
  },
  
  // For fallback - store tokens in memory only (not localStorage for security)
  _memoryTokens: {
    accessToken: null,
    refreshToken: null
  },
  
  setMemoryTokens: (accessToken, refreshToken) => {
    tokenManager._memoryTokens.accessToken = accessToken;
    tokenManager._memoryTokens.refreshToken = refreshToken;
  },
  
  getMemoryAccessToken: () => tokenManager._memoryTokens.accessToken,
  
  clearTokens: () => {
    console.log('Clearing tokens...');
    
    // Clear memory tokens
    tokenManager._memoryTokens.accessToken = null;
    tokenManager._memoryTokens.refreshToken = null;
    console.log('Memory tokens cleared');
    
    // Clear cookies with multiple possible configurations
    const cookieConfigs = [
      // Default
      'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/',
      'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/',
      // With SameSite
      'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict',
      'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict',
      // With domain
      'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost',
      'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost',
    ];
    
    cookieConfigs.forEach(config => {
      document.cookie = config;
    });
    
    console.log('Cookies cleared with multiple configurations');
    
    // Debug: check if cookies are actually cleared
    setTimeout(() => {
      debugCookies();
    }, 100);
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
      credentials: 'include', // Always include cookies for httpOnly tokens
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
          
          // Store memory tokens for immediate use if needed
          if (refreshData.data.accessToken && refreshData.data.refreshToken) {
            tokenManager.setMemoryTokens(refreshData.data.accessToken, refreshData.data.refreshToken);
          }
          
          // Retry original request (new cookies should be set automatically)
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
    
    // Store memory tokens if provided (cookies are set automatically by backend)
    if (response.success && response.data.accessToken) {
      tokenManager.setMemoryTokens(response.data.accessToken, response.data.refreshToken);
    }
    
    return response;
  },

  // Login user
  login: async (firebaseUid) => {
    const response = await apiRequest('/users/login', {
      method: 'POST',
      body: JSON.stringify({ firebaseUid }),
    });
    
    // Store memory tokens if provided (cookies are set automatically by backend)
    if (response.success && response.data.accessToken) {
      tokenManager.setMemoryTokens(response.data.accessToken, response.data.refreshToken);
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
  getProfile: async (userId) => {
    return apiRequest(`/users/profile/${userId}`);
  },

  // Update user profile
  updateProfile: async (userId, userData) => {
    return apiRequest(`/users/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
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
  }
};

export { tokenManager, debugCookies };
export default apiRequest;
