import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaShieldAlt, FaCheck, FaSpinner } from 'react-icons/fa';
import FloatingChatButton from '../components/FloatingChatButton';

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('phone'); // 'phone', 'otp', 'details'
  const { sendOTP, verifyOTP, currentUser, loginUser, signupUser, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  // Form states
  const [formData, setFormData] = useState({
    phoneNumber: '',
    otp: '',
    firstName: '',
    lastName: ''
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
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
      
      // Send OTP via Firebase
      const result = await sendOTP(formattedPhone);
      
      if (result.success) {
        setStep('otp');
        setMessage({ type: 'success', text: 'OTP sent successfully!' });
        setFormData({ ...formData, phoneNumber: formattedPhone });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send OTP. Please try again.' });
    }
    
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await verifyOTP(formData.otp);
      
      if (result.success) {
        const firebaseUser = result.user;
        
        if (isSignup) {
          setStep('details');
          setMessage({ type: 'success', text: 'Phone verified! Please complete your profile.' });
        } else {
          // Try to login with existing account
          const loginResult = await loginUser(firebaseUser.uid);
          
          if (loginResult.success) {
            setMessage({ type: 'success', text: 'Login successful!' });
            setTimeout(() => {
              navigate('/', { replace: true });
            }, 1500);
          } else {
            setMessage({ type: 'error', text: 'User not found. Please sign up first.' });
            setIsSignup(true);
            setStep('details');
          }
        }
      } else {
        setMessage({ type: 'error', text: result.message || 'Invalid OTP' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'OTP verification failed. Please try again.' });
    }
    
    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Get current Firebase user from auth context
      if (!currentUser) {
        throw new Error('Authentication session expired. Please verify OTP again.');
      }

      const signupData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        firebaseUid: currentUser.uid
      };

      console.log('Sending signup data:', signupData); // Debug log

      const result = await signupUser(signupData);
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Account created successfully!' });
        
        // Redirect to dashboard or home
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
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
    setFormData({ phoneNumber: '', otp: '', firstName: '', lastName: '' });
    setStep('phone');
    setMessage({ type: '', text: '' });
    
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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.25, 0.25, 0.75]
      }
    }
  };

  const formVariants = {
    enter: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: "easeOut"
      }
    },
    exit: {
      x: -50,
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/assets/360_F_502186443_Kubg3Wl76uE8BYl1tcAuYYXgGKAaO6r4.jpg')`
        }}
      />
      
      {/* Bright Overlay for better readability */}
      <div className="absolute inset-0 z-0 bg-black/70" />
      
      {/* Additional subtle patterns */}
      <div className="absolute inset-0 z-0">
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100/10 via-transparent to-secondary-100/10" />
        
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-repeat" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23059669' fill-opacity='0.3'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Animated glow effects - brighter and more subtle */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-radial from-emerald-300/30 to-transparent rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-gradient-radial from-blue-300/20 to-transparent rounded-full blur-3xl"
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="w-full max-w-sm sm:max-w-md lg:max-w-lg"
        >

          {/* Main Form Card */}
          <motion.div 
            variants={itemVariants}
            className="bg-gray-400/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-6 sm:p-8 mb-6 backdrop-saturate-150"
            style={{
              backdropFilter: 'blur(20px) saturate(150%)',
              borderColor: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            {/* Form Header */}
            <div className="text-center mb-6">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500/40 to-blue-500/40 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30"
              >
                <FaShieldAlt className="text-xl sm:text-2xl text-emerald-800" />
              </motion.div>
              
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary-300 mb-2">
                {isSignup ? 'Create Professional Account' : 'Secure Login'}
              </h2>
              <p className="text-gray-800 text-sm sm:text-base font-semibold">
                {step === 'phone' && 'Enter your mobile number to continue'}
                {step === 'otp' && 'Verify the code sent to your phone'}
                {step === 'details' && 'Complete your professional profile'}
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center mb-6">
              <div className="flex space-x-2">
                {['phone', 'otp', 'details'].map((stepName, index) => (
                  <div
                    key={stepName}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      step === stepName ? 'bg-primary-500 w-6' :
                      ['phone', 'otp', 'details'].indexOf(step) > index ? 'bg-primary-400' :
                      'bg-gray-600'
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
                  className={`mb-6 p-4 rounded-xl border text-sm ${
                    message.type === 'success' 
                      ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {message.type === 'success' ? <FaCheck /> : <span>⚠️</span>}
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
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-primary-300 text-sm sm:text-base font-bold mb-2">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white flex items-center">
                          <span className="mr-2">🇮🇳</span>
                          <span className="text-sm">+91</span>
                        </div>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          className="w-full pl-20 pr-4 py-3 sm:py-4 bg-secondary-600/20 backdrop-blur-sm border border-white/40 rounded-xl text-main placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 transition-all duration-300 font-semibold text-sm sm:text-base"
                          placeholder="9876543210"
                          maxLength="10"
                        />
                      </div>
                    </div>

                    {/* reCAPTCHA Container */}
                    <div className="flex justify-center py-4">
                      <div id="recaptcha-container" className="min-h-[78px]"></div>
                    </div>
                    
                    <motion.button
                      onClick={handleSendOTP}
                      disabled={loading || formData.phoneNumber.length !== 10}
                      className="w-full py-3 sm:py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-emerald-500 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-lg hover:shadow-emerald-500/25 text-sm sm:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <FaSpinner className="animate-spin" />
                          <span>Sending OTP...</span>
                        </div>
                      ) : (
                        'Send Verification Code'
                      )}
                    </motion.button>
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
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        name="otp"
                        value={formData.otp}
                        onChange={handleInputChange}
                        className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent text-center text-xl tracking-[0.5em] transition-all duration-300"
                        placeholder="000000"
                        maxLength="6"
                      />
                      <p className="text-gray-500 text-xs mt-2 text-center">
                        Code sent to {formData.phoneNumber}
                      </p>
                    </div>
                    
                    <motion.button
                      onClick={handleVerifyOTP}
                      disabled={loading || formData.otp.length !== 6}
                      className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-primary-500 hover:to-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <FaSpinner className="animate-spin" />
                          <span>Verifying...</span>
                        </div>
                      ) : (
                        'Verify Code'
                      )}
                    </motion.button>

                    <button
                      onClick={resetForm}
                      className="w-full py-3 text-gray-400 rounded-xl font-medium hover:text-white hover:bg-gray-700/30 transition-all duration-300"
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
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300"
                        placeholder="Enter your first name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-4 bg-gray-700/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300"
                        placeholder="Enter your last name"
                      />
                    </div>
                    
                    <motion.button
                      onClick={handleSignup}
                      disabled={loading || !formData.firstName.trim()}
                      className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:from-primary-500 hover:to-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <FaSpinner className="animate-spin" />
                          <span>Creating Account...</span>
                        </div>
                      ) : (
                        'Create Professional Account'
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toggle Login/Signup */}
            {step === 'phone' && (
              <motion.div 
                variants={itemVariants}
                className="text-center mt-6 pt-6 border-t border-white/30"
              >
                <p className="text-white/70 text-sm sm:text-base font-semibold">
                  {isSignup ? 'Already have a professional account?' : "Don't have an account?"}
                </p>
                <button
                  onClick={() => setIsSignup(!isSignup)}
                  className="text-primary-300 font-bold mt-1 hover:text-emerald-700 transition-colors duration-300 text-sm sm:text-base"
                >
                  {isSignup ? 'Sign In' : 'Create Account'}
                </button>
              </motion.div>
            )}
          </motion.div>


          {/* Footer */}
          <motion.div 
            variants={itemVariants}
            className="text-center mt-8"
          >
            <p className="text-secondary text-xs sm:text-sm font-medium">
              Powered by advanced AI • Trusted by farmers across India
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Floating Chat Button */}
      <FloatingChatButton />
    </div>
  );
};

export default Login;
