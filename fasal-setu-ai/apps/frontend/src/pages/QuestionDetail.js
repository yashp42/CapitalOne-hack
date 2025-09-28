import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { communityAPI } from '../services/communityAPI';
import AnswerCard from '../components/community/AnswerCard';
import LoadingSpinner from '../components/LoadingSpinner';

const QuestionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAnswer, setNewAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Tag translations
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
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      console.log('Fetching post with ID:', id);
      const response = await communityAPI.getPost(id);
      console.log('Post response:', response);
      setPost(response.data.post);
      setAnswers(response.data.answers || []);
    } catch (error) {
      console.error('Error fetching post:', error);
      console.error('Error details:', error.response);
      // Don't automatically navigate away, let user see the error message
      // if (error.response?.status === 404) {
      //   navigate('/community');
      // }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    
    if (!user) {
      navigate('/login');
      return;
    }

    if (!newAnswer.trim()) {
      setError('Answer is required');
      return;
    }

    if (newAnswer.length < 10) {
      setError('Answer must be at least 10 characters long');
      return;
    }

    if (newAnswer.length > 500) {
      setError('Answer cannot exceed 500 characters');
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      const response = await communityAPI.createAnswer(id, { content: newAnswer });
      setAnswers([...answers, response.data]);
      setNewAnswer('');
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError(error.response?.data?.message || 'Error posting answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAsSolved = async (answerId) => {
    try {
      await communityAPI.markPostAsSolved(id, answerId);
      // Refresh the post and answers
      await fetchPost();
    } catch (error) {
      console.error('Error marking as solved:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 break-words">Question Not Found</h2>
          <Link
            to="/community"
            className="text-green-600 hover:text-green-700 text-sm sm:text-base"
          >
            Back to Community Forum
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 sm:mb-6 px-2 sm:px-0">
          <Link
            to="/community"
            className="text-green-600 hover:text-green-700 text-xs sm:text-sm font-medium break-words"
          >
            ← Back to Community Forum
          </Link>
        </nav>

        {/* Question */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6 mx-2 sm:mx-0">
          {/* Status Badge */}
          {post.status === 'solved' && (
            <div className="mb-3 sm:mb-4">
              <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-800">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Solved
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 break-words">
            {post.title}
          </h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>
                {post.author.firstName} {post.author.lastName}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatDate(post.created_at)}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>{post.viewCount} views</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
              >
                {tagTranslations[tag] || tag}
              </span>
            ))}
          </div>

          {/* Description */}
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-line">
              {post.description}
            </p>
          </div>
        </div>

        {/* Answers Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Answers ({answers.length})
          </h2>

          {answers.length > 0 ? (
            <div className="space-y-6">
              {answers.map((answer) => (
                <AnswerCard
                  key={answer._id}
                  answer={answer}
                  canMarkAsSolved={user && user._id === post.author._id && post.status !== 'solved'}
                  onMarkAsSolved={() => handleMarkAsSolved(answer._id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg
                className="mx-auto w-12 h-12 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-gray-500 mb-2">No answers yet</p>
              <p className="text-gray-400 text-sm">Be the first to help this farmer by providing an answer!</p>
            </div>
          )}
        </div>

        {/* Add Answer Form */}
        {user ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Your Answer
            </h3>
            <form onSubmit={handleSubmitAnswer}>
              <div className="mb-4">
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Write your answer here... Provide detailed information on how the problem can be solved."
                  rows={6}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    error ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {error && (
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                )}
                <p className="text-gray-500 text-sm mt-1">
                  {newAnswer.length}/500 characters
                </p>
              </div>
              
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submitting || !newAnswer.trim()}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Posting...
                    </div>
                  ) : (
                    'Post Answer'
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-600 mb-4">
              Please login to post an answer
            </p>
            <Link
              to="/login"
              className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionDetail;