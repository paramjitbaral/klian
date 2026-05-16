import API from './index';

export interface Notification {
  id: number;
  type: 'LIKE' | 'COMMENT' | 'REPLY' | 'SHARE' | 'GROUP_ADDED' | 'EVENT_REMINDER';
  postId?: number | string;
  commentId?: number | string;
  groupId?: number | string;
  content?: string;
  commentText?: string;
  postPreview?: {
    content: string;
    image?: string;
  };
  isRead: boolean;
  createdAt: string;
  actor?: {
    id: number;
    name: string;
    avatar: string;
  } | null;
}

export const notificationsAPI = {
  getNotifications: () => {
    return API.get<Notification[]>('/notifications');
  },
  
  markAllAsRead: () => {
    return API.put('/notifications/read-all');
  },

  markAllTypeAsRead: (type: string) => {
    return API.put(`/notifications/read-type/${type}`);
  },

  deleteNotification: (id: number) => {
    return API.delete(`/notifications/${id}`);
  }
};

export default notificationsAPI;
