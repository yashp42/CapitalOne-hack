import React from 'react';

const AnswerCard = ({ answer, canMarkAsSolved, onMarkAsSolved }) => {
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

  return (
    <div className={`border rounded-lg p-4 sm:p-6 ${
      answer.isAccepted ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
    }`}>
      {/* Accepted Answer Badge */}
      {answer.isAccepted && (
        <div className="mb-3 sm:mb-4">
          <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-600 text-white">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="hidden sm:inline">Accepted Answer</span>
            <span className="sm:hidden">Accepted</span>
          </span>
        </div>
      )}

      {/* Answer Content */}
      <div className="prose max-w-none mb-3 sm:mb-4">
        <p className="text-gray-700 whitespace-pre-line text-sm sm:text-base break-words">
          {answer.content}
        </p>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 sm:pt-4 border-t border-gray-200 gap-3 sm:gap-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
          {/* Author */}
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="break-words">
              {answer.author.firstName} {answer.author.lastName}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="break-words text-xs sm:text-sm">{formatDate(answer.created_at)}</span>
          </div>
        </div>

        {/* Mark as Solution Button */}
        {canMarkAsSolved && !answer.isAccepted && (
          <button
            onClick={onMarkAsSolved}
            className="inline-flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-green-700 transition-colors w-full sm:w-auto justify-center flex-shrink-0"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="hidden sm:inline">Mark as Solution</span>
            <span className="sm:hidden">Mark Solution</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AnswerCard;