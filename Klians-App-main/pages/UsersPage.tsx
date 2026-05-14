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
  }, [currentUser]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredUsers(allUsers);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = allUsers.filter(u =>
      u.name.toLowerCase().includes(lowerQuery) ||
      u.email.toLowerCase().includes(lowerQuery) ||
      (u.username && u.username.toLowerCase().includes(lowerQuery))
    );
    
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
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Users</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Connect and message with other users</p>
          </div>
          
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full px-3 py-2 pl-9 rounded-xl bg-slate-100 dark:bg-slate-700 border-transparent focus:bg-white dark:focus:bg-slate-600 focus:ring-2 focus:ring-red-500 transition-all text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {searchQuery ? 'No users found' : 'No users available'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {searchQuery ? 'Try adjusting your search' : 'Check back later'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mx-6 mb-10">
            {filteredUsers.map((u, index) => (
              <div
                key={u._id || u.id || `user-${index}`}
                className={`flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                  index !== filteredUsers.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar src={u.profilePicture} alt={u.name} size="md" />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">{u.name}</span>
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded uppercase tracking-wider">
                        {u.role || 'Student'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate lowercase font-medium">
                      {u.email}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const uid = u._id || u.id;
                      navigate(`/profile/${uid}`);
                    }}
                    className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => handleMessageClick(u)}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-all shadow-sm shadow-red-200 dark:shadow-none active:scale-95"
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
