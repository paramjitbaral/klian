import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import { notificationsAPI, Notification } from '../src/api/notifications';
import { ICONS } from '../constants';
import { useSocket } from '../contexts/SocketContext';

const getImageUrl = (url: string | undefined) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `http://localhost:5000${url}`;
};

const getFileType = (url: string): 'image' | 'video' | 'doc' | 'other' => {
    if (!url) return 'other';
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext || '')) return 'video';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(ext || '')) return 'doc';
    return 'other';
};

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();
  const { socket } = useSocket();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await notificationsAPI.getNotifications();
        setNotifications(response.data);
        await notificationsAPI.markAllAsRead();
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewNotification = (notif: Notification) => setNotifications(prev => [notif, ...prev]);
    const handleDeleteEvent = (data: { id: number }) => setNotifications(prev => prev.filter(n => n.id !== data.id));
    socket.on('new_notification', handleNewNotification);
    socket.on('delete_notification', handleDeleteEvent);
    return () => {
      socket.off('new_notification');
      socket.off('delete_notification');
    };
  }, [socket]);

  const handleDeleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await notificationsAPI.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return `${Math.floor(diff / 604800)}w`;
  };

  const filteredNotifs = filter === 'all' ? notifications : notifications.filter(n => !n.isRead);

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#0b0e14] pb-20">
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center lg:hidden">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">Notifications</h1>
      </header>
      <div className="lg:hidden h-12"></div>
      
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 md:p-8">
        
        {/* Left Column: Stats & Filters */}
        <div className="lg:col-span-3 space-y-6 hidden lg:block">
           <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Activity Control</h2>
              <div className="space-y-1">
                 <button 
                  onClick={() => setFilter('all')}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${filter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                 >
                   All Activity
                 </button>
                 <button 
                  onClick={() => setFilter('unread')}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${filter === 'unread' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                 >
                   Unread
                 </button>
              </div>
           </div>

           <div className="bg-slate-900 dark:bg-slate-800 rounded-[24px] p-6 text-white shadow-xl">
              <h3 className="text-lg font-black tracking-tight mb-2 uppercase italic">Community</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">Stay connected with your community. Real-time updates on your interactions.</p>
              <div className="mt-4 flex -space-x-2">
                 {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold">
                       {String.fromCharCode(65+i)}
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Center Column: Notifications */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-2 mb-6">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Notifications</h1>
            <div className="lg:hidden flex gap-2">
               <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>All</button>
               <button onClick={() => setFilter('unread')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === 'unread' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Unread</button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="p-6 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                      <div className="h-3 bg-slate-50 dark:bg-slate-800 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifs.length === 0 ? (
              <div className="py-32 flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-200">
                  {ICONS.bell}
                </div>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Everything is clean</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredNotifs.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => notif.postId && navigate('/home', { state: { highlightPost: notif.postId } })}
                    className="group relative flex items-center gap-4 p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-all duration-200"
                  >
                    <div className="shrink-0">
                      <Avatar src={notif.actor.avatar} alt={notif.actor.name} size="lg" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-[14px] leading-[1.3] text-slate-900 dark:text-slate-100">
                        <span className="font-black hover:underline">{notif.actor?.name || 'System'}</span>
                        {' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          {notif.type === 'LIKE' ? 'liked your post.' : notif.type === 'COMMENT' ? 'commented on your post.' : notif.type === 'REPLY' ? 'replied to your comment.' : notif.type === 'EVENT_REMINDER' ? 'your event is starting now.' : 'interacted with your content.'}
                        </span>
                      </p>
                      
                      {notif.commentText && (
                        <div className="mt-2 p-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <p className="text-[13px] text-slate-600 dark:text-slate-300 italic line-clamp-2">
                            "{notif.commentText}"
                          </p>
                        </div>
                      )}
                      
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{getTimeAgo(notif.createdAt)}</span>
                        {!notif.isRead && (
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-4">
                      {notif.postPreview?.image && (() => {
                          const fileType = getFileType(notif.postPreview.image);
                          return (
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:scale-105 transition-transform">
                              {fileType === 'image' ? (
                                <img src={getImageUrl(notif.postPreview.image)} className="w-full h-full object-cover" alt="Post" />
                              ) : (
                                <div className="text-slate-400">
                                   <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                   </svg>
                                </div>
                              )}
                            </div>
                          );
                      })()}

                      <button 
                        onClick={(e) => handleDeleteNotification(e, notif.id)}
                        className="p-2 rounded-xl text-slate-200 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tips / Quick Actions */}
        <div className="lg:col-span-3 space-y-6 hidden xl:block">
           <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Pro Tip</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">You can delete any notification by hovering over it and clicking the (X) button on the right.</p>
           </div>
           
           <div className="bg-gradient-to-br from-blue-500 to-emerald-500 rounded-[24px] p-6 text-white shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4">
                 {ICONS.bell}
              </div>
              <h3 className="text-sm font-black uppercase tracking-tighter">Stay Notified</h3>
              <p className="text-[10px] text-white/80 font-medium mt-1 uppercase tracking-widest">Real-time alerts active</p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default NotificationsPage;
