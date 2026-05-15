import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components/ui/Avatar';

interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  profilePicture?: string;
  username?: string;
  role?: string;
}

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<User[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get auth token from localStorage
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch('http://localhost:5000/api/users', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched users:', data);

        // Get current user ID
        const currentUserId = (currentUser as any)?._id || (currentUser as any)?.id;

        // Filter out current user - be flexible with ID matching
        const otherUsers = Array.isArray(data)
          ? data.filter((u: User) => {
            const userId = u._id || u.id;
            return userId && userId !== currentUserId;
          })
          : [];

        console.log('Filtered users (current user removed):', otherUsers);

        setAllUsers(otherUsers);
        setFilteredUsers(otherUsers);
      } catch (error: any) {
        console.error('Error fetching users:', error);
        setError('Failed to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();

    // Load recent searches
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }

    // Handle clicks outside search for dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [currentUser]);

  const handleUserView = (user: User) => {
    const targetId = user._id || user.id;
    const updated = [user, ...recentSearches.filter(s => (s._id || s.id) !== targetId)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
    navigate(`/profile/${targetId}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    const searchVal = query.toLowerCase().trim();

    if (!searchVal) {
      setFilteredUsers(allUsers);
      return;
    }

    const filtered = allUsers.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      const idStr = (u._id || u.id || '').toString().toLowerCase();
      const emailPrefix = email.split('@')[0];

      // Match if any word in name starts with query OR any field starts with query
      const nameWords = name.split(/\s+/);
      const nameMatch = nameWords.some(word => word.startsWith(searchVal));

      return nameMatch ||
        email.startsWith(searchVal) ||
        username.startsWith(searchVal) ||
        idStr.startsWith(searchVal) ||
        emailPrefix.startsWith(searchVal);
    });

    setFilteredUsers(filtered);
  };

  const handleMessageClick = (user: User) => {
    const userId = user._id || user.id;
    navigate(`/messages/${userId}`, { state: { user } });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header Section */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-[22px] font-bold text-slate-900 dark:text-white">Users</h1>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Connect and message with other users</p>
            </div>
          </div>

          <div className="relative w-full sm:w-[350px]" ref={searchRef}>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full px-4 pl-10 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 border-transparent focus:bg-white dark:focus:bg-slate-600 focus:ring-2 focus:ring-red-500 transition-all text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
            />
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>

            {/* Recent Searches Dropdown */}
            {isSearchFocused && !searchQuery && recentSearches.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 py-1">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent</span>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setRecentSearches([]);
                      localStorage.removeItem('recentSearches');
                    }}
                    className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {recentSearches.map((u, idx) => (
                    <div
                      key={`recent-${u._id || u.id || idx}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleUserView(u);
                        setIsSearchFocused(false);
                      }}
                      className="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-slate-100 dark:border-slate-700">
                        <img
                          src={u.profilePicture || u.avatar || '/default-avatar.png'}
                          alt={u.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate group-hover:text-red-600 transition-colors tracking-tight">{u.name}</p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate font-medium">@{u.username || u.email?.split('@')[0]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
        {loading ? (
          <div className="space-y-3 p-6 animate-pulse">
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700"
              >
                {/* Left: Skeleton Avatar and Info */}
                <div className="flex items-center gap-4 flex-1">
                  {/* Avatar Skeleton */}
                  <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>

                  {/* Text Skeleton */}
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                  </div>
                </div>

                {/* Right: Button Skeleton */}
                <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg flex-shrink-0 ml-4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Unable to load users</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium tracking-tight">
              {searchQuery ? `No users found matching "${searchQuery}"` : 'No users available in the directory'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mx-6 mb-10">
            {filteredUsers.map((u, index) => (
              <div
                key={u._id || u.id || `user-${index}`}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${index !== filteredUsers.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''
                  }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar src={u.profilePicture || u.avatar} alt={u.name || 'User'} size="md" />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">
                        {u.name || 'Anonymous User'}
                      </span>
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded uppercase tracking-wider">
                        {u.role || 'User'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate lowercase font-medium">
                      {u.email || 'no-email@kluniversity.in'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 sm:mt-0">
                  <button
                    onClick={() => handleUserView(u)}
                    className="flex-1 sm:flex-none text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 px-3 py-2 sm:py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-slate-200 dark:border-slate-700 sm:border-transparent"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => handleMessageClick(u)}
                    className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 sm:py-1.5 rounded-lg transition-all shadow-sm shadow-red-200 dark:shadow-none active:scale-95"
                  >
                    Message
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
