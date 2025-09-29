import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FaShieldAlt, FaCheck, FaSpinner } from 'react-icons/fa';
import FloatingChatButton from '../components/FloatingChatButton';

// Kerala districts and villages data (Kerala farmers only)
const KERALA_DISTRICTS_VILLAGES = {
  'Thiruvananthapuram': [
    'Amboori', 'Anavoor', 'Athiyannoor', 'Chenkal', 'Kallikkad', 
    'Kanjiramkulam', 'Karode', 'Karumkulam', 'Poovar', 'Vizhinjam'
  ],
  'Kollam': [
    'Sakthikulangara', 'Thrikkadavoor', 'Thrikkaruva', 'East Kallada', 'Perinad',
    'Mayyanad', 'Alappad', 'Oachira', 'Adinad', 'Neendakara'
  ],
  'Kottayam': [
    'Kumarakom', 'Ettumanoor', 'Athirampuzha', 'Aymanam', 'Arpookara East',
    'Kaipuzha', 'Anickad', 'Akalakunnam', 'Chengalam South', 'Ayarkunnam'
  ],
  'Alappuzha': [
    'Ambalappuzha', 'Kalavoor', 'Karumadi', 'Purakkad', 'Kadakkarappally',
    'Mararikulam North', 'Panavally', 'Pattanakkad', 'Perumbalam', 'Champakulam'
  ],
  'Pathanamthitta': [
    'Ranni', 'Adoor', 'Chittar', 'Seethathodu', 'Kodumon'
  ],
  'Idukki': [
    'Kannan Devan Hills', 'Marayoor', 'Kanthalloor', 'Keezhanthoor', 'Kunchithanny',
    'Mankulam', 'Mannamkandam', 'Pallivasal', 'Anaviratty', 'Elappara'
  ],
  'Ernakulam': [
    'Kizhakkambalam', 'Kalady', 'Ayyampuzha', 'Kadamakkudy', 'Cheranalloor', 'Manjapra'
  ],
  'Thrissur': [
    'Thriprayar', 'Varandarappilly', 'Vellikulangara', 'Annallur', 'Kodakara'
  ],
  'Palakkad': [
    'Agali', 'Kottathara', 'Mannarkkad', 'Alathur', 'Erimayur',
    'Kannambra', 'Kavasseri', 'Kizhakkenchery', 'Alanallur', 'Karimba'
  ],
  'Malappuram': [
    'Areekode', 'Pandikkad', 'Vazhakkad', 'Kizhuparamba', 'Urangattiri',
    'Panakkad', 'Melmuri', 'Chembrasseri', 'Vettikkattiri', 'Kavanoor'
  ],
  'Kozhikode': [
    'Ayancheri', 'Azhiyur', 'Chekkiad', 'Chorode', 'Edacheri',
    'Eramala', 'Kavilumpara', 'Kayakkodi', 'Kottappally', 'Kunnummal'
  ],
  'Wayanad': [
    'Ambalavayal', 'Sulthan Bathery', 'Kuppadi', 'Poothadi', 'Pulpally',
    'Kidanganad', 'Meenangadi', 'Thavinhal', 'Noolpuzha', 'Panamaram'
  ],
  'Kannur': [
    'Alakode', 'Chuzhali', 'Irikkur', 'Kooveri', 'Chengalai',
    'Cheleri', 'Eramam', 'Malapattam', 'Alapadamba', 'Karivellur'
  ],
  'Kasaragod': [
    'Badiyadka', 'Bedadka', 'Bayar', 'Bandadka', 'Kumbla'
  ]
};



