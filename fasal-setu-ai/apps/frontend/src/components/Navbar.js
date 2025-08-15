import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { FaBars, FaTimes, FaHome, FaRobot, FaSignInAlt, FaSignOutAlt, FaUser } from 'react-icons/fa';

const Navbar = () => {
  const { user, isAuthenticated, logout, authKey } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect for navbar transparency
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  // Debug logging
  console.log('Navbar render - User:', user, 'isAuthenticated:', isAuthenticated, 'authKey:', authKey);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

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

  const navItems = [
    { to: '/', label: 'Home', icon: FaHome },
    { to: '/chatbot', label: 'Chatbot', icon: FaRobot },
  ];

  return (
    <>
      {/* Floating Navbar */}
      <motion.nav 
        className="fixed top-4 left-4 right-4 z-40 rounded-2xl bg-primary-600/60 backdrop-blur-sm shadow-lg border border-primary-500"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="px-4 sm:px-6 py-3">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <motion.div 
              className="flex items-center"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link 
                to="/" 
                className="text-lg sm:text-xl font-bold text-white hover:text-primary-200 transition-colors"
              >
                FasalSetu.ai
              </Link>
            </motion.div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => (
                <motion.div
                  key={item.to}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Link 
                    to={item.to}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      location.pathname === item.to
                        ? 'bg-primary-700 text-white border border-primary-500'
                        : 'text-primary-100 hover:text-white hover:bg-primary-700'
                    }`}
                  >
                    <item.icon className="text-xs" />
                    <span>{item.label}</span>
                  </Link>
                </motion.div>
              ))}
              
              {/* Desktop Auth Section */}
              <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-primary-400">
                {isAuthenticated && user ? (
                  <>
                    <div className="flex items-center space-x-2 text-sm text-primary-100">
                      <FaUser className="text-xs text-primary-200" />
                      <span className="hidden lg:inline">{user.firstName}</span>
                    </div>
                    <motion.button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FaSignOutAlt className="text-xs" />
                      <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                    </motion.button>
                  </>
                ) : (
                  <motion.div whileHover={{ scale: 1.05 }}>
                    <Link 
                      to="/login" 
                      className="flex items-center space-x-2 bg-secondary-500 hover:bg-secondary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    >
                      <FaSignInAlt className="text-xs" />
                      <span>Login</span>
                    </Link>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              onClick={toggleSidebar}
              className="md:hidden p-2 rounded-lg text-primary-100 hover:text-white hover:bg-primary-700 transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSidebarOpen ? (
                <FaTimes className="text-lg" />
              ) : (
                <FaBars className="text-lg" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/20 z-30 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
            />
            
            {/* Sidebar */}
            <motion.div
              className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-primary-600 border-l border-primary-500 shadow-2xl z-40 md:hidden"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="p-6">
                {/* Sidebar Header */}
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-white">Menu</h3>
                  <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-lg text-primary-200 hover:text-white hover:bg-primary-700 transition-all duration-200"
                  >
                    <FaTimes className="text-lg" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-3 mb-8">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        location.pathname === item.to
                          ? 'bg-primary-700 text-white border border-primary-500'
                          : 'text-primary-100 hover:text-white hover:bg-primary-700'
                      }`}
                    >
                      <item.icon className="text-lg" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>

                {/* Mobile Auth Section */}
                <div className="border-t border-primary-500 pt-6">
                  {isAuthenticated && user ? (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 px-4 py-3 bg-primary-700 rounded-xl">
                        <FaUser className="text-primary-200" />
                        <div>
                          <p className="text-sm font-medium text-white">Welcome back!</p>
                          <p className="text-xs text-primary-200">{user.firstName}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
                      >
                        <FaSignOutAlt />
                        <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                      </button>
                    </div>
                  ) : (
                    <Link 
                      to="/login" 
                      className="w-full flex items-center justify-center space-x-3 bg-secondary-500 hover:bg-secondary-600 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200"
                    >
                      <FaSignInAlt />
                      <span>Login</span>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
