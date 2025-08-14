import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Navbar = () => {
  return (
    <motion.nav 
      className="bg-primary text-white p-4"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto flex justify-between items-center">
        <motion.div 
          className="text-xl font-bold"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Link to="/">FasalSetu.ai</Link>
        </motion.div>
        <ul className="flex space-x-6">
          <motion.li whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
            <Link to="/" className="hover:text-secondary-200 transition-colors">
              Home
            </Link>
          </motion.li>
          <motion.li whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
            <Link to="/chatbot" className="hover:text-secondary-200 transition-colors">
              Chatbot
            </Link>
          </motion.li>
          <motion.li whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
            <Link to="/login" className="hover:text-secondary-200 transition-colors">
              Login
            </Link>
          </motion.li>
        </ul>
      </div>
    </motion.nav>
  );
};

export default Navbar;
