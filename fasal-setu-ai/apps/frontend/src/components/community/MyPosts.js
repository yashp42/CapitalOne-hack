import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { communityAPI } from '../../services/communityAPI';
import { useAuth } from '../../contexts/AuthContext';
import Pagination from './Pagination';
import { FaCheckCircle, FaClock, FaCalendar, FaTrash } from 'react-icons/fa';

const MyPosts = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [deleting, setDeleting] = useState(false); // all, open, solved
    const { user } = useAuth();

    const fetchMyPosts = async (page = 1, status = 'all') => {
        try {
            setLoading(true);
            const params = {
                page,
                limit: 10,
                ...(status !== 'all' && { status })
            };
            
            const response = await communityAPI.getMyPosts(params);
            
            if (response.success) {
                setPosts(response.data.posts);
                setCurrentPage(response.data.currentPage);
                setTotalPages(response.data.totalPages);
            }
        } catch (error) {
            console.error('Error fetching my posts:', error);
            setError('Failed to fetch your posts. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchMyPosts(1, statusFilter);
        }
    }, [user, statusFilter]);

    const handlePageChange = (page) => {
        fetchMyPosts(page, statusFilter);
    };

    const handleStatusFilterChange = (status) => {
        setStatusFilter(status);
        setCurrentPage(1);
        fetchMyPosts(1, status);
    };

    const handleMarkSolved = async (postId) => {
        try {
            const response = await communityAPI.markPostSolved(postId);
            
            if (response.success) {
                // Refresh the posts to show updated status
                fetchMyPosts(currentPage, statusFilter);
            }
        } catch (error) {
            console.error('Error marking post as solved:', error);
            setError('Failed to mark post as solved. Please try again.');
        }
    };

    const handleDeletePost = async (postId) => {
        try {
            setDeleting(true);
            const response = await communityAPI.deletePost(postId);
            
            if (response.success) {
                setDeleteConfirmId(null);
                // Refresh the posts to show updated list
                fetchMyPosts(currentPage, statusFilter);
            } else {
                setError(response.message || 'Failed to delete post');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            setError('Failed to delete post. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">My Posts</h3>
                <div className="space-y-4">
                    {[...Array(3)].map((_, index) => (
                        <div key={index} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">My Posts</h3>
                
                {/* Status Filter */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => handleStatusFilterChange('all')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            statusFilter === 'all'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => handleStatusFilterChange('open')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                            statusFilter === 'open'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <FaClock className="w-3 h-3" />
                        Unsolved
                    </button>
                    <button
                        onClick={() => handleStatusFilterChange('solved')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                            statusFilter === 'solved'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <FaCheckCircle className="w-3 h-3" />
                        Solved
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                    {error}
                </div>
            )}

            {posts.length === 0 ? (
                <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h4>
                    <p className="text-gray-500">
                        {statusFilter === 'all' 
                            ? "You haven't created any posts yet. Share your questions with the community!"
                            : statusFilter === 'open'
                            ? "You don't have any unsolved posts."
                            : "You don't have any solved posts yet."
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <div key={post._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-start gap-2 mb-2">
                                        <h4 className="font-medium text-gray-900 flex-1">{post.title}</h4>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {post.status === 'solved' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    <FaCheckCircle className="w-3 h-3" />
                                                    Solved
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                    <FaClock className="w-3 h-3" />
                                                    Open
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <FaCalendar className="w-3 h-3" />
                                            {formatDate(post.createdAt || post.created_at)}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            {post.answerCount || 0} answers
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            {post.viewCount || 0} views
                                        </div>
                                        {post.tags && post.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {post.tags.slice(0, 3).map((tag, index) => (
                                                    <span key={index} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                                        {tag}
                                                    </span>
                                                ))}
                                                {post.tags.length > 3 && (
                                                    <span className="text-gray-400 text-xs">+{post.tags.length - 3} more</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-2">
                                    {post.status === 'open' && (
                                        <button
                                            onClick={() => handleMarkSolved(post._id)}
                                            className="px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors"
                                        >
                                            Mark Solved
                                        </button>
                                    )}
                                    <Link
                                        to={`/community/question/${post._id}`}
                                        className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors text-center"
                                    >
                                        View Details
                                    </Link>
                                    <button
                                        onClick={() => setDeleteConfirmId(post._id)}
                                        className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors flex items-center justify-center gap-1"
                                        title="Delete post"
                                    >
                                        <FaTrash className="w-3 h-3" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="mt-6">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                    />
                </div>
            )}
        </div>

        {/* Delete Confirmation Modal - Rendered as Portal */}
        {deleteConfirmId && ReactDOM.createPortal(
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-red-200">
                    <div className="p-6">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <FaTrash className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Post</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>
                        
                        <p className="text-gray-700 mb-6">
                            Are you sure you want to delete this post? All associated answers and data will be permanently removed.
                        </p>
                        
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeletePost(deleteConfirmId)}
                                disabled={deleting}
                                className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center space-x-2 ${
                                    deleting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {deleting && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                )}
                                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )}
        </>
    );
};

export default MyPosts;