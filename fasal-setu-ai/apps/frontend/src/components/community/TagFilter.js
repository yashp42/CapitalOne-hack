import React from 'react';

const TagFilter = ({ tags, selectedTags, onTagChange }) => {
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

  const handleTagToggle = (tag) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    
    onTagChange(newSelectedTags);
  };

  const clearAllTags = () => {
    onTagChange([]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Topics</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={clearAllTags}
            className="text-xs text-green-600 hover:text-green-700 font-medium flex-shrink-0"
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagToggle(tag)}
            className={`w-full text-left px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm transition-colors flex items-center justify-between ${
              selectedTags.includes(tag)
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="truncate break-words min-w-0">
              {tagTranslations[tag] || tag}
            </span>
            {selectedTags.includes(tag) && (
              <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
      
      {selectedTags.length > 0 && (
        <div className="mt-3 sm:mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Selected tags:</p>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full max-w-full"
              >
                <span className="truncate">{tagTranslations[tag] || tag}</span>
                <button
                  onClick={() => handleTagToggle(tag)}
                  className="ml-1 hover:text-green-900 flex-shrink-0"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TagFilter;