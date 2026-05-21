import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../contexts/SocketContext';
import { usePosts, useCreatePost } from '../src/hooks/usePosts';
import { MOCK_POSTS, MOCK_BROADCASTS } from '../constants';
import { Post, Broadcast, Role } from '../types';
import { Skeleton } from '../components/ui/Skeleton';
import { SuggestedUsers } from '../components/SuggestedUsers';
import { TrendingTopics } from '../components/TrendingTopics';
import { BroadcastCard } from '../components/BroadcastCard';
import { FeedPostCard } from '../components/FeedPostCard';
import { Card } from '../components/ui/Card';
import { CreatePostCard } from '../components/CreatePostCard';
import { CreatePostModal } from '../components/CreatePostModal';
import { announcementsAPI } from '../src/api/announcements';
import { postsAPI } from '../src/api/posts';
import { useQueryClient } from '@tanstack/react-query';

const PostSkeleton: React.FC = () => (
  <Card className="mb-4">
    <div className="flex items-center space-x-3 p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
    <Skeleton className="h-4 w-5/6 mx-4 mb-2" />
    <Skeleton className="h-4 w-4/6 mx-4 mb-4" />
    <Skeleton className="w-full h-[400px] rounded-none" />
    <div className="p-2 flex justify-around">
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-20" />
    </div>
  </Card>
);

