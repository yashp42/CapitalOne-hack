import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/config';
import { 
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';
import { authAPI, tokenManager } from '../services/api';


const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [user, setUser] = useState(null); // JWT authenticated user
  const [authKey, setAuthKey] = useState(0); // Force re-render key

const setupRecaptcha = () => {
  // Simple cleanup of existing verifier
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      // Ignore cleanup errors
    }
    window.recaptchaVerifier = null;
  }

  // Create new verifier - let Firebase handle everything
  window.recaptchaVerifier = new RecaptchaVerifier(
    auth,
    'recaptcha-container',
    {
      size: 'normal',
      theme: 'light'
    }
  );
};


  // Check if user is authenticated on app load
  const checkAuthStatus = async () => {
    try {
      console.log('Checking auth status...');
      
      // Check if we have a valid access token
      if (authAPI.isAuthenticated()) {
        console.log('Found access token, fetching user data...');
        try {
          const userData = await authAPI.getCurrentUser();
          if (userData && userData.data) {
            console.log('User data retrieved:', userData.data);
            setUser(userData.data);
            return;
          }
        } catch (error) {
          console.log('Token might be expired, trying to refresh...');
          
          // Try to refresh token
          try {
            const refreshResult = await authAPI.refreshToken();
            if (refreshResult && refreshResult.success) {
              console.log('Token refresh successful, retrying user fetch...');
              // Retry getting user data with new token
              const userData = await authAPI.getCurrentUser();
              if (userData && userData.data) {
                setUser(userData.data);
                return;
              }
            }
          } catch (refreshError) {
            console.log('Token refresh failed:', refreshError);
          }
        }
      }
      
      console.log('No valid authentication found');
      tokenManager.clearTokens();
      setUser(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      tokenManager.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Send OTP
  const sendOTP = async (phoneNumber) => {
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, message: error.message || 'Failed to send OTP' };
    }
  };


  // Verify OTP
  const verifyOTP = async (otp) => {
    try {
      if (!confirmationResult) {
        throw new Error('No confirmation result available. Please request OTP again.');
      }
      const result = await confirmationResult.confirm(otp);
      setVerifiedUser(result.user); // Store verified user immediately
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, message: error.message };
    }
  };

  // Login with backend
  const loginUser = async (firebaseUid) => {
    try {
      const response = await authAPI.login(firebaseUid);
      if (response.success) {
        setUser(response.data.user);
        return { success: true, user: response.data.user };
      }
      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Signup with backend
  const signupUser = async (userData) => {
    try {
      const response = await authAPI.signup(userData);
      if (response.success) {
        setUser(response.data.user);
        return { success: true, user: response.data.user };
      }
      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      console.log('Starting logout process...');
      
      // Call backend logout API
      await authAPI.logout();
      console.log('Backend logout successful');
      
      // Sign out from Firebase
      await signOut(auth);
      console.log('Firebase signout successful');
      
      // Clear all local state immediately
      setCurrentUser(null);
      setVerifiedUser(null);
      setUser(null);
      setConfirmationResult(null);
      setAuthKey(prev => prev + 1); // Force component re-renders
      console.log('Local state cleared');
      
      // Clear recaptcha
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (error) {
          console.warn('Error clearing reCAPTCHA on logout:', error);
        }
        window.recaptchaVerifier = null;
      }
      
      // Clear container
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
      
      console.log('Logout completed successfully');
      return { success: true };
      
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Even if API call fails, clear local state
      setCurrentUser(null);
      setVerifiedUser(null);
      setUser(null);
      setConfirmationResult(null);
      setAuthKey(prev => prev + 1); // Force component re-renders
      
      // Force clear tokens
      tokenManager.clearTokens();
      console.log('Forced local state clear due to logout error');
      
      return { success: false, message: error.message };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setCurrentUser(firebaseUser);
    });

    // Check JWT auth status on mount
    checkAuthStatus();

    return () => {
      unsubscribe();
      // Cleanup recaptcha on unmount
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (error) {
          console.warn('Error clearing reCAPTCHA on unmount:', error);
        }
        window.recaptchaVerifier = null;
      }
      // Clear container
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  const value = {
    // Firebase auth
    currentUser: currentUser || verifiedUser,
    sendOTP,
    verifyOTP,
    confirmationResult,
    
    // JWT auth
    user, // JWT authenticated user
    loginUser,
    signupUser,
    logout,
    isAuthenticated: !!user, // Simple check based on user state
    loading,
    authKey // For force re-renders
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
