import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ICONS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../contexts/MessagesContext';
import { Avatar } from '../components/ui/Avatar';
import { MessageBubble } from '../components/MessageBubble';
import { Input } from '../components/ui/Input';
import { ChatInput } from '../components/ChatInput';
import { Card } from '../components/ui/Card';
import { MessageSearchDropdown } from '../components/MessageSearchDropdown';
import { messagesAPI } from '../src/api/messages';

export const MessagesPage: React.FC = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    conversations,
    messages,
    sendMessage,
    currentConversation,
    setCurrentConversation,
  } = useMessages();
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      if (conversationId !== currentConversation) {
        setCurrentConversation(conversationId);
      }
    } else {
      setCurrentConversation(null);
    }
  }, [conversationId, currentConversation, setCurrentConversation]);

  const handleSearchEmail = async (email: string) => {
    if (!email.includes('@')) return;
    
    setIsSearching(true);
    try {
      const response = await messagesAPI.searchByEmail(email);
      const users = response.data;
      
      if (users.length > 0) {
        const selectedUser = users[0];
        setCurrentConversation(selectedUser._id);
        navigate(`/messages/${selectedUser._id}`);
      }
      
      setSearchEmail('');
    } catch (error) {
      console.error('Error searching user:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'file' = 'text') => {
    if (!currentConversation || !content.trim()) return;
    await sendMessage(currentConversation, content, type);
  };

  const renderTime = (date?: string) => {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diff = now.getTime() - d.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days >= 1) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeConversation = conversations.find(c => c.user._id === currentConversation);

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900">
      {/* CONVERSATIONS LIST */}
      <aside className={`flex flex-col w-full md:w-[320px] lg:w-[360px] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${conversationId ? 'hidden md:flex' : 'flex'}`}>
          <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
            <button 
              onClick={() => navigate('/home')} 
              className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate flex-1">Messages</h1>
            <button 
              onClick={() => navigate('/groups')}
              className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
              title="Groups"
            >
              <div className="h-6 w-6">
                {ICONS.groups}
              </div>
            </button>
          </header>

          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <Input
                value={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                placeholder="Search users..."
                className="bg-slate-100 dark:bg-slate-700 rounded-lg"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {showSearchDropdown && searchEmail.trim().length > 0 && (
                <MessageSearchDropdown 
                  searchTerm={searchEmail}
                  onSelectUser={(user) => {
                    const id = (user as any).id || (user as any)._id;
                    if (!id) return;
                    setCurrentConversation(id);
                    navigate(`/messages/${id}`);
                    setShowSearchDropdown(false);
                    setSearchEmail('');
                  }}
                  onClose={() => {
                    setShowSearchDropdown(false);
                    setSearchEmail('');
                  }}
                />
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center p-6">
                <div>
                  <div className="text-5xl mb-3 text-slate-300 dark:text-slate-600">💬</div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No conversations yet</p>
                  <p className="text-slate-500 dark:text-slate-500 text-xs mt-1">Search for someone to start a chat</p>
                </div>
              </div>
            ) : (
              conversations.map((conv) => {
                const otherUser = conv.user;
                return (
                  <button
                    key={otherUser._id}
                    onClick={() => {
                      navigate(`/messages/${otherUser._id}`);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${
                      currentConversation === otherUser._id ? 'bg-slate-50 dark:bg-slate-700/50' : ''
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar src={otherUser.profilePicture} alt={otherUser.name} size="xl" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <p className="font-semibold text-sm truncate text-slate-900 dark:text-white">{otherUser.name}</p>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{renderTime(conv.lastMessage?.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 gap-2">
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{conv.lastMessage?.content || 'No messages yet'}</p>
                        {conv.unread && (
                          <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs rounded-full min-w-[20px] text-center font-semibold flex-shrink-0">
                            1
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${conversationId ? 'flex' : 'hidden md:flex'}`}>
        {currentConversation ? (
          (() => {
            // Find in conversations or create a placeholder from what we know
            const conv = conversations.find(c => String(c.user._id) === String(currentConversation));
            
            // Priority for display data: 
            // 1. Existing conversation 
            // 2. Passed state from previous page (instant!)
            // 3. Fallback to Loading
            const stateUser = (location.state as any)?.user;
            const displayUser = conv?.user || stateUser || { _id: currentConversation, name: 'Loading...', profilePicture: null };

            return (
              <>
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-[72px]">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => navigate('/messages')} 
                      className="md:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <Avatar src={displayUser.profilePicture} alt={displayUser.name} size="md" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">{displayUser.name}</h3>
                      <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400">
                        {conv ? 'Active recently' : 'Starting new chat...'}
                      </p>
                    </div>
                  </div>

              <div className="flex gap-2">
                {[ICONS.search, ICONS.moreHorizontal].map((icon, idx) => (
                  <button
                    key={idx}
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                    type="button"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 bg-white dark:bg-slate-900 flex flex-col">
              <div className="space-y-2">
                {messages.map((message) => (
                  <MessageBubble
                    key={message._id}
                    message={message}
                    isOwnMessage={String(message.sender._id) === String(user?.id || (user as any)?._id)}
                  />
                ))}
              </div>
              <div ref={messagesEndRef} />
            </div>

              <ChatInput onSendMessage={handleSendMessage} />
            </>
          );
        })()
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 p-12">
            <div className="text-center animate-in fade-in duration-500 flex flex-col items-center">
              <div className="mb-6 opacity-20 scale-[2.5] text-slate-400">
                {ICONS.messages}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Your Messages</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-[280px]">
                Search for someone to start a conversation or jump into your groups.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
