import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from '../hooks/useAuth';
import { messagesAPI } from '../src/api/messages';
import { usersAPI } from '../src/api/users';

interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    email: string;
    profilePicture: string;
  };
  recipient: {
    _id: string;
    name: string;
    email: string;
    profilePicture: string;
  };
  content: string;
  type: 'text' | 'post' | 'image' | 'file';
  postId?: any; // Can be string ID or full post object with content, image, user
  read: boolean;
  createdAt: string;
}

interface Conversation {
  user: {
    _id: string;
    name: string;
    email: string;
    profilePicture: string;
  };
  lastMessage: Message;
  unread: boolean;
}

interface MessagesContextType {
  conversations: Conversation[];
  currentConversation: string | null;
  messages: Message[];
  sendMessage: (recipientId: string, content: string, type?: 'text' | 'image' | 'file' | 'post', postId?: string) => Promise<void>;
  sharePost: (recipientId: string, postId: string, message?: string) => Promise<void>;
  setCurrentConversation: (userId: string | null) => void;
  unreadCount: number;
  groupUnreadCount: number;
  groupAddedNotifsCount: number;
  refreshGroupCounts: () => Promise<void>;
  clearGroupUnreadCount: (amount: number) => void;
}

const MessagesContext = createContext<MessagesContextType>({
  conversations: [],
  currentConversation: null,
  messages: [],
  sendMessage: async () => {},
  sharePost: async () => {},
  setCurrentConversation: () => {},
  unreadCount: 0,
  groupUnreadCount: 0,
  groupAddedNotifsCount: 0,
  refreshGroupCounts: async () => {},
  clearGroupUnreadCount: () => {}
});

