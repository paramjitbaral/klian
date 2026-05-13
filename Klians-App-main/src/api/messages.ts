import API from './index';

export interface User {
  _id: string;
  name: string;
  email: string;
  profilePicture: string;
}

export interface Message {
  _id: string;
  sender: User;
  recipient: User;
  content: string;
  type: 'text' | 'post';
  postId?: string;
  read: boolean;
  createdAt: string;
}

export interface Conversation {
  user: User;
  lastMessage: Message;
  unread: boolean;
}

// Messages API services
export const messagesAPI = {
  // Get all conversations for current user
  getConversations: () => {
    return API.get<Conversation[]>('/messages');
  },
  
  // Get messages with a specific user
  getMessagesWith: (userId: string) => {
    return API.get<Message[]>(`/messages/${userId}`);
  },
  
  // Search for users by email
  searchByEmail: (email: string) => {
    return API.get<{
      _id: string;
      name: string;
      email: string;
      profilePicture: string;
    }[]>(`/users/search?q=${email}`);
  },
  
  // Send a message to another user
  sendMessage: (recipientId: string, content: string, type: 'text' | 'post' | 'image' | 'file' = 'text', postId?: string) => {
    return API.post<Message>('/messages', { 
      recipient: recipientId, 
      content,
      type,
      postId
    });
  },

  // Upload a file
  uploadFile: (formData: FormData) => {
    return API.post<{ url: string, type: 'image' | 'file', filename: string }>('/messages/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Share a post via message
  sharePost: (recipientId: string, postId: string, message?: string) => {
    return API.post<Message>('/messages/share', {
      recipient: recipientId,
      postId,
      message
    });
  }
};

export default messagesAPI;