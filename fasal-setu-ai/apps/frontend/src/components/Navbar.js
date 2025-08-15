import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout, authKey } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Debug logging
  console.log('Navbar render - User:', user, 'isAuthenticated:', isAuthenticated, 'authKey:', authKey);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    console.log('Navbar: Starting logout...');
    
    try {
      const result = await logout();
      console.log('Navbar: Logout result:', result);
      
      if (result.success) {
        console.log('Navbar: Logout successful, navigating to home');
        navigate('/', { replace: true });
      } else {
        console.error('Navbar: Logout failed:', result.message);
        // Still navigate even if logout had issues
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Navbar: Logout error:', error);
      // Navigate anyway to ensure user is taken to public page
      navigate('/', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

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
        
        <div className="flex items-center space-x-6">
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
          </ul>

          {/* Authentication Section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <>
                {/* User Info */}
                <motion.div 
                  className="text-sm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-secondary-200">Welcome, </span>
                  <span className="font-medium">{user.firstName}</span>
                </motion.div>
                
                {/* Logout Button */}
                <motion.button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="bg-secondary-500 hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </motion.button>
              </>
            ) : (
              /* Login Button */
              <motion.div whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
                <Link 
                  to="/login" 
                  className="bg-secondary-500 hover:bg-secondary-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Login
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
