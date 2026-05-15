import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
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
  const navigate = useNavigate();
  const { socket } = useSocket();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await notificationsAPI.getNotifications();
        setNotifications(response.data);
        // Mark all as read when opening the page
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
    
    const handleNewNotification = (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    };

    const handleDeleteNotification = (data: { id: number }) => {
      setNotifications(prev => prev.filter(n => n.id !== data.id));
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('delete_notification', handleDeleteNotification);

    return () => {
      socket.off('new_notification');
      socket.off('delete_notification');
    };
  }, [socket]);

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const getNotificationText = (notif: Notification) => {
    switch (notif.type) {
      case 'LIKE': return 'liked your post';
      case 'COMMENT': return 'commented on your post';
      case 'REPLY': return 'replied to your comment';
      case 'SHARE': return 'shared your post';
      default: return 'interacted with your content';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return <div className="text-red-500">{ICONS.likeSolid}</div>;
      case 'COMMENT': return <div className="text-blue-500">{ICONS.comment}</div>;
      case 'REPLY': return <div className="text-emerald-500">{ICONS.comment}</div>;
      default: return <div className="text-slate-400">{ICONS.bell}</div>;
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Notifications</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Activity from your community</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            {ICONS.bell}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-300">
              {ICONS.bell}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nothing to see here yet</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">When people engage with your content, you'll see it here.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <Card 
                key={notif.id}
                className={`p-4 transition-all hover:translate-x-1 cursor-pointer group ${!notif.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
                onClick={() => notif.postId && navigate('/home', { state: { highlightPost: notif.postId } })}
              >
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <Avatar src={notif.actor.avatar} alt={notif.actor.name} size="md" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-md border border-slate-50 dark:border-slate-800">
                       <div className="scale-75">
                         {getIcon(notif.type)}
                       </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      <span className="font-black text-slate-900 dark:text-white">{notif.actor.name}</span>
                      {' '}
                      <span className="font-medium">{getNotificationText(notif)}</span>
                    </p>
                    
                    {notif.commentText && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{notif.commentText}"</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{getTimeAgo(notif.createdAt)}</span>
                      {notif.postPreview?.content && (
                         <span className="text-[11px] font-medium text-slate-400 truncate max-w-[200px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                           Post: {notif.postPreview.content}
                         </span>
                      )}
                    </div>
                  </div>

                  {notif.postPreview?.image && (() => {
                      const fileType = getFileType(notif.postPreview.image);
                      return (
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 border-white dark:border-slate-800 shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                          {fileType === 'image' ? (
                            <img src={getImageUrl(notif.postPreview.image)} className="w-full h-full object-cover" alt="Post preview" />
                          ) : (
                            <div className="text-slate-400">
                               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                               </svg>
                            </div>
                          )}
                        </div>
                      );
                  })()}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage;