export const useMessages = () => useContext(MessagesContext);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [groupUnreadCount, setGroupUnreadCount] = useState(0);
  const [groupAddedNotifsCount, setGroupAddedNotifsCount] = useState(0);
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [initialLoaded, setInitialLoaded] = useState(false);



  // Helper function to get user ID (handle both _id and id)
  const getUserId = (userObj: any) => userObj?._id || userObj?.id;

  const normalizeTimestamp = (value: any) => {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return new Date().toISOString();
  };

  const normalizeMessage = React.useCallback((raw: any): Message => {
    const fallbackSender = {
      _id: String(raw?.senderId || ''),
      name: raw?.senderName || 'User',
      email: raw?.senderEmail || '',
      profilePicture: raw?.senderProfilePicture || '',
    };
    const fallbackRecipient = {
      _id: String(raw?.recipientId || ''),
      name: raw?.recipientName || 'User',
      email: raw?.recipientEmail || '',
      profilePicture: raw?.recipientProfilePicture || '',
    };

    const sender = raw?.sender
      ? {
          _id: String(raw.sender._id || raw.sender.id || ''),
          name: raw.sender.name || 'User',
          email: raw.sender.email || '',
          profilePicture: raw.sender.profilePicture || raw.sender.avatar || '',
        }
      : fallbackSender;
    const recipient = raw?.recipient
      ? {
          _id: String(raw.recipient._id || raw.recipient.id || ''),
          name: raw.recipient.name || 'User',
          email: raw.recipient.email || '',
          profilePicture: raw.recipient.profilePicture || raw.recipient.avatar || '',
        }
      : fallbackRecipient;

    return {
      _id: String(raw?._id || raw?.id || `temp_${Date.now()}`),
      sender,
      recipient,
      content: raw?.content || raw?.text || '',
      type: raw?.type || 'text',
      postId: raw?.postId,
      read: !!raw?.read,
      createdAt: normalizeTimestamp(raw?.createdAt || raw?.created_at || raw?.timestamp),
    };
  }, []);

  useEffect(() => {
    const count = conversations.reduce((acc, conv) => acc + (conv.unread ? 1 : 0), 0);
    console.log('--- Unread Count Sync ---');
    console.log('Conversations:', conversations.length);
    console.log('Unread Count:', count);
    setUnreadCount(count);
  }, [conversations]);

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      if (!user) return;
      try {
        const response = await messagesAPI.getConversations();
        setConversations(response.data);
        setUnreadCount(response.data.filter((conv: Conversation) => conv.unread).length);
      } catch (error) {
        console.error('Error loading conversations:', error);
      }
    };

    loadConversations();
  }, [user]);

  const refreshGroupCounts = React.useCallback(async () => {

    if (!user) return;
    try {
      const [groupsRes, notifRes] = await Promise.all([
        import('../src/api/groups').then(m => m.groupsAPI.getGroups()),
        import('../src/api/notifications').then(m => m.notificationsAPI.getNotifications())
      ]);
      
      const total = groupsRes.data.reduce((acc: number, g: any) => acc + (g.unreadCount || 0), 0);
      setGroupUnreadCount(total);
      
      const groupAddedCount = notifRes.data.filter((n: any) => n.type === 'GROUP_ADDED' && !n.isRead).length;
      setGroupAddedNotifsCount(groupAddedCount);
    } catch (error) {
      console.error('Error refreshing group counts:', error);
    }
  }, [user]);

  // Debounced version for socket events to avoid race conditions
  const debouncedRefreshGroupCounts = React.useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshGroupCounts();
    }, 500);
  }, [user, refreshGroupCounts]);

  useEffect(() => {
    if (user) {
      refreshGroupCounts();
    }
  }, [user, refreshGroupCounts]);

  const clearGroupUnreadCount = React.useCallback((amount: number) => {
    setGroupUnreadCount(prev => Math.max(0, prev - amount));
  }, []);

  // Load messages for current conversation
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentConversation || !user) return;
      
      try {
        // If this user is not in our conversations list yet, fetch their info
        const exists = conversations.some(c => String(c.user._id) === String(currentConversation));
        if (!exists) {
          try {
            const userRes = await usersAPI.getUserById(currentConversation);
            const targetUser = userRes.data;
            
            // Add a placeholder conversation
            setConversations(prev => {
              if (prev.some(c => c.user._id === targetUser.id || c.user._id === targetUser._id)) return prev;
              return [{
                user: {
                  _id: targetUser.id || targetUser._id,
                  name: targetUser.name,
                  email: targetUser.email,
                  profilePicture: targetUser.profilePicture
                },
                lastMessage: null as any,
                unread: false
              }, ...prev];
            });
          } catch (err) {
            console.error('Error fetching target user:', err);
          }
        }

        const response = await messagesAPI.getMessagesWith(currentConversation);
        setMessages((response.data || []).map((m: any) => normalizeMessage(m)));
        
        // Mark messages as read locally
        setConversations(prev => prev.map(conv => {
          if (String(conv.user._id) === String(currentConversation)) {
            return { ...conv, unread: false };
          }
          return conv;
        }));
        
        // Mark messages as read on server
        if (socket && user) {
          socket.emit('mark-messages-read', {
            userId: getUserId(user),
            senderId: currentConversation
          });
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [currentConversation, user, socket]);

  // Listen for new messages
  useEffect(() => {
    if (!socket || !user) return;

    socket.on('new-message', (incomingMessage: any) => {
      const message = normalizeMessage(incomingMessage);
      const userId = getUserId(user);
      console.log('--- Real-time Message Received ---');
      console.log('My ID:', userId);
      console.log('Sender ID:', message.sender._id);
      console.log('Recipient ID:', message.recipient._id);
      
      const otherUserId = String(message.sender._id) === String(userId) ? message.recipient._id : message.sender._id;
      
      if (String(currentConversation) === String(otherUserId)) {
        setMessages(prev => {
          // Remove matching optimistic message for this conversation only
          const filteredMessages = prev.filter(msg => {
            const isTemp = String(msg._id).startsWith('temp_');
            const msgOtherUserId = String(msg.sender._id) === String(userId) ? msg.recipient._id : msg.sender._id;
            return !(isTemp && String(msgOtherUserId) === String(otherUserId) && msg.content === message.content && msg.type === message.type);
          });
          
          // Check if message already exists (avoid duplicates)
          const existingMessage = filteredMessages.find(msg => String(msg._id) === String(message._id));
          if (existingMessage) {
            return filteredMessages;
          }
          
          return [...filteredMessages, message];
        });
      }
      
      // Mark as read if we're the recipient and in current conversation
      if (String(message.recipient._id) === String(userId) && String(currentConversation) === String(message.sender._id)) {
        socket.emit('mark-messages-read', {
          userId: userId,
          senderId: message.sender._id
        });
      }

      // Update conversations list
      setConversations(prev => {
        const userId = getUserId(user);
        const otherUser = String(message.sender._id) === String(userId) ? message.recipient : message.sender;
        const otherConversations = prev.filter(c => String(c.user._id) !== String(otherUser._id));
        
        return [{
          user: otherUser,
          lastMessage: message,
          unread: String(message.sender._id) !== String(userId) && String(currentConversation) !== String(otherUser._id)
        }, ...otherConversations];
      });

      // Update unread count
      setUnreadCount(prev => String(message.sender._id) !== String(userId) && !message.read ? prev + 1 : prev);
    });

    socket.on('messages-marked-read', ({ by }) => {
      if (by === currentConversation) {
        setMessages(prev =>
          prev.map(msg => ({
            ...msg,
            read: true
          }))
        );
      }
    });

    // Group related socket events — use debounced for background events
    const handleGroupUpdate = () => {
        debouncedRefreshGroupCounts();
    };

    const handleNewNotification = (notif: any) => {
        if (notif.type === 'GROUP_ADDED') {
            setGroupAddedNotifsCount(prev => prev + 1);
        }
    };



    socket.on('new_group_message', handleGroupUpdate);
    socket.on('group_added_to', handleGroupUpdate);
    socket.on('group_removed_from', handleGroupUpdate);
    socket.on('new_notification', handleNewNotification);
    socket.on('update_notification', (data: any) => {
        if (data.type === 'GROUP_ADDED' && data.isRead) {
            setGroupAddedNotifsCount(prev => Math.max(0, prev - 1));
        debouncedRefreshGroupCounts();
        }
    });

    socket.on('group_marked_read', (data: any) => {
      // Optimistically reduce count for this specific group before re-fetching
      refreshGroupCounts();
    });

    return () => {
      socket.off('new-message');
      socket.off('messages-marked-read');
      socket.off('new_group_message', handleGroupUpdate);
      socket.off('group_added_to', handleGroupUpdate);
      socket.off('group_removed_from', handleGroupUpdate);
      socket.off('new_notification', handleNewNotification);
      socket.off('update_notification');
      socket.off('group_marked_read');
    };
  }, [socket, user, currentConversation, normalizeMessage]);

  const sendMessage = async (recipientId: string, content: string, type: 'text' | 'image' | 'file' | 'post' = 'text', postId?: string) => {
    if (!socket || !user) {
      console.log('Cannot send message: missing socket or user', { socket: !!socket, user: !!user });
      return;
    }

    console.log('Sending message:', { recipientId, content, type, postId });
    console.log('User object:', user);
    const currentUserId = getUserId(user);
    console.log('User ID:', currentUserId);

    // Find recipient info
    let recipientInfo = conversations.find(c => String(c.user._id) === String(recipientId))?.user;
    
    // If not found in conversations, check if we're currently viewing this user
    if (!recipientInfo && messages.length > 0) {
      const msg = messages.find(m => String(m.sender._id) === String(recipientId) || String(m.recipient._id) === String(recipientId));
      if (msg) {
        recipientInfo = String(msg.sender._id) === String(recipientId) ? msg.sender : msg.recipient;
      }
    }

    // If still not found, create minimal recipient info
    if (!recipientInfo) {
      recipientInfo = {
        _id: recipientId,
        name: 'Admin', // Default to Admin if ID is likely admin, but better to keep current name
        email: '',
        profilePicture: ''
      };
    }

    // Create optimistic message with timestamp-based temporary ID
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      _id: tempId,
      sender: {
        _id: currentUserId,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture || user.avatar
      },
      recipient: recipientInfo,
      content,
      type,
      postId,
      read: false,
      createdAt: new Date().toISOString()
    };

    // Update messages optimistically only if this is the current conversation
    if (String(currentConversation) === String(recipientId)) {
      setMessages(prev => [...prev, optimisticMessage]);
    }

    // Update conversations optimistically
    setConversations(prev => {
      const otherConversations = prev.filter(c => String(c.user._id) !== String(recipientId));
      return [{
        user: recipientInfo,
        lastMessage: optimisticMessage,
        unread: false
      }, ...otherConversations];
    });

    // Send to server
    console.log('Emitting private-message event to server');
    socket.emit('private-message', {
      senderId: currentUserId,
      recipientId,
      content,
      type,
      postId
    });
  };

  const sharePost = async (recipientId: string, postId: string, message?: string) => {
    if (!socket || !user) return;

    socket.emit('share-post', {
      senderId: user._id,
      recipientId,
      postId,
      message
    });
  };

  return (
    <MessagesContext.Provider
      value={{
        conversations,
        currentConversation,
        messages,
        sendMessage,
        sharePost,
        setCurrentConversation,
        unreadCount,
        groupUnreadCount,
        groupAddedNotifsCount,
        refreshGroupCounts,
        clearGroupUnreadCount
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
};