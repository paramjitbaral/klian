import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from './ui/Avatar';
import { Card } from './ui/Card';
import { Notification, notificationsAPI } from '../src/api/notifications';
import { ICONS } from '../constants';

interface NotificationsDropdownProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onDelete: (id: number) => void;
  className?: string;
}

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

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ notifications, onClose, onMarkAllRead, onDelete, className }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDeleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await notificationsAPI.deleteNotification(id);
      onDelete(id);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (notif.postId) {
      navigate('/home', { state: { highlightPost: notif.postId } });
    }
    onClose();
  };

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
    <Card 
      className={className || `absolute top-full right-0 mt-2 w-[380px] overflow-hidden flex flex-col z-50 shadow-2xl border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200 transition-all ease-in-out ${isExpanded ? 'max-h-[80vh]' : 'max-h-[500px]'}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Notifications</h3>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={onMarkAllRead}
            className="text-[10px] font-bold text-blue-500 hover:text-blue-600 uppercase tracking-tight transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
        {notifications.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-300 dark:text-slate-600">
              {ICONS.bell}
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">No notifications yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">When people like or comment on your posts, they'll show up here.</p>
          </div>
        ) : (
          (isExpanded ? notifications : notifications.slice(0, 4)).map((notif) => (
            <div
              key={notif.id}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if(e.key === 'Enter') handleNotificationClick(notif) }}
              onClick={() => handleNotificationClick(notif)}
              className={`w-full flex items-start gap-3 p-3 md:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left border-b border-slate-50 dark:border-slate-800/50 last:border-0 cursor-pointer ${!notif.isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
            >
              <div className="relative shrink-0 mt-0.5 md:mt-0">
                <Avatar src={notif.actor.avatar} alt={notif.actor.name} size="xs" className="md:w-8 md:h-8" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                  <div className="scale-[0.6]">
                    {getIcon(notif.type)}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-slate-800 dark:text-slate-200 leading-snug">
                  <span className="font-bold text-slate-900 dark:text-white">{notif.actor.name}</span>
                  {' '}
                  {getNotificationText(notif)}
                </p>
                
                {notif.commentText && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 italic bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded-md border-l-2 border-slate-200 dark:border-slate-700">
                    "{notif.commentText}"
                  </p>
                )}
                
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-tighter flex items-center gap-2">
                  <span>{getTimeAgo(notif.createdAt)}</span>
                  {notif.postPreview?.content && (
                     <span className="truncate max-w-[100px] border-l border-slate-200 dark:border-slate-700 pl-2">
                       on: {notif.postPreview.content}
                     </span>
                  )}
                </p>
              </div>

              {notif.postPreview?.image && (() => {
                  const fileType = getFileType(notif.postPreview.image);
                  return (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                      {fileType === 'image' ? (
                        <img src={getImageUrl(notif.postPreview.image)} className="w-full h-full object-cover" alt="Post thumbnail" />
                      ) : (
                        <div className="text-slate-400">
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                           </svg>
                        </div>
                      )}
                    </div>
                  );
              })()}
              
               {!notif.isRead && (
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2"></div>
              )}

              <button 
                onClick={(e) => handleDeleteNotification(e, notif.id)}
                className="absolute right-2 top-2 p-1 rounded-md text-slate-200 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isExpanded ? 'Show less activity' : 'See all activity'}
          </button>
      </div>
    </Card>
  );
};