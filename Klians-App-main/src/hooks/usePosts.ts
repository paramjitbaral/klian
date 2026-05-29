import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Post } from '../../types';
import { postsAPI } from '../api/posts';
import { queryClient } from '../lib/queryClient';
import { announcementsAPI } from '../api/announcements';

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
      try {
        const response = await postsAPI.getPosts();
        // Backend returns { items, nextCursor, hasMore }
        const data = response.data;
        console.log('[React Query] Posts fetched:', data?.items?.length || 0, 'posts');
        return data || { items: [], hasMore: false };
      } catch (error) {
        console.error('[React Query] Error fetching posts:', error);
        throw error;
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,      // 5 minutes
    gcTime: 10 * 60 * 1000,        // 10 minutes
    refetchInterval: false,        // Don't auto-refetch by time
    refetchOnWindowFocus: true,    // Refetch if data is stale
    refetchOnReconnect: true,      // Refetch when connection restored
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
      const data = await announcementsAPI.getAnnouncements();
      const arr = Array.isArray(data) ? data : [];
      return arr.map((ann: any) => ({
        id: String(ann.id || ann._id),
        title: ann.title,
        content: ann.content,
        author: ann.author,
        target: ann.target,
        timestamp: ann.createdAt || ann.created_at,
      }));
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

      // Get previous data - handle both array and paginated object formats
      const previousData = queryClient.getQueryData<any>(postsQueryKeys.list());
      const previousPosts = Array.isArray(previousData) ? previousData : (previousData?.items || []);

      // Optimistically update cache with temporary post
      const optimisticPost = {
        id: `optimistic-${Date.now()}`,
        ...newPost,
        timestamp: new Date().toISOString(),
        likes: 0,
        comments: 0,
        isLiked: false,
      } as any;

      if (Array.isArray(previousData)) {
        queryClient.setQueryData(postsQueryKeys.list(), [optimisticPost, ...previousData]);
      } else {
        queryClient.setQueryData(postsQueryKeys.list(), {
          ...previousData,
          items: [optimisticPost, ...(previousData?.items || [])]
        });
      }

      return { previousData };
    },
    onError: (error, newPost, context) => {
      // Revert optimistic update on error
      if (context?.previousData) {
        queryClient.setQueryData(postsQueryKeys.list(), context.previousData);
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

      const previousData = queryClient.getQueryData<any>(postsQueryKeys.list());
      
      const updatePosts = (posts: Post[]) => 
        posts.map((post) =>
          String(post.id) === String(postId)
            ? {
                ...post,
                isLiked: true,
                likes: Number(post.likes || 0) + 1,
              }
            : post
        );

      if (Array.isArray(previousData)) {
        queryClient.setQueryData(postsQueryKeys.list(), updatePosts(previousData));
      } else if (previousData?.items) {
        queryClient.setQueryData(postsQueryKeys.list(), {
          ...previousData,
          items: updatePosts(previousData.items)
        });
      }

      return { previousData };
    },
    onError: (error, postId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(postsQueryKeys.list(), context.previousData);
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

      const previousData = queryClient.getQueryData<any>(postsQueryKeys.list());

      const updatePosts = (posts: Post[]) =>
        posts.map((post) =>
          String(post.id) === String(postId)
            ? {
                ...post,
                isLiked: false,
                likes: Math.max(0, (post.likes || 0) - 1),
              }
            : post
        );

      if (Array.isArray(previousData)) {
        queryClient.setQueryData(postsQueryKeys.list(), updatePosts(previousData));
      } else if (previousData?.items) {
        queryClient.setQueryData(postsQueryKeys.list(), {
          ...previousData,
          items: updatePosts(previousData.items)
        });
      }

      return { previousData };
    },
    onError: (error, postId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(postsQueryKeys.list(), context.previousData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.list() });
    },
  });
};

/**
 * useUpdatePost Mutation
 * - Updates an existing post
 */
export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const response = await postsAPI.updatePost(postId, { content });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch posts
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.list() });
      console.log('[React Query] Post updated successfully');
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

      const previousData = queryClient.getQueryData<any>(postsQueryKeys.list());

      const updatePosts = (posts: Post[]) => posts.filter((post) => post.id !== postId);

      if (Array.isArray(previousData)) {
        queryClient.setQueryData(postsQueryKeys.list(), updatePosts(previousData));
      } else if (previousData?.items) {
        queryClient.setQueryData(postsQueryKeys.list(), {
          ...previousData,
          items: updatePosts(previousData.items)
        });
      }

      return { previousData };
    },
    onError: (error, postId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(postsQueryKeys.list(), context.previousData);
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
