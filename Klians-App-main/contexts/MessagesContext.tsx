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
  sendMessage: (recipientId: string, content: string, type?: 'text' | 'post', postId?: string) => Promise<void>;
  sharePost: (recipientId: string, postId: string, message?: string) => Promise<void>;
  setCurrentConversation: (userId: string | null) => void;
  unreadCount: number;
}

const MessagesContext = createContext<MessagesContextType>({
  conversations: [],
  currentConversation: null,
  messages: [],
  sendMessage: async () => {},
  sharePost: async () => {},
  setCurrentConversation: () => {},
  unreadCount: 0
});

export const useMessages = () => useContext(MessagesContext);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Helper function to get user ID (handle both _id and id)
  const getUserId = (userObj: any) => userObj?._id || userObj?.id;

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
        setMessages(response.data);
        
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

    socket.on('new-message', (message: Message) => {
      const userId = getUserId(user);
      console.log('--- Real-time Message Received ---');
      console.log('My ID:', userId);
      console.log('Sender ID:', message.sender._id);
      console.log('Recipient ID:', message.recipient._id);
      
      const otherUserId = String(message.sender._id) === String(userId) ? message.recipient._id : message.sender._id;
      
      if (String(currentConversation) === String(otherUserId)) {
        setMessages(prev => {
          // Remove any temporary messages (optimistic updates)
          const filteredMessages = prev.filter(msg => !String(msg._id).startsWith('temp_'));
          
          // Check if message already exists (avoid duplicates)
          const existingMessage = filteredMessages.find(msg => String(msg._id) === String(message._id));
          if (existingMessage) {
            return filteredMessages;
          }
          
          return [...filteredMessages, message];
        });
      }
      
      // Mark as read if we're the recipient and in current conversation
      if (message.recipient._id === userId && currentConversation === message.sender._id) {
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
      setUnreadCount(prev => message.sender._id !== userId && !message.read ? prev + 1 : prev);
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

    return () => {
      socket.off('new-message');
      socket.off('messages-marked-read');
    };
  }, [socket, user, currentConversation]);

  const sendMessage = async (recipientId: string, content: string, type: 'text' | 'post' = 'text', postId?: string) => {
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
        unreadCount
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
};