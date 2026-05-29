import API from './index';

// Groups API services
export const groupsAPI = {
  // Get all groups
  getGroups: () => {
    return API.get('/groups');
  },
  
  // Get a single group by ID
  getGroup: (groupId: string) => {
    return API.get(`/groups/${groupId}`);
  },
  
  // Create a new group
  createGroup: (groupData: any) => {
    return API.post('/groups', groupData);
  },
  
  // Update a group
  updateGroup: (groupId: string, groupData: any) => {
    return API.put(`/groups/${groupId}`, groupData);
  },
  
  // Delete a group message
  deleteMessage: (groupId: string, msgId: string) => {
    return API.delete(`/groups/${groupId}/messages/${msgId}`);
  },

  // Delete a group
  deleteGroup: (groupId: string) => {
    return API.delete(`/groups/${groupId}`);
  },
  
  // Join a group
  joinGroup: (groupId: string) => {
    return API.put(`/groups/${groupId}/join`);
  },
  
  // Leave a group
  leaveGroup: (groupId: string) => {
    return API.put(`/groups/${groupId}/leave`);
  },

  // Add members to a group
  addMembers: (groupId: string, userIds: string[]) => {
    return API.post(`/groups/${groupId}/members`, { userIds });
  },

  // Update notification setting
  updateNotificationSetting: (groupId: string, setting: 'all' | 'mentions' | 'off') => {
    return API.put(`/groups/${groupId}/notification-setting`, { setting });
  },

  // Mark group as read
  markAsRead: (groupId: string) => {
    return API.put(`/groups/${groupId}/read`);
  },
  
  // Remove a member from a group
  removeMember: (groupId: string, userId: string) => {
    return API.delete(`/groups/${groupId}/members/${userId}`);
  },
  
  // Update a member's role
  updateMemberRole: (groupId: string, userId: string, role: 'admin' | 'member') => {
    return API.put(`/groups/${groupId}/members/role`, { userId, role });
  }
};

export default groupsAPI;
