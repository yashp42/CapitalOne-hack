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

  // Language variations for the tagline
  const taglineLanguages = [
    { text: "Your Intelligent Farming Companion", lang: "English" },
    { text: "आपका बुद्धिमान कृषि साथी", lang: "Hindi" },
    { text: "உங்கள் அறிவார்ந்த விவசாய துணை", lang: "Tamil" },
    { text: "आपले हुशार शेती साथी", lang: "Marathi" },
    { text: "ನಿಮ್ಮ ಬುದ್ಧಿವಂತ ಕೃಷಿ ಸಹಚರ", lang: "Kannada" },
    { text: "તમારા બુદ્ધિશાળી ખેતી સાથી", lang: "Gujarati" },
    { text: "ਤੁਹਾਡਾ ਬੁੱਧੀਮਾਨ ਖੇਤੀ ਸਾਥੀ", lang: "Punjabi" }
  ];

  useEffect(() => {
    setMounted(true);
    
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
        duration: 0.6,
        ease: [0.25, 0.25, 0.25, 0.75]
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
      rotateY: 90,
      y: 0,
      scale: 1,
      z: 0
    },
    visible: {
      opacity: 1,
      rotateY: 0,
      y: 0,
      scale: 1,
      z: 0,
      transition: {
        type: "tween",
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1]
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
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1]
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1]
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
      title: "Smart AI Assistant",
      description: "24/7 available AI chatbot that provides instant answers to your farming queries in multiple languages. Get expert guidance anytime.",
      benefit: "Instant farming guidance in your language",
      link: "/chatbot"
    },
    {
      icon: <FaSeedling className="text-2xl sm:text-3xl" />,
      title: "Crop Simulation",
      description: "Virtual technology to predict crop growth under different conditions. Test seed varieties, weather patterns, and farming techniques.",
      benefit: "Predict crop growth virtually",
      link: "/simulation"
    },
    {
      icon: <FaChartLine className="text-2xl sm:text-3xl" />,
      title: "Smart Analytics",
      description: "Real-time analysis of weather, soil health, market prices, and government policies to help you make informed decisions.",
      benefit: "Real-time market & weather data",
      link: "/insights"
    },
    {
      icon: <FaMoneyBillWave className="text-2xl sm:text-3xl" />,
      title: "Financial Guidance",
      description: "Find affordable credit options, government schemes, and market timing advice to maximize your farming profits.",
      benefit: "Maximize profits with smart financing",
      link: "/finance"
    }
  ];

  const stats = [
    { number: "50K+", label: "Farmers Connected", sublabel: "Active Users" },
    { number: "95%", label: "Success Rate", sublabel: "Satisfied Farmers" },
    { number: "12", label: "Languages", sublabel: "Supported" },
    { number: "24/7", label: "Support", sublabel: "Always Available" }
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black relative overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <div 
            className="w-full h-full bg-cover bg-center bg-fixed"
            style={{
              backgroundImage: `url('/assets/desktop-wallpaper-rice-agriculture-field-golden-hour-grass.jpg')`,
              filter: 'brightness(0.4) contrast(1.1)'
            }}
          />
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/80 via-transparent to-secondary-900/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Animated Glow Effects */}
        <motion.div
          variants={glowVariants}
          animate="animate"
          className="absolute top-1/4 left-1/4 w-20 h-20 xs:w-32 xs:h-32 sm:w-64 sm:h-64 md:w-80 md:h-80 bg-gradient-radial from-primary-400/20 to-transparent rounded-full blur-3xl"
        />
        <motion.div
          variants={glowVariants}
          animate="animate"
          className="absolute bottom-1/4 right-1/4 w-16 h-16 xs:w-24 xs:h-24 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-gradient-radial from-secondary-400/15 to-transparent rounded-full blur-3xl"
        />

        {/* Hero Content */}
        <div className="relative z-10 text-center px-3 xs:px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-4 xs:space-y-6 sm:space-y-8"
          >
            {/* Badge */}
            <div className='flex w-full justify-center items-center'>
                <motion.div 
                variants={itemVariants}
                className="block px-4 sm:px-6 py-2 rounded-full bg-gradient-to-r from-primary-500/20 to-secondary-500/20 backdrop-blur-sm border border-primary-400/30"
                >
                    <span className="text-primary-300 text-xs sm:text-sm font-medium">AI Solutions for Indian Farmers</span>
                </motion.div>
            </div>

            <div className="relative inline-block">
              <motion.h1 
                initial="hidden"
                animate="visible"
                variants={titleContainerVariants}
                className="text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-tight perspective-1000"
                style={{ perspective: "1000px" }}
              >
                {titleLetters.map((letter, index) => (
                  <motion.span
                    key={index}
                    variants={letterVariants}
                    className="inline-block bg-gradient-to-r from-white via-primary-200 to-secondary-200 bg-clip-text text-transparent transform-style-preserve-3d"
                    style={{
                      transformOrigin: "center bottom",
                      transformStyle: "preserve-3d",
                      display: "inline-block",
                      backfaceVisibility: "hidden"
                    }}
                    whileHover={{
                      scale: 1.1,
                      rotateY: 10,
                      transition: { duration: 0.3 }
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
                className="absolute bottom-0 left-0 h-1 sm:h-2 md:h-3 bg-gradient-to-r from-primary-400 via-secondary-400 to-primary-500 rounded-full"
                style={{
                  background: "linear-gradient(90deg, #22c55e 0%, #c5ae8b 50%, #22c55e 100%)",
                  boxShadow: "0 0 20px rgba(34, 197, 94, 0.5)"
                }}
              />
            </div>
            
            <div className="text-base xs:text-lg sm:text-2xl md:text-3xl text-secondary-300 font-light h-10 xs:h-12 sm:h-16 md:h-20 flex items-center justify-center px-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentLanguageIndex}
                  variants={taglineVariants}
                  initial="exit"
                  animate="enter"
                  exit="exit"
                  className="text-center max-w-full"
                >
                  {taglineLanguages[currentLanguageIndex].text}
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.p 
              variants={itemVariants}
              className="text-sm xs:text-base sm:text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto font-light leading-relaxed px-2"
            >
              <span className="text-primary-300">AI-powered</span> agricultural advisor that helps you make 
              <span className="text-secondary-300"> smart farming</span> decisions for better yields and profits.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-3 xs:gap-4 sm:gap-6 justify-center items-center pt-4 px-2"
            >
              <Link to="/chatbot" className="w-full xs:w-full sm:w-auto max-w-sm xs:max-w-xs">
                <motion.button
                  whileHover={{ 
                    scale: 1.05, 
                    y: -2,
                    boxShadow: "0 20px 40px rgba(45, 90, 58, 0.4)"
                  }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative w-full px-4 xs:px-6 sm:px-10 py-3 xs:py-4 sm:py-5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl text-sm xs:text-base sm:text-lg font-semibold overflow-hidden transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center justify-center gap-2 xs:gap-3">
                    <FaRobot className="text-base xs:text-lg sm:text-xl" /> Chat with AI
                  </span>
                </motion.button>
              </Link>
              
              <motion.button
                whileHover={{ 
                  scale: 1.05, 
                  y: -2,
                  boxShadow: "0 20px 40px rgba(197, 174, 139, 0.4)"
                }}
                whileTap={{ scale: 0.95 }}
                className="group relative w-full xs:w-full sm:w-auto max-w-sm xs:max-w-xs px-4 xs:px-6 sm:px-10 py-3 xs:py-4 sm:py-5 bg-gradient-to-r from-secondary-600 to-secondary-500 text-white rounded-2xl text-sm xs:text-base sm:text-lg font-semibold overflow-hidden transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-secondary-400 to-secondary-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center justify-center gap-2 xs:gap-3">
                  <FaSeedling className="text-base xs:text-lg sm:text-xl" /> Crop Simulator
                </span>
              </motion.button>
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div
              variants={itemVariants}
              className="pt-8 sm:pt-12"
            >
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-block"
              >
                <div className="w-5 h-8 sm:w-6 sm:h-10 border-2 border-primary-400 rounded-full flex justify-center">
                  <div className="w-1 h-2 sm:h-3 bg-primary-400 rounded-full mt-2" />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary via-primary-950 to-primary-700">
        {/* Smooth fade transitions */}
        <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-yellow-600/20 to-transparent z-10"></div>
        <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-white/10 to-transparent z-10"></div>
        
        <div className="container mx-auto max-w-7xl relative z-20">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
            className="text-center mb-12 sm:mb-16 md:mb-20"
          >
            <motion.h2 
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary-300 to-secondary-300 bg-clip-text text-transparent"
            >
              Modern Agricultural Solutions
            </motion.h2>
            <motion.p 
              variants={itemVariants}
              className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto font-light"
            >
              Traditional farming wisdom meets cutting-edge AI technology
            </motion.p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={containerVariants}
            className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xs:gap-6 sm:gap-8"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ 
                  y: -10, 
                  scale: 1.02
                }}
                className="group relative p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-primary-900  to-black backdrop-blur-xl border border-gray-700/50 hover:border-primary-500/50 transition-all duration-500 h-full"
              >
                {/* Hover Glow */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-500/10 to-secondary-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 h-full flex flex-col">
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 w-fit text-primary-300">
                    {feature.icon}
                  </div>
                  
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 mb-4 text-sm sm:text-base leading-relaxed flex-grow">
                    {feature.description}
                  </p>
                  <p className="text-primary-300 text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                    {feature.benefit}
                  </p>
                  
                  <Link to={feature.link} className="mt-auto">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      className="w-full py-3 bg-gradient-to-r from-primary-600/80 to-secondary-600/80 text-white rounded-xl font-medium text-sm backdrop-blur-sm border border-primary-500/30 hover:border-primary-400/50 transition-all duration-300"
                    >
                      Learn More
                    </motion.button>
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
          <div 
            className="w-full h-full bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url('/assets/palladium,-india,-tribal-farmers,-fpo.jpg')`,
              filter: 'brightness(0.3) contrast(1.1)'
            }}
          />
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900/30 to-secondary-900/30" />
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
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            >
              Trusted Platform
            </motion.h2>
            <motion.p 
              variants={itemVariants}
              className="text-gray-300 text-lg"
            >
              Trusted by farmers across India
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
                className="text-center p-3 xs:p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl border border-gray-700/50"
              >
                <div className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary-300 mb-1 xs:mb-2">
                  {stat.number}
                </div>
                <div className="text-white font-medium mb-1 text-xs xs:text-sm sm:text-base">{stat.label}</div>
                <div className="text-gray-400 text-xs sm:text-sm">{stat.sublabel}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-black">
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
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary-300 to-secondary-300 bg-clip-text text-transparent"
            >
              Get in Touch
            </motion.h2>
            <motion.p 
              variants={itemVariants}
              className="text-gray-400 text-lg"
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
            <motion.div variants={itemVariants} className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl border border-gray-700/50">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8">Contact Information</h3>
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-primary-500/20 text-primary-300 flex-shrink-0">
                    <FaPhone className="text-lg sm:text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium">+91-XXX-XXX-XXXX</div>
                    <div className="text-gray-400 text-sm">24/7 Helpline</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-primary-500/20 text-primary-300 flex-shrink-0">
                    <FaEnvelope className="text-lg sm:text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium break-words">support@fasalsetuai.com</div>
                    <div className="text-gray-400 text-sm">Quick Support</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-primary-500/20 text-primary-300 flex-shrink-0">
                    <FaMapMarkerAlt className="text-lg sm:text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium">Serving All of India</div>
                    <div className="text-gray-400 text-sm">All states covered</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl border border-gray-700/50">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8">Quick Contact</h3>
              <form className="space-y-4 sm:space-y-6">
                <input
                  type="text"
                  placeholder="Your Name"
                  className="w-full p-3 sm:p-4 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300"
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  className="w-full p-3 sm:p-4 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300"
                />
                <textarea
                  placeholder="Your Message"
                  rows="4"
                  className="w-full p-3 sm:p-4 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all duration-300 resize-vertical"
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
      <footer className="relative py-8 sm:py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50 bg-black/80">
        <div className="container mx-auto text-center">
          <p className="text-lg sm:text-xl font-medium text-white mb-2">
            Fasal Setu AI - The Future of Indian Agriculture
          </p>
          <p className="text-gray-400 text-sm sm:text-base">Built for Capital One Hackathon 2025</p>
        </div>
      </footer>

      {/* Floating Chat Button */}
      <FloatingChatButton />
    </div>
  );
};

export default Home;
