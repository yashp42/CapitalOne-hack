import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  FaRobot, 
  FaSeedling, 
  FaChartLine, 
  FaMoneyBillWave, 
  FaPhone, 
  FaEnvelope, 
  FaMapMarkerAlt
} from 'react-icons/fa';
import FloatingChatButton from '../components/FloatingChatButton';

const Home = () => {
  const [mounted, setMounted] = useState(false);
  const [currentLanguageIndex, setCurrentLanguageIndex] = useState(0);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [aboutImageLoaded, setAboutImageLoaded] = useState(false);
  const [mockupLoaded, setMockupLoaded] = useState(false);

  // Language variations for the tagline - focused on Kerala
  const taglineLanguages = [
    { text: "നിങ്ങളുടെ ബുദ്ധിമാനായ കൃഷി സഹചാരി", lang: "Malayalam" },
    { text: "Your Intelligent Farming Companion", lang: "English" },
    { text: "നിങ്ങളുടെ സ്മാർട്ട് കൃഷി ഉപദേഷ്ടാവ്", lang: "Malayalam" },
    { text: "Kerala's Smart Agriculture Partner", lang: "English" },
    { text: "உங்கள் அறிவார்ந்த விவசாய துணை", lang: "Tamil" },
    { text: "കേരളത്തിലെ കാർഷിക വിപ്ലവം", lang: "Malayalam" },
    { text: "ನಿಮ್ಮ ಬುದ್ಧಿವಂತ ಕೃಷಿ ಸಹಚರ", lang: "Kannada" },
    { text: "स्मार्ट खेती का साथी", lang: "Hindi" }
  ];

  useEffect(() => {
    setMounted(true);
    
    // Preload background images
    const preloadImages = () => {
      const heroImage = new Image();
      const aboutImage = new Image();
      
      heroImage.onload = () => setHeroImageLoaded(true);
      aboutImage.onload = () => setAboutImageLoaded(true);
      
      heroImage.src = '/assets/desktop-wallpaper-rice-agriculture-field-golden-hour-grass.jpg';
      aboutImage.src = '/assets/palladium,-india,-tribal-farmers,-fpo.jpg';
    };
    
    preloadImages();
    
    // Cycle through languages every 3 seconds
    const interval = setInterval(() => {
      setCurrentLanguageIndex((prev) => (prev + 1) % taglineLanguages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.35,
        ease: [0.2, 0.8, 0.2, 1] // Use easing instead of complex spring
      }
    }
  };

  const glowVariants = {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.4, 0.6, 0.4],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  // Animation for the spiral flip title
  const titleContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.3
      }
    }
  };

  const letterVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.8
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.35,
        ease: [0.2, 0.8, 0.2, 1] // Use easing instead of spring
      }
    }
  };

  // Animation for the gradient underline
  const underlineVariants = {
    hidden: {
      width: "0%",
      opacity: 0
    },
    visible: {
      width: "100%",
      opacity: 1,
      transition: {
        delay: 1.5, // Wait for title animation to complete
        duration: 1.2,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  };

  // Animation for language cycling tagline
  const taglineVariants = {
    enter: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.35,
        ease: [0.2, 0.8, 0.2, 1] // Use easing for better performance
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      transition: {
        duration: 0.25,
        ease: [0.2, 0.8, 0.2, 1]
      }
    }
  };

  // Split "Fasal Setu" into individual characters
  const titleText = "Fasal Setu";
  const titleLetters = titleText.split("").map((char, index) => ({
    char: char === " " ? "\u00A0" : char, // Use non-breaking space for spaces
    index
  }));

  const features = [
    {
      icon: <FaRobot className="text-2xl sm:text-3xl" />,
      title: "Malayalam AI Assistant",
      description: "24/7 available AI chatbot in Malayalam and English. Get expert guidance for rice, coconut, rubber, and spice cultivation specific to Kerala.",
      benefit: "Expert advice in Malayalam & English",
      link: "/chatbot"
    },
    {
      icon: <FaSeedling className="text-2xl sm:text-3xl" />,
      title: "Kerala Crop Simulation",
      description: "Predict growth for Kerala's major crops like rice, coconut, pepper, cardamom under monsoon conditions and tropical climate.",
      benefit: "Monsoon-optimized crop predictions",
      link: "/simulation"
    },
    {
      icon: <FaChartLine className="text-2xl sm:text-3xl" />,
      title: "Kerala Market Analytics",
      description: "Real-time analysis of Kerala's weather patterns, laterite soil conditions, spice market prices, and state agricultural policies.",
      benefit: "Kerala-specific market insights",
      link: "/insights"
    },
    {
      icon: <FaMoneyBillWave className="text-2xl sm:text-3xl" />,
      title: "Kerala Schemes & Finance",
      description: "Access Kerala state government schemes, cooperative bank loans, and optimal timing for coconut, rubber, and spice harvesting.",
      benefit: "Kerala govt schemes & co-op finance",
      link: "/finance"
    }
  ];

  const stats = [
    { number: "50K+", label: "Kerala Farmers", sublabel: "Target Community" },
    { number: "95%", label: "Monsoon Accuracy", sublabel: "Weather Predictions" },
    { number: "ML + EN", label: "Languages", sublabel: "Malayalam & English" },
    { number: "14", label: "Districts", sublabel: "Complete Kerala" }
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-x-hidden page-wrapper">
      {/* Hero Section */}
      <section className="relative bg-section overflow-hidden h-screen max-h-screen">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          {/* Gradient Fallback - Shows immediately while image loads */}
          <div className="w-full h-full bg-gradient-to-br from-green-200 via-yellow-100 to-green-300" />
          
          {/* Actual Background Image - Fades in when loaded */}
          <div 
            className={`w-full h-full bg-section absolute inset-0 transition-opacity duration-1000 ${
              heroImageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: heroImageLoaded ? `url('/assets/desktop-wallpaper-rice-agriculture-field-golden-hour-grass.jpg')` : 'none',
              filter: 'brightness(0.8) contrast(1.1)'
            }}
          />
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-gray-50/80 to-blue-50/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
        </div>

        {/* Animated Glow Effects */}
        <motion.div
          variants={glowVariants}
          animate="animate"
          className="absolute top-1/4 left-1/4 w-20 h-20 xs:w-32 xs:h-32 sm:w-64 sm:h-64 md:w-80 md:h-80 bg-gradient-radial from-primary-300/15 to-transparent rounded-full blur-3xl"
        />
        <motion.div
          variants={glowVariants}
          animate="animate"
          className="absolute bottom-1/4 right-1/4 w-16 h-16 xs:w-24 xs:h-24 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-gradient-radial from-secondary-300/10 to-transparent rounded-full blur-3xl"
        />

        {/* Hero Content */}
        <div className="relative z-10 h-full flex items-center px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 lg:pt-0 pb-4 lg:pb-0">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 h-full lg:items-center">
              {/* Left Content */}
              <motion.div 
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="flex flex-col justify-center space-y-2 sm:space-y-4 lg:space-y-6 text-center lg:text-left order-1 lg:order-1"
              >
                {/* Badge */}
                <motion.div 
                  variants={itemVariants}
                  className="flex justify-center lg:justify-start mt-4 sm:mt-6"
                >
                  <div className="inline-flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-primary-100/80 to-secondary-100/80 backdrop-blur-sm border border-primary-300/50">
                    <span className="text-primary-700 text-[10px] sm:text-xs font-medium text-center">AI Solutions for Kerala Farmers</span>
                  </div>
                </motion.div>

                {/* Title */}
                <div className="w-fit mx-auto lg:mx-0 relative">
                  <motion.h1 
                    initial="hidden"
                    animate="visible"
                    variants={titleContainerVariants}
                    className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight title-text-stability mobile-text-fix animating"
                    style={{ 
                      willChange: "opacity",
                      contain: "layout style paint"
                    }}
                    onAnimationComplete={() => {
                      const titleElement = document.querySelector('.title-text-stability');
                      if (titleElement) titleElement.classList.remove('animating');
                    }}
                  >
                    {titleLetters.map((letter, index) => (
                      <motion.span
                        key={index}
                        variants={letterVariants}
                        className="inline-block bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent"
                        style={{
                          display: "inline-block",
                          WebkitFontSmoothing: "antialiased",
                          fontSmooth: "always",
                          textRendering: "optimizeSpeed"
                        }}
                        whileHover={{
                          scale: 1.05,
                          transition: { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }
                        }}
                      >
                        {letter.char}
                      </motion.span>
                    ))}
                  </motion.h1>
                  
                  {/* Animated Gradient Underline */}
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={underlineVariants}
                    className="absolute bottom-0 left-0 w-full h-0.5 sm:h-1 bg-gradient-to-r from-primary-400 via-secondary-400 to-primary-500 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #22c55e 0%, #c5ae8b 50%, #22c55e 100%)",
                      boxShadow: "0 0 20px rgba(34, 197, 94, 0.5)"
                    }}
                  />
                </div>
                
                {/* Dynamic Tagline */}
                <div className="h-6 sm:h-8 flex items-center justify-center lg:justify-start">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentLanguageIndex}
                      variants={taglineVariants}
                      initial="exit"
                      animate="enter"
                      exit="exit"
                      className="text-xs sm:text-sm lg:text-base text-gray-700 font-light"
                    >
                      {taglineLanguages[currentLanguageIndex].text}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Description */}
                <motion.p 
                  variants={itemVariants}
                  className="text-xs sm:text-sm lg:text-base text-gray-600 max-w-xl mx-auto lg:mx-0 font-light leading-relaxed"
                >
                  <span className="text-primary-600">AI-powered</span> agricultural advisor specifically designed for 
                  <span className="text-secondary-600">{" Kerala's unique farming"}</span> conditions and crop patterns.
                </motion.p>

                {/* Action Buttons */}
                <motion.div
                  variants={itemVariants}
                  className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center lg:justify-start"
                >
                  <Link to="/chatbot" className="w-full sm:w-auto">
                    <motion.button
                      whileHover={{ 
                        scale: 1.05, 
                        y: -2,
                        transition: { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }
                      }}
                      whileTap={{ scale: 0.95 }}
                      className="group relative w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold overflow-hidden transition-all duration-300"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span className="relative flex items-center justify-center gap-2">
                        <FaRobot className="text-xs sm:text-sm" /> Chat with AI
                      </span>
                    </motion.button>
                  </Link>

                  <Link to="/my-farm" className="w-full sm:w-auto">
                    <motion.button
                      whileHover={{ 
                        scale: 1.05, 
                        y: -2,
                        transition: { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }
                      }}
                      whileTap={{ scale: 0.95 }}
                      className="group relative w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-secondary-600 to-secondary-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold overflow-hidden transition-all duration-300"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-secondary-400 to-secondary-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span className="relative flex items-center justify-center gap-2">
                        <FaSeedling className="text-xs sm:text-sm" /> Crop Simulator
                      </span>
                    </motion.button>
                  </Link>
                </motion.div>
              </motion.div>

              {/* Right Mockup Image */}
              <div className="flex flex-col items-center justify-center space-y-2 sm:space-y-4 order-2 lg:order-2 opacity-100 transition-opacity duration-1000 ease-in-out">
                <div className="w-full max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl mx-auto relative">
                  {/* Transparent Placeholder */}
                  {!mockupLoaded && (
                    <div 
                      className="w-full rounded-lg sm:rounded-xl flex items-center justify-center animate-pulse bg-black/10"
                      style={{ aspectRatio: '1/1' }} // Typical phone mockup aspect ratio
                    >
                      
                    </div>
                  )}
                  
                  {/* Mockup Image */}
                  <img
                    src="/assets/mockup.png"
                    alt="Fasal Setu AI Interface"
                    className={`w-full h-auto rounded-lg sm:rounded-xl transition-all duration-500 hover:scale-105 ${
                      mockupLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
                    }`}
                    onLoad={() => setMockupLoaded(true)}
                    onError={() => setMockupLoaded(false)}
                  />
                </div>

                {/* Caption Text */}
                <div className="text-center max-w-xs sm:max-w-sm mx-auto">
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    <span className="font-medium text-primary-600">It's that easy</span> to get straightforward and 
                    to-the-point agricultural advice for <span className="font-medium text-secondary-600">Kerala farmers</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
            className="text-center mb-16 md:mb-20"
          >
            <motion.h2 
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-secondary-500"
            >
              Kerala Agricultural Solutions
            </motion.h2>
            <motion.p 
              variants={itemVariants}
              className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed"
            >
              Comprehensive AI-powered tools designed specifically for Kerala's agricultural landscape
            </motion.p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ 
                  y: -4,
                  transition: { duration: 0.2 }
                }}
                className="group relative bg-white border border-gray-200 rounded-2xl p-6 h-full hover:border-primary-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="h-full flex flex-col">
                  <div className="mb-4 p-3 rounded-lg bg-primary-50 w-fit text-primary-600 group-hover:bg-primary-100 transition-colors duration-300">
                    {feature.icon}
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 mb-4 leading-relaxed flex-grow">
                    {feature.description}
                  </p>
                  <div className="text-primary-600 text-sm font-medium mb-6">
                    {feature.benefit}
                  </div>
                  
                  <Link to={feature.link} className="mt-auto">
                    <button className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-500 transition-colors duration-200">
                      Learn More
                    </button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          {/* Gradient Fallback - Shows immediately while image loads */}
          <div className="w-full h-full bg-gradient-to-r from-green-600 via-green-500 to-green-400" />
          
          {/* Actual Background Image - Fades in when loaded */}
          <div 
            className={`w-full h-full bg-section absolute inset-0 transition-opacity duration-1000 ${
              aboutImageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: aboutImageLoaded ? `url('/assets/palladium,-india,-tribal-farmers,-fpo.jpg')` : 'none',
              filter: 'brightness(0.7) contrast(1.1)'
            }}
          />
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/60 to-gray-50/60" />
        </div>

        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
            className="text-center mb-12 sm:mb-16"
          >
            <motion.h2 
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 mb-4"
            >
              Our Mission for Kerala
            </motion.h2>
            <motion.p 
              variants={itemVariants}
              className="text-gray-600 text-lg"
            >
              Empowering Kerala farmers with AI-driven solutions for rice, spices, and coconut cultivation
            </motion.p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
            className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 xs:gap-4 sm:gap-6 md:gap-8"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="text-center p-3 xs:p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-white/80 to-gray-50/80 backdrop-blur-xl border border-gray-200/50 shadow-lg"
              >
                <div className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary-600 mb-1 xs:mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-800 font-medium mb-1 text-xs xs:text-sm sm:text-base">{stat.label}</div>
                <div className="text-gray-600 text-xs sm:text-sm">{stat.sublabel}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-100 to-white">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
            className="text-center mb-12 sm:mb-16"
          >
            <motion.h2 
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent"
            >
              Get in Touch
            </motion.h2>
            <motion.p 
              variants={itemVariants}
              className="text-gray-600 text-lg"
            >
              Have questions? Need support? We're here to help.
            </motion.p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12"
          >
            <motion.div variants={itemVariants} className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white/80 to-gray-50/80 backdrop-blur-xl border border-gray-200/50 shadow-lg">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 sm:mb-8">Contact Information</h3>
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-primary-100/80 text-primary-600 flex-shrink-0">
                    <FaPhone className="text-lg sm:text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-800 font-medium">+91-900-424-6251</div>
                    <div className="text-gray-600 text-sm">24/7 Helpline</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-primary-100/80 text-primary-600 flex-shrink-0">
                    <FaEnvelope className="text-lg sm:text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-800 font-medium break-words">akshathsurwase@gmail.com</div>
                    <div className="text-gray-600 text-sm">Quick Support</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-primary-100/80 text-primary-600 flex-shrink-0">
                    <FaMapMarkerAlt className="text-lg sm:text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-800 font-medium">Serving All of Kerala</div>
                    <div className="text-gray-600 text-sm">All 14 districts covered</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white/80 to-gray-50/80 backdrop-blur-xl border border-gray-200/50 shadow-lg">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 sm:mb-8">Quick Contact</h3>
              <form className="space-y-4 sm:space-y-6">
                <input
                  type="text"
                  placeholder="Your Name"
                  className="w-full p-3 sm:p-4 bg-white/80 border border-gray-300/50 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300"
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  className="w-full p-3 sm:p-4 bg-white/80 border border-gray-300/50 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300"
                />
                <textarea
                  placeholder="Your Message"
                  rows="4"
                  className="w-full p-3 sm:p-4 bg-white/80 border border-gray-300/50 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300 resize-vertical"
                ></textarea>
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 sm:py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl font-semibold transition-all duration-300 hover:from-primary-500 hover:to-secondary-500"
                >
                  Send Message
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 sm:py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-300/50 bg-gray-100/80">
        <div className="container mx-auto text-center">
          <p className="text-lg sm:text-xl font-medium text-gray-800 mb-2">
            Fasal Setu AI - The Future of Kerala Agriculture
          </p>
          <p className="text-gray-600 text-sm sm:text-base">Built for Capital One Hackathon 2025</p>
        </div>
      </footer>

      {/* Floating Chat Button */}
      <FloatingChatButton />
    </div>
  );
};

export default Home;
