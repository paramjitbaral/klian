import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../contexts/SocketContext';
import { announcementsAPI } from '../src/api/announcements';
import { Role } from '../types';
import { Modal } from '../components/ui/Modal';

interface Announcement {
  id: string;
  _id?: string;
  title: string;
  content: string;
  author: {
    id?: string;
    _id?: string;
    name: string;
    avatar: string;
    role: string;
  };
  target: string;
  isRead: boolean;
  createdAt: string;
}

export const AnnouncementsPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target: 'All'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTeacherOrAdmin = user && (user.role === Role.TEACHER || user.role === Role.ADMIN);

  useEffect(() => {
    fetchAnnouncements();

    if (socket) {
      socket.on('announcement-created', (newAnnouncement: any) => {
        // Filter by role before adding to state
        const target = (newAnnouncement.target || 'All').toLowerCase();
        const role = user?.role?.toLowerCase() || '';
        
        const isAdmin = role === 'admin';
        const isTeacher = role === 'teacher';
        
        let isVisible = false;
        if (isAdmin) {
          isVisible = true;
        } else if (isTeacher) {
          isVisible = ['all', 'all users', 'teacher', 'teachers'].includes(target);
        } else {
          isVisible = ['all', 'all users', 'student', 'students'].includes(target);
        }

        if (!isVisible) return;

        const incomingId = String(newAnnouncement.id || newAnnouncement._id);
        setAnnouncements(prev => {
          if (prev.some(a => String(a.id || a._id) === incomingId)) return prev;
          return [{ ...newAnnouncement, id: incomingId }, ...prev];
        });
      });

      return () => {
        socket.off('announcement-created');
      };
    }
  }, [socket]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementsAPI.getAnnouncements();
      setAnnouncements(data);
      setError('');
    } catch (err) {
      setError('Failed to load announcements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const newAnnouncement = await announcementsAPI.createAnnouncement(formData);
      
      // Don't add locally; let socket event handle it for all users
      // If socket not available, add it locally
      if (!socket) {
        setAnnouncements(prev => [newAnnouncement, ...prev]);
      }
      
      setFormData({ title: '', content: '', target: 'All' });
      setIsCreateModalOpen(false);
    } catch (err) {
      setError('Failed to create announcement');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsRead = async (announcementId: string) => {
    try {
      await announcementsAPI.markAsRead(announcementId);
      setAnnouncements(prev =>
        prev.map(ann =>
          String(ann.id || ann._id) === announcementId ? { ...ann, isRead: true } : ann
        )
      );
    } catch (err) {
      console.error('Failed to mark announcement as read', err);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await announcementsAPI.deleteAnnouncement(announcementId);
        setAnnouncements(prev => prev.filter(ann => String(ann.id || ann._id) !== announcementId));
      } catch (err) {
        setError('Failed to delete announcement');
        console.error(err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.history.state?.idx > 0 ? window.history.back() : window.location.href = '/home'} 
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Announcements</h1>
          </div>
          {isTeacherOrAdmin && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition whitespace-nowrap"
            >
              + New Announcement
            </button>
          )}
        </div>

        {/* Create Modal */}
        {isTeacherOrAdmin && (
          <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg w-full max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Create Announcement
              </h2>
              <form onSubmit={handleCreateAnnouncement} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="Announcement title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Content
                  </label>
                  <textarea
                    placeholder="Announcement content"
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Audience
                  </label>
                  <select
                    value={formData.target}
                    onChange={(e) =>
                      setFormData({ ...formData, target: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="All">All</option>
                    <option value="Student">Students</option>
                    <option value="Teacher">Teachers</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-slate-100 rounded-lg font-medium transition hover:bg-slate-400 dark:hover:bg-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </Modal>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Announcements List */}
        <div className="space-y-3 sm:space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              Loading announcements...
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              No announcements yet
            </div>
          ) : (
            announcements.map((announcement) => {
              const annId = String(announcement.id || announcement._id);
              return (
              <div
                key={annId}
                className={`bg-white dark:bg-slate-800 rounded-lg shadow p-4 sm:p-6 ${
                  !announcement.isRead ? 'border-l-4 border-blue-500' : ''
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <img
                      src={announcement.author.avatar}
                      alt={announcement.author.name}
                      className="h-10 w-10 rounded-full flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {announcement.author.name}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {announcement.author.role}
                      </p>
                    </div>
                  </div>
                  {isTeacherOrAdmin && String(announcement.author.id || announcement.author._id) === String(user?.id || user?._id) && (
                    <button
                      onClick={() => handleDeleteAnnouncement(annId)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  {announcement.title}
                </h2>

                {/* Content */}
                <p className="text-slate-600 dark:text-slate-300 mb-3 whitespace-pre-wrap">
                  {announcement.content}
                </p>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500 dark:text-slate-400 gap-2 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                      {announcement.target}
                    </span>
                  </div>
                  {!announcement.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(annId)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
