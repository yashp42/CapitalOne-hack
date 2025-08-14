import React from 'react';
import { motion } from 'framer-motion';

const Chatbot = () => {
  return (
    <motion.div 
      className="container mx-auto p-8"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <motion.h1 
        className="text-3xl font-bold text-gray-800 mb-4"
        initial={{ opacity: 0, rotate: -10 }}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
      >
        AI Chatbot
      </motion.h1>
      <motion.p 
        className="text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        Chatbot interface will be added here.
      </motion.p>
    </motion.div>
  );
};

export default Chatbot;
