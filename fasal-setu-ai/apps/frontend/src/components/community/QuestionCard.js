import React from 'react';
import { Link } from 'react-router-dom';

const QuestionCard = ({ post }) => {
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return '1 day ago';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    }
  };

  return (
    <Link
      to={`/community/question/${post._id}`}
      className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 p-4 sm:p-6 mx-2 sm:mx-0"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 hover:text-green-600 transition-colors">
            <span className="break-words">{post.title}</span>
          </h3>
        </div>
        
        {/* Status Badge */}
        {post.status === 'solved' && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="hidden sm:inline">Solved</span>
            <span className="sm:hidden">✓</span>
          </span>
        )}
      </div>

      {/* Description Preview */}
      <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 break-words">
        {post.description.length > 100 ? `${post.description.substring(0, 100)}...` : post.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-4">
        {/* Show first 2 tags on mobile, 3 on desktop */}
        {post.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full break-words"
          >
            {tagTranslations[tag] || tag}
          </span>
        ))}
        {/* Show 3rd tag only on desktop */}
        {post.tags.length > 2 && (
          <span className="hidden sm:inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full break-words">
            {tagTranslations[post.tags[2]] || post.tags[2]}
          </span>
        )}
        {/* Show remaining count */}
        {post.tags.length > 3 && (
          <span className="text-xs text-gray-500 px-2 py-1 flex-shrink-0">
            +{post.tags.length - 3} more
          </span>
        )}
        {post.tags.length > 2 && (
          <span className="sm:hidden text-xs text-gray-500 px-2 py-1 flex-shrink-0">
            +{post.tags.length - 2} more
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-gray-500 gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* Author */}
          <div className="flex items-center gap-1 min-w-0">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="truncate max-w-[80px] sm:max-w-[120px]">
              {post.author.firstName} {post.author.lastName}
            </span>
          </div>

          {/* Answer Count */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{post.answerCount || 0}</span>
            <span className="hidden sm:inline">answers</span>
          </div>

          {/* View Count */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>{post.viewCount || 0}</span>
          </div>
        </div>

        {/* Time */}
        <span className="text-xs sm:text-sm flex-shrink-0 break-words">
          {formatDate(post.created_at)}
        </span>
      </div>
    </Link>
  );
};

export default QuestionCard;