import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Avatar } from './ui/Avatar';
import { useQuery } from '@tanstack/react-query';
import { usersAPI } from '../src/api/users';
import { groupsAPI } from '../src/api/groups';
import { ICONS } from '../constants';
import { User } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (recipientId: string, message: string, shareType: 'email' | 'message' | 'group') => Promise<void>;
  postId?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, onShare, postId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users-search', searchQuery],
    queryFn: async () => {
      if (searchQuery.trim()) {
        const { data } = await usersAPI.searchUsers(searchQuery);
        return data;
      }
      const { data } = await usersAPI.getUsers();
      return data.slice(0, 10); // Show top 10 suggested
    },
    enabled: isOpen
  });

  const { data: groups, isLoading: isLoadingGroups } = useQuery<any[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await groupsAPI.getGroups();
      return data;
    },
    enabled: isOpen
  });

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleSend = async (user: User) => {
    try {
      const userId = user.id || (user as any)._id;
      await onShare(userId, '', 'message');
      setSentTo(prev => [...prev, String(userId)]);
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleSendGroup = async (group: any) => {
    try {
      const groupId = group.id || group._id;
      await onShare(String(groupId), '', 'group');
      setSentTo(prev => [...prev, `group-${groupId}`]);
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share" size="sm">
      <div className="flex flex-col h-[480px] overflow-hidden">
        {/* FIXED HEADER: Search Input */}
        <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* SCROLLABLE BODY: Users List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-2 overscroll-contain">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse px-2">
                  <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24" />
                    <div className="h-2 bg-slate-50 dark:bg-slate-800/50 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 pb-4">
              {users && users.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-4 mb-2 mt-2">Users</h4>
                  {users.map((u: any) => {
                    const id = String(u.id || u._id);
                    const isSent = sentTo.includes(id);
                    return (
                      <div key={id} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-all duration-200 group">
                        <div className="flex items-center gap-3">
                          <Avatar src={u.profilePicture || u.profile_picture || u.avatar} alt={u.name} size="md" />
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">{u.name}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-medium">@{u.username || u.email?.split('@')[0] || 'user'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSend(u)}
                          disabled={isSent}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                            isSent 
                              ? 'bg-transparent text-slate-300 dark:text-slate-600 cursor-default' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white active:scale-95'
                          }`}
                        >
                          {isSent ? 'Sent' : 'Send'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {groups && groups.length > 0 && (!searchQuery || groups.some(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))) && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-4 mb-2 mt-2">Groups</h4>
                  {groups
                    .filter(g => !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((g: any) => {
                      const id = String(g.id || g._id);
                      const isSent = sentTo.includes(`group-${id}`);
                      return (
                        <div key={id} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-all duration-200 group">
                          <div className="flex items-center gap-3">
                            <Avatar src={g.avatar} alt={g.name} size="md" />
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">{g.name}</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-medium">{g.members?.length || 0} members</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSendGroup(g)}
                            disabled={isSent}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                              isSent 
                                ? 'bg-transparent text-slate-300 dark:text-slate-600 cursor-default' 
                                : 'bg-blue-500 hover:bg-blue-600 text-white active:scale-95'
                            }`}
                          >
                            {isSent ? 'Sent' : 'Send'}
                          </button>
                        </div>
                      );
                  })}
                </div>
              )}

              {(!users || users.length === 0) && (!groups || groups.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No results found</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try a different name</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-10 py-5 border-t border-slate-50 dark:border-slate-800/50 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
          {/* 1. LINK */}
          <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 group">
            <div className={`w-9 h-9 rounded-full border border-slate-100 dark:border-slate-800 flex items-center justify-center transition-all duration-300 ${copySuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-500' : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 text-slate-500 dark:text-slate-400'}`}>
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className={`text-[7.5px] font-bold uppercase tracking-[0.1em] ${copySuccess ? 'text-emerald-500' : 'text-slate-400'}`}>Link</span>
          </button>

          {/* 2. LINKEDIN */}
          <button onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${window.location.origin}/post/${postId}`, '_blank')} className="flex flex-col items-center gap-2 group">
            <div className="w-9 h-9 rounded-full border border-[#0077B5]/20 bg-[#0077B5]/5 flex items-center justify-center text-[#0077B5] group-hover:bg-[#0077B5]/10 transition-all">
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </div>
            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-[0.1em] group-hover:text-[#0077B5]">LinkedIn</span>
          </button>

          {/* 3. WHATSAPP */}
          <button onClick={() => window.open(`https://wa.me/?text=Check this out on Klians: ${window.location.origin}/post/${postId}`, '_blank')} className="flex flex-col items-center gap-2 group">
            <div className="w-9 h-9 rounded-full border border-[#25D366]/20 bg-[#25D366]/5 flex items-center justify-center text-[#25D366] group-hover:bg-[#25D366]/10 transition-all">
              <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.554 4.189 1.604 6.06L0 24l6.104-1.602a11.834 11.834 0 005.944 1.599h.005c6.632 0 12.028-5.398 12.031-12.033a11.85 11.85 0 00-3.527-8.508z" />
              </svg>
            </div>
            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-[0.1em] group-hover:text-[#25D366]">WhatsApp</span>
          </button>

          {/* 4. TELEGRAM */}
          <button onClick={() => window.open(`https://t.me/share/url?url=${window.location.origin}/post/${postId}&text=Check this out on Klians!`, '_blank')} className="flex flex-col items-center gap-2 group">
            <div className="w-9 h-9 rounded-full border border-[#0088cc]/20 bg-[#0088cc]/5 flex items-center justify-center text-[#0088cc] group-hover:bg-[#0088cc]/10 transition-all">
              <svg viewBox="0 0 24 24" className="w-[20px] h-[20px]" fill="currentColor">
                <path d="M19.07 4.93L2.19 11.47c-1.14.44-1.13 1.08-.2 1.43l4.34 1.35 1.51 4.61c.18.5.09.7.61.7.41 0 .6-.18.82-.41l1.97-1.91 4.09 3.02c.75.42 1.29.2 1.48-.7l2.68-12.63c.28-1.1-.42-1.6-1.14-.11z" />
              </svg>
            </div>
            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-[0.1em] group-hover:text-[#0088cc]">Telegram</span>
          </button>

          {/* 5. MORE */}
          <button onClick={() => navigator.share?.({ url: `${window.location.origin}/post/${postId}` })} className="flex flex-col items-center gap-2 group">
            <div className="w-9 h-9 rounded-full border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-slate-50 transition-all">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-[0.1em]">More</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
