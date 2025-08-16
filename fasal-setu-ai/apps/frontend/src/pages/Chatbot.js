import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPaperPlane, FaMicrophone, FaRobot, FaUser, FaTimes, FaEyeSlash, FaEye } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import FloatingChatButton from '../components/FloatingChatButton';

const Chatbot = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      content: 'Hello! I\'m your AI agricultural assistant. How can I help you with farming today?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
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

      // Simulate AI thinking delay
      setTimeout(() => {
        const botResponse = {
          type: 'bot',
          content: `Thank you for your question about "${currentInput}". I'm here to help with agricultural advice! In the full version, I would provide detailed insights based on real-time data.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botResponse]);
        setIsTyping(false);
      }, 1500);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickQuestions = [
    "What crops grow best in my region?",
    "Current weather forecast",
    "Market prices for wheat",
    "Pest control advice"
  ];

  return (
    <div className="h-screen bg-gray-50 relative overflow-hidden">
      {/* Red Cross Button - Fixed Position */}
      <motion.button
        onClick={() => navigate('/')}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        className="fixed top-4 right-4 md:top-6 md:right-6 z-50 w-10 h-10 md:w-12 md:h-12 bg-red-500/90 backdrop-blur-sm border border-red-400/50 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-all duration-300 shadow-lg hover:shadow-red-500/25"
      >
        <FaTimes className="text-sm md:text-lg" />
      </motion.button>

      {/* Background with blur effects */}
      <div className="absolute inset-0 z-0">
        <div 
          className="w-full h-full bg-cover bg-center bg-fixed"
          style={{
            backgroundImage: `url('/assets/desktop-wallpaper-rice-agriculture-field-golden-hour-grass.jpg')`,
            filter: 'brightness(0.9) contrast(1.1) blur(1px)'
          }}
        />
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-gray-50/80 to-blue-50/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent" />
      </div>

      {/* Animated Glow Effects */}
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
        className="absolute top-1/4 left-1/4 w-32 h-32 md:w-64 md:h-64 bg-gradient-radial from-emerald-300/20 to-transparent rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1.1, 1, 1.1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute bottom-1/4 right-1/4 w-24 h-24 md:w-48 md:h-48 bg-gradient-radial from-blue-300/15 to-transparent rounded-full blur-3xl"
      />

      {/* Main Chat Container */}
      <div className="relative z-10 h-screen flex flex-col p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
        
        {/* Chat Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-3 md:p-4 mb-4 md:mb-6 shadow-xl flex-shrink-0"
        >
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="relative">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                <FaRobot className="text-white text-lg md:text-xl" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded-full animate-pulse border-2 border-white"></div>
            </div>
            <div>
              <h1 className="text-gray-800 text-lg md:text-xl font-bold">AI Agricultural Assistant</h1>
              <p className="text-emerald-600 text-xs md:text-sm">Online • Ready to help</p>
            </div>
          </div>
        </motion.div>

        {/* Chat Messages Area */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`flex-1 bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 overflow-hidden shadow-xl min-h-0 ${
            showQuickQuestions ? 'mb-4 md:mb-6' : 'mb-3 md:mb-4'
          }`}
        >
          <div className="h-full overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 scrollbar-thin scrollbar-thumb-emerald-400/50 scrollbar-track-gray-100/50">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
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
                    <div className={`px-3 md:px-4 py-2 md:py-3 rounded-2xl backdrop-blur-sm border ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-br from-blue-500/90 to-purple-600/90 text-white border-blue-400/50 rounded-br-md' 
                        : 'bg-white/80 text-gray-800 border-gray-200/50 rounded-bl-md'
                    } shadow-lg`}>
                      <p className="text-xs md:text-sm leading-relaxed">{message.content}</p>
                      <p className={`text-xs mt-1 md:mt-2 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex justify-start"
                >
                  <div className="flex items-start space-x-2 md:space-x-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                      <FaRobot className="text-white text-xs" />
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl rounded-bl-md px-3 md:px-4 py-2 md:py-3">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div ref={messagesEndRef} />
          </div>
        </motion.div>

        {/* Quick Questions */}
        <AnimatePresence>
          {showQuickQuestions && (
            <motion.div 
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-3 md:mb-4 flex-shrink-0"
            >
              {/* Quick Questions Header with Toggle */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 text-sm font-medium">Quick Questions</span>
                <motion.button
                  onClick={() => setShowQuickQuestions(false)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-6 h-6 bg-gray-100/80 backdrop-blur-sm border border-gray-200/50 rounded-full flex items-center justify-center text-gray-600 hover:bg-red-100/80 hover:border-red-300/50 hover:text-red-600 transition-all duration-300"
                  title="Hide quick questions"
                >
                  <FaTimes className="text-xs" />
                </motion.button>
              </div>
              
              {/* Quick Questions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {quickQuestions.map((question, index) => (
                  <motion.button
                    key={index}
                    onClick={() => setInputMessage(question)}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="p-2 md:p-3 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-xl text-gray-700 text-xs md:text-sm hover:bg-white/80 hover:border-emerald-400/50 transition-all duration-300 text-left shadow-sm"
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
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mb-3 md:mb-4 w-full p-2 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-xl text-gray-700 text-sm hover:bg-white/80 hover:border-emerald-400/50 transition-all duration-300 flex items-center justify-center space-x-2 flex-shrink-0 shadow-sm"
            >
              <FaEye className="text-xs" />
              <span>Show Quick Questions</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Chat Input */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-3 md:p-4 shadow-xl flex-shrink-0"
        >
          <div className="flex space-x-2 md:space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about crops, weather, farming techniques..."
                className="w-full px-3 md:px-4 py-2 md:py-3 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400/50 transition-all duration-300 resize-none h-10 md:h-12 overflow-hidden text-sm md:text-base"
                rows="1"
              />
            </div>
            
            <motion.button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-400 hover:to-emerald-500 transition-all duration-300 flex items-center space-x-1 md:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-500/25"
            >
              <FaPaperPlane className="text-xs md:text-sm" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 md:px-4 py-2 md:py-3 bg-gray-200/80 backdrop-blur-sm text-gray-600 rounded-xl hover:bg-gray-300/80 transition-all duration-300 border border-gray-200/50"
            >
              <FaMicrophone className="text-xs md:text-sm" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Chatbot;
