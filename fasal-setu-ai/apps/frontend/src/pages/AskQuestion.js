import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { communityAPI } from '../services/communityAPI';
import LoadingSpinner from '../components/LoadingSpinner';

const AskQuestion = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: []
  });
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tag translations for better UX
  const tagTranslations = {
    'irrigation': 'Irrigation',
    'pest-control': 'Pest Control',
    'fertilizer': 'Fertilizer',
    'seeds': 'Seeds',
    'soil-health': 'Soil Health',
    'weather': 'Weather',
    'harvest': 'Harvest',
    'crop-disease': 'Crop Disease',
    'equipment': 'Equipment',
    'organic-farming': 'Organic Farming'
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchTags();
  }, [user, navigate]);

  const fetchTags = async () => {
    try {
      const response = await communityAPI.getTags();
      setAvailableTags(response.data.tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleTagChange = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : prev.tags.length < 3
          ? [...prev.tags, tag]
          : prev.tags
    }));

    // Clear tag error
    if (errors.tags) {
      setErrors(prev => ({
        ...prev,
        tags: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 10) {
      newErrors.title = 'Title must be at least 10 characters long';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters long';
    } else if (formData.description.length > 1000) {
      newErrors.description = 'Description cannot exceed 1000 characters';
    }

    if (formData.tags.length === 0) {
      newErrors.tags = 'Please select at least one tag';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await communityAPI.createPost(formData);
      navigate(`/community/question/${response.data._id}`);
    } catch (error) {
      console.error('Error creating post:', error);
      setErrors({
        submit: error.response?.data?.message || 'Error posting question'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 px-2 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">
            Ask New Question
          </h1>
          <p className="text-sm sm:text-base text-gray-600 break-words">
            Ask your farming-related question and get help from the community
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mx-2 sm:mx-0">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Question Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Example: Why are my wheat crop leaves turning yellow?"
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.title && (
                <p className="text-red-600 text-sm mt-1">{errors.title}</p>
              )}
              <p className="text-gray-500 text-xs sm:text-sm mt-1">
                {formData.title.length}/100 characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Description *
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Provide detailed information about your question. Include when the problem started, which crop it is, area size, and other relevant details."
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base resize-none ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.description && (
                <p className="text-red-600 text-sm mt-1">{errors.description}</p>
              )}
              <p className="text-gray-500 text-xs sm:text-sm mt-1">
                {formData.description.length}/1000 characters
              </p>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Tags (maximum 3) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagChange(tag)}
                    className={`px-3 sm:px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-colors break-words text-center ${
                      formData.tags.includes(tag)
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    } ${formData.tags.length >= 3 && !formData.tags.includes(tag) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={formData.tags.length >= 3 && !formData.tags.includes(tag)}
                  >
                    {tagTranslations[tag] || tag}
                  </button>
                ))}
              </div>
              {errors.tags && (
                <p className="text-red-600 text-sm mt-1">{errors.tags}</p>
              )}
              <p className="text-gray-500 text-sm mt-1">
                Selected: {formData.tags.length}/3
              </p>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <p className="text-red-600 text-xs sm:text-sm break-words">{errors.submit}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-2 sm:py-3 px-4 sm:px-6 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm sm:text-base">Posting...</span>
                  </div>
                ) : (
                  'Post Question'
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/community')}
                className="px-4 sm:px-6 py-2 sm:py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm sm:text-base flex-shrink-0"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Guidelines */}
        <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 mx-2 sm:mx-0">
          <h3 className="font-semibold text-blue-900 mb-3 text-sm sm:text-base">Tips for asking a good question:</h3>
          <ul className="text-blue-800 text-xs sm:text-sm space-y-1 sm:space-y-2">
            <li className="break-words">• Write a clear and detailed title</li>
            <li className="break-words">• Provide complete description of the problem</li>
            <li className="break-words">• Include crop name, area size, and timing information</li>
            <li className="break-words">• Choose appropriate tags so the right people can help you</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AskQuestion;