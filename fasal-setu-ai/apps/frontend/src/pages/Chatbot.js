import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPaperPlane, FaRobot, FaUser, FaTimes, FaEyeSlash, FaEye, FaComments, FaExclamationTriangle, FaCheckCircle, FaSpinner, FaHistory, FaBars, FaToggleOn, FaToggleOff, FaUserTie, FaGlobe } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { chatbotAPI, authAPI, conversationAPI } from '../services/api';
import ConversationSidebar from '../components/ConversationSidebar';
import SpeechToText from '../components/SpeechToText';
import { useAuth } from '../contexts/AuthContext';

// Memoized FloatingChatButton to prevent unnecessary re-renders
const FloatingChatButton = React.memo(() => {
  const navigate = useNavigate();
  return (
    <motion.button
      onClick={() => navigate('/chatbot')}
      className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-50 transition-all duration-300"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.2 }}
      title="Start New Chat"
    >
      <FaComments className="text-xl" />
    </motion.button>
  );
});

const Chatbot = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user: authUser } = useAuth(); // Get auth context
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false);
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      content: 'Hello! I\'m your AI agricultural assistant. How can I help you with farming today?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [chatMode, setChatMode] = useState('public_advisor'); // Default to public advisor
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting, connected, disconnected
  const [errorMessage, setErrorMessage] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  // Determine if user is authenticated
  const isAuthenticated = authAPI.isAuthenticated();

  // Function to toggle between modes (only available for authenticated users)
  const toggleChatMode = useCallback(() => {
    if (!isAuthenticated) return; // Prevent toggle for non-authenticated users
    
    const newMode = chatMode === 'my_farm' ? 'public_advisor' : 'my_farm';
    setChatMode(newMode);
    
    // Add a system message to inform about the mode change
    const modeChangeMessage = {
      type: 'bot',
      content: newMode === 'my_farm' 
        ? '🌾 **Switched to My Farm mode** - I now have access to your personal farm data and can provide personalized recommendations!'
        : '🌍 **Switched to Public Advisor mode** - I\'m now providing general agricultural advice without using your personal data.',
      timestamp: new Date(),
      isSystemMessage: true
    };
    
    setMessages(prev => [...prev, modeChangeMessage]);
  }, [chatMode, isAuthenticated]);

  // Check user authentication and profile on component mount
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Check if user is authenticated
        const isUserAuthenticated = authAPI.isAuthenticated();
        
        if (isUserAuthenticated) {
          // Set initial mode to my_farm for authenticated users
          setChatMode('my_farm');
          
          // Get user profile for personalized mode
          try {
            const profileResponse = await authAPI.getProfile();
            if (profileResponse.success && profileResponse.data) {
              setUserProfile(profileResponse.data);
              console.log('User profile loaded:', profileResponse.data);
              // Log specific fields we need to ensure they're available
              console.log('User ID in profile:', profileResponse.data.id);
            }
          } catch (error) {
            console.log('Profile not available, using standard UI');
          }

          // Load existing conversation if conversationId is provided
          if (conversationId) {
            try {
              const response = await conversationAPI.getConversation(conversationId);
              if (response.success && response.data && response.data.messages) {
                // Load existing messages
                const formattedMessages = response.data.messages.map(msg => ({
                  type: msg.role === 'user' ? 'user' : 'bot',
                  content: msg.content,
                  timestamp: new Date(msg.timestamp || Date.now())
                }));
                
                setMessages(formattedMessages);
                setCurrentConversationId(conversationId);
                setShowQuickQuestions(false); // Hide quick questions for existing conversations
                console.log('Loaded existing conversation:', conversationId);
              }
            } catch (error) {
              console.error('Failed to load conversation:', error);
              // If conversation doesn't exist or user doesn't have access, redirect to new chat
              navigate('/chatbot', { replace: true });
            }
          } else {
            // Reset to initial state for new conversation
            setMessages([{
              type: 'bot',
              content: 'Hello! I\'m your AI agricultural assistant. How can I help you with farming today?',
              timestamp: new Date()
            }]);
            setCurrentConversationId(null);
            setShowQuickQuestions(true);
          }
        } else {
          // For non-authenticated users, force public_advisor mode
          setChatMode('public_advisor');
          console.log('User not authenticated, using public advisor mode');
        }

        // Check chatbot service health
        try {
          await chatbotAPI.checkHealth();
          setConnectionStatus('connected');
          console.log('Chatbot service is healthy');
        } catch (error) {
          setConnectionStatus('disconnected');
          setErrorMessage('AI services are currently unavailable. Some features may be limited.');
          console.error('Chatbot health check failed:', error);
        }
      } catch (error) {
        console.error('Chat initialization failed:', error);
        setConnectionStatus('disconnected');
      }
    };

    initializeChat();
  }, [conversationId, navigate]);

  // Reduced animation variants for better mobile performance
  const reducedMotion = useMemo(() => ({
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -5, transition: { duration: 0.1 } }
  }), []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Optimized image preloading with lazy loading
  useEffect(() => {
    const preloadImage = () => {
      const image = new Image();
      image.onload = () => setBackgroundImageLoaded(true);
      image.src = '/assets/desktop-wallpaper-rice-agriculture-field-golden-hour-grass.jpg';
    };
    
    // Delay image loading to improve initial page load
    const timer = setTimeout(preloadImage, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (inputMessage.trim() && connectionStatus !== 'disconnected') {
      // Add user message
      const userMessage = {
        type: 'user',
        content: inputMessage,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      const currentInput = inputMessage;
      setInputMessage('');
      setIsTyping(true);
      setLoadingMessage('Thinking...');
      setErrorMessage(null);

      try {
        // Progressive loading messages with slower timing
        setTimeout(() => setLoadingMessage('Analyzing your query...'), 1500);
        setTimeout(() => setLoadingMessage('Calling datasets and tools...'), 3500);
        setTimeout(() => setLoadingMessage('Decision engine optimizing...'), 6000);
        setTimeout(() => setLoadingMessage('Generating response...'), 8500);

        // Build conversation history for context
        const conversationHistory = messages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

        // Prepare request payload
        const requestPayload = {
          message: currentInput,
          conversation: conversationHistory,
          conversationId: currentConversationId, // Include current conversation ID
          mode: chatMode // Send the current mode selection to backend
        };

        // Add profile data when available and in my_farm mode
        if (userProfile && chatMode === 'my_farm') {
          // Provide profile in a simple, LLM-friendly format - just flat key-value pairs
          requestPayload.profile = {
            user_id: userProfile.id, // CRITICAL: Using 'id' not '_id' as returned by API
            state: userProfile.state || userProfile.location?.state,
            district: userProfile.district || userProfile.location?.district,
            lat: userProfile.lat || userProfile.latitude || userProfile.location?.lat,
            lon: userProfile.lon || userProfile.lng || userProfile.longitude || userProfile.location?.lon,
            farm_size: userProfile.farmSize || userProfile.land_area_acres,
            soil_type: userProfile.soilType || userProfile.soil_type,
            irrigation: userProfile.irrigationType || userProfile.irrigation
          };
          
          // Remove undefined/null values for cleaner object
          Object.keys(requestPayload.profile).forEach(key => {
            if (requestPayload.profile[key] === undefined || requestPayload.profile[key] === null) {
              delete requestPayload.profile[key];
            }
          });
          
          console.log("Sending simplified profile to AI engine:", requestPayload.profile);
        }

        console.log('Sending chat request with mode:', chatMode, requestPayload);

        // Call the chatbot API
        const response = await chatbotAPI.sendMessage(requestPayload);

        if (response.success && response.data) {
          const botResponse = {
            type: 'bot',
            content: response.data.answer,
            timestamp: new Date(),
            metadata: {
              intent: response.data.llm1?.intent,
              requestId: response.data._meta?.requestId,
              timings: response.data._meta?.timings
            }
          };
          
          setMessages(prev => [...prev, botResponse]);
          
          // Update conversation ID if a new one was created
          if (response.data.conversationId && !currentConversationId) {
            setCurrentConversationId(response.data.conversationId);
            // Redirect to conversation URL if we're on the base /chatbot route
            if (!conversationId) {
              navigate(`/chatbot/${response.data.conversationId}`, { replace: true });
            }
          }
          
          console.log('Chat response received:', {
            intent: response.data.llm1?.intent,
            responseTime: response.data._meta?.timings?.total_ms,
            requestId: response.data._meta?.requestId,
            conversationId: response.data.conversationId
          });
        } else {
          throw new Error(response.message || 'Failed to get response from AI');
        }
      } catch (error) {
        console.error('Chat request failed:', error);
        
        // Create user-friendly error messages
        let userFriendlyMessage = "I'm sorry, I'm having trouble processing your request right now.";
        
        const errorMessage = error.message || '';
        
        if (errorMessage.includes('timeout') || errorMessage.includes('LLM1_INVALID_RESPONSE')) {
          userFriendlyMessage = "I'm taking longer than usual to respond. Please try asking your question again.";
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          userFriendlyMessage = "I'm having connectivity issues. Please check your internet connection and try again.";
        } else if (errorMessage.includes('500') || errorMessage.includes('server')) {
          userFriendlyMessage = "Our AI services are temporarily unavailable. Please try again in a few moments.";
        } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          userFriendlyMessage = "Your session has expired. Please refresh the page and try again.";
        } else {
          userFriendlyMessage = "Something went wrong. Please try again, and if the problem persists, contact our support team.";
        }
        
        // Add error message to chat
        const errorResponse = {
          type: 'bot',
          content: userFriendlyMessage,
          timestamp: new Date(),
          isError: true
        };
        
        setMessages(prev => [...prev, errorResponse]);
        setErrorMessage('Request failed'); // Keep technical details out of UI
      } finally {
        setIsTyping(false);
        setLoadingMessage('');
      }
    } else if (connectionStatus === 'disconnected') {
      setErrorMessage('AI services are currently unavailable. Please try again later.');
    }
  }, [inputMessage, messages, userProfile, connectionStatus, currentConversationId, conversationId, navigate]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Conversation management functions
  const handleConversationSelect = useCallback((conversation) => {
    if (conversation && conversation._id) {
      // Navigate to the conversation URL
      navigate(`/chatbot/${conversation._id}`);
    }
  }, [navigate]);

  const handleNewConversation = useCallback(() => {
    // Navigate to base chatbot route for new conversation
    navigate('/chatbot');
  }, [navigate]);

  // Memoized quick questions to prevent re-renders
  const quickQuestions = useMemo(() => {
    // Show personalized questions if user profile is available and in my_farm mode
    if (isAuthenticated && chatMode === 'my_farm') {
      return [
        "What crops should I plant this season?",
        "How to manage pests in my crops?",
        "Current weather forecast for my farm",
        "Market prices for my crops"
      ];
    } else {
      // Default questions for public advisor mode
      return [
        "What crops grow best in Karnataka?",
        "How to control white fly in cotton?", 
        "Best fertilizers for wheat crop",
        "Organic farming techniques"
      ];
    }
  }, [isAuthenticated, chatMode]);

  // Utility function to render text with bold formatting
  const renderFormattedText = (text) => {
    if (!text) return '';
    
    // Split text by **bold** markers and render accordingly
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove ** markers and render as bold
        const boldText = part.slice(2, -2);
        return <strong key={index} className="font-semibold text-green-700">{boldText}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="h-screen bg-gray-50 relative overflow-hidden page-wrapper"
      style={{
        minHeight: '100svh',     /* stable on iOS 16+ */
        minHeight: '100dvh',     /* newer devices */
        minHeight: '100vh'       /* fallback */
      }}
    >
      {/* Red Cross Button - Simplified animations */}
      <motion.button
        onClick={() => navigate('/')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="fixed top-4 right-4 md:top-6 md:right-6 z-50 w-10 h-10 md:w-12 md:h-12 bg-red-500/90 backdrop-blur-sm border border-red-400/50 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-all duration-200 shadow-lg hover:shadow-red-500/25"
      >
        <FaTimes className="text-sm md:text-lg" />
      </motion.button>

      {/* Background with simplified effects */}
      <div className="absolute inset-0 z-0">
        {/* Gradient Fallback - Shows immediately while image loads */}
        <div className="w-full h-full bg-gradient-to-br from-secondary-200 via-yellow-100 to-secondary-400" />
        
        {/* Actual Background Image - Simple fade in when loaded */}
        <div 
          className={`w-full h-full bg-section absolute inset-0 transition-opacity duration-500 ${
            backgroundImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundImage: backgroundImageLoaded ? `url('/assets/desktop-wallpaper-rice-agriculture-field-golden-hour-grass.jpg')` : 'none',
            filter: 'brightness(0.9) contrast(1.1) blur(1px)'
          }}
        />
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-gray-50/80 to-blue-50/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent" />
      </div>

      {/* Simplified glow effects - static instead of animated */}
      <div className="absolute top-1/4 left-1/4 w-32 h-32 md:w-64 md:h-64 bg-gradient-radial from-emerald-300/15 to-transparent rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-1/4 right-1/4 w-24 h-24 md:w-48 md:h-48 bg-gradient-radial from-blue-300/10 to-transparent rounded-full blur-3xl opacity-20" />

      {/* Main Chat Container */}
      <div className="relative z-10 h-screen flex flex-col p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
        
        {/* Chat Header */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-2 sm:p-3 md:p-4 mb-3 sm:mb-4 md:mb-6 shadow-xl flex-shrink-0"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
              {/* Sidebar Toggle Button */}
              {authAPI.isAuthenticated() && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                  title="Conversation History"
                >
                  <FaHistory className="text-gray-600 text-sm sm:text-base" />
                </button>
              )}
              
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <FaRobot className="text-white text-sm sm:text-lg md:text-xl" />
                </div>
                <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded-full border-2 border-white ${
                  connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`}></div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center flex-1 min-w-0">
                <h1 className="text-gray-800 text-base sm:text-lg md:text-xl font-bold truncate">AI Agricultural Assistant</h1>
                
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 sm:mt-0 sm:ml-3">
                  <p className={`text-2xs sm:text-xs md:text-sm whitespace-nowrap ${
                    connectionStatus === 'connected' ? 'text-emerald-600' :
                    connectionStatus === 'connecting' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {connectionStatus === 'connected' ? 'Online • Ready to help' :
                     connectionStatus === 'connecting' ? 'Connecting...' :
                     'Offline • Limited features'}
                  </p>
                  
                </div>
              </div>
            </div>

            {/* Mode Toggle Button - Only show for authenticated users */}
            {isAuthenticated && (
              <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                <span className="text-xs text-gray-600 hidden sm:inline">Mode:</span>
                <button
                  onClick={toggleChatMode}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-all duration-200 hover:shadow-md ${
                    chatMode === 'my_farm'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  }`}
                  title={`Currently in ${chatMode === 'my_farm' ? 'My Farm' : 'Public Advisor'} mode. Click to toggle.`}
                >
                  {chatMode === 'my_farm' ? (
                    <>
                      <FaUserTie className="text-xs" />
                      <span className="text-xs font-medium">My Farm</span>
                      <FaToggleOn className="text-sm" />
                    </>
                  ) : (
                    <>
                      <FaGlobe className="text-xs" />
                      <span className="text-xs font-medium">Public</span>
                      <FaToggleOff className="text-sm" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          
          {/* Error message display */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 sm:mt-3 p-1.5 sm:p-2 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2"
            >
              <FaExclamationTriangle className="text-red-500 text-xs sm:text-sm flex-shrink-0" />
              <p className="text-red-700 text-2xs sm:text-xs flex-1">{errorMessage}</p>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-500 hover:text-red-700 flex-shrink-0"
              >
                <FaTimes className="text-2xs sm:text-xs" />
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* Chat Messages Area */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={`flex-1 bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 overflow-hidden shadow-xl min-h-0 ${
            showQuickQuestions ? 'mb-4 md:mb-6' : 'mb-3 md:mb-4'
          }`}
        >
          <div className="h-full overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 scrollbar-thin scrollbar-thumb-emerald-400/50 scrollbar-track-gray-100/50">
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  variants={reducedMotion}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[280px] sm:max-w-xs md:max-w-md lg:max-w-lg flex items-start space-x-2 md:space-x-3 ${
                    message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    {/* Avatar */}
                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                        : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                    }`}>
                      {message.type === 'user' ? 
                        <FaUser className="text-white text-xs" /> : 
                        <FaRobot className="text-white text-xs" />
                      }
                    </div>
                    
                    {/* Message Bubble */}
                    <div className={`px-3 md:px-4 py-2 md:py-3 rounded-2xl backdrop-blur-sm border transition-opacity duration-200 ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-br from-blue-500/90 to-purple-600/90 text-white border-blue-400/50 rounded-br-md' 
                        : message.isError
                          ? 'bg-gradient-to-br from-red-50/90 to-red-100/90 text-red-800 border-red-200/50 rounded-bl-md'
                          : message.isSystemMessage
                            ? 'bg-gradient-to-br from-amber-50/90 to-yellow-100/90 text-amber-800 border-amber-200/50 rounded-bl-md'
                            : 'bg-white/80 text-gray-800 border-gray-200/50 rounded-bl-md'
                    } shadow-lg`}>
                      <div className="text-xs md:text-sm leading-relaxed">
                        {renderFormattedText(message.content)}
                      </div>
                      
                      {/* Metadata for bot messages */}
                      {message.type === 'bot' && message.metadata && (
                        <div className="mt-2 pt-2 border-t border-gray-200/50">
                          <div className="flex items-center space-x-3 text-xs text-gray-500">
                            {message.metadata.timings?.total_ms && (
                              <span className="flex items-center space-x-1">
                                <FaCheckCircle className="text-green-500" />
                                <span>{message.metadata.timings.total_ms}ms</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <p className={`text-xs mt-1 md:mt-2 ${
                        message.type === 'user' ? 'text-blue-100' : 
                        message.isError ? 'text-red-600' : 
                        message.isSystemMessage ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  variants={reducedMotion}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex justify-start"
                >
                  <div className="flex items-start space-x-2 md:space-x-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                      <FaRobot className="text-white text-xs" />
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl rounded-bl-md px-3 md:px-4 py-2 md:py-3">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        {loadingMessage && (
                          <span 
                            key={loadingMessage}
                            className="text-sm text-gray-600 ml-2 animate-text-fade"
                          >
                            {loadingMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div ref={messagesEndRef} />
          </div>
        </motion.div>

        {/* Quick Questions - Simplified animations */}
        <AnimatePresence>
          {showQuickQuestions && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-3 md:mb-4 flex-shrink-0"
            >
              {/* Quick Questions Header with Toggle */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 text-sm font-medium">Quick Questions</span>
                <button
                  onClick={() => setShowQuickQuestions(false)}
                  className="w-6 h-6 bg-gray-100/80 backdrop-blur-sm border border-gray-200/50 rounded-full flex items-center justify-center text-gray-600 hover:bg-red-100/80 hover:border-red-300/50 hover:text-red-600 transition-all duration-200"
                  title="Hide quick questions"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
              
              {/* Quick Questions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {quickQuestions.map((question, index) => (
                  <motion.button
                    key={index}
                    onClick={() => setInputMessage(question)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="p-2 md:p-3 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-xl text-gray-700 text-xs md:text-sm hover:bg-white/80 hover:border-emerald-400/50 transition-all duration-200 text-left shadow-sm"
                  >
                    {question}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show Quick Questions Button (when hidden) */}
        <AnimatePresence>
          {!showQuickQuestions && (
            <motion.button
              onClick={() => setShowQuickQuestions(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-3 md:mb-4 w-full p-2 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-xl text-gray-700 text-sm hover:bg-white/80 hover:border-emerald-400/50 transition-all duration-200 flex items-center justify-center space-x-2 flex-shrink-0 shadow-sm"
            >
              <FaEye className="text-xs" />
              <span>Show Quick Questions</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Chat Input */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-3 md:p-4 shadow-xl flex-shrink-0"
        >
          <div className="flex space-x-2 md:space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={connectionStatus === 'connected' 
                  ? "Ask me about crops, weather, farming techniques..." 
                  : "AI services are currently unavailable..."}
                disabled={connectionStatus === 'disconnected' || isTyping}
                className={`w-full px-3 md:px-4 py-2 md:py-3 bg-white/80 backdrop-blur-sm border rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none transition-all duration-200 resize-none h-10 md:h-12 overflow-hidden text-sm md:text-base ${
                  connectionStatus === 'disconnected' 
                    ? 'border-red-200/50 bg-red-50/50 cursor-not-allowed' 
                    : 'border-gray-200/50 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400/50'
                }`}
                rows="1"
              />
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping || connectionStatus === 'disconnected'}
              className={`px-4 md:px-6 py-2 md:py-3 text-white rounded-xl transition-all duration-200 flex items-center space-x-1 md:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                connectionStatus === 'disconnected'
                  ? 'bg-gray-400'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 hover:shadow-emerald-500/25'
              }`}
            >
              {isTyping ? (
                <FaSpinner className="text-xs md:text-sm animate-spin" />
              ) : (
                <FaPaperPlane className="text-xs md:text-sm" />
              )}
            </button>
            
            {/* Speech-to-Text Component */}
            <SpeechToText
              onTranscript={(transcript, isInterim = false) => {
                if (isInterim) {
                  // For interim results, replace only the voice input part
                  // We need to track what was there before voice input started
                  setInputMessage(transcript);
                } else {
                  // For final results, set the final text (interim is replaced, not appended)
                  setInputMessage(transcript);
                }
              }}
              userPreferredLanguage={userProfile?.preferred_language || 'en'}
              size="normal"
              forceDirection="up"
              className={connectionStatus === 'disconnected' ? 'opacity-50 pointer-events-none' : ''}
            />
          </div>
          
          {/* Connection status indicator */}
        </motion.div>
      </div>

      {/* Conversation Sidebar */}
      <ConversationSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        currentConversationId={currentConversationId}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
      />
    </div>
  );
};

export default Chatbot;
