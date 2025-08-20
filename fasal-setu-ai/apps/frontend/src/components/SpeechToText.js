import {useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaGlobe, FaChevronDown } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// Supported languages with native names
const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', name: 'English', native: 'English' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ur-IN', name: 'Urdu', native: 'اردو' }
];

// Map simplified language codes to full locale codes
const LANGUAGE_CODE_MAP = {
  'en': 'en-IN',
  'hi': 'hi-IN',
  'bn': 'bn-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'gu': 'gu-IN',
  'kn': 'kn-IN',
  'ml': 'ml-IN',
  'mr': 'mr-IN',
  'pa': 'pa-IN',
  'ur': 'ur-IN'
};

const SpeechToText = ({ 
  onTranscript, 
  userPreferredLanguage = 'en', 
  className = "",
  size = "normal", // "small", "normal", "large"
  forceDirection = null // "up", "down", or null for auto-detect
}) => {
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState('down'); // 'up' or 'down'
  const [currentInterimText, setCurrentInterimText] = useState(''); // Track interim text
  const [voiceAmplitude, setVoiceAmplitude] = useState(0); // 0-100 for voice volume
  
  const dropdownRef = useRef(null);
  const modalRef = useRef(null);
  const containerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Initialize speech recognition on mount
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsSupported(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.maxAlternatives = 1;
      
      setRecognition(recognitionInstance);
    } else {
      setIsSupported(false);
      console.warn('Speech recognition not supported in this browser');
    }
  }, []);

  // Set initial language based on user preference
  useEffect(() => {
    if (userPreferredLanguage) {
      const fullLanguageCode = LANGUAGE_CODE_MAP[userPreferredLanguage] || userPreferredLanguage;
      setSelectedLanguage(fullLanguageCode);
      setHasSelectedLanguage(true);
    }
  }, [userPreferredLanguage]);

  // Setup recognition event handlers
  useEffect(() => {
    if (!recognition) return;

    const handleResult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        // Final result - send to parent and clear interim tracking
        if (onTranscript) {
          onTranscript(finalTranscript.trim(), false); // false = final result
        }
        setCurrentInterimText(''); // Clear interim tracking
        setTranscript('');
      } else if (interimTranscript) {
        // Interim result - only send if it's different from current interim
        if (interimTranscript !== currentInterimText) {
          setCurrentInterimText(interimTranscript);
          if (onTranscript) {
            onTranscript(interimTranscript.trim(), true); // true = interim result
          }
        }
        setTranscript(interimTranscript);
      }
    };

    const handleEnd = () => {
      setIsListening(false);
      setTranscript('');
      setCurrentInterimText(''); // Clear interim tracking when recognition ends
      stopAudioAnalysis(); // Stop amplitude detection
    };

    const handleError = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setTranscript('');
      setCurrentInterimText(''); // Clear interim tracking on error
      stopAudioAnalysis(); // Stop amplitude detection on error
      
      // Show user-friendly error message
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access to use voice input.');
      } else if (event.error === 'network') {
        alert('Network error. Please check your internet connection.');
      } else if (event.error === 'no-speech') {
        // Silent error for no speech detected
      } else {
        alert('Speech recognition error. Please try again.');
      }
    };

    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('end', handleEnd);
    recognition.addEventListener('error', handleError);

    return () => {
      recognition.removeEventListener('result', handleResult);
      recognition.removeEventListener('end', handleEnd);
      recognition.removeEventListener('error', handleError);
    };
  }, [recognition, onTranscript]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setShowLanguageModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Setup audio context for voice amplitude detection
  const setupAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneRef.current = stream;
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      return true;
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
      return false;
    }
  };

  // Start voice amplitude detection loop
  const startAmplitudeDetection = () => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const detectAmplitude = () => {
      if (!isListening) {
        setVoiceAmplitude(0);
        return;
      }
      
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average amplitude
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      // Convert to 0-100 scale and smooth it
      const amplitude = Math.min(100, (average / 128) * 100);
      const smoothedAmplitude = voiceAmplitude * 0.7 + amplitude * 0.3;
      setVoiceAmplitude(smoothedAmplitude);
      
      // Debug log for testing
      if (amplitude > 5) {
        console.log('Voice amplitude:', amplitude.toFixed(2), 'smoothed:', smoothedAmplitude.toFixed(2));
      }
      
      animationFrameRef.current = requestAnimationFrame(detectAmplitude);
    };
    
    detectAmplitude();
  };

  // Stop audio analysis
  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    setVoiceAmplitude(0);
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
    };
  }, []);

  // Get ordered languages with user's preferred language first
  const getOrderedLanguages = () => {
    const userLangCode = LANGUAGE_CODE_MAP[userPreferredLanguage] || userPreferredLanguage;
    const userLang = SUPPORTED_LANGUAGES.find(lang => lang.code === userLangCode);
    const otherLangs = SUPPORTED_LANGUAGES.filter(lang => lang.code !== userLangCode);
    
    return userLang ? [userLang, ...otherLangs] : SUPPORTED_LANGUAGES;
  };

  // Calculate dropdown position based on available space
  const calculateDropdownPosition = () => {
    // If direction is forced, use that
    if (forceDirection) {
      setDropdownPosition(forceDirection);
      return;
    }
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // More aggressive positioning: if we're in the bottom half of the viewport or have less than 300px below
      if (rect.bottom > viewportHeight * 0.5 || spaceBelow < 300) {
        setDropdownPosition('up');
      } else {
        setDropdownPosition('down');
      }
    }
  };

  const handleLanguageDropdownToggle = () => {
    if (!showLanguageDropdown) {
      calculateDropdownPosition();
    }
    setShowLanguageDropdown(!showLanguageDropdown);
  };

  const handleMicClick = async () => {
    if (!isSupported) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (!hasSelectedLanguage) {
      setShowLanguageModal(true);
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      stopAudioAnalysis();
    } else {
      recognition.lang = selectedLanguage;
      try {
        // Start audio analysis for voice amplitude detection
        const audioStarted = await setupAudioAnalysis();
        if (audioStarted) {
          startAmplitudeDetection();
        }
        
        recognition.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        alert('Failed to start voice recognition. Please try again.');
        stopAudioAnalysis(); // Clean up audio if speech recognition fails
      }
    }
  };

  const handleLanguageSelect = (languageCode) => {
    setSelectedLanguage(languageCode);
    setHasSelectedLanguage(true);
    setShowLanguageDropdown(false);
    setShowLanguageModal(false);
    
    // Save language preference to localStorage
    localStorage.setItem('stt_preferred_language', languageCode);
  };

  const selectedLangObj = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);
  
  // Size variants
  const sizeClasses = {
    small: {
      container: "space-x-1",
      button: "p-1.5",
      icon: "text-xs",
      dropdown: "text-xs",
      modal: "text-sm"
    },
    normal: {
      container: "space-x-2",
      button: "p-2",
      icon: "text-sm",
      dropdown: "text-sm",
      modal: "text-base"
    },
    large: {
      container: "space-x-3",
      button: "p-3",
      icon: "text-base",
      dropdown: "text-base",
      modal: "text-lg"
    }
  };

  const sizes = sizeClasses[size];

  if (!isSupported) {
    return null; // Don't render if not supported
  }

  return (
    <>
      <div className={`flex items-center ${sizes.container} ${className}`} ref={containerRef}>
        {/* Language Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleLanguageDropdownToggle}
            className={`${sizes.button} bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors duration-200 flex items-center space-x-1`}
            title="Select language"
          >
            <FaGlobe className={`text-gray-600 ${sizes.icon}`} />
            <FaChevronDown className={`text-gray-600 ${sizes.icon}`} />
          </button>

          <AnimatePresence>
            {showLanguageDropdown && (
              <motion.div
                initial={{ opacity: 0, y: dropdownPosition === 'down' ? -10 : 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: dropdownPosition === 'down' ? -10 : 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`absolute ${dropdownPosition === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} right-0 bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] min-w-48 max-h-60 overflow-y-auto`}
                style={{
                  maxHeight: dropdownPosition === 'up' ? '240px' : '240px',
                  minWidth: '200px'
                }}
              >
                {getOrderedLanguages().map((language) => (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageSelect(language.code)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${sizes.dropdown} transition-colors duration-200 ${
                      selectedLanguage === language.code ? 'text-purple-500 bg-purple-50' : 'text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{language.name}</div>
                    <div className="text-xs text-gray-500">{language.native}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Microphone Button */}
        <button
          onClick={handleMicClick}
          className={`${sizes.button} rounded-lg transition-all duration-200 flex items-center justify-center ${
            isListening
              ? voiceAmplitude > 15 
                ? 'bg-green-500 hover:bg-green-600 text-white animate-pulse' 
                : voiceAmplitude > 5 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white animate-pulse'
                  : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : hasSelectedLanguage
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!hasSelectedLanguage}
          title={
            !hasSelectedLanguage 
              ? 'Select a language first' 
              : isListening 
                ? voiceAmplitude > 15 
                  ? 'Hearing you clearly - Stop recording'
                  : voiceAmplitude > 5 
                    ? 'Hearing you softly - Stop recording'
                    : 'Listening... - Stop recording'
                : 'Start voice input'
          }
        >
          {isListening ? (
            <FaMicrophoneSlash className={sizes.icon} />
          ) : (
            <FaMicrophone className={sizes.icon} />
          )}
        </button>

        {/* Current language indicator */}
        {selectedLangObj && hasSelectedLanguage && (
          <div className={`text-gray-600 ${sizes.dropdown} hidden sm:block`}>
            {selectedLangObj.native}
          </div>
        )}
      </div>

      {/* Language Selection Modal */}
      <AnimatePresence>
        {showLanguageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-96 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200">
                <h3 className={`font-bold text-gray-800 ${sizes.modal}`}>Select Language for Voice Input</h3>
                <p className="text-sm text-gray-600 mt-1">Choose your preferred language for speech recognition</p>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {getOrderedLanguages().map((language) => (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageSelect(language.code)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors duration-200 border-b border-gray-100 last:border-b-0 ${
                      selectedLanguage === language.code ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`font-medium text-gray-800 ${sizes.modal}`}>
                      {language.name} ({language.native})
                    </div>
                    <div className="text-sm text-gray-500">{language.code}</div>
                  </button>
                ))}
              </div>
              
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowLanguageModal(false)}
                  className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SpeechToText;
