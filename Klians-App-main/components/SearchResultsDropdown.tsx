import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User } from '../types';
import { Avatar } from './ui/Avatar';
import { Card } from './ui/Card';
import { getBackendUrl } from '@/src/api/config';

interface SearchResultsDropdownProps {
  searchTerm: string;
  onClose: () => void;
}

export const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = ({ searchTerm, onClose }) => {
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<User[]>([]);

  useEffect(() => {
    // Load recent searches from localStorage
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      try {
        setRecentSearches(JSON.parse(savedSearches));
      } catch (error) {
        console.error('Failed to parse recent searches:', error);
        setRecentSearches([]);
      }
    }
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      const q = searchTerm.trim().toLowerCase();
      if (q.length >= 1) {
        setIsLoading(true);
        
        try {
          // Get auth token
          const token = localStorage.getItem('token');
          
          if (!token) {
            setSearchResults([]);
            setIsLoading(false);
            return;
          }

          // Use dynamic host for the API call
          const response = await fetch(`${getBackendUrl()}/api/users`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const allUsers = await response.json();
            
            // Strict prefix matching for names, emails, and student IDs
            const filteredUsers = Array.isArray(allUsers) ? allUsers.filter((u: any) => {
              const name = (u.name || '').toLowerCase();
              const email = (u.email || '').toLowerCase();
              const emailPrefix = email.split('@')[0];
              const username = (u.username || '').toLowerCase();
              const idStr = (u.id || u._id || '').toString().toLowerCase();

              const nameWords = name.split(/\s+/);
              const nameMatch = nameWords.some(word => word.startsWith(q));

              return nameMatch || 
                     email.startsWith(q) || 
                     emailPrefix.startsWith(q) ||
                     username.startsWith(q) ||
                     idStr.startsWith(q);
            }) : [];
            
            setSearchResults(filteredUsers);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error('Error searching users:', error);
          setSearchResults([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchUsers();
    }, 150);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const handleUserClick = (user: User) => {
    // Save to recent searches
    const targetId = user.id || (user as any)._id;
    const updatedRecentSearches = [user, ...recentSearches.filter(s => (s.id || (s as any)._id) !== targetId)].slice(0, 5);
    setRecentSearches(updatedRecentSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedRecentSearches));
    onClose();
  };

  const renderContent = () => {
    const q = searchTerm.trim().toLowerCase();
    
    // If we have results, show them FIRST
    if (searchResults.length > 0) {
      return (
        <div className="space-y-1">
          <h3 className="font-semibold text-[10px] px-4 py-1 mb-1 text-red-600 uppercase tracking-wider bg-red-50 dark:bg-red-900/10">Search Results</h3>
          {searchResults.map((user, idx) => (
            <Link 
              key={user.id || (user as any)._id || `result-${idx}`} 
              to={`/profile/${user.id || (user as any)._id}`} 
              onClick={() => handleUserClick(user)} 
              className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
            >
              <Avatar 
                src={user.avatar || (user as any).profilePicture || '/default-avatar.png'} 
                alt={user.name} 
                size="sm"
              />
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-red-600 transition-colors">{user.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">@{user.username || user.email?.split('@')[0] || 'user'}</p>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="space-y-1 animate-pulse">
          <h3 className="font-semibold text-[10px] px-4 py-1 mb-1 text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50">Searching Directory</h3>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2">
              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (q.length > 0 && !isLoading) {
      return (
        <div className="text-center p-8">
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">No results found for "{searchTerm}"</p>
        </div>
      );
    }

    // Default: Show Recent Searches if search term is empty
    if (recentSearches.length > 0) {
      return (
        <div>
          <h3 className="font-semibold text-[10px] px-4 py-1 mb-1 text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50">Recent</h3>
          <div className="space-y-1">
            {recentSearches.map((user, idx) => (
              <Link 
                key={user.id || (user as any)._id || `recent-${idx}`} 
                to={`/profile/${user.id || (user as any)._id}`} 
                onClick={() => handleUserClick(user)} 
                className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <Avatar 
                  src={user.avatar || (user as any).profilePicture || '/default-avatar.png'} 
                  alt={user.name} 
                  size="sm" 
                />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">@{user.username || user.email?.split('@')[0] || 'user'}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="text-center p-8">
        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Start typing to search users...</p>
      </div>
    );
  };

  const q = searchTerm.trim().toLowerCase();
  const hasRecent = recentSearches.length > 0;

  // Show dropdown if:
  // 1. We are typing and have results/loading
  // 2. We are not typing but have recent searches to show
  const shouldShow = (q && (isLoading || searchResults.length > 0)) || (!q && hasRecent);

  if (!shouldShow) return null;

  return (
    <Card className="absolute top-full mt-2 w-full max-h-[400px] overflow-y-auto py-1 z-50 shadow-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {renderContent()}
    </Card>
  );
};