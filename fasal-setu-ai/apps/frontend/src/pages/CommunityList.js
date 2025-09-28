import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { communityAPI } from '../services/communityAPI';
import QuestionCard from '../components/community/QuestionCard';
import TagFilter from '../components/community/TagFilter';
import Pagination from '../components/community/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';

const CommunityList = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [tags, setTags] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Memoize derived values from URL params to prevent infinite re-renders
  const currentPage = useMemo(() => parseInt(searchParams.get('page')) || 1, [searchParams]);
  const selectedTags = useMemo(() => searchParams.get('tags')?.split(',').filter(Boolean) || [], [searchParams]);
  const status = useMemo(() => searchParams.get('status') || 'all', [searchParams]);
  const search = useMemo(() => searchParams.get('search') || '', [searchParams]);

  const fetchTags = async () => {
    try {
      const response = await communityAPI.getTags();
      setTags(response.data.tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        tags: selectedTags,
        status,
        search: search || undefined
      };

      const response = await communityAPI.getPosts(params);
      setPosts(response.data.posts);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedTags, status, search]);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const updateSearchParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all') {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });

    // Reset page when changing filters
    if (updates.tags !== undefined || updates.status !== undefined || updates.search !== undefined) {
      newParams.delete('page');
    }

    setSearchParams(newParams);
  };

  const handleTagFilter = (newSelectedTags) => {
    updateSearchParams({ tags: newSelectedTags.join(',') });
  };

  const handleStatusFilter = (newStatus) => {
    updateSearchParams({ status: newStatus });
  };

  const handleSearch = (searchTerm) => {
    updateSearchParams({ search: searchTerm });
  };

  const handlePageChange = (page) => {
    updateSearchParams({ page: page.toString() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-200 via-white to-secondary-200 pt-20">
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 sm:mb-8 px-2 sm:px-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 break-words">
              Agriculture Community Forum
            </h1>
            <p className="text-sm sm:text-base text-gray-600 break-words">
              Ask questions and get help from other farmers
            </p>
          </div>
          <Link
            to="/community/ask"
            className="mt-4 md:mt-0 bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-green-700 transition-colors inline-flex items-center gap-2 text-sm sm:text-base w-full md:w-auto justify-center md:justify-start flex-shrink-0"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ask Question
          </Link>
        </div>

        {/* Search Bar */}
        <div className="mb-4 sm:mb-6 px-2 sm:px-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Search questions..."
              className="w-full px-4 py-2 sm:py-3 pl-8 sm:pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <svg
              className="absolute left-2 sm:left-3 top-2.5 sm:top-3.5 w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Sidebar */}
          <div className="order-2 lg:order-1 lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 lg:sticky lg:top-24 mx-2 sm:mx-0">
              {/* Status Filter */}
              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">Status</h3>
                <div className="space-y-2">
                  {['all', 'open', 'solved'].map((statusOption) => (
                    <button
                      key={statusOption}
                      onClick={() => handleStatusFilter(statusOption)}
                      className={`w-full text-left px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm transition-colors ${
                        status === statusOption
                          ? 'bg-green-100 text-green-800'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {statusOption === 'all' && 'All'}
                      {statusOption === 'open' && 'Open'}
                      {statusOption === 'solved' && 'Solved'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag Filter */}
              <TagFilter
                tags={tags}
                selectedTags={selectedTags}
                onTagChange={handleTagFilter}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="order-1 lg:order-2 lg:col-span-3 min-w-0 px-2 sm:px-0">
            {/* Results Summary */}
            <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-600 break-words">
              {pagination.totalPosts ? (
                <>
                  {pagination.totalPosts} questions found
                  {selectedTags.length > 0 && (
                    <span className="ml-1 sm:ml-2 block sm:inline">
                      in tags: <span className="break-all">{selectedTags.join(', ')}</span>
                    </span>
                  )}
                </>
              ) : (
                'Loading questions...'
              )}
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : posts.length > 0 ? (
              <>
                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  {posts.map((post) => (
                    <QuestionCard key={post._id} post={post} />
                  ))}
                </div>

                {/* Pagination */}
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                  hasMore={pagination.hasMore}
                />
              </>
            ) : (
              <div className="text-center py-12">
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
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No questions found
                </h3>
                <p className="text-gray-500 mb-4">
                  No questions match your search criteria yet.
                </p>
                <Link
                  to="/community/ask"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Ask First Question
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityList;