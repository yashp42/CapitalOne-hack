import apiRequest from './api.js';

// Community API endpoints
export const communityAPI = {
  // Posts
  async getPosts(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.tags && params.tags.length > 0) {
      queryParams.append('tags', params.tags.join(','));
    }
    if (params.status && params.status !== 'all') {
      queryParams.append('status', params.status);
    }
    if (params.search) queryParams.append('search', params.search);
    
    const url = `/community/posts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest(url);
  },

  async getPost(id) {
    console.log('API: Getting post with ID:', id);
    const url = `/community/posts/${id}`;
    console.log('API: Request URL:', url);
    return apiRequest(url);
  },

  async createPost(postData) {
    return apiRequest('/community/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  },

  async markPostAsSolved(postId, answerId) {
    return apiRequest(`/community/posts/${postId}/solve/${answerId}`, {
      method: 'PATCH'
    });
  },

  async markPostSolved(postId) {
    return apiRequest(`/community/posts/${postId}/mark-solved`, {
      method: 'PATCH'
    });
  },

  // Answers
  async createAnswer(postId, answerData) {
    return apiRequest(`/community/posts/${postId}/answers`, {
      method: 'POST',
      body: JSON.stringify(answerData)
    });
  },

  async getAnswers(postId) {
    return apiRequest(`/community/answers/${postId}`);
  },

  // Tags
  async getTags() {
    return apiRequest('/community/tags');
  },

  // My Posts
  async getMyPosts(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    
    const url = `/community/my-posts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest(url);
  },

  async deletePost(postId) {
    return apiRequest(`/community/posts/${postId}`, {
      method: 'DELETE'
    });
  }
};