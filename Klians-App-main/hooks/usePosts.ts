import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Post } from '../types';
import { postsAPI } from '../src/api/posts';
import { queryClient } from '../lib/queryClient';

// Note: If hooks/usePosts.ts is at root level, but it's in hooks folder
// So the import from ../src/api/posts is correct since:
// hooks/usePosts.ts -> ../src/api/posts = src/api/posts
/**
 * Query keys for posts - ensures cache invalidation works correctly
 */
export const postsQueryKeys = {
  all: ['posts'] as const,
  lists: () => [...postsQueryKeys.all, 'list'] as const,
  list: (filters?: any) => [...postsQueryKeys.lists(), { filters }] as const,
  details: () => [...postsQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...postsQueryKeys.details(), id] as const,
  broadcasts: () => [...postsQueryKeys.all, 'broadcasts'] as const,
};

/**
 * usePosts Hook
 * - Fetches all posts with automatic caching
 * - Shows loading skeleton only on first fetch
 * - Returns cached posts instantly when switching sections
 * - Refetches in background when data becomes stale
 */
export const usePosts = (enabled = true) => {
  return useQuery({
    queryKey: postsQueryKeys.list(),
    queryFn: async () => {
      console.log('[React Query] Starting to fetch posts...');
      const startTime = performance.now();
      try {
        const response = (await Promise.race([
          postsAPI.getPosts(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('API timeout after 10 seconds - MongoDB connection slow')), 10000)
          )
        ])) as any;
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);
        console.log(`[React Query] ✓ Posts fetched in ${duration}ms:`, response.data?.length || 0, 'posts');
        return response.data || [];
      } catch (error) {
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        console.error(`[React Query] ✗ Error fetching posts after ${duration}s:`, error);
        console.error('[React Query] Error details:', {
          message: (error as any)?.message,
          status: (error as any)?.response?.status,
          data: (error as any)?.response?.data,
        });
        throw error;
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,      // 5 minutes
    gcTime: 10 * 60 * 1000,        // 10 minutes
    refetchInterval: false,        // Don't auto-refetch by time
    refetchOnWindowFocus: true,    // Refetch if data is stale
    refetchOnReconnect: true,      // Refetch when connection restored
    retry: 2,                      // Retry twice on failure
  });
};

/**
 * usePost Hook - Fetch single post by ID
 */
export const usePost = (postId: string) => {
  return useQuery({
    queryKey: postsQueryKeys.detail(postId),
    queryFn: async () => {
      const response = await postsAPI.getPost(postId);
      return response.data;
    },
  });
};

/**
 * useBroadcasts Hook - Fetch broadcasts (faculty posts)
 */
export const useBroadcasts = (enabled = true) => {
  return useQuery({
    queryKey: postsQueryKeys.broadcasts(),
    queryFn: async () => {
      const response = await postsAPI.getBroadcasts();
      return response.data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * useCreatePost Mutation
 * - Creates a new post
 * - Optimistically updates cache
 * - Invalidates cache after success
 */
export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postData: { content: string; image?: string; isBroadcast?: boolean }) => {
      const response = await postsAPI.createPost(postData);
      return response.data;
    },
    onMutate: async (newPost) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: postsQueryKeys.list() });

      // Get previous data
      const previousPosts = queryClient.getQueryData<Post[]>(postsQueryKeys.list());

      // Optimistically update cache with temporary post
      if (previousPosts) {
        const optimisticPost = {
          id: `optimistic-${Date.now()}`,
          ...newPost,
          timestamp: new Date().toISOString(),
          likes: 0,
          comments: 0,
          isLiked: false,
        } as any;

        queryClient.setQueryData(postsQueryKeys.list(), [optimisticPost, ...previousPosts]);
      }

      return { previousPosts };
    },
    onError: (error, newPost, context) => {
      // Revert optimistic update on error
      if (context?.previousPosts) {
        queryClient.setQueryData(postsQueryKeys.list(), context.previousPosts);
      }
      console.error('[React Query] Error creating post:', error);
    },
    onSuccess: (newPost) => {
      // Invalidate and refetch posts
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.list() });
      console.log('[React Query] Post created successfully');
    },
  });
};

/**
 * useLikePost Mutation
 * - Likes a post with optimistic update
 */
export const useLikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postsAPI.likePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postsQueryKeys.list() });

      const previousPosts = queryClient.getQueryData<Post[]>(postsQueryKeys.list());

      if (previousPosts) {
        queryClient.setQueryData(
          postsQueryKeys.list(),
          previousPosts.map((post) =>
            String(post.id) === String(postId)
              ? {
                  ...post,
                  isLiked: true,
                  likes: Number(post.likes || 0) + 1,
                }
              : post
          )
        );
      }

      return { previousPosts };
    },
    onError: (error, postId, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(postsQueryKeys.list(), context.previousPosts);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.list() });
    },
  });
};

/**
 * useUnlikePost Mutation
 * - Unlikes a post with optimistic update
 */
export const useUnlikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postsAPI.unlikePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postsQueryKeys.list() });

      const previousPosts = queryClient.getQueryData<Post[]>(postsQueryKeys.list());

      if (previousPosts) {
        queryClient.setQueryData(
          postsQueryKeys.list(),
          previousPosts.map((post) =>
            String(post.id) === String(postId)
              ? {
                  ...post,
                  isLiked: false,
                  likes: Math.max(0, (post.likes || 0) - 1),
                }
              : post
          )
        );
      }

      return { previousPosts };
    },
    onError: (error, postId, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(postsQueryKeys.list(), context.previousPosts);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.list() });
    },
  });
};

/**
 * useDeletePost Mutation
 * - Deletes a post with optimistic removal
 */
export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postsAPI.deletePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postsQueryKeys.list() });

      const previousPosts = queryClient.getQueryData<Post[]>(postsQueryKeys.list());

      if (previousPosts) {
        queryClient.setQueryData(
          postsQueryKeys.list(),
          previousPosts.filter((post) => post.id !== postId)
        );
      }

      return { previousPosts };
    },
    onError: (error, postId, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(postsQueryKeys.list(), context.previousPosts);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.list() });
    },
  });
};

/**
 * Prefetch posts on app start or when needed
 * Call this in your App component or root layout
 */
export const prefetchPosts = async () => {
  try {
    await queryClient.prefetchQuery({
      queryKey: postsQueryKeys.list(),
      queryFn: async () => {
        const response = await postsAPI.getPosts();
        return response.data || [];
      },
      staleTime: 5 * 60 * 1000,
    });
    console.log('[React Query] Posts prefetched');
  } catch (error) {
    console.error('[React Query] Error prefetching posts:', error);
  }
};
