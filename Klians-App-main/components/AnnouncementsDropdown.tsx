import React, { useState, useEffect } from 'react';
import { announcementsAPI } from '../src/api/announcements';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';

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
  const [error, setError] = useState('');
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    // Fetch announcements when dropdown opens
    if (isOpen !== false) {
      fetchAnnouncements();
    }

    // Listen for new announcements
    if (socket) {
      socket.on('announcement-created', (newAnnouncement) => {
        setAnnouncements(prev => {
          // Check if announcement already exists to prevent duplicates
          const exists = prev.some(ann => ann._id === newAnnouncement._id);
          if (exists) return prev;
          return [newAnnouncement, ...prev];
        });
      });

      return () => {
        socket.off('announcement-created');
      };
    }
  }, [socket, isOpen]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementsAPI.getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setError('Failed to load announcements');
      console.error(err);
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

  const unreadCount = announcements.filter(ann => !ann.isRead).length;

  return (
    <>
      {/* Mobile Overlay */}
      <div className="fixed md:hidden inset-0 bg-black/50 z-40" onClick={onClose} />
      
      {/* Dropdown */}
      <div className="fixed md:absolute right-0 md:right-0 top-16 md:top-12 left-0 md:left-auto md:w-96 w-full md:rounded-lg rounded-t-lg bg-white dark:bg-slate-800 shadow-xl border-t md:border border-slate-200 dark:border-slate-700 z-50 max-h-[70vh] md:max-h-96 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between rounded-t-lg">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Announcements</h3>
            {unreadCount > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{unreadCount} new</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              Loading announcements...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : announcements.length === 0 ? (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              No announcements yet
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement._id}
                className={`border-b border-slate-100 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer ${
                  !announcement.isRead ? 'bg-blue-50 dark:bg-slate-700/30' : ''
                }`}
                onClick={() => handleMarkAsRead(announcement._id)}
              >
                {/* Author Info */}
                <div className="flex items-start gap-3 mb-2">
                  <img
                    src={announcement.author.avatar}
                    alt={announcement.author.name}
                    className="h-8 w-8 rounded-full flex-shrink-0 object-cover"
                    style={{ aspectRatio: '1/1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                      {announcement.author.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {announcement.author.role}
                    </p>
                  </div>
                  {!announcement.isRead && (
                    <div className="h-2 w-2 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                  )}
                </div>

                {/* Title */}
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1 line-clamp-2">
                  {announcement.title}
                </h4>

                {/* Content Preview */}
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">
                  {announcement.content}
                </p>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-2">
                  <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                    {announcement.target}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {unreadCount > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-700 p-3 text-center sticky bottom-0 bg-white dark:bg-slate-800">
            <a
              href="/announcements"
              onClick={() => {
                // Mark all as read before navigating
                announcements.forEach(ann => {
                  if (!ann.isRead) handleMarkAsRead(ann._id);
                });
                onClose();
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all announcements
            </a>
          </div>
        )}
      </div>
    </>
  );
};
