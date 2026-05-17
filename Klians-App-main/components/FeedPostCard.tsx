import React, { useState, useEffect } from 'react';
import { Post, User } from '../types';
import { Avatar } from './ui/Avatar';
import { ICONS } from '../constants';
import { Card } from './ui/Card';
import { postsAPI } from '../src/api/posts';
import { messagesAPI } from '../src/api/messages';
import { useAuth } from '../hooks/useAuth';
import { usePosts, useDeletePost, useUpdatePost } from '../src/hooks/usePosts';
import { ShareModal } from './ShareModal';
import { LikesModal } from './LikesModal';
import { CommentModal } from './CommentModal';
import { useSocket } from '../contexts/SocketContext';

const getImageUrl = (url: string | undefined) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `http://localhost:5000${url}`;
};

const useTimeAgo = (date: string | number | Date) => {
    const [time, setTime] = React.useState('...');

    React.useEffect(() => {
        const calculateTime = () => {
            if (!date) return "just now";
            const d = new Date(date);
            if (isNaN(d.getTime())) return "just now";
            
            const now = new Date();
            const diffSeconds = (now.getTime() - d.getTime()) / 1000;
            const seconds = Math.max(0, Math.floor(diffSeconds));
            
            if (seconds < 60) return "just now";
            
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes}m ago`;
        
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
        
            const days = Math.floor(hours / 24);
            if (days < 7) return `${days}d ago`;
            
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        setTime(calculateTime());
        const interval = setInterval(() => setTime(calculateTime()), 30000); // Update every 30s
        return () => clearInterval(interval);
    }, [date]);

    return time;
};

const parseMarkdownToHTML = (text: string | undefined): string => {
    if (!text) return '';

    let escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    escapedText = escapedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/__(.*?)__/g, '<u>$1</u>');

    // Match hashtags and wrap them in links
    escapedText = escapedText.replace(/(#\w+)/g, '<a href="#" class="text-red-500 hover:underline">$1</a>');

    return escapedText;
};

const ActionButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    isActive?: boolean;
}> = ({ icon, label, onClick, isActive }) => {
    const activeClasses = 'text-red-500 dark:text-red-400';
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${isActive ? activeClasses : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
};


export const FeedPostCard: React.FC<{ post: Post; onDelete?: (postId: string) => void }> = ({ post, onDelete }) => {
    const { user } = useAuth();

    // Safety check: ensure post.author exists
    if (!post.author) {
        return null;
    }

    const [isLiked, setIsLiked] = useState(post.isLiked || false);
    const [likeCount, setLikeCount] = useState(post.likes);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [showCommentsModal, setShowCommentsModal] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [commentCount, setCommentCount] = useState(post.comments);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [showLikesModal, setShowLikesModal] = useState(false);
    const [likes, setLikes] = useState<User[]>([]);
    const [isSaved, setIsSaved] = useState(() => {
        if (!post.id || !user) return false;
        try {
            const saved = localStorage.getItem(`saved_posts_${user.id}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.includes(String(post.id));
            }
        } catch (e) {
            console.error(e);
        }
        return false;
    });

    const handleSaveToggle = () => {
        if (!post.id || !user) return;
        setIsSaved(prev => {
            const next = !prev;
            try {
                const savedKey = `saved_posts_${user.id}`;
                const saved = localStorage.getItem(savedKey);
                let parsed = saved ? JSON.parse(saved) : [];
                if (next) {
                    if (!parsed.includes(String(post.id))) {
                        parsed.push(String(post.id));
                    }
                } else {
                    parsed = parsed.filter((id: string) => id !== String(post.id));
                }
                localStorage.setItem(savedKey, JSON.stringify(parsed));
            } catch (e) {
                console.error(e);
            }
            return next;
        });
    };

    // Keep state in sync with props when they change (e.g. on refresh or refetch)
    useEffect(() => {
        setIsLiked(post.isLiked || false);
        setLikeCount(post.likes);
        setCommentCount(post.comments);
    }, [post.id, post.likes, post.comments, post.isLiked]);

    // Mutation hooks for instant updates
    const deleteMutation = useDeletePost();
    const updateMutation = useUpdatePost();
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { socket } = useSocket();

    // Listen for real-time updates from other users
    useEffect(() => {
        if (!socket || !post.id) return;

        const handlePostUpdate = (data: any) => {
            if (String(data.postId) === String(post.id)) {
                if (data.type === 'LIKE_CHANGE') {
                    setLikeCount(data.likesCount);
                } else if (data.type === 'COMMENT_CHANGE') {
                    setCommentCount(data.commentCount);
                }
            }
        };

        socket.on('post_update', handlePostUpdate);
        return () => {
            socket.off('post_update', handlePostUpdate);
        };
    }, [socket, post.id]);

    const handleLike = async () => {
        if (isLikeLoading) return;

        if (!post.id) {
            console.error('Post ID is missing');
            alert('Error: Post ID is missing');
            return;
        }

        setIsLikeLoading(true);
        const previousLiked = isLiked;
        const previousCount = likeCount;

        // Optimistically update UI first
        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);

        try {
            if (isLiked) {
                await postsAPI.unlikePost(post.id);
            } else {
                await postsAPI.likePost(post.id);
            }
        } catch (error: any) {
            console.error('Error toggling like:', error);
            // Reset to previous state on error
            setIsLiked(previousLiked);
            setLikeCount(previousCount);

            // Show user-friendly error message
            if (error.response?.status === 400) {
                const message = error.response?.data?.message;
                if (message?.includes('already liked')) {
                    // This is fine - post is already liked, just update UI
                    setIsLiked(true);
                    return;
                } else if (message?.includes('has not yet been liked')) {
                    // Post hasn't been liked yet, just update UI
                    setIsLiked(false);
                    return;
                }
            }

            alert('Unable to process your like. Please try again.');
        } finally {
            setIsLikeLoading(false);
        }
    };

    const handleShowLikes = async () => {
        try {
            const response = await postsAPI.getPost(post.id);
            if (response.data && response.data.likes) {
                setLikes(response.data.likes);
                setShowLikesModal(true);
            }
        } catch (error) {
            console.error('Error fetching likes:', error);
            alert('Unable to load likes. Please try again.');
        }
    };

    const handleCommentClick = async () => {
        // Modal will load comments when opened
        setShowCommentsModal(true);
    };

    const handleCommentAdded = () => {
        setCommentCount(prev => prev + 1);
    };

    const confirmDeletePost = () => {
        setShowOptionsMenu(false);
        setShowDeleteConfirm(true);
    };

    const performDeletePost = async () => {
        try {
            await deleteMutation.mutateAsync(post.id);
            setShowDeleteConfirm(false);
            if (onDelete) {
                onDelete(post.id);
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('Failed to delete post. Please try again.');
        }
    };

    const handleUpdatePost = async () => {
        if (!editContent.trim()) return;
        try {
            await updateMutation.mutateAsync({ postId: post.id, content: editContent });
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating post:', error);
            alert('Failed to update post. Please try again.');
        }
    };

    // Corrected permission logic
    const isOwnPost = user ? (post.author.email === user.email || String(post.author.id) === String(user.id)) : false;
    const isPrivileged = user ? ['Teacher', 'Dean', 'Admin'].includes(user.role) : false;
    const canDelete = isOwnPost || isPrivileged;
    const canEdit = isOwnPost;

    const isUpdating = updateMutation.isPending;
    const isDeleting = deleteMutation.isPending;

    const timeDisplay = useTimeAgo(post.timestamp);

    return (
        <Card className="mb-4">
            {/* Post Header */}
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                    <Avatar src={post.author.avatar} alt={post.author.name} size="md" />
                    <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{post.author.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">@{post.author.username} · {timeDisplay}</p>
                    </div>
                </div>
                {/* Save and More Options Actions */}
                <div className="flex items-center gap-1">
                    {/* Save Button */}
                    <button
                        onClick={handleSaveToggle}
                        className={`p-2 rounded-full transition-colors ${
                            isSaved 
                                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        title={isSaved ? "Saved" : "Save Post"}
                    >
                        {isSaved ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        )}
                    </button>

                    {/* More Options Button (Only for Owners or Privileged users) */}
                    {canDelete && (
                        <div className="relative">
                            <button
                                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                                className="p-2 -mr-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                {ICONS.moreHorizontal}
                            </button>

                            {/* Options Dropdown Menu */}
                            {showOptionsMenu && (
                                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10 min-w-[160px] overflow-hidden">
                                    {/* OWNER OPTIONS */}
                                    {isOwnPost && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setIsEditing(true);
                                                    setShowOptionsMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2.5 transition-colors"
                                            >
                                                <div className="text-slate-400">{React.cloneElement(ICONS.attachment, { className: "h-4 w-4 rotate-[-45deg]" })}</div>
                                                Edit Post
                                            </button>
                                            <button
                                                onClick={confirmDeletePost}
                                                disabled={isDeleting}
                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center gap-2.5 transition-colors border-t border-slate-100 dark:border-slate-700/50"
                                            >
                                                <div className="text-red-400">{ICONS.trash}</div>
                                                {isDeleting ? 'Deleting...' : 'Delete Post'}
                                            </button>
                                        </>
                                    )}

                                    {/* PRIVILEGED OPTIONS (for posts they don't own) */}
                                    {isPrivileged && !isOwnPost && (
                                        <button
                                            onClick={confirmDeletePost}
                                            disabled={isDeleting}
                                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center gap-2.5 transition-colors"
                                        >
                                            <div className="text-red-400">{ICONS.trash}</div>
                                            {isDeleting ? 'Deleting...' : 'Remove Post (Admin)'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Post Content */}
            <div className="px-4 pb-3">
                {isEditing ? (
                    <div className="space-y-3">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none min-h-[120px] text-slate-800 dark:text-slate-200 scrollbar-hide"
                            autoFocus
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${target.scrollHeight}px`;
                            }}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdatePost}
                                disabled={isUpdating}
                                className="px-4 py-1.5 text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50"
                            >
                                {isUpdating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(post.content) }}
                    />
                )}
            </div>

            {/* Post Media (Image or Document) */}
            {post.image && (
                <div className="px-4 pb-4">
                    {(() => {
                        const url = getImageUrl(post.image);
                        const isDocument = url.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i);
                        
                        if (isDocument) {
                            const extension = url.split('.').pop()?.toUpperCase();
                            const filename = url.split('/').pop()?.split('-').slice(2).join('-') || 'Document';

                            return (
                                <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all group"
                                >
                                    <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                                        {React.cloneElement(ICONS.document, { className: "h-7 w-7" })}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-500 transition-colors">
                                            {filename}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                {extension}
                                            </span>
                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                                                Click to view
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-slate-400 group-hover:text-blue-500 transition-colors">
                                        {React.cloneElement(ICONS.attachment, { className: "h-5 w-5 rotate-[-45deg]" })}
                                    </div>
                                </a>
                            );
                        }

                        return (
                            <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl overflow-hidden">
                                <img
                                    src={url}
                                    alt={post.imageDescription || 'Post image'}
                                    className="w-full h-auto max-h-[400px] object-cover"
                                />
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Stats */}
            {(likeCount > 0 || commentCount > 0) && (
                <div className="flex justify-between items-center px-4 pt-3 text-sm text-slate-500 dark:text-slate-400">
                    <button
                        onClick={handleShowLikes}
                        className="hover:text-red-500 hover:underline transition-colors"
                    >
                        {likeCount.toLocaleString()} Likes
                    </button>
                    <span>{commentCount.toLocaleString()} Comments</span>
                </div>
            )}

            {/* Actions */}
            <div className="px-2 py-1 mt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-around items-center">
                    <ActionButton
                        icon={isLiked ? React.cloneElement(ICONS.likeSolid, { className: "h-5 w-5" }) : ICONS.like}
                        label="Like"
                        onClick={handleLike}
                        isActive={isLiked}
                    />
                    <ActionButton
                        icon={ICONS.comment}
                        label="Comment"
                        onClick={handleCommentClick}
                    />
                    <ActionButton
                        icon={ICONS.share}
                        label="Share"
                        onClick={async () => {
                            setIsShareModalOpen(true);
                        }}
                    />
                </div>
            </div>

            {/* Comment Modal */}
            <CommentModal
                isOpen={showCommentsModal}
                onClose={() => setShowCommentsModal(false)}
                postId={post.id}
                initialComments={comments}
                onCommentAdded={handleCommentAdded}
            />

            {/* Likes Modal */}
            <LikesModal
                isOpen={showLikesModal}
                onClose={() => setShowLikesModal(false)}
                likes={likes}
                title="Likes"
            />

            {/* Share Modal */}
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                postId={post.id}
                onShare={async (recipientId, message) => {
                    const postId = post.id || (post as any)._id;
                    if (!postId || !recipientId) {
                        throw new Error('Invalid share parameters');
                    }

                    try {
                        // Share post via messaging system
                        const shareMessage = message || `Check out this post: ${post.content?.substring(0, 50)}...`;
                        await messagesAPI.sharePost(recipientId, postId, shareMessage);
                    } catch (error: any) {
                        throw new Error(error.message || 'Failed to share post');
                    }
                }}
            />
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center space-y-4">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Post?</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {isOwnPost 
                                    ? "Are you sure you want to delete this post? This action cannot be undone."
                                    : "Are you sure you want to remove this post from the community?"}
                            </p>
                        </div>
                        <div className="flex flex-col border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={performDeletePost}
                                className="w-full py-3.5 text-red-600 dark:text-red-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="w-full py-3.5 text-slate-900 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};