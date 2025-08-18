import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPlus, 
  FaTrash, 
  FaEdit, 
  FaTimes, 
  FaChevronLeft,
  FaHistory,
  FaUser,
  FaGlobeAmericas,
  FaSpinner
} from 'react-icons/fa';
import { conversationAPI, authAPI } from '../services/api';

const ConversationSidebar = ({ 
  isOpen, 
  onClose, 
  currentConversationId, 
  onConversationSelect, 
  onNewConversation,
  chatMode 
}) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Load conversations when sidebar opens
  const loadConversations = useCallback(async () => {
    if (!authAPI.isAuthenticated()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await conversationAPI.getConversations();
      if (response.success) {
        setConversations(response.data);
      } else {
        setError('Failed to load conversations');
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && authAPI.isAuthenticated()) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Handle conversation selection
  const handleConversationSelect = async (conversationId) => {
    try {
      const response = await conversationAPI.getConversation(conversationId);
      if (response.success) {
        onConversationSelect(response.data);
        onClose();
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      setError('Failed to load conversation');
    }
  };

  // Handle new conversation
  const handleNewConversation = async () => {
    try {
      const response = await conversationAPI.createConversation('New Conversation', chatMode);
      if (response.success) {
        onNewConversation(response.data);
        loadConversations(); // Refresh the list
        onClose();
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError('Failed to create conversation');
    }
  };

  // Handle conversation deletion
  const handleDeleteConversation = async (conversationId, event) => {
    event.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      await conversationAPI.deleteConversation(conversationId);
      setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      
      // If deleted conversation was current, start new conversation
      if (conversationId === currentConversationId) {
        onNewConversation(null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  // Handle title editing
  const handleEditTitle = (conversation, event) => {
    event.stopPropagation();
    setEditingId(conversation._id);
    setEditTitle(conversation.title);
  };

  const handleSaveTitle = async (conversationId) => {
    if (!editTitle.trim()) return;

    try {
      await conversationAPI.updateConversationTitle(conversationId, editTitle.trim());
      setConversations(prev => 
        prev.map(conv => 
          conv._id === conversationId 
            ? { ...conv, title: editTitle.trim() }
            : conv
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error('Error updating title:', error);
      setError('Failed to update title');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  if (!authAPI.isAuthenticated()) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 w-80 h-full bg-white shadow-2xl z-50 border-r border-gray-200"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Conversations</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FaTimes className="text-gray-500" />
                </button>
              </div>

              {/* Not authenticated message */}
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <FaUser className="text-4xl text-gray-400 mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Sign in to save conversations</h3>
                  <p className="text-gray-500 text-sm">
                    Create an account or sign in to save and access your chat history.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -320 }}
          animate={{ x: 0 }}
          exit={{ x: -320 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed top-0 left-0 w-80 h-full bg-white shadow-2xl z-50 border-r border-gray-200"
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <FaHistory className="mr-2 text-emerald-600" />
                Conversations
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FaTimes className="text-gray-500" />
              </button>
            </div>

            {/* New Conversation Button */}
            <div className="p-4 border-b border-gray-100">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center justify-center px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <FaPlus className="mr-2" />
                New Conversation
              </button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <FaSpinner className="animate-spin text-emerald-600 text-xl" />
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-600">
                  <p>{error}</p>
                  <button
                    onClick={loadConversations}
                    className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    Try again
                  </button>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <FaHistory className="text-3xl text-gray-400 mb-3 mx-auto" />
                  <p>No conversations yet</p>
                  <p className="text-sm mt-1">Start chatting to see your history here</p>
                </div>
              ) : (
                <div className="p-2">
                  {conversations.map((conversation) => (
                    <motion.div
                      key={conversation._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 mb-2 rounded-lg cursor-pointer transition-all border ${
                        conversation._id === currentConversationId
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'hover:bg-gray-50 border-transparent'
                      }`}
                      onClick={() => handleConversationSelect(conversation._id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {editingId === conversation._id ? (
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => handleSaveTitle(conversation._id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveTitle(conversation._id);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="w-full px-2 py-1 text-sm border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <h3 className="font-medium text-gray-800 truncate text-sm">
                              {conversation.title}
                            </h3>
                          )}
                          
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            {conversation.mode === 'my_farm' ? (
                              <FaUser className="mr-1" />
                            ) : (
                              <FaGlobeAmericas className="mr-1" />
                            )}
                            <span className="mr-2">
                              {conversation.mode === 'my_farm' ? 'Personal' : 'Public'}
                            </span>
                            <span>{formatDate(conversation.lastMessageAt)}</span>
                          </div>
                          
                          {conversation.messageCount && (
                            <div className="text-xs text-gray-400 mt-1">
                              {conversation.messageCount} messages
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={(e) => handleEditTitle(conversation, e)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Edit title"
                          >
                            <FaEdit className="text-xs text-gray-400" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteConversation(conversation._id, e)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Delete conversation"
                          >
                            <FaTrash className="text-xs text-red-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConversationSidebar;
