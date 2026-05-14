import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ICONS } from '../constants';
import { Post, User } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { postsAPI } from '../src/api/posts';
import { ImageCropperModal } from '../components/ImageCropperModal';

type ProfileTab = 'posts' | 'media' | 'saved';

const PostModal: React.FC<{ post: Post; onClose: () => void; author: User }> = ({ post, onClose, author }) => (
    <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:opacity-80 transition-opacity">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 flex rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-full md:w-3/5 bg-black flex items-center justify-center rounded-l-lg">
                <img src={post.image} alt={post.imageDescription} className="max-h-full max-w-full object-contain" />
            </div>
            <div className="hidden md:flex w-2/5 flex-col p-4">
                <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                    <Avatar src={author.avatar} alt={author.name} size="md" />
                    <div>
                        <p className="font-semibold text-sm">{author.name}</p>
                        <p className="text-xs text-slate-500">@{author.username}</p>
                    </div>
                </div>
                <div className="flex-1 py-4 space-y-4 text-sm overflow-y-auto">
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-8">Comments are not yet implemented.</p>
                </div>
            </div>
        </div>
    </div>
);


export const ProfilePage: React.FC = () => {
    const { userId } = useParams();
    const { user: loggedInUser, updateProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [profileUser, setProfileUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [postsLoading, setPostsLoading] = useState(false);
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [uploading, setUploading] = useState(false);
    const [bannerUploading, setBannerUploading] = useState(false);
    
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

            const formData = new FormData();
            formData.append('file', croppedBlob, 'profile-image.jpg');

            const token = localStorage.getItem('token');
            const uploadRes = await fetch('http://localhost:5000/api/messages/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!uploadRes.ok) throw new Error('Upload failed');
            const { url } = await uploadRes.json();

            if (type === 'avatar') {
                await updateProfile({ avatar: url });
                setProfileUser((prev: any) => ({ ...prev, profilePicture: url, avatar: url }));
            } else {
                await updateProfile({ coverPhoto: url });
                setProfileUser((prev: any) => ({ ...prev, coverPhoto: url }));
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to update image');
        } finally {
            setUploading(false);
            setBannerUploading(false);
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
                const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
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
    const isOwnProfile = userToDisplay?._id === (loggedInUser as any)?._id || userToDisplay?._id === (loggedInUser as any)?.id || userToDisplay?.id === (loggedInUser as any)?.id;
    
    useEffect(() => {
        const fetchUserPosts = async () => {
            if (!userToDisplay?.id && !userToDisplay?._id) return;
            setPostsLoading(true);
            try {
                const response = await postsAPI.getPosts();
                const allPosts = response.data.items || response.data || [];
                const pid = userToDisplay._id || userToDisplay.id;
                const filtered = Array.isArray(allPosts) ? allPosts.filter((p: any) => {
                    const postUserId = p.user?._id || p.user?.id || p.user || p.userId;
                    return String(postUserId) === String(pid) && p.image;
                }) : [];

                const mappedPosts: Post[] = filtered.map((p: any) => ({
                    id: p._id || p.id,
                    author: {
                        id: p.user?._id || p.user?.id || '',
                        name: p.user?.name || 'User',
                        username: p.user?.email || 'user',
                        email: p.user?.email || '',
                        avatar: p.user?.profilePicture || '',
                        coverPhoto: p.user?.coverPhoto || '',
                        bio: p.user?.bio || '',
                        role: p.user?.role || 'Student',
                        createdAt: p.createdAt || new Date().toISOString(),
                    },
                    content: p.content || '',
                    timestamp: p.createdAt || new Date().toISOString(),
                    likes: p.likes?.length || 0,
                    comments: p.comments?.length || 0,
                    image: p.image,
                    imageDescription: '',
                }));

                setUserPosts(mappedPosts);
            } catch (error) {
                console.error('Posts error:', error);
            } finally {
                setPostsLoading(false);
            }
        };

        fetchUserPosts();
    }, [userToDisplay]);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading Profile...</div>;
    if (!profileUser) return <div className="p-8 text-center">User not found</div>;

    const renderContent = () => {
        switch (activeTab) {
            case 'posts':
                if (userPosts.length === 0) {
                    return <Card className="p-12 text-center text-slate-500">No posts yet</Card>;
                }
                return (
                    <div className="grid grid-cols-3 gap-1 sm:gap-4">
                        {userPosts.map(post => (
                            <div key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square relative group cursor-pointer overflow-hidden rounded-md">
                                <img src={post.image} alt="post" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-bold">
                                    <span>♥ {post.likes}</span>
                                    <span>💬 {post.comments}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'saved':
                return <Card className="p-12 text-center text-slate-500">No saved posts</Card>;
            case 'media':
                return <Card className="p-12 text-center text-slate-500">No tagged photos</Card>;
            default: return null;
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto pt-6 px-4 pb-20 relative">

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

            {/* Header / Banner */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                <div className="h-32 sm:h-48 bg-slate-900 relative">
                    <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'banner')} />
                    {userToDisplay.coverPhoto ? (
                        <img src={userToDisplay.coverPhoto} alt="banner" className={`w-full h-full object-cover ${bannerUploading ? 'opacity-40 animate-pulse' : ''}`} />
                    ) : (
                        <div className="w-full h-full bg-[#0f172a]" />
                    )}
                    
                    {isOwnProfile && (
                        <button 
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={bannerUploading}
                            className="absolute bottom-3 right-4 sm:bottom-4 sm:right-8 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all shadow-md disabled:opacity-50 z-20"
                        >
                            {bannerUploading ? 'Uploading...' : 'Edit Banner'}
                        </button>
                    )}
                </div>

                <div className="px-5 sm:px-8 pb-6 sm:pb-8 relative">
                    <div className="flex justify-between items-end sm:items-start -mt-12 sm:-mt-16 mb-4">
                        <div className="relative">
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} />
                            <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-lg overflow-hidden bg-slate-200 dark:bg-slate-700 ${uploading ? 'animate-pulse' : ''}`}>
                                <img src={userToDisplay.profilePicture || userToDisplay.avatar} alt="avatar" className="w-full h-full object-cover" />
                            </div>
                            {isOwnProfile && (
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
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
                                        {React.cloneElement(ICONS.linkedin as React.ReactElement, { className: "h-3 w-3 sm:h-3.5 sm:w-3.5" })}
                                        <span>LinkedIn</span>
                                    </a>
                                )}
                                {userToDisplay.github && (
                                    <a href={userToDisplay.github.startsWith('http') ? userToDisplay.github : `https://${userToDisplay.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-50 dark:bg-slate-800/50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-slate-100 dark:border-slate-700/50">
                                        {React.cloneElement(ICONS.github as React.ReactElement, { className: "h-3 w-3 sm:h-3.5 sm:w-3.5" })}
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
                {(['posts', 'saved', 'media'] as ProfileTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
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

            {selectedPost && <PostModal post={selectedPost} author={userToDisplay} onClose={() => setSelectedPost(null)} />}
        </div>
    );
};