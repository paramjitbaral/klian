import React, { useState, useEffect } from 'react';
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

  // Fetch broadcasts from API
  useEffect(() => {
    const fetchBroadcasts = async () => {
      try {
        setBroadcastsLoading(true);
        const data = await announcementsAPI.getAnnouncements();
        const formattedBroadcasts: Broadcast[] = data.map((ann: any) => ({
          id: ann._id,
          title: ann.title,
          content: ann.content,
          author: ann.author,
          target: ann.target,
          timestamp: ann.createdAt,
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
        const newBroadcast: Broadcast = {
          id: newAnnouncement._id,
          title: newAnnouncement.title,
          content: newAnnouncement.content,
          author: newAnnouncement.author,
          target: newAnnouncement.target,
          timestamp: newAnnouncement.createdAt,
        };
        setBroadcasts(prev => [newBroadcast, ...prev]);
      });

      return () => {
        socket.off('announcement-created');
      };
    }
  }, [socket]);

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
          id: p.id || p._id,
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
          likes: p.likes?.length || 0,
          comments: p.comments?.length || 0,
          isLiked: p.likes?.some((like: any) => {
            const likeId = typeof like._id === 'string' ? like._id : like._id?.toString();
            return likeId === userId || like === userId;
          }),
          type: 'post' as const
        }))
        : [];

      console.log('[HomePage] Raw posts from API:', rawPosts.length, rawPosts[0]);

      // Add broadcasts from API
      const broadcastsForFeed: FeedItem[] = broadcasts.map(b => ({ ...b, type: 'broadcast' as const }));

      // Combine and sort with 24-hour pinning logic
      const combined = [...postsForFeed, ...broadcastsForFeed];
      combined.sort((a, b) => {
        const aIsRecentBroadcast = a.type === 'broadcast' && new Date(a.timestamp) > twentyFourHoursAgo;
        const bIsRecentBroadcast = b.type === 'broadcast' && new Date(b.timestamp) > twentyFourHoursAgo;

        // If one is recent broadcast and other isn't, recent broadcast goes first
        if (aIsRecentBroadcast && !bIsRecentBroadcast) return -1;
        if (!aIsRecentBroadcast && bIsRecentBroadcast) return 1;

        // Otherwise, sort by timestamp (newest first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      console.log('[HomePage] Feed items computed:', { posts: postsForFeed.length, broadcasts: broadcastsForFeed.length, total: combined.length });
      return combined;
    } catch (error) {
      console.error('Error transforming feed items:', error);
      return [];
    }
  }, [postsResponse, broadcasts, user?.id]);

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

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center">
        <p className="text-slate-500">Loading user profile...</p>
      </div>
    );
  }

  const canPost = user.role === Role.TEACHER || user.role === Role.DEAN || user.role === Role.ADMIN || user.role?.toLowerCase() === 'dean';
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return (
    <>
      <div className="h-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden px-6">
        {/* Center Feed - Scrollable without scrollbar */}
        <div className="lg:col-span-8 h-full overflow-y-auto scrollbar-hide py-4 md:py-8">
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
                <FeedPostCard
                  key={`${item.id || index}-post`}
                  post={item}
                  onDelete={(postId) => {
                    console.log('[React Query] Post deleted:', postId);
                  }}
                />
              ) : (
                <BroadcastCard
                  key={`${item.id || index}-broadcast`}
                  broadcast={item}
                  isPinned={new Date(item.timestamp) > twentyFourHoursAgo}
                />
              )
            ))
          )}
        </div>

        {/* Right Sidebar - Fixed position */}
        <aside className="hidden lg:block lg:col-span-4 h-full py-8">
          <div className="sticky top-8 space-y-6">
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
