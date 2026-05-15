import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { announcementsAPI } from '../src/api/announcements';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from './ui/Avatar';
import { Card } from './ui/Card';
import { ICONS } from '../constants';

interface Announcement {
  _id: string;
  title: string;
  content: string;
  author: {
    _id: string;
    name: string;
    avatar: string;
    role: string;
  };
  target: string;
  isRead: boolean;
  createdAt: string;
}

interface AnnouncementsDropdownProps {
  onClose: () => void;
  isOpen?: boolean;
}

export const AnnouncementsDropdown: React.FC<AnnouncementsDropdownProps> = ({ onClose, isOpen }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen !== false) {
      fetchAnnouncements();
      // Auto-mark all as read when opening
      handleMarkAllAsRead();
    }

    if (socket) {
      const handleNewAnnouncement = (newAnnouncement: Announcement) => {
        setAnnouncements(prev => {
          const exists = prev.some(ann => ann._id === newAnnouncement._id);
          if (exists) return prev;
          return [newAnnouncement, ...prev];
        });
        // If dropdown is open, mark the incoming one as read too
        if (isOpen !== false) {
            handleMarkAllAsRead();
        }
      };
      socket.on('announcement-created', handleNewAnnouncement);
      return () => {
        socket.off('announcement-created');
      };
    }
  }, [socket, isOpen]);

  const handleMarkAllAsRead = async () => {
    try {
      await announcementsAPI.markAllAsRead();
      setAnnouncements(prev => prev.map(ann => ({ ...ann, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementsAPI.getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      console.error('Failed to load announcements', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (announcementId: string) => {
    try {
      await announcementsAPI.markAsRead(announcementId);
      setAnnouncements(prev =>
        prev.map(ann =>
          ann._id === announcementId ? { ...ann, isRead: true } : ann
        )
      );
    } catch (err) {
      console.error('Failed to mark announcement as read', err);
    }
  };

  const handleDeleteAnnouncement = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Assuming a delete endpoint exists or we just hide it locally
    setAnnouncements(prev => prev.filter(ann => ann._id !== id));
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString();
  };

  const unreadCount = announcements.filter(ann => !ann.isRead).length;

  return (
    <Card 
      className={`absolute top-full right-0 mt-2 w-[380px] overflow-hidden flex flex-col z-50 shadow-2xl border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200 transition-all ease-in-out ${isExpanded ? 'max-h-[80vh]' : 'max-h-[500px]'}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Announcements</h3>
        {unreadCount > 0 && (
          <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">
            {unreadCount} new
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
        {loading ? (
          <div className="p-10 space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                  <div className="h-2 bg-slate-50 dark:bg-slate-800 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-300 dark:text-slate-600">
               {ICONS.announcement}
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">No announcements</p>
          </div>
        ) : (
          (isExpanded ? announcements : announcements.slice(0, 4)).map((ann) => (
            <div
              key={ann._id}
              onClick={() => handleMarkAsRead(ann._id)}
              className={`group relative flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${!ann.isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
            >
              <div className="shrink-0 relative">
                <Avatar src={ann.author.avatar} alt={ann.author.name} size="sm" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                   <div className="text-blue-500 scale-[0.6]">
                      {ICONS.announcement}
                   </div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                   <span className="text-[12px] font-bold text-slate-900 dark:text-white truncate">{ann.author.name}</span>
                   <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-tighter shrink-0">{getTimeAgo(ann.createdAt)}</span>
                </div>
                <p className="text-[11px] font-black text-blue-500 uppercase tracking-tight mt-0.5">{ann.title}</p>
                <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-snug">
                  {ann.content}
                </p>
              </div>

              {!ann.isRead && (
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2"></div>
              )}

              <button 
                onClick={(e) => handleDeleteAnnouncement(e, ann._id)}
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
