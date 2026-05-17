import React, { useEffect, useRef, useState } from 'react';
import { notificationsAPI } from '../src/api/notifications';
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
import { groupsAPI } from '../src/api/groups';
import { useSocket } from '../contexts/SocketContext';

const formatDividerDate = (dateString: string) => {
  const d = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
  if (msgDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (msgDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

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
    unreadCount: dmUnreadCount,
    groupUnreadCount,
    groupAddedNotifsCount,
    refreshGroupCounts
  } = useMessages();
  const { socket } = useSocket();
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    setIsSearchingMessages(false);
    setMessageSearchQuery('');
    if (conversationId) {
      if (conversationId !== currentConversation) {
        setCurrentConversation(conversationId);
      }
    } else {
      setCurrentConversation(null);
    }
  }, [conversationId, currentConversation, setCurrentConversation]);

  // Socket and other effects continue below...

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

  const scrollToMessage = (msgId: string) => {
    const element = document.getElementById(`message-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Flash highlight animation
      element.classList.add(
        'bg-blue-100/40', 
        'dark:bg-blue-900/40', 
        'ring-2', 
        'ring-blue-500/50', 
        'rounded-xl', 
        'p-2', 
        'transition-all', 
        'duration-300'
      );
      setTimeout(() => {
        element.classList.remove(
          'bg-blue-100/40', 
          'dark:bg-blue-900/40', 
          'ring-2', 
          'ring-blue-500/50', 
          'rounded-xl', 
          'p-2'
        );
      }, 2000);
    }
  };

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'file' | 'post' = 'text') => {
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
  const hasConversations = conversations.length > 0;

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
              className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 relative"
              title="Groups"
            >
              <div className="h-6 w-6">
                {ICONS.groups}
              </div>
              {(groupUnreadCount > 0 || groupAddedNotifsCount > 0) && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 animate-in zoom-in duration-300">
                  {(groupUnreadCount + groupAddedNotifsCount) > 9 ? '9+' : (groupUnreadCount + groupAddedNotifsCount)}
                </span>
              )}
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
                <div className="max-w-[240px]">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm border border-slate-100 dark:border-slate-700">
                    {ICONS.messagesOff}
                  </div>
                  <p className="text-slate-900 dark:text-white text-base font-semibold">No chats yet</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">Search for someone to start a chat. Your messages will appear here once a conversation begins.</p>
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
                    className={`w-full text-left flex items-center p-4 space-x-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-l-4 ${
                      String(currentConversation) === String(otherUser._id) ? 'border-red-500 bg-slate-50 dark:bg-slate-900/50' : 'border-transparent'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar src={otherUser.profilePicture} alt={otherUser.name} size="md" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="font-semibold text-sm truncate text-slate-900 dark:text-white">{otherUser.name}</p>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 ml-2">{renderTime(conv.lastMessage?.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{conv.lastMessage?.content || 'No messages yet'}</p>
                        {conv.unread && (
                          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse-subtle flex-shrink-0">
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
                <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 h-[65px] flex-shrink-0">
                  <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
                    <button 
                      onClick={() => navigate('/messages')} 
                      className="md:hidden p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <Avatar src={displayUser.profilePicture} alt={displayUser.name} size="md" />
                    <div className="min-w-0">
                      <h3 className="text-[17px] font-semibold text-slate-900 dark:text-white truncate">{displayUser.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {conv ? 'Active recently' : 'Starting new chat...'}
                      </p>
                    </div>
                  </div>

                  {/* Header controls: Shows search input extending leftward on click */}
                  <div className="flex items-center space-x-2 flex-1 justify-end ml-4 min-w-0">
                    {isSearchingMessages ? (
                      <div className="flex items-center gap-3 w-full max-w-[200px] sm:max-w-[280px] md:max-w-[340px] animate-in slide-in-from-right duration-300">
                        <div className="relative flex-1">
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 flex items-center justify-center">
                            {ICONS.search}
                          </span>
                          <input
                            type="text"
                            value={messageSearchQuery}
                            onChange={(e) => setMessageSearchQuery(e.target.value)}
                            placeholder="Search chat..."
                            className="w-full bg-transparent text-slate-900 dark:text-white pl-7 pr-6 py-1 text-xs border-b border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:outline-none transition-colors rounded-none"
                            autoFocus
                          />
                          {messageSearchQuery && (
                            <button
                              onClick={() => setMessageSearchQuery('')}
                              className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[10px] font-bold p-1"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setIsSearchingMessages(false);
                            setMessageSearchQuery('');
                          }}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-1 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex-shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1">
                        {[(hasConversations ? ICONS.search : ICONS.messagesOff), ICONS.moreHorizontal].map((icon, idx) => (
                          <button
                            key={idx}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                            type="button"
                            onClick={idx === 0 && hasConversations ? () => {
                              setIsSearchingMessages(true);
                              setMessageSearchQuery('');
                            } : undefined}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </header>

                <div className="relative flex-1 flex flex-col overflow-hidden">
                  {messageSearchQuery.trim().length > 0 && (
                    <div className="absolute top-2 right-4 z-30 w-72 max-h-[320px] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 space-y-1 scrollbar-hide animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50 mb-1 flex justify-between">
                        <span>Search Results</span>
                        <span>
                          {
                            messages.filter(msg => 
                              msg.type === 'text' && 
                              msg.content && 
                              msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase())
                            ).length
                          } found
                        </span>
                      </div>
                      {(() => {
                        const filtered = messages.filter(msg => 
                          msg.type === 'text' && 
                          msg.content && 
                          msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase())
                        );
                        
                        if (filtered.length === 0) {
                          return (
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4 italic">
                              No matching messages.
                            </p>
                          );
                        }

                        return filtered.map((msg) => (
                          <button
                            key={msg._id}
                            onClick={() => scrollToMessage(msg._id)}
                            className="w-full text-left p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors flex flex-col gap-0.5 border border-transparent hover:border-slate-100 dark:hover:border-slate-600/30"
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className="font-bold text-[10px] text-blue-500 uppercase tracking-wider truncate max-w-[150px]">
                                {msg.sender.name}
                              </span>
                              <span className="text-[9px] text-slate-400 flex-shrink-0">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 truncate leading-tight">
                              {msg.content}
                            </p>
                          </button>
                        ));
                      })()}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 bg-white dark:bg-slate-900 flex flex-col">
                    <div className="space-y-2">
                      {messages.map((message, index) => {
                        const showDivider = index === 0 || (() => {
                          const prevMsg = messages[index - 1];
                          const prevDate = new Date(prevMsg.createdAt).toDateString();
                          const currDate = new Date(message.createdAt).toDateString();
                          return prevDate !== currDate;
                        })();

                        return (
                          <React.Fragment key={message._id}>
                            {showDivider && (
                              <div className="flex justify-center my-4 animate-in fade-in duration-300 select-none">
                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 rounded-full tracking-wider shadow-sm uppercase border border-slate-200/50 dark:border-slate-700/50">
                                  {formatDividerDate(message.createdAt)}
                                </span>
                              </div>
                            )}
                            <div id={`message-${message._id}`} className="transition-all duration-300">
                              <MessageBubble
                                message={message}
                                isOwnMessage={String(message.sender._id) === String(user?.id || (user as any)?._id)}
                              />
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div ref={messagesEndRef} />
                  </div>
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
