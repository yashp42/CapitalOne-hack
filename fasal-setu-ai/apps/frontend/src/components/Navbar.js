import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { preloadComponent } from '../utils/loadable';
import { FaBars, FaTimes, FaHome, FaRobot, FaSignInAlt, FaSignOutAlt, FaUser, FaSeedling } from 'react-icons/fa';

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

  // Basic nav items for all users with preloading
  const publicNavItems = [
    { 
      to: '/', 
      label: 'Home', 
      icon: FaHome,
      preload: () => preloadComponent(() => import('../pages/Home'))
    },
    { 
      to: '/chatbot', 
      label: 'Chatbot', 
      icon: FaRobot,
      preload: () => preloadComponent(() => import('../pages/Chatbot'))
    },
  ];
  
  // Additional nav items for authenticated users with preloading
  const privateNavItems = [
    { 
      to: '/my-farm', 
      label: 'My Farm', 
      icon: FaSeedling,
      preload: () => preloadComponent(() => import('../pages/MyFarm'))
    },
  ];
  
  // Combine nav items based on authentication status
  const navItems = isAuthenticated ? 
    [...publicNavItems, ...privateNavItems] :
    publicNavItems;

  return (
    <>
      {/* Navbar Wrapper */}
      <div className="fixed top-4 left-0 right-0 z-40 w-full flex justify-center px-4">
        {/* Floating Navbar */}
        <nav 
          className="w-full max-w-[2000px] min-h-[60px] rounded-2xl bg-primary-200 backdrop-blur-xl shadow-lg border border-gray-200/50 transition-all duration-300"
          style={{
            backdropFilter: 'blur(20px) saturate(150%)',
          }}
        >
        <div className="px-4 sm:px-6 py-3">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center">
              <Link 
                to="/" 
                className="text-lg sm:text-xl font-bold text-primary-600 hover:text-primary-700 transition-colors duration-200 hover:scale-105 transform"
                onMouseEnter={() => preloadComponent(() => import('../pages/Home'))}
              >
                FasalSetu.ai
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => (
                <div key={item.to} className="hover:scale-105 transform transition-transform duration-200">
                  <Link 
                    to={item.to}
                    onMouseEnter={item.preload}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      location.pathname === item.to
                        ? 'bg-primary-100 text-primary-700 border border-primary-200'
                        : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100/50'
                    }`}
                  >
                    <item.icon className="text-xs" />
                    <span>{item.label}</span>
                  </Link>
                </div>
              ))}
              
              {/* Desktop Auth Section */}
              <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-300">
                {isAuthenticated && user ? (
                  <>
                    <Link 
                      to="/profile"
                      onMouseEnter={() => preloadComponent(() => import('../pages/Profile'))}
                      className="flex items-center space-x-2 text-sm text-gray-600 hover:text-primary-600 transition-colors duration-200 px-2 py-1 rounded-lg hover:bg-gray-100/50"
                    >
                      <FaUser className="text-xs text-primary-500" />
                      <span className="hidden lg:inline">{user.firstName}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 hover:scale-105 transform"
                    >
                      <FaSignOutAlt className="text-xs" />
                      <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                    </button>
                  </>
                ) : (
                  <div className="hover:scale-105 transform transition-transform duration-200">
                    <Link 
                      to="/login" 
                      onMouseEnter={() => preloadComponent(() => import('../pages/Login'))}
                      className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    >
                      <FaSignInAlt className="text-xs" />
                      <span>Login</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleSidebar}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-gray-100/50 transition-all duration-200 hover:scale-105 transform"
            >
              {isSidebarOpen ? (
                <FaTimes className="text-lg" />
              ) : (
                <FaBars className="text-lg" />
              )}
            </button>
          </div>
        </div>
      </nav>
      </div>

      {/* Mobile Sidebar */}
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black/20 z-30 md:hidden transition-opacity duration-300 ${
            isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={toggleSidebar}
        />
        
        {/* Sidebar */}
        <div
          className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white/95 backdrop-blur-xl border-l border-gray-200/50 shadow-2xl z-40 md:hidden transform transition-transform duration-300 ease-out ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{
            backdropFilter: 'blur(20px) saturate(150%)',
          }}
        >
              <div className="p-6">
                {/* Sidebar Header */}
                <div className={`flex justify-between items-center mb-8 transition-all duration-300 transform ${
                  isSidebarOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`} style={{ transitionDelay: isSidebarOpen ? '100ms' : '0ms' }}>
                  <h3 className="text-xl font-bold text-gray-800">Menu</h3>
                  <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-gray-100/50 transition-all duration-200 hover:scale-105 transform"
                  >
                    <FaTimes className="text-lg" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-3 mb-8">
                  {navItems.map((item, index) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onMouseEnter={item.preload}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 transform ${
                        isSidebarOpen 
                          ? 'translate-x-0 opacity-100' 
                          : 'translate-x-4 opacity-0'
                      } ${
                        location.pathname === item.to
                          ? 'bg-primary-100 text-primary-700 border border-primary-200'
                          : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100/50'
                      }`}
                      style={{
                        transitionDelay: isSidebarOpen ? `${index * 50}ms` : '0ms'
                      }}
                    >
                      <item.icon className="text-lg" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>

                {/* Mobile Auth Section */}
                <div className={`border-t border-gray-200 pt-6 transition-all duration-300 transform ${
                  isSidebarOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`} style={{ transitionDelay: isSidebarOpen ? '250ms' : '0ms' }}>
                  {isAuthenticated && user ? (
                    <div className="space-y-4">
                      <Link
                        to="/profile"
                        className="flex items-center space-x-3 px-4 py-3 bg-gray-100/80 rounded-xl hover:bg-gray-200/80 transition-all duration-200"
                      >
                        <FaUser className="text-primary-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">Welcome back!</p>
                          <p className="text-xs text-gray-600">{user.firstName}</p>
                        </div>
                      </Link>
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
                      className="w-full flex items-center justify-center space-x-3 bg-primary-600 hover:bg-primary-700 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200"
                    >
                      <FaSignInAlt />
                      <span>Login</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
      </>
    </>
  );
};

export default Navbar;