// Languages available for Kerala farmers
const LANGUAGES = [
  { code: 'ml-IN', name: 'മലയാളം (Malayalam)' },
  { code: 'en-IN', name: 'English (English)' },
  { code: 'ta-IN', name: 'தமிழ் (Tamil)' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ (Kannada)' }
];


const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false);
  const [step, setStep] = useState('phone'); // 'phone', 'otp', 'details', 'profile'
  const [coordinates, setCoordinates] = useState(null); // Store fetched coordinates
  // State for location detection
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  // State for reverse geocoding
  const [reverseGeocodedLocation, setReverseGeocodedLocation] = useState(null); // Store auto-detected state/district
  const [locationMismatchWarning, setLocationMismatchWarning] = useState(false); // Warning if user changes location manually

  // Function to reverse geocode coordinates using LocationIQ API with timeout
  const reverseGeocodeLocation = async (lat, lon) => {
    try {
      const options = {
        method: 'GET', 
        headers: {
          accept: 'application/json'
        },
        signal: AbortSignal.timeout(6000) // 6 second timeout
      };

      const response = await fetch(
        `https://us1.locationiq.com/v1/reverse?lat=${lat}&lon=${lon}&format=json&key=pk.f17bff92c09589cfb3ea210be85903ac`, 
        options
      );
      
      if (!response.ok) {
        throw new Error(`LocationIQ API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.address && data.address.state) {
        const detectedState = data.address.state;
        const detectedDistrict = data.address.state_district || data.address.county || data.address.city;
        
        // Store the reverse geocoded location
        setReverseGeocodedLocation({
          state: detectedState,
          district: detectedDistrict,
          displayName: data.display_name
        });
        
        // Auto-populate the form fields
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            state: detectedState,
            district: detectedDistrict
          }
        }));
        
        setMessage({ 
          type: 'success', 
          text: `Location detected: ${detectedState}, ${detectedDistrict}` 
        });
        
        return { state: detectedState, district: detectedDistrict };
      } else {
        throw new Error('Unable to determine state/district from coordinates');
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setMessage({ 
        type: 'warning', 
        text: `Location detected but unable to auto-fill state/district: ${error.message}` 
      });
      return null;
    }
  };

  // Function to request location permission and get coordinates
  const requestLocationAccess = async () => {
    setLocationLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const locationData = await getCurrentLocation();
      
      // Update form data with precise coordinates
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          lat: locationData.lat,
          lon: locationData.lon
        }
      }));

      setCoordinates({
        lat: locationData.lat,
        lon: locationData.lon,
        accuracy: locationData.accuracy
      });

      setLocationPermissionStatus('granted');
      
      // Perform reverse geocoding to auto-populate state/district
      await reverseGeocodeLocation(locationData.lat, locationData.lon);

    } catch (error) {
      console.error('Location error:', error);
      setLocationPermissionStatus('denied');
      setMessage({ 
        type: 'error', 
        text: `Location access failed: ${error.message}. You can still enter your state/district manually.` 
      });
    } finally {
      setLocationLoading(false);
    }
  };
  const { sendOTP, verifyOTP, currentUser, loginUser, signupUser, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  // Form states
  const [formData, setFormData] = useState({
    phoneNumber: '',
    otp: '',
    firstName: '',
    lastName: '',
    preferred_language: 'ml-IN', // Default to Malayalam for Kerala farmers
    location: {
      state: 'Kerala', // Fixed to Kerala only
      district: '',
      village: '', // Added village field for Kerala-specific registration
      lat: '',
      lon: ''
    },
    land_area_acres: '',
    finance: {
      has_kcc: null,
      receives_pm_kisan: null,
      collateral_available: null
    }
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Preload background image with timeout handling
  useEffect(() => {
    const preloadImage = () => {
      const image = new Image();
      
      // Set a timeout for image loading to prevent hanging
      const imageTimeout = setTimeout(() => {
        console.warn('Background image load timeout, using fallback');
        setBackgroundImageLoaded(false); // Use gradient fallback
      }, 5000); // 5 second timeout for image loading
      
      image.onload = () => {
        clearTimeout(imageTimeout);
        setBackgroundImageLoaded(true);
      };
      
      image.onerror = () => {
        clearTimeout(imageTimeout);
        console.warn('Background image failed to load, using gradient fallback');
        setBackgroundImageLoaded(false); // Use gradient fallback
      };
      
      image.src = '/assets/360_F_502186443_Kubg3Wl76uE8BYl1tcAuYYXgGKAaO6r4.jpg';
    };
    
    preloadImage();
  }, []);

  // Cleanup reCAPTCHA when component unmounts
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (error) {
          // Ignore cleanup errors
        }
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      // Handle nested objects (location.state, finance.has_kcc, etc.)
      const [parent, child] = name.split('.');
      setFormData(prev => {
        const newData = {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: type === 'checkbox' ? checked : value
          }
        };
        
        // Clear village when district changes
        if (parent === 'location' && child === 'district') {
          newData[parent].village = '';
        }
        
        return newData;
      });

      // Fetch coordinates when location fields are changed
      if (parent === 'location' && (child === 'state' || child === 'district' || child === 'village')) {
        const newLocation = {
          ...formData.location,
          [child]: value
        };
        
        // Check if user is changing location manually after GPS detection
        if (reverseGeocodedLocation && locationPermissionStatus === 'granted') {
          const isManualChange = (child === 'state' && value !== reverseGeocodedLocation.state) ||
                                 (child === 'district' && value !== reverseGeocodedLocation.district);
          
          if (isManualChange) {
            setLocationMismatchWarning(true);
            setMessage({ 
              type: 'warning', 
              text: `⚠️ You're changing the location from what we detected via GPS (${reverseGeocodedLocation.state}, ${reverseGeocodedLocation.district}). This may affect location-based recommendations.` 
            });
          } else {
            setLocationMismatchWarning(false);
            setMessage({ type: '', text: '' });
          }
        }
        
        // Clear village selection when district changes
        if (child === 'district') {
          newLocation.village = '';
          setCoordinates(null);
        }
        
        // Fetch coordinates when village is selected (Kerala-specific)
        if (child === 'village' && newLocation.state === 'Kerala' && newLocation.district && value) {
          // Simple immediate fetch for dropdown selection (no debouncing needed for dropdowns)
          fetchCoordinatesForLocation(newLocation.state, newLocation.district, value);
        } else if (child !== 'village') {
          setCoordinates(null);
        }
      }
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  // Function to fetch coordinates from backend API (Kerala village-level) with timeout handling
  const fetchCoordinatesForLocation = async (state, district, village = null) => {
    try {
      // Add timeout wrapper to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Coordinate fetch timeout')), 8000); // 8 second timeout
      });
      
      const coordinatePromise = fetch(`/api/location/coordinates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state,
          district,
          village
        })
      }).then(res => res.json());
      
      const result = await Promise.race([coordinatePromise, timeoutPromise]);
      
      if (result.success && result.data) {
        // Handle village-level coordinates
        const coords = {
          lat: result.data.lat,
          lon: result.data.lon,
          source: 'kerala_village_precise'
        };
        setCoordinates(coords);
        console.log(`Got coordinates for ${village}, ${district}: ${coords.lat}, ${coords.lon}`);
      } else {
        setCoordinates(null);
      }
    } catch (error) {
      console.warn('Failed to fetch coordinates:', error);
      setCoordinates(null);
      // Don't show error to user for coordinate fetch failures
    }
  };

  // Function to get user's current location with improved error handling
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 8000, // Reduced from 10s to 8s to prevent timeouts
        maximumAge: 30000 // Reduced cache time to 30s for better accuracy
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          let errorMessage = 'Failed to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          reject(new Error(errorMessage));
        },
        options
      );
    });
  };

  const formatPhoneNumber = (phone) => {
    // Remove any non-digits and add +91 prefix if not present
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('91')) {
      return `+${cleaned}`;
    }
    return `+91${cleaned}`;
  };

  const handleSendOTP = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const formattedPhone = formatPhoneNumber(formData.phoneNumber);
      
      // Add timeout to OTP sending to prevent hanging
      const otpPromise = sendOTP(formattedPhone);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OTP request timeout')), 15000); // 15 second timeout
      });
      
      const result = await Promise.race([otpPromise, timeoutPromise]);
      
      if (result.success) {
        setStep('otp');
        setMessage({ type: 'success', text: 'OTP sent successfully!' });
        setFormData({ ...formData, phoneNumber: formattedPhone });
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to send OTP' });
      }
    } catch (error) {
      console.error('OTP send error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message === 'OTP request timeout' 
          ? 'Request timed out. Please check your connection and try again.' 
          : 'Failed to send OTP. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Add timeout to OTP verification to prevent hanging
      const verifyPromise = verifyOTP(formData.otp);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OTP verification timeout')), 12000); // 12 second timeout
      });
      
      const result = await Promise.race([verifyPromise, timeoutPromise]);
      
      if (result.success) {
        const firebaseUser = result.user;
        
        // Always try to login first, regardless of signup/login mode
        const loginResult = await loginUser(firebaseUser.uid);
        
        if (loginResult.success) {
          setMessage({ type: 'success', text: `Welcome back, ${loginResult.user.firstName}!` });
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1500);
        } else {
          // User doesn't exist, proceed to signup
          if (isSignup) {
            setStep('details');
            setMessage({ type: 'success', text: 'Phone verified! Please complete your profile.' });
          } else {
            // User tried to login but doesn't exist
            setMessage({ 
              type: 'info', 
              text: 'Account not found. Please create a new account.' 
            });
            setIsSignup(true);
            setStep('details');
          }
        }
      } else {
        setMessage({ type: 'error', text: result.message || 'Invalid OTP' });
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message === 'OTP verification timeout'
          ? 'Verification timed out. Please try again.'
          : 'OTP verification failed. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Get current Firebase user from auth context
      if (!currentUser) {
        throw new Error('Authentication session expired. Please verify OTP again.');
      }

      // Prepare signup data with comprehensive profile (Kerala-specific)
      const signupData = {
        firstName: formData.firstName,
        lastName: formData.lastName || undefined,
        phoneNumber: formData.phoneNumber,
        firebaseUid: currentUser.uid,
        preferred_language: formData.preferred_language,
        location: {
          state: 'Kerala', // Always Kerala
          district: formData.location.district || undefined,
          village: formData.location.village || undefined, // Required village field
          // Include coordinates from GPS or manual input (ensure they're numbers)
          lat: coordinates?.lat || (formData.location.lat ? parseFloat(formData.location.lat) : undefined),
          lon: coordinates?.lon || (formData.location.lon ? parseFloat(formData.location.lon) : undefined)
        },
        land_area_acres: formData.land_area_acres ? parseFloat(formData.land_area_acres) : undefined,
        finance: {
          has_kcc: formData.finance.has_kcc,
          receives_pm_kisan: formData.finance.receives_pm_kisan,
          collateral_available: formData.finance.collateral_available
        }
      };

      // Validate Kerala location requirements
      if (!signupData.location.district || !signupData.location.village) {
        throw new Error('District and village are required for Kerala farmers');
      }
      
      if (signupData.finance.has_kcc === null && 
          signupData.finance.receives_pm_kisan === null && 
          signupData.finance.collateral_available === null) {
        delete signupData.finance;
      }

      console.log('Sending comprehensive signup data:', signupData); // Debug log
      console.log('Coordinates in signup data:', signupData.location); // Debug coordinates specifically

      const result = await signupUser(signupData);
      
      if (result.success) {
        // Check if user already exists and should login
        if (result.data && result.data.userExists) {
          setMessage({ 
            type: 'info', 
            text: `Welcome back, ${result.data.user.firstName}! Logging you in...` 
          });
          
          // Automatically attempt login
          const loginResult = await loginUser(currentUser.uid);
          
          if (loginResult.success) {
            setMessage({ type: 'success', text: 'Login successful!' });
            setTimeout(() => {
              navigate('/', { replace: true });
            }, 1500);
          } else {
            setMessage({ type: 'error', text: 'Login failed. Please try again.' });
          }
        } else {
          setMessage({ type: 'success', text: 'Account created successfully with comprehensive profile!' });
          
          // Redirect to dashboard or home
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 2000);
        }
      } else {
        setMessage({ type: 'error', text: result.message || 'Signup failed. Please try again.' });
      }
      
    } catch (error) {
      console.error('Signup error:', error); // Debug log
      setMessage({ type: 'error', text: error.message || 'Signup failed. Please try again.' });
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ 
      phoneNumber: '', 
      otp: '', 
      firstName: '', 
      lastName: '',
      preferred_language: 'ml-IN',
      location: {
        state: 'Kerala',
        district: '',
        village: '',
        lat: '',
        lon: ''
      },
      land_area_acres: '',
      finance: {
        has_kcc: null,
        receives_pm_kisan: null,
        collateral_available: null
      }
    });
    setStep('phone');
    setMessage({ type: '', text: '' });
    setCoordinates(null); // Reset coordinates
    setLocationPermissionStatus('prompt'); // Reset location permission
    
    // Simple reCAPTCHA cleanup
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (error) {
        // Ignore cleanup errors
      }
      window.recaptchaVerifier = null;
    }
  };

  // Simplified animation variants - keeping only essential ones
  const formVariants = {
    enter: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        {/* Gradient Fallback - Shows immediately while image loads */}
        <div className="w-full h-full bg-gradient-to-br from-green-100 via-blue-50 to-green-200" />
        
        {/* Actual Background Image - Fades in when loaded */}
        <div 
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${
            backgroundImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundImage: backgroundImageLoaded ? `url('/assets/360_F_502186443_Kubg3Wl76uE8BYl1tcAuYYXgGKAaO6r4.jpg')` : 'none'
          }}
        />
      </div>
      
      {/* Bright Overlay for better readability */}
      <div className="absolute inset-0 z-0 bg-white/80" />
      
      {/* Additional subtle patterns */}
      <div className="absolute inset-0 z-0">
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 via-transparent to-secondary-50/50" />
        
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full bg-repeat" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23059669' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Animated glow effects - simplified with CSS */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-radial from-emerald-200/20 to-transparent rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-gradient-radial from-blue-200/15 to-transparent rounded-full blur-3xl animate-pulse-slow animation-delay-2s" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 pt-20">
        <div className="w-full max-w-xs sm:max-w-sm lg:max-w-md animate-fade-in">

          {/* Main Form Card */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-4 sm:p-6 mb-4 backdrop-saturate-150 transition-all duration-500 hover:shadow-3xl"
            style={{
              backdropFilter: 'blur(20px) saturate(150%)',
              borderColor: 'rgba(156, 163, 175, 0.3)',
            }}
          >
            {/* Form Header */}
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 bg-gradient-to-br from-emerald-100/90 to-blue-100/90 rounded-xl flex items-center justify-center backdrop-blur-sm border border-gray-200/50 transition-transform duration-300 hover:scale-105">
                <FaShieldAlt className="text-lg sm:text-xl text-emerald-700" />
              </div>
              
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-primary-600 mb-2">
                {isSignup ? 'Create Professional Account' : 'Secure Login'}
              </h2>
              <p className="text-gray-700 text-xs sm:text-sm font-semibold">
                {step === 'phone' && 'Enter your mobile number to continue'}
                {step === 'otp' && 'Verify the code sent to your phone'}
                {step === 'details' && 'Complete your professional profile'}
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="flex space-x-2">
                {['phone', 'otp', 'details'].map((stepName, index) => (
                  <div
                    key={stepName}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      step === stepName ? 'bg-primary-600 w-6' :
                      ['phone', 'otp', 'details'].indexOf(step) > index ? 'bg-primary-500' :
                      'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Error/Success Message */}
            <AnimatePresence>
              {message.text && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mb-4 sm:mb-6 p-3 rounded-xl border text-xs sm:text-sm ${
                    message.type === 'success' 
                      ? 'bg-green-100/80 text-green-700 border-green-300/50' 
                      : message.type === 'info'
                      ? 'bg-blue-100/80 text-blue-700 border-blue-300/50'
                      : message.type === 'warning'
                      ? 'bg-orange-100/80 text-orange-700 border-orange-300/50'
                      : 'bg-red-100/80 text-red-700 border-red-300/50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {message.type === 'success' ? <FaCheck /> : message.type === 'info' ? <span>ℹ️</span> : message.type === 'warning' ? <span>⚠️</span> : <span>❌</span>}
                    <span>{message.text}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Steps */}
            <AnimatePresence mode="wait">
              {/* Phone Number Step */}
              {step === 'phone' && (
                <motion.div
                  key="phone"
                  variants={formVariants}
                  initial="exit"
                  animate="enter"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-primary-600 text-xs sm:text-sm font-bold mb-2">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center z-10">
                          <span className="mr-1.5 font-semibold" style={{ color: '#1f2937' }}>🇮🇳</span>
                          <span className="text-xs font-semibold" style={{ color: '#1f2937' }}>+91</span>
                        </div>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          className="w-full pl-16 pr-3 py-2.5 sm:py-3 bg-white/80 backdrop-blur-sm border border-gray-300/50 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 transition-all duration-300 font-semibold text-xs sm:text-sm"
                          placeholder="9876543210"
                          maxLength="10"
                        />
                      </div>
                    </div>

                    {/* reCAPTCHA Container */}
                    <div className="flex justify-center">
                      <div id="recaptcha-container"></div>
                    </div>
                    
                    <button
                      onClick={handleSendOTP}
                      disabled={loading || formData.phoneNumber.length !== 10}
                      className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-emerald-500 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-lg hover:shadow-emerald-500/25 text-xs sm:text-sm hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <FaSpinner className="animate-spin" />
                          <span>Sending OTP...</span>
                        </div>
                      ) : (
                        'Send Verification Code'
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* OTP Step */}
              {step === 'otp' && (
                <motion.div
                  key="otp"
                  variants={formVariants}
                  initial="exit"
                  animate="enter"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-gray-600 text-xs sm:text-sm font-medium mb-2">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        name="otp"
                        value={formData.otp}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 bg-white/80 border border-gray-300/50 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent text-center text-lg tracking-[0.3em] transition-all duration-300"
                        placeholder="000000"
                        maxLength="6"
                      />
                      <p className="text-gray-500 text-xs mt-2 text-center">
                        Code sent to {formData.phoneNumber}
                      </p>
                    </div>
                    
                    <button
                      onClick={handleVerifyOTP}
                      disabled={loading || formData.otp.length !== 6}
                      className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-primary-500 hover:to-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-xs sm:text-sm hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <FaSpinner className="animate-spin" />
                          <span>Verifying...</span>
                        </div>
                      ) : (
                        'Verify Code'
                      )}
                    </button>

                    <button
                      onClick={resetForm}
                      className="w-full py-3 text-gray-600 rounded-xl font-medium hover:text-gray-800 hover:bg-gray-100/50 transition-all duration-300"
                    >
                      Use Different Number
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Details Step (Signup) */}
              {step === 'details' && (
                <motion.div
                  key="details"
                  variants={formVariants}
                  initial="exit"
                  animate="enter"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto pr-2 scrollbar-elegant">
                    {/* Basic Information */}
                    <div className="bg-gray-50/50 p-3 rounded-lg">
                      <h4 className="font-semibold text-gray-700 text-sm mb-3">Basic Information</h4>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-gray-600 text-xs sm:text-sm font-medium mb-2">
                            First Name *
                          </label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2.5 bg-white/80 border border-gray-300/50 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300 text-xs sm:text-sm"
                            placeholder="Enter your first name"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-gray-600 text-xs sm:text-sm font-medium mb-2">
                            Last Name
                          </label>
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2.5 bg-white/80 border border-gray-300/50 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300 text-xs sm:text-sm"
                            placeholder="Enter your last name"
                          />
                        </div>

                        <div>
                          <label className="block text-gray-600 text-xs sm:text-sm font-medium mb-2">
                            Preferred Language
                          </label>
                          <select
                            name="preferred_language"
                            value={formData.preferred_language}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2.5 bg-white/80 border border-gray-300/50 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300 text-xs sm:text-sm"
                          >
                            {LANGUAGES.map(lang => (
                              <option key={lang.code} value={lang.code}>
                                {lang.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Location Information */}
                    <div className="bg-gray-50/50 p-3 rounded-lg">
                      <h4 className="font-semibold text-gray-700 text-sm mb-3">Location (Optional)</h4>
                      
                      {/* Precise Location Detection */}
                      <div className="mb-4 p-3 bg-blue-50/50 border border-blue-200/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span>📍</span>
                            <span className="text-sm font-medium text-blue-800">Get Precise Location</span>
                          </div>
                          <button
                            type="button"
                            onClick={requestLocationAccess}
                            disabled={locationLoading || locationPermissionStatus === 'granted'}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-300 ${
                              locationPermissionStatus === 'granted' 
                                ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50'
                            }`}
                          >
                            {locationLoading ? (
                              <div className="flex items-center space-x-1">
                                <FaSpinner className="animate-spin" />
                                <span>Detecting...</span>
                              </div>
                            ) : locationPermissionStatus === 'granted' ? (
                              <div className="flex items-center space-x-1">
                                <FaCheck />
                                <span>Located</span>
                              </div>
                            ) : (
                              'Use My Location'
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-blue-600">
                          {locationPermissionStatus === 'granted' 
                            ? (reverseGeocodedLocation 
                                ? `Using your precise GPS coordinates for better farming recommendations. Auto-detected: ${reverseGeocodedLocation.state}, ${reverseGeocodedLocation.district}`
                                : 'Using your precise GPS coordinates for better farming recommendations')
                            : 'Get precise coordinates and auto-fill state/district for accurate weather data and farming insights'
                          }
                        </p>
                        
                        {/* Location Mismatch Warning */}
                        {locationMismatchWarning && (
                          <div className="mt-2 p-2 bg-orange-50/80 border border-orange-200/50 rounded-lg">
                            <div className="flex items-center space-x-2 text-xs text-orange-700">
                              <span>⚠️</span>
                              <span>Manual location differs from GPS detection</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-gray-600 text-xs sm:text-sm font-medium mb-2">
                            State
                          </label>
                          <input
                            type="text"
                            value="Kerala"
                            disabled
                            className="w-full px-3 py-2.5 bg-green-50/80 border border-green-300/50 rounded-lg text-gray-600 text-xs sm:text-sm font-medium"
                          />
                          <p className="text-xs text-green-600 mt-1">This app serves Kerala farmers only</p>
                        </div>

                        <div>
                          <label className="block text-gray-600 text-xs sm:text-sm font-medium mb-2">
                            District <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="location.district"
                            value={formData.location.district}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2.5 bg-white/80 border border-gray-300/50 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300 text-xs sm:text-sm"
                            required
                          >
                            <option value="">Select District</option>
                            {Object.keys(KERALA_DISTRICTS_VILLAGES).map(district => (
                              <option key={district} value={district}>
                                {district}
                              </option>
                            ))}
                          </select>
                        </div>

                        {formData.location.district && (
                          <div>
                            <label className="block text-gray-600 text-xs sm:text-sm font-medium mb-2">
                              Village <span className="text-red-500">*</span>
                            </label>
                            <select
                              name="location.village"
                              value={formData.location.village}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2.5 bg-white/80 border border-gray-300/50 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300 text-xs sm:text-sm"
                              required
                            >
                              <option value="">Select Village</option>
                              {KERALA_DISTRICTS_VILLAGES[formData.location.district]?.map(village => (
                                <option key={village} value={village}>
                                  {village}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Coordinate Preview */}
                        {coordinates && (
                          <div className="bg-green-50/50 p-2 rounded-lg border border-green-200/50">
                            <div className="flex items-center space-x-1 text-xs text-green-700 mb-1">
                              <span>✅</span>
                              <span>
                                Village Location: {coordinates.lat.toFixed(6)}, {coordinates.lon.toFixed(6)}
                                {coordinates.accuracy && ` (±${Math.round(coordinates.accuracy)}m accuracy)`}
                              </span>
                            </div>
                            <div className="text-xs text-green-600 pl-4">
                              🌾 Perfect for Kerala agricultural advice and weather forecasts
                            </div>
                            {reverseGeocodedLocation && (
                              <div className="text-xs text-green-600 pl-4">
                                📍 GPS Detected: {reverseGeocodedLocation.state}, {reverseGeocodedLocation.district}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Village Selection Status */}
                        {formData.location.district && !formData.location.village && (
                          <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-200/50">
                            <div className="flex items-center space-x-1 text-xs text-orange-700">
                              <span>⚠️</span>
                              <span>Please select your village for precise agricultural guidance</span>
                            </div>
                          </div>
                        )}

                        {/* Loading coordinates indicator */}
                        {formData.location.village && !coordinates && (
                          <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-200/50">
                            <div className="flex items-center space-x-1 text-xs text-blue-700">
                              <span className="animate-spin">⏳</span>
                              <span>Loading village coordinates...</span>
                            </div>
                          </div>
                        )}

                        {/* Manual Coordinates Input (Advanced) */}
                        {!coordinates && (
                          <div className="border-t border-gray-200 pt-3">
                            <details className="group">
                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                Advanced: Enter coordinates manually
                              </summary>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-gray-600 text-xs font-medium mb-1">
                                    Latitude
                                  </label>
                                  <input
                                    type="number"
                                    name="location.lat"
                                    value={formData.location.lat || ''}
                                    onChange={handleInputChange}
                                    step="any"
                                    className="w-full px-2 py-1.5 bg-white/80 border border-gray-300/50 rounded text-gray-800 text-xs"
                                    placeholder="e.g., 28.6139"
                                  />
                                </div>
                                <div>
                                  <label className="block text-gray-600 text-xs font-medium mb-1">
                                    Longitude
                                  </label>
                                  <input
                                    type="number"
                                    name="location.lon"
                                    value={formData.location.lon || ''}
                                    onChange={handleInputChange}
                                    step="any"
                                    className="w-full px-2 py-1.5 bg-white/80 border border-gray-300/50 rounded text-gray-800 text-xs"
                                    placeholder="e.g., 77.2090"
                                  />
                                </div>
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Agricultural Information */}
                    <div className="bg-gray-50/50 p-3 rounded-lg">
                      <h4 className="font-semibold text-gray-700 text-sm mb-3">Agricultural Details (Optional)</h4>
                      
                      <div>
                        <label className="block text-gray-600 text-xs sm:text-sm font-medium mb-2">
                          Land Area (Acres)
                        </label>
                        <input
                          type="number"
                          name="land_area_acres"
                          value={formData.land_area_acres}
                          onChange={handleInputChange}
                          min="0"
                          step="0.1"
                          className="w-full px-3 py-2.5 bg-white/80 border border-gray-300/50 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300 text-xs sm:text-sm"
                          placeholder="e.g., 2.5"
                        />
                      </div>
                    </div>

                    {/* Financial Information */}
                    <div className="bg-gray-50/50 p-3 rounded-lg">
                      <h4 className="font-semibold text-gray-700 text-sm mb-3">Financial Information (Optional)</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="has_kcc"
                            name="finance.has_kcc"
                            checked={formData.finance.has_kcc === true}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleInputChange({
                                target: {
                                  name: 'finance.has_kcc',
                                  type: 'checkbox',
                                  checked: checked ? true : null
                                }
                              });
                            }}
                            className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                          />
                          <label htmlFor="has_kcc" className="text-gray-700 text-xs sm:text-sm">
                            I have a Kisan Credit Card (KCC)
                          </label>
                        </div>

                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="receives_pm_kisan"
                            name="finance.receives_pm_kisan"
                            checked={formData.finance.receives_pm_kisan === true}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleInputChange({
                                target: {
                                  name: 'finance.receives_pm_kisan',
                                  type: 'checkbox',
                                  checked: checked ? true : null
                                }
                              });
                            }}
                            className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                          />
                          <label htmlFor="receives_pm_kisan" className="text-gray-700 text-xs sm:text-sm">
                            I receive PM-KISAN benefits
                          </label>
                        </div>

                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="collateral_available"
                            name="finance.collateral_available"
                            checked={formData.finance.collateral_available === true}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleInputChange({
                                target: {
                                  name: 'finance.collateral_available',
                                  type: 'checkbox',
                                  checked: checked ? true : null
                                }
                              });
                            }}
                            className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                          />
                          <label htmlFor="collateral_available" className="text-gray-700 text-xs sm:text-sm">
                            I have collateral available for loans
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    {/* Form Validation Status */}
                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200/50">
                      <p className="text-xs text-blue-800 font-medium mb-2">Required Fields:</p>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${formData.firstName.trim() ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className={`text-xs ${formData.firstName.trim() ? 'text-green-700' : 'text-gray-500'}`}>
                            First Name
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${formData.location.district ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className={`text-xs ${formData.location.district ? 'text-green-700' : 'text-gray-500'}`}>
                            District Selection
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${formData.location.village ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className={`text-xs ${formData.location.village ? 'text-green-700' : 'text-gray-500'}`}>
                            Village Selection
                          </span>
                        </div>
                        {coordinates && (
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-xs text-green-700">
                              📍 Village coordinates loaded
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleSignup}
                      disabled={
                        loading || 
                        !formData.firstName.trim() ||
                        !formData.location.district.trim() ||
                        !formData.location.village.trim()
                      }
                      className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-primary-500 hover:to-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-xs sm:text-sm hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <FaSpinner className="animate-spin" />
                          <span>Creating Account...</span>
                        </div>
                      ) : (
                        'Create Professional Account'
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toggle Login/Signup */}
            {step === 'phone' && (
              <div className="text-center mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-300/50 transition-opacity duration-300">
                <p className="text-gray-600 text-xs sm:text-sm font-semibold">
                  {isSignup ? 'Already have a professional account?' : "Don't have an account?"}
                </p>
                <button
                  onClick={() => setIsSignup(!isSignup)}
                  className="text-primary-600 font-bold mt-1 hover:text-primary-700 transition-colors duration-300 text-xs sm:text-sm"
                >
                  {isSignup ? 'Sign In' : 'Create Account'}
                </button>
              </div>
            )}
          </div>


          {/* Footer */}
          <div className="text-center mt-6 transition-opacity duration-500">
            <p className="text-gray-600 text-xs font-medium">
              Powered by advanced AI • Trusted by farmers across Kerala
            </p>
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      <FloatingChatButton />
    </div>
  );
};

export default Login;
