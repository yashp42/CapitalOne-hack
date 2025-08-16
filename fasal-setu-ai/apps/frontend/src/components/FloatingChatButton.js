import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaComments } from 'react-icons/fa';

const FloatingChatButton = () => {
  const navigate = useNavigate();

  return (
    <motion.button
      onClick={() => navigate('/chatbot')}
      className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-50 transition-all duration-300 hover:scale-110"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, duration: 0.3 }}
      title="Chat with AI Assistant"
    >
      <FaComments className="text-xl" />
    </motion.button>
  );
};

export default FloatingChatButton;
