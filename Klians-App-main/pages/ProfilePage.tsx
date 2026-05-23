import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ICONS } from '../constants';
import { Post, User } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { getBackendUrl, resolveBackendUrl } from '@/src/api/config';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { usersAPI } from '../src/api/users';
import { postsAPI } from '../src/api/posts';
import { ImageCropperModal } from '../components/ImageCropperModal';

type ProfileTab = 'posts' | 'documents' | 'saved';
type PhotoActionTarget = 'avatar' | 'banner' | null;


const getImageUrl = (url: string | undefined) => {
    return resolveBackendUrl(url);
};

const isDocumentFile = (url: string | undefined) => {
    if (!url) return false;
    return /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i.test(url);
};

const getMediaType = (url: string | undefined) => {
    if (!url) return 'image';
    const cleanUrl = url.split('?')[0].split('#')[0];
    const extension = cleanUrl.includes('.') ? cleanUrl.split('.').pop()?.toLowerCase() : '';

    if (extension && ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'].includes(extension)) return 'video';
    if (extension && ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) return 'document';
    return 'image';
};

const formatPostDate = (value: string | number | Date) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

type PostComment = {
    _id: string;
    text: string;
    date: string;
    parentId?: string | null;
    user: {
        id: string;
        name: string;
        email: string;
        profilePicture?: string;
    };
    likesCount?: number;
    isLiked?: boolean;
};

const getSafeCount = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (Array.isArray(val)) return val.length;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

const normalizeProfilePost = (post: any): Post => {
    const rawUrl = post.fileUrl || post.video || post.image || post.image_url || post.mediaUrl || '';
    const mediaType = getMediaType(rawUrl);
    const timestamp = post.created_at || post.createdAt || post.timestamp || post.date || new Date().toISOString();
    const user = post.user || {};
    const authorId = user?._id || user?.id || post.userId || post.user_id || '';
    const authorName = user?.name || post.name || 'User';
    const authorEmail = user?.email || post.email || '';
    const authorAvatar = user?.profilePicture || user?.profilepicture || user?.avatar || post.profilePicture || post.profilepicture || post.avatar || '';
    const authorCoverPhoto = user?.coverPhoto || user?.coverphoto || post.coverPhoto || post.coverphoto || '';
    const authorBio = user?.bio || post.bio || '';
    const authorRole = user?.role || post.role || 'Student';

    return {
        id: String(post._id || post.id),
        author: {
            id: String(authorId),
            name: authorName,
            username: authorEmail ? authorEmail.split('@')[0] : 'user',
            email: authorEmail,
            avatar: authorAvatar,
            coverPhoto: authorCoverPhoto,
            bio: authorBio,
            role: authorRole,
            createdAt: post.userCreatedAt || post.user_createdAt || timestamp,
        },
        content: post.content || '',
        timestamp,
        likes: post.likesCount !== undefined 
            ? getSafeCount(post.likesCount) 
            : getSafeCount(post.likes),
        comments: post.commentsCount !== undefined 
            ? getSafeCount(post.commentsCount) 
            : getSafeCount(post.comments),
        image: mediaType === 'image' ? rawUrl : undefined,
        video: mediaType === 'video' ? rawUrl : undefined,
        fileUrl: mediaType === 'document' ? rawUrl : undefined,
        imageDescription: post.imageDescription || '',
        isLiked: !!post.isLiked,
    };
};



const PostModal: React.FC<{ post: Post; onClose: () => void; author: User }> = ({ post, onClose, author }) => {
    const mediaUrl = post.video || post.image || post.fileUrl;
    const mediaType = getMediaType(mediaUrl);
    const postedDate = formatPostDate(post.timestamp);
    const [postDetails, setPostDetails] = useState<Post | null>(null);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadPostDetails = async () => {
            setCommentsLoading(true);
            try {
                const detailsResponse = await postsAPI.getPost(String(post.id));
                const details = detailsResponse.data;

                if (isMounted) {
                    setPostDetails({
                        ...post,
                        likes: Number(details.likesCount ?? details.likes ?? post.likes ?? 0),
                        comments: Number(details.commentsCount ?? details.comments?.length ?? post.comments ?? 0),
                    });
                    setComments(Array.isArray(details.comments) ? details.comments : []);
                }
            } catch (error) {
                if (isMounted) {
                    setPostDetails(post);
                    setComments([]);
                }
            } finally {
                if (isMounted) setCommentsLoading(false);
            }
        };

        loadPostDetails();

        return () => {
            isMounted = false;
        };
    }, [post, author.id]);

    const commentRows = comments;
    const commentCount = postDetails?.comments ?? post.comments;
    const rootComments = commentRows.filter(comment => !comment.parentId);
    const repliesByParent = commentRows.reduce((groups, comment) => {
        if (!comment.parentId) return groups;
        if (!groups[comment.parentId]) groups[comment.parentId] = [];
        groups[comment.parentId].push(comment);
        return groups;
    }, {} as Record<string, PostComment[]>);

    const renderComment = (comment: PostComment, depth = 0) => {
        const replies = repliesByParent[comment._id] || [];

        return (
            <div key={comment._id} className={`${depth > 0 ? 'ml-8 pl-3 border-l border-slate-200/80 dark:border-slate-800/80' : ''}`}>
                <div className="flex items-start gap-2 py-2">
                    <Avatar
                        src={getImageUrl(comment.user.profilePicture)}
                        alt={comment.user.name}
                        size="sm"
                        className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{comment.user.name}</p>
                            <p className="text-[10px] text-slate-400">{formatPostDate(comment.date)}</p>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-5 text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                            {comment.text}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                            {comment.likesCount > 0 && <span>{comment.likesCount} {comment.likesCount === 1 ? 'like' : 'likes'}</span>}
                            {comment.isLiked ? <span className="text-rose-500 font-semibold">Liked</span> : null}
                        </div>
                    </div>
                </div>

                {replies.length > 0 && (
                    <div className="pb-2">
                        {replies.map(reply => renderComment(reply, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 pt-3 pb-[6.75rem] sm:pt-4 sm:pb-4" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white hover:opacity-80 transition-opacity z-10">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="w-full max-w-6xl h-[calc(100dvh-7.75rem)] sm:h-[90vh] bg-white dark:bg-slate-900 flex flex-col md:flex-row rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className={`w-full md:w-[58%] flex items-center justify-center overflow-hidden h-[220px] md:h-auto md:min-h-0 ${mediaType === 'document' ? 'bg-white items-start pt-2 sm:items-center sm:pt-0' : 'bg-black'}`}>
                    {post.video ? (
                        <video 
                            src={getImageUrl(post.video)} 
                            controls 
                            autoPlay 
                            className="max-h-full max-w-full object-contain"
                        />
                    ) : post.image ? (
                        <img src={getImageUrl(post.image)} alt={post.imageDescription} className="max-h-full max-w-full object-contain" />
                    ) : post.fileUrl ? (
                        <div className="w-full h-full bg-white flex items-center justify-center p-3 sm:p-10">
                            <div className="w-full max-w-[200px] sm:max-w-md rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-sm p-4 sm:p-10 text-center">
                                <div className="mx-auto w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h8M8 17h8M8 9h2" />
                                    </svg>
                                </div>
                                <p className="mt-2.5 sm:mt-5 text-[14px] sm:text-lg font-semibold text-slate-900">Document Attached</p>
                                <a 
                                    href={getImageUrl(post.fileUrl)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="mt-3.5 sm:mt-6 inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-blue-600 text-white text-[10px] sm:text-base font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    View Document
                                </a>
                            </div>
                        </div>

                    ) : (
                        <div className="p-8 text-slate-500 text-sm italic">No media preview available</div>
                    )}
                </div>
                <div
                    className="w-full md:w-[40%] flex flex-col bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 overflow-y-auto scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
                        <div className="flex items-center gap-3 min-w-0">
                            <Avatar src={author.avatar} alt={author.name} size="md" className="shrink-0" />
                            <div className="min-w-0">
                                <p className="font-semibold text-[14px] text-slate-900 dark:text-white truncate">{author.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{author.username}</p>
                            </div>
                        </div>
                        <Badge role={author.role} />
                    </div>

                    <div
                        className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 scrollbar-hide"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-400 font-bold">
                                <span>Posted</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <span>{postedDate}</span>
                            </div>
                            {post.content ? (
                                <p className="text-[13px] leading-5 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {post.content}
                                </p>
                            ) : (
                                <p className="text-[13px] text-slate-500 dark:text-slate-400 italic">No caption provided.</p>
                            )}

                            <div className="flex items-center gap-4 pt-1">
                                <div className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.53L12 21.35z" /></svg>
                                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{postDetails?.likes ?? post.likes}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Likes</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{commentCount}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Comments</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Comments</p>
                            </div>
                            <div>
                                {commentsLoading ? (
                                    <div className="p-4 text-[13px] text-slate-500 dark:text-slate-400 animate-pulse">Loading comments...</div>
                                ) : commentRows.length > 0 ? (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800 px-3.5">
                                        {rootComments.map(comment => renderComment(comment))}
                                    </div>
                                ) : (
                                    <div className="px-4 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
                                        No comments yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


import { useSocket } from '../contexts/SocketContext';

const useTimeAgo = (date: string | number | Date) => {
    const [time, setTime] = useState('...');

    useEffect(() => {
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
        const interval = setInterval(() => setTime(calculateTime()), 30000);
        return () => clearInterval(interval);
    }, [date]);

    return time;
};

const PostItem: React.FC<{ post: Post; onClick: () => void }> = ({ post, onClick }) => {
    const timestampParsed = typeof post.timestamp === 'string' && !isNaN(Number(post.timestamp)) ? Number(post.timestamp) : post.timestamp;
    const date = new Date(timestampParsed);
    const dateFormatted = isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const docUrl = post.fileUrl || post.image;
    const extension = docUrl?.split('.').pop()?.toUpperCase() || 'DOC';
    
    // Extract everything after the first dash (which is the timestamp)
    const urlFilename = docUrl?.split('/').pop() || '';
    const nameParts = urlFilename.split('-');
    const realName = nameParts.length > 1 ? nameParts.slice(1).join('-') : urlFilename;
    const fileName = realName || `document.${extension.toLowerCase()}`;

    return (
        <div 
            onClick={onClick}
            className="group bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-2.5 flex items-center gap-5 hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer shadow-sm hover:shadow-md"
        >
            <div className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0">
                <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-0.5">
                    <h3 className="font-bold text-[14.5px] text-slate-800 dark:text-white truncate">
                        {fileName}
                    </h3>
                    <span className="text-[9px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded uppercase tracking-wider border border-slate-100 dark:border-slate-700">
                        {extension}
                    </span>
                </div>
                
                {post.content && (
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2 font-medium">
                        {post.content}
                    </p>
                )}
                
                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/30 pt-2 mt-0.5">
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                        <span className="flex items-center gap-1 opacity-70">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {dateFormatted}
                        </span>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                {post.likes}
                            </span>
                            <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                {post.comments}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-500 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                        Open
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ProfilePage: React.FC = () => {
    const { userId } = useParams();
    const { user: loggedInUser, updateProfile } = useAuth();
    const { socket } = useSocket();
    const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [profileUser, setProfileUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [postsLoading, setPostsLoading] = useState(false);
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [savedPosts, setSavedPosts] = useState<Post[]>([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [bannerUploading, setBannerUploading] = useState(false);
    const [photoActionTarget, setPhotoActionTarget] = useState<PhotoActionTarget>(null);
    const [avatarLoadError, setAvatarLoadError] = useState(false);
    
    // Cropper states
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [cropType, setCropType] = useState<'avatar' | 'banner' | null>(null);
    
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);
    
    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/home', { replace: true });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setImageToCrop(reader.result as string);
            setCropType(type);
        };
        reader.readAsDataURL(file);
        
        // Reset input value so same file can be picked again
        e.target.value = '';
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        const type = cropType;
        setImageToCrop(null);
        setCropType(null);
        
        if (!type || !profileUser) return;

        try {
            if (type === 'avatar') setUploading(true);
            else setBannerUploading(true);

            const base64data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(croppedBlob);
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
            });

            if (type === 'avatar') {
                await updateProfile({ avatar: base64data });
                setProfileUser((prev: any) => ({ ...prev, profilePicture: base64data, avatar: base64data }));
            } else {
                await updateProfile({ coverPhoto: base64data });
                setProfileUser((prev: any) => ({ ...prev, coverPhoto: base64data }));
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to update image');
        } finally {
            setUploading(false);
            setBannerUploading(false);
        }
    };

    const handleDeleteCurrentPhoto = async () => {
        if (!photoActionTarget || !profileUser) return;

        try {
            if (photoActionTarget === 'avatar') {
                setUploading(true);
                await updateProfile({ avatar: '' });
                setProfileUser((prev: any) => ({ ...prev, profilePicture: '', avatar: '' }));
            } else {
                setBannerUploading(true);
                await updateProfile({ coverPhoto: '' });
                setProfileUser((prev: any) => ({ ...prev, coverPhoto: '' }));
            }
        } catch (error) {
            console.error('Delete photo error:', error);
            alert('Failed to delete image');
        } finally {
            setUploading(false);
            setBannerUploading(false);
            setPhotoActionTarget(null);
        }
    };

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!userId) {
                setProfileUser(loggedInUser);
                setLoading(false);
                return;
            }

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${getBackendUrl()}/api/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const userData = await response.json();
                    setProfileUser(userData);
                }
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [userId, loggedInUser]);

    const userToDisplay = profileUser;
    const profileImage = userToDisplay?.profilePicture || userToDisplay?.profilepicture || userToDisplay?.avatar || '';
    const profileId = userToDisplay?.id || userToDisplay?._id;
    const loggedInId = loggedInUser?.id || (loggedInUser as any)?._id;
    const isOwnProfile = !userId || (profileId !== undefined && loggedInId !== undefined && String(profileId) === String(loggedInId));

    useEffect(() => {
        setAvatarLoadError(false);
    }, [profileImage]);
    
    useEffect(() => {
        if (!isOwnProfile && activeTab === 'saved') {
            setActiveTab('posts');
        }
    }, [isOwnProfile, activeTab]);
    useEffect(() => {
        const fetchUserPosts = async () => {
            if (!userToDisplay?.id && !userToDisplay?._id) return;
            setPostsLoading(true);
            try {
                const pid = userToDisplay._id || userToDisplay.id;
                const response = await usersAPI.getUserPosts(String(pid));
                const items = response.data?.items || response.data || [];
                const mappedPosts: Post[] = Array.isArray(items) ? items.map((p: any) => normalizeProfilePost(p)) : [];

                setUserPosts(mappedPosts);
            } catch (error) {
                console.error('Posts error:', error);
            } finally {
                setPostsLoading(false);
            }
        };

        fetchUserPosts();
    }, [userToDisplay]);

    // Socket Listeners for Live Updates
    useEffect(() => {
        if (!socket) return;

        const handlePostUpdate = (data: any) => {
            setUserPosts(prev => prev.map(post => {
                if (String(post.id) === String(data.postId)) {
                    if (data.type === 'LIKE_CHANGE') {
                        return { ...post, likes: data.likesCount };
                    } else if (data.type === 'COMMENT_CHANGE') {
                        return { ...post, comments: data.commentCount };
                    }
                }
                return post;
            }));
        };

        const handleNewPost = (newPost: any) => {
            const pid = userToDisplay?._id || userToDisplay?.id;
            const postUserId = newPost.user?._id || newPost.user?.id || newPost.user || newPost.userId;
            
            if (String(postUserId) === String(pid)) {
                const mapped = normalizeProfilePost(newPost);
                setUserPosts(prev => [mapped, ...prev]);
            }
        };

        socket.on('post_update', handlePostUpdate);
        socket.on('new-post', handleNewPost);

        return () => {
            socket.off('post_update', handlePostUpdate);
            socket.off('new-post', handleNewPost);
        };
    }, [socket, userToDisplay]);

    useEffect(() => {
        const fetchSavedPosts = async () => {
            if (!loggedInUser || activeTab !== 'saved') return;
            setSavedLoading(true);
            try {
                const savedKey = `saved_posts_${loggedInUser.id || (loggedInUser as any)._id}`;
                const saved = localStorage.getItem(savedKey);
                const parsedIds = saved ? JSON.parse(saved) : [];
                if (parsedIds.length === 0) {
                    setSavedPosts([]);
                    setSavedLoading(false);
                    return;
                }
                
                // Fetch each post by ID in parallel
                const promises = parsedIds.map(async (id: string) => {
                    try {
                        const response = await postsAPI.getPost(id);
                        if (response.data) {
                            return normalizeProfilePost(response.data);
                        }
                    } catch (err) {
                        console.error(`Failed to fetch saved post ${id}:`, err);
                    }
                    return null;
                });
                
                const results = await Promise.all(promises);
                const validPosts = results.filter((p): p is Post => p !== null);
                setSavedPosts(validPosts);
            } catch (error) {
                console.error('Error loading saved posts:', error);
            } finally {
                setSavedLoading(false);
            }
        };

        fetchSavedPosts();

        const handleSavedUpdate = () => {
            if (activeTab === 'saved') fetchSavedPosts();
        };
        window.addEventListener('saved_posts_updated', handleSavedUpdate);
        return () => window.removeEventListener('saved_posts_updated', handleSavedUpdate);
    }, [activeTab, loggedInUser.id]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-pulse">
                {/* Banner Skeleton */}
                <div className="h-48 md:h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl w-full" />
                
                {/* Profile Details Header Skeleton */}
                <div className="relative -mt-16 px-6 pb-6 flex flex-col sm:flex-row items-center sm:items-end justify-between border-b border-slate-200 dark:border-slate-800 gap-4">
                    <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
                        {/* Avatar circle */}
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-700 shadow-md" />
                        <div className="space-y-2">
                            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40" />
                            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-24" />
                        </div>
                    </div>
                    {/* Action button */}
                    <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                </div>

                {/* Tabs Skeleton */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 py-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                </div>

                {/* Posts/Content Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
                                <div className="space-y-1.5 flex-1">
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
                                </div>
                            </div>
                            <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-full" />
                            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-24" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    if (!profileUser) return <div className="p-8 text-center">User not found</div>;

    const renderContent = () => {
        switch (activeTab) {
            case 'posts':
                const visualPosts = userPosts.filter(p => (p.image && !isDocumentFile(p.image)) || p.video);
                if (visualPosts.length === 0) {
                    return <Card className="p-12 text-center text-slate-500">No photos or videos yet</Card>;
                }
                return (
                    <div className="grid grid-cols-3 gap-1 sm:gap-4">
                        {visualPosts.map(post => (
                            <div key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square relative group cursor-pointer overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                                {post.image ? (
                                    <img src={getImageUrl(post.image)} alt="post" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                ) : post.video ? (
                                    <div className="w-full h-full relative">
                                        <video src={getImageUrl(post.video)} className="w-full h-full object-cover" />
                                        <div className="absolute top-2 right-2 bg-black/60 p-1 rounded-md">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.333-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"/></svg>
                                        </div>
                                    </div>
                                ) : null}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white text-xs sm:text-sm font-bold">
                                    <span className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3c1.745 0 3.23.834 4.312 2.113C13.083 3.834 14.568 3 16.312 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                                        {post.likes}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                                        {post.comments}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'documents':
                const docPosts = userPosts.filter(p => p.fileUrl || (p.image && isDocumentFile(p.image)));
                if (docPosts.length === 0) {
                    return <Card className="p-12 text-center text-slate-500">No documents shared yet</Card>;
                }
                return (
                    <div className="flex flex-col gap-4">
                        {docPosts.map(post => (
                            <PostItem key={post.id} post={post} onClick={() => setSelectedPost(post)} />
                        ))}
                    </div>
                );


            case 'saved':
                if (savedLoading) {
                    return (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white"></div>
                        </div>
                    );
                }
                if (savedPosts.length === 0) {
                    return (
                        <Card className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-300 dark:text-slate-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                            </svg>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">No saved posts</h3>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Posts you save will appear here in your private collection.</p>
                            </div>
                        </Card>
                    );
                }
                return (
                    <div className="grid grid-cols-3 gap-1 sm:gap-4">
                        {savedPosts.map(post => {
                            const isDoc = post.fileUrl || (post.image && isDocumentFile(post.image));
                            return (
                                <div key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square relative group cursor-pointer overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/20">
                                    {post.image && !isDocumentFile(post.image) ? (
                                        <img src={getImageUrl(post.image)} alt="post" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    ) : post.video ? (
                                        <div className="w-full h-full relative">
                                            <video src={getImageUrl(post.video)} className="w-full h-full object-cover" />
                                            <div className="absolute top-2 right-2 bg-black/60 p-1 rounded-md">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.333-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"/></svg>
                                            </div>
                                        </div>
                                    ) : isDoc ? (
                                        <div className="w-full h-full p-3 sm:p-4 flex flex-col justify-between bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10">
                                            <p className="text-[9px] sm:text-xs text-slate-700 dark:text-slate-300 line-clamp-2 font-medium leading-relaxed mb-0.5">
                                                {post.content}
                                            </p>
                                            <div className="flex-1 flex flex-col items-center justify-center gap-1 py-1">
                                                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-emerald-100/60 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                    {React.cloneElement(ICONS.document as React.ReactElement, { className: "h-8 w-8 sm:h-9 sm:w-9" } as any)}
                                                </div>
                                                <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-white/60 dark:bg-slate-800/40 px-1.5 py-0.5 rounded-full border border-slate-200/40">
                                                    {(post.fileUrl || post.image)?.split('.').pop()?.toUpperCase() || 'PDF'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[9px] sm:text-xs text-slate-400 gap-2 border-t border-slate-100/40 dark:border-slate-800/40 pt-1">
                                                <span className="font-bold truncate max-w-[75%]">@{post.author?.username}</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" className="w-3.5 h-3.5 text-slate-400 shrink-0">
                                                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                                                </svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full p-3 sm:p-4 flex flex-col justify-between bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/80">
                                            <p className="text-[9px] sm:text-xs text-slate-700 dark:text-slate-300 line-clamp-4 font-medium leading-relaxed">
                                                {post.content}
                                            </p>
                                            <div className="flex items-center justify-between text-[9px] sm:text-xs text-slate-400 gap-2">
                                                <span className="font-bold truncate max-w-[75%]">@{post.author?.username}</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" className="w-3.5 h-3.5 text-slate-400 shrink-0">
                                                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white text-xs sm:text-sm font-bold">
                                        <span className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3c1.745 0 3.23.834 4.312 2.113C13.083 3.834 14.568 3 16.312 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                                            {getSafeCount(post.likes)}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                                            {getSafeCount(post.comments)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );

            default: return null;
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto md:pt-6 px-4 pb-20 relative">
            <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex md:hidden items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <button 
                        onClick={handleBack} 
                        className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">{profileUser.username}</h1>
                </div>
                <Link to="/settings" className="p-2 -mr-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    {React.cloneElement(ICONS.settings, { className: "h-6 w-6" })}
                </Link>
            </header>
            <div className="md:hidden h-12"></div>

            {imageToCrop && (
                <ImageCropperModal 
                    image={imageToCrop} 
                    circular={cropType === 'avatar'}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                        setImageToCrop(null);
                        setCropType(null);
                    }}
                />
            )}

            {photoActionTarget && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                        <div className="px-6 pt-6 pb-4 text-center border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Profile Photo
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose what you want to do</p>
                        </div>

                        <div className="p-4 space-y-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (photoActionTarget === 'avatar') fileInputRef.current?.click();
                                    if (photoActionTarget === 'banner') bannerInputRef.current?.click();
                                    setPhotoActionTarget(null);
                                }}
                                className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold text-slate-900 dark:text-white transition-colors"
                            >
                                Change Photo
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteCurrentPhoto}
                                className="w-full h-11 rounded-xl bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-sm font-semibold text-rose-600 dark:text-rose-400 transition-colors"
                            >
                                Delete Current
                            </button>
                            <button
                                type="button"
                                onClick={() => setPhotoActionTarget(null)}
                                className="w-full h-11 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header / Banner */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                <div className="h-32 sm:h-48 bg-slate-900 relative">
                    <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'banner')} />
                    {userToDisplay.coverPhoto ? (
                        <img src={getImageUrl(userToDisplay.coverPhoto)} alt="banner" className={`w-full h-full object-cover ${bannerUploading ? 'opacity-40 animate-pulse' : ''}`} />
                    ) : (
                        <div className="w-full h-full bg-[#0f172a]" />
                    )}
                </div>

                <div className="px-5 sm:px-8 pb-6 sm:pb-8 relative">
                    <div className="flex justify-between items-end sm:items-start -mt-12 sm:-mt-16 mb-4">
                        <div className="relative">
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} />
                            <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-lg overflow-hidden bg-slate-200 dark:bg-slate-700 ${uploading ? 'animate-pulse' : ''}`}>
                                {profileImage && !avatarLoadError ? (
                                    <img
                                        src={getImageUrl(profileImage)}
                                        alt="avatar"
                                        className="w-full h-full object-cover"
                                        onError={() => setAvatarLoadError(true)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-2xl">
                                        {(userToDisplay?.name || 'U').slice(0, 1).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {isOwnProfile && (
                                <button 
                                    onClick={() => setPhotoActionTarget('avatar')}
                                    disabled={uploading}
                                    className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-white dark:bg-slate-700 rounded-full p-1.5 sm:p-2 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 border border-slate-100 dark:border-slate-600"
                                >
                                    {uploading ? (
                                        <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 dark:text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </div>
                        
                        {isOwnProfile && (
                            <div className="mb-1 sm:mt-20">
                                <Link to="/settings">
                                    <button className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 border border-slate-200 dark:border-slate-600 shadow-sm">
                                        Edit Profile
                                    </button>
                                </Link>
                            </div>
                        )}
                        {!isOwnProfile && (
                             <div className="mb-1 sm:mt-20">
                                <Button onClick={() => navigate(`/messages/${userToDisplay._id || userToDisplay.id}`)} className="!px-4 !py-2 text-xs sm:text-sm">Message</Button>
                             </div>
                        )}
                    </div>

                    <div className="mt-2 sm:mt-4">
                        <div className="flex items-center gap-2 sm:gap-3 mb-1">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-none">{userToDisplay.name}</h1>
                            <Badge role={userToDisplay.role} />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-semibold text-xs sm:text-sm mb-3 sm:mb-4">{userToDisplay.email}</p>
                        <p className="text-slate-700 dark:text-slate-300 text-sm max-w-2xl leading-relaxed font-medium mb-4">{userToDisplay.bio || 'Building something amazing at KLIANS.'}</p>
                        
                        {(userToDisplay.linkedin || userToDisplay.github || userToDisplay.portfolio) && (
                            <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
                                {userToDisplay.linkedin && (
                                    <a href={userToDisplay.linkedin.startsWith('http') ? userToDisplay.linkedin : `https://${userToDisplay.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-slate-50 dark:bg-slate-800/50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-slate-100 dark:border-slate-700/50">
                                        {React.cloneElement(ICONS.linkedin as React.ReactElement, { className: "h-3 w-3 sm:h-3.5 sm:w-3.5" } as any)}
                                        <span>LinkedIn</span>
                                    </a>
                                )}
                                {userToDisplay.github && (
                                    <a href={userToDisplay.github.startsWith('http') ? userToDisplay.github : `https://${userToDisplay.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-50 dark:bg-slate-800/50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-slate-100 dark:border-slate-700/50">
                                        {React.cloneElement(ICONS.github as React.ReactElement, { className: "h-3 w-3 sm:h-3.5 sm:w-3.5" } as any)}
                                        <span>GitHub</span>
                                    </a>
                                )}
                                {userToDisplay.portfolio && (
                                    <a href={userToDisplay.portfolio.startsWith('http') ? userToDisplay.portfolio : `https://${userToDisplay.portfolio}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-50 dark:bg-slate-800/50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-slate-100 dark:border-slate-700/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                                        <span>Website</span>
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-8 border-b border-slate-200 dark:border-slate-700 mb-8 px-4">
                {(isOwnProfile ? ['posts', 'documents', 'saved'] : ['posts', 'documents']).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as ProfileTab)}
                        className={`pb-4 text-xs font-black tracking-widest uppercase transition-all border-b-2 ${
                            activeTab === tab 
                                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' 
                                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>


            <div className="px-1">{renderContent()}</div>

            {selectedPost && <PostModal post={selectedPost} author={selectedPost.author || userToDisplay} onClose={() => setSelectedPost(null)} />}
        </div>
    );
};