import API from './index';

// Posts API services
export const postsAPI = {
  // Get all posts
  getPosts: () => {
    return API.get('/posts');
  },
  
  // Get broadcasts (faculty posts)
  getBroadcasts: () => {
    return API.get('/posts/broadcasts');
  },
  
  // Get a single post by ID
  getPost: (postId: string) => {
    return API.get(`/posts/${postId}`);
  },
  
  // Create a new post
  createPost: (postData: any) => {
    return API.post('/posts', postData);
  },

  // Update a post
  updatePost: (postId: string, postData: any) => {
    return API.put(`/posts/${postId}`, postData);
  },
  
  // Delete a post
  deletePost: (postId: string) => {
    return API.delete(`/posts/${postId}`);
  },
  
  // Like a post
  likePost: (postId: string) => {
    return API.put(`/posts/like/${postId}`);
  },
  
  // Unlike a post
  unlikePost: (postId: string) => {
    return API.put(`/posts/unlike/${postId}`);
  },
  
  // Add a comment to a post
  addComment: (postId: string, text: string, parentId?: string) => {
    return API.post(`/posts/comment/${postId}`, { text, parentId });
  },

  // Update a comment
  updateComment: (postId: string, commentId: string, text: string) => {
    return API.put(`/posts/comment/${postId}/${commentId}`, { text });
  },
  
  // Delete a comment from a post
  deleteComment: (postId: string, commentId: string) => {
    return API.delete(`/posts/comment/${postId}/${commentId}`);
  },
  
  // Like a comment
  likeComment: (postId: string, commentId: string) => {
    return API.put(`/posts/comment/like/${postId}/${commentId}`);
  },
  
  // Unlike a comment
  unlikeComment: (postId: string, commentId: string) => {
    return API.put(`/posts/comment/unlike/${postId}/${commentId}`);
  },
  
  // Share a post
  sharePost: (postId: string, recipientEmails: string[]) => {
    return API.post(`/posts/share/${postId}`, { recipientEmails });
  }
};

export default postsAPI;