type FeedItem = (Post & { type: 'post' }) | (Broadcast & { type: 'broadcast' });

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const { data: postsResponse, isLoading, isFetching } = usePosts();
  const createPostMutation = useCreatePost();
  const queryClient = useQueryClient();
  const [isCreatePostModalOpen, setCreatePostModalOpen] = useState(false);
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [initialType, setInitialType] = useState<'image' | 'video' | 'document' | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(true);
  const { socket } = useSocket();
  const location = useLocation();

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  

  // Fetch broadcasts from API
  useEffect(() => {
    const fetchBroadcasts = async () => {
      try {
        setBroadcastsLoading(true);
        const data = await announcementsAPI.getAnnouncements();
        const formattedBroadcasts: Broadcast[] = data.map((ann: any) => ({
          id: String(ann.id || ann._id),
          title: ann.title,
          content: ann.content,
          author: ann.author,
          target: ann.target,
          timestamp: ann.createdAt || ann.created_at,
        }));
        setBroadcasts(formattedBroadcasts);
      } catch (error) {
        console.error('Failed to load broadcasts:', error);
        setBroadcasts([]);
      } finally {
        setBroadcastsLoading(false);
      }
    };

    fetchBroadcasts();

    // Listen for new broadcasts via socket
    if (socket) {
      socket.on('announcement-created', (newAnnouncement: any) => {
        console.log('[Socket] New announcement received:', newAnnouncement);
        
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

        if (!isVisible) {
          console.log('[Socket] Skipping broadcast meant for different role:', newAnnouncement.target);
          return;
        }

        const timestamp = newAnnouncement.createdAt || newAnnouncement.created_at || new Date().toISOString();
        const id = newAnnouncement.id || newAnnouncement._id;

        if (!id) {
          console.warn('[Socket] Announcement missing ID, skipping live update');
          return;
        }

        const newBroadcast: Broadcast = {
          id: String(id),
          title: newAnnouncement.title || 'Broadcast',
          content: newAnnouncement.content || '',
          author: newAnnouncement.author || { name: 'Admin', avatar: '' },
          target: newAnnouncement.target || 'All',
          timestamp: timestamp,
        };

        setBroadcasts(prev => {
          if (prev.some(b => String(b.id) === String(newBroadcast.id))) {
            console.log('[Socket] Announcement already in state, skipping');
            return prev;
          }
          console.log('[Socket] Adding new broadcast to state:', newBroadcast.id);
          return [newBroadcast, ...prev];
        });
      });

      socket.on('new-post', (newPost: any) => {
        console.log('[Socket] New post received:', newPost);
        
        const id = newPost.id || newPost._id;
        if (!id) return;

        // Ensure post has correct format for feedItems memo
        const formattedPost = {
            ...newPost,
            id: id,
            type: 'post' as const,
            timestamp: newPost.created_at || newPost.createdAt || new Date().toISOString()
        };

        queryClient.setQueryData(['posts'], (oldData: any) => {
          if (!oldData) return { items: [formattedPost], nextCursor: null, hasMore: false };
          const items = oldData.items || (Array.isArray(oldData) ? oldData : []);
          if (items.some((p: any) => String(p.id) === String(id))) return oldData;
          console.log('[Socket] Injecting new post into React Query cache:', id);
          return {
            ...oldData,
            items: [formattedPost, ...items]
          };
        });
      });

      const applyPostUpdate = (postId: string, updater: (post: any) => any) => {
        queryClient.setQueryData(['posts'], (oldData: any) => {
          if (!oldData) return oldData;

          const items = oldData.items || (Array.isArray(oldData) ? oldData : []);
          const nextItems = items.map((post: any) => (
            String(post.id) === String(postId) ? updater(post) : post
          ));

          if (Array.isArray(oldData)) {
            return nextItems;
          }

          return {
            ...oldData,
            items: nextItems,
          };
        });
      };

      socket.on('post-updated', (updatedPost: any) => {
        console.log('[Socket] Post updated:', updatedPost);
        const id = updatedPost?.id || updatedPost?._id;
        if (!id) return;

        applyPostUpdate(String(id), (post) => ({
          ...post,
          ...updatedPost,
          id: String(id),
          timestamp: updatedPost.created_at || updatedPost.createdAt || post.timestamp,
        }));
      });

      socket.on('post-deleted', ({ postId }: { postId: string }) => {
        console.log('[Socket] Post deleted:', postId);
        queryClient.setQueryData(['posts'], (oldData: any) => {
          if (!oldData) return oldData;

          const items = oldData.items || (Array.isArray(oldData) ? oldData : []);
          const nextItems = items.filter((post: any) => String(post.id) !== String(postId));

          if (Array.isArray(oldData)) {
            return nextItems;
          }

          return {
            ...oldData,
            items: nextItems,
          };
        });
      });

      socket.on('post_update', (data: any) => {
        if (!data?.postId) return;

        if (data.type === 'LIKE_CHANGE') {
          applyPostUpdate(String(data.postId), (post) => ({
            ...post,
            likes: Number(data.likesCount ?? post.likes ?? 0),
            isLiked: typeof post.isLiked === 'boolean' ? post.isLiked : post.isLiked,
          }));
        }

        if (data.type === 'COMMENT_CHANGE') {
          applyPostUpdate(String(data.postId), (post) => ({
            ...post,
            comments: Number(data.commentCount ?? post.comments ?? 0),
          }));
        }

        if (data.type === 'POST_UPDATED' && data.post) {
          applyPostUpdate(String(data.postId), (post) => ({
            ...post,
            ...data.post,
          }));
        }

        if (data.type === 'POST_DELETED') {
          queryClient.setQueryData(['posts'], (oldData: any) => {
            if (!oldData) return oldData;
            const items = oldData.items || (Array.isArray(oldData) ? oldData : []);
            const nextItems = items.filter((post: any) => String(post.id) !== String(data.postId));

            if (Array.isArray(oldData)) {
              return nextItems;
            }

            return {
              ...oldData,
              items: nextItems,
            };
          });
        }
      });

      socket.on('announcement-deleted', ({ id }: { id: string }) => {
        console.log('[Socket] Broadcast deleted, removing from feed:', id);
        setBroadcasts(prev => prev.filter(b => String(b.id) !== String(id)));
      });

      return () => {
        socket.off('announcement-created');
        socket.off('new-post');
        socket.off('post-updated');
        socket.off('post-deleted');
        socket.off('post_update');
        socket.off('announcement-deleted');
      };
    }
  }, [socket, queryClient]);

  // Transform API posts to feed items
  const feedItems = React.useMemo(() => {
    if (!user) return [];

    try {
      const userId = user.id;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Backend returns { items: [...], nextCursor: ... }
      const rawPosts = postsResponse?.items || (Array.isArray(postsResponse) ? postsResponse : []);

      // Convert DB posts to FeedItems
      const postsForFeed: FeedItem[] = (rawPosts && rawPosts.length > 0)
        ? rawPosts.map((p: any) => ({
          id: String(p.id || p._id),
          author: {
            id: p.userId || p.user_id,
            name: p.name,
            username: p.email?.split('@')[0] || '',
            email: p.email,
            avatar: p.profilePicture || p.avatar || '',
            coverPhoto: p.coverPhoto || '',
            bio: p.bio || '',
            role: p.role,
            createdAt: p.user_createdAt || p.created_at || new Date().toISOString(),
          },
          content: p.content,
          image: p.image,
          timestamp: p.created_at || p.createdAt || p.timestamp,
          likes: p.likes || 0,
          comments: p.comments || 0,
          isLiked: !!p.isLiked,
          type: (p.isBroadcast || p.is_broadcast) ? 'broadcast' as const : 'post' as const
        }))
        : [];

      // Combine and sort
      const combined = [...postsForFeed];
      
      // Add socket-loaded broadcasts that aren't already in postsForFeed
      broadcasts.forEach(b => {
        const uniqueId = String(b.id);
        if (!combined.some(item => item.id === uniqueId)) {
            combined.push({ 
                ...b, 
                id: uniqueId,
                type: 'broadcast' as const 
            });
        }
      });
      // Identify broadcasts to pin (max 4, and must be < 24h)
      const now = new Date();
      
      const allRecentBroadcasts = combined
        .filter(item => item.type === 'broadcast' && new Date(item.timestamp) > twentyFourHoursAgo)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const pinnedIds = new Set(allRecentBroadcasts.slice(0, 4).map(b => b.id));

      combined.sort((a, b) => {
        const aIsPinned = pinnedIds.has(a.id);
        const bIsPinned = pinnedIds.has(b.id);

        if (aIsPinned && !bIsPinned) return -1;
        if (!aIsPinned && bIsPinned) return 1;

        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        
        if (isNaN(timeA) || isNaN(timeB)) return 0;
        return timeB - timeA;
      });

      console.log('[HomePage] Final Feed IDs:', combined.map(item => item.id));
      console.log('[HomePage] Feed items computed:', { posts: postsForFeed.length, broadcasts: broadcasts.length, total: combined.length });
      return combined;
    } catch (error) {
      console.error('Error transforming feed items:', error);
      return [];
    }
  }, [postsResponse, broadcasts, user?.id]);

  // Handle scrolling to highlighted post
  useEffect(() => {
    const highlightId = (location.state as any)?.highlightPost;
    if (highlightId && feedItems.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`post-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'rounded-xl', 'animate-pulse');
          setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'animate-pulse'), 3000);
        }
      }, 500);
    }
  }, [location.state, feedItems]);

  const handleCreatePost = async (content: string, image?: string, fileName?: string) => {
    if ((!content.trim() && !image) || !user) return;

    try {
      console.log('[HomePage] Creating post...', { content, image: image ? 'base64 data' : 'none', fileName });

      await createPostMutation.mutateAsync({
        content,
        image,
        fileName
      } as any);

      setCreatePostModalOpen(false);
      setInitialFile(null);
      setInitialType(null);
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to share post. Please try again.');
    }
  };

  const handleComposeClick = () => {
    setInitialFile(null);
    setInitialType(null);
    setCreatePostModalOpen(true);
  };

  const handleComposeWithFile = (file: File, type: 'image' | 'video' | 'document') => {
    setInitialFile(file);
    setInitialType(type);
    setCreatePostModalOpen(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current && !isRefreshing) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartRef.current;
      if (diff > 0) {
        const distance = Math.min(Math.pow(diff, 0.75) * 1.5, 80);
        setPullDistance(distance);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 55) {
      setIsRefreshing(true);
      setPullDistance(50);
      try {
        await queryClient.invalidateQueries({ queryKey: ['posts'] });
        await new Promise(resolve => setTimeout(resolve, 800));
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    touchStartRef.current = 0;
  };

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 py-4 md:py-8 animate-pulse">
        {/* Center Feed Skeleton */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 flex gap-4 items-center">
            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0" />
            <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-xl flex-1" />
          </div>
          <PostSkeleton />
          <PostSkeleton />
        </div>
        {/* Right Sidebar Skeleton */}
        <aside className="hidden lg:block lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    );
  }

  const canPost = true;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return (
    <>
      <div className="lg:h-[calc(100vh-4rem)] max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:overflow-hidden px-6 relative items-start">
        {/* Center Feed - Scrollable without scrollbar */}
        <div 
            ref={scrollContainerRef}
            className="lg:col-span-8 h-full lg:overflow-y-auto scrollbar-hide py-4 md:py-8"
        >
          {canPost && (
            <CreatePostCard
              user={user}
              onComposeClick={handleComposeClick}
              onComposeWithFile={handleComposeWithFile}
            />
          )}

          {isLoading || broadcastsLoading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : feedItems.length === 0 ? (
            <Card className="p-8 text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No posts yet</h3>
              <p className="text-slate-500 dark:text-slate-400">Be the first to share something!</p>
            </Card>
          ) : (
            feedItems.map((item, index) => (
              item.type === 'post' ? (
                <div id={`post-${item.id}`} key={`${item.id || index}-post`}>
                  <FeedPostCard
                    post={item}
                    onDelete={(postId) => {
                      console.log('[React Query] Post deleted:', postId);
                    }}
                  />
                </div>
              ) : (
                <div id={`post-${item.id}`} key={`${item.id || index}-broadcast`}>
                  <BroadcastCard
                    broadcast={item}
                    isPinned={new Date(item.timestamp) > twentyFourHoursAgo}
                  />
                </div>
              )
            ))
          )}
        </div>

        {/* Right Sidebar - Fixed position */}
        <aside className="hidden lg:block lg:col-span-4 h-full py-8 lg:sticky lg:top-8 lg:self-start">
          <div className="space-y-6">
            <SuggestedUsers />
            <TrendingTopics />
          </div>
        </aside>
      </div>

      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={() => {
          setCreatePostModalOpen(false);
          setInitialFile(null);
          setInitialType(null);
        }}
        user={user}
        onPost={handleCreatePost}
        initialFile={initialFile}
        initialType={initialType}
      />
    </>
  );
};
