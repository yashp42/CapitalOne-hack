import React from 'react';
import { motion } from 'framer-motion';

const Login = () => {
  return (
    <motion.div 
      className="container mx-auto p-8"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <motion.h1 
        className="text-3xl font-bold text-gray-800 mb-4"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        Login
      </motion.h1>
      <motion.p 
        className="text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        Login form will be added here.
      </motion.p>
    </motion.div>
  );
};

export default Login;
