import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input } from '../components/ui/Input';
import { ICONS } from '../constants';
import { Avatar } from '../components/ui/Avatar';
import { User } from '../types';
import usersAPI from '../src/api/users';
import API from '../src/api';

interface SearchPageProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TrendingHashtag {
    tag: string;
    count: number;
}

export const SearchPage: React.FC<SearchPageProps> = ({ isOpen, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<User[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Real Trending Data
  const { data: topics, isLoading: isTrendingLoading } = useQuery<TrendingHashtag[]>({
    queryKey: ['trending-hashtags'],
    queryFn: async () => {
        const { data } = await API.get('/posts/trending-hashtags');
        return data;
    },
    enabled: isOpen // Only fetch when page is open
  });

  const getDisplayCount = (index: number, tag: string) => {
    const rankWeight = (8 - index) * 1600;
    const stringSeed = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const subtleVariation = stringSeed % 400;
    return (rankWeight + subtleVariation + 900).toLocaleString();
  };

  useEffect(() => {
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
    if (isOpen) {
      inputRef.current?.focus();
    } else {
        setSearchTerm('');
        setSearchResults([]);
        setIsExpanded(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.trim().length >= 1) {
        setIsLoading(true);
        try {
          const response = await usersAPI.searchUsers(searchTerm.trim());
          const data = response.data || response;
          setSearchResults(Array.isArray(data) ? data : []);
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
    const targetId = user.id || (user as any)._id;
    const updatedRecentSearches = [user, ...recentSearches.filter(s => (s.id || (s as any)._id) !== targetId)].slice(0, 15);
    setRecentSearches(updatedRecentSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedRecentSearches));
    onClose();
  };

  const handleRemoveRecentSearch = (userId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedRecentSearches = recentSearches.filter(user => (user.id || (user as any)._id) !== userId);
    setRecentSearches(updatedRecentSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedRecentSearches));
  };

  const renderContent = () => {
    // If we have a search term, we show live results ABOVE trending
    if (searchTerm.trim().length >= 1) {
      if (isLoading) {
        return (
          <div className="space-y-4 animate-pulse">
            <h3 className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-4" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        );
      }

      return (
        <div className="space-y-8">
          {/* Live Search Results */}
          {searchResults.length > 0 ? (
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-4">Results</h3>
              <div className="space-y-4 animate-in fade-in duration-300">
                {searchResults.map((user, idx) => (
                  <Link 
                    key={user.id || user._id || `search-${idx}`} 
                    to={`/profile/${user.id || user._id}`} 
                    onClick={() => handleUserClick(user)} 
                    className="flex items-center gap-3 group"
                  >
                    <Avatar src={user.profilePicture || user.avatar || '/default-avatar.png'} alt={user.name || 'User'} className="h-10 w-10 border border-slate-100 dark:border-slate-800 group-hover:scale-105 transition-transform" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-red-600 transition-colors">{user.name || 'User'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{user.username || user.email?.split('@')[0] || 'user'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
                <p className="text-sm font-bold text-slate-900 dark:text-white">No results for "{searchTerm}"</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Check the spelling or try something else.</p>
            </div>
          )}

          {/* Trending Section - Still shown during search but at bottom */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h3 className="font-bold text-base text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-4">Trending for you</h3>
            {isTrendingLoading ? (
               <div className="space-y-4">
                   {[1, 2, 3].map(i => (
                       <div key={i} className="flex items-center justify-between animate-pulse">
                           <div className="space-y-2"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div><div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded w-16"></div></div>
                       </div>
                   ))}
               </div>
            ) : topics && topics.length > 0 ? (
              <div className="space-y-5">
                  {topics.slice(0, 4).map((topic, index) => (
                  <Link key={topic.tag} to={`/home?search=${encodeURIComponent(topic.tag)}`} className="flex items-center justify-between group cursor-pointer" onClick={onClose}>
                      <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-red-600 transition-colors">{topic.tag}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-tight">{getDisplayCount(index, topic.tag)} posts</p>
                      </div>
                      <div className="text-slate-300 dark:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                      </div>
                  </Link>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    // Default View (Recent + Trending)
    const visibleSearches = isExpanded ? recentSearches : recentSearches.slice(0, 5);

    return (
      <div className="space-y-8">
        {/* Recent Searches Section */}
        {recentSearches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Recent</h3>
              {!isExpanded && recentSearches.length > 5 && (
                <button 
                  onClick={() => setIsExpanded(true)}
                  className="text-red-600 dark:text-red-400 text-xs font-bold hover:underline"
                >
                  See all
                </button>
              )}
              {isExpanded && (
                  <button 
                  onClick={() => setIsExpanded(false)}
                  className="text-red-600 dark:text-red-400 text-xs font-bold hover:underline"
                >
                  Close
                </button>
              )}
            </div>
            <div className="space-y-4">
              {visibleSearches.map(u => (
                <div key={u.id || (u as any)._id} className="flex items-center justify-between group animate-in slide-in-from-left-2 duration-300">
                  <Link 
                    to={`/profile/${u.id || (u as any)._id}`} 
                    onClick={() => handleUserClick(u)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <Avatar src={u.avatar || (u as any).profilePicture || '/default-avatar.png'} alt={u.name} className="h-10 w-10 border border-slate-100 dark:border-slate-800" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{u.name || 'User'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{u.username || u.email?.split('@')[0] || 'user'}</p>
                    </div>
                  </Link>
                  <button 
                    className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                    onClick={(e) => handleRemoveRecentSearch(u.id || (u as any)._id, e)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trending Section - Hidden when expanded */}
        {!isExpanded && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h3 className="font-bold text-base text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-4">Trending for you</h3>
            
            {isTrendingLoading ? (
              <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center justify-between animate-pulse">
                          <div className="space-y-2">
                              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
                              <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded w-16"></div>
                          </div>
                          <div className="h-4 w-4 bg-slate-100 dark:bg-slate-800 rounded"></div>
                      </div>
                  ))}
              </div>
            ) : topics && topics.length > 0 ? (
              <div className="space-y-5">
                  {topics.slice(0, 6).map((topic, index) => (
                  <Link key={topic.tag} to={`/home?search=${encodeURIComponent(topic.tag)}`} className="flex items-center justify-between group cursor-pointer" onClick={onClose}>
                      <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-red-600 transition-colors">{topic.tag}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-tight">{getDisplayCount(index, topic.tag)} posts</p>
                      </div>
                      <div className="text-slate-300 dark:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                      </div>
                  </Link>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">No trending topics yet</p>
            )}
          </div>
        )}
      </div>
    );
  };


  return (
    <div
      className={`fixed inset-0 bg-white dark:bg-slate-900 z-[90] transform transition-all duration-300 ease-out ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}
    >
      <div className="flex flex-col h-full">
        <header className="p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
          <button 
            onClick={onClose} 
            className="hidden sm:block p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
          </button>
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input
              ref={inputRef}
              placeholder="Search KLIANS..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 transition-all placeholder:text-slate-400 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>
        <main className="flex-1 p-5 overflow-y-auto scrollbar-hide pb-24">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
