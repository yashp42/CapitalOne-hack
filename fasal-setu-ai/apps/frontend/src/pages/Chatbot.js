import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const Chatbot = () => {
  const { user } = useAuth();

  return (
    <motion.div 
      className="container mx-auto p-8"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Welcome Section */}
      <motion.div 
        className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Welcome to AI Chatbot, {user?.firstName}!
        </h1>
        <p className="text-gray-600">
          Your personalized agricultural assistant is ready to help.
        </p>
        <div className="mt-4 text-sm text-gray-500">
          <p><strong>Phone:</strong> {user?.phoneNumber}</p>
          <p><strong>Account Created:</strong> {new Date(user?.createdAt).toLocaleDateString()}</p>
        </div>
      </motion.div>

      {/* Chatbot Interface */}
      <motion.div 
        className="bg-white rounded-2xl shadow-lg p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <motion.h2 
          className="text-2xl font-bold text-gray-800 mb-4"
          initial={{ opacity: 0, rotate: -10 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          AI Agricultural Assistant
        </motion.h2>
        
        {/* Placeholder for chatbot interface */}
        <motion.div 
          className="bg-gray-50 rounded-lg p-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div className="text-6xl mb-4">🤖</div>
          <p className="text-gray-600 mb-4">
            Chatbot interface will be integrated here.
          </p>
          <p className="text-sm text-gray-500">
            Ask me about crops, weather, market prices, and farming best practices!
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default Chatbot;
