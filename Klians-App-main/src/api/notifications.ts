import API from './index';

export interface Notification {
  id: number;
  type: 'LIKE' | 'COMMENT' | 'REPLY' | 'SHARE';
  postId?: number | string;
  commentId?: number | string;
  commentText?: string;
  postPreview?: {
    content: string;
    image?: string;
  };
  isRead: boolean;
  createdAt: string;
  actor: {
    id: number;
    name: string;
    avatar: string;
  };
}

export const notificationsAPI = {
  getNotifications: () => {
    return API.get<Notification[]>('/notifications');
  },
  
  markAllAsRead: () => {
    return API.put('/notifications/read-all');
  }
};

export default notificationsAPI;
