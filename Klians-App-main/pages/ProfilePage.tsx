import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ICONS } from '../constants';
import { Post, User } from '../types';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { postsAPI } from '../src/api/posts';

type ProfileTab = 'posts' | 'media' | 'saved';

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => {
    const activeClasses = 'border-red-500 text-slate-900 dark:text-slate-100';
    const inactiveClasses = 'border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200';
    return (
        <button
            onClick={onClick}
            className={`py-4 px-6 text-sm font-semibold border-b-2 transition-colors duration-200 ${isActive ? activeClasses : inactiveClasses}`}
        >
            {label}
        </button>
    );
};

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
    const { user: loggedInUser } = useAuth();
    const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [profileUser, setProfileUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [postsLoading, setPostsLoading] = useState(false);
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const navigate = useNavigate();
    
    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/home', { replace: true });
        }
    };

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!userId) {
                // If no userId in params, show logged in user's profile
                setProfileUser(loggedInUser);
                setLoading(false);
                return;
            }

            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setLoading(false);
                    return;
                }

                const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const userData = await response.json();
                    setProfileUser(userData);
                } else {
                    console.error('Failed to fetch user profile');
                    setProfileUser(null);
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
                setProfileUser(null);
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [userId, loggedInUser]);

    const userToDisplay = profileUser;
    const isOwnProfile = userToDisplay?._id === (loggedInUser as any)?._id || userToDisplay?._id === (loggedInUser as any)?.id || userToDisplay?.id === (loggedInUser as any)?.id;
    const userMediaPosts = userPosts.filter(post => (post as any).image);

    // Fetch posts for this user
    useEffect(() => {
        const fetchUserPosts = async () => {
            if (!userToDisplay?._id && !userToDisplay?.id) return;
            setPostsLoading(true);
            try {
                const response = await postsAPI.getPosts();
                const allPosts = response.data || [];
                const pid = userToDisplay._id || userToDisplay.id;
                const filtered = allPosts.filter((p: any) => {
                    const postUserId = p.user?._id || p.user?.id || p.user;
                    const hasImage = typeof p.image === 'string' ? p.image.trim().length > 0 : Boolean(p.image);
                    return postUserId === pid && hasImage; // only non-empty image posts
                });

                // Normalize API post shape to UI Post type consumed by PostCard
                const mappedPosts: Post[] = filtered.map((p: any) => {
                    const user = p.user || {};
                    const createdAt = p.createdAt || p.timestamp || new Date().toISOString();
                    return {
                        id: p._id || p.id,
                        author: {
                            id: user._id || user.id || '',
                            name: user.name || 'Unknown User',
                            username: user.email || user.name || 'user',
                            email: user.email || '',
                            avatar: user.profilePicture || user.avatar || '',
                            coverPhoto: user.coverPhoto || '',
                            bio: user.bio || '',
                            role: (user.role as any) || 'Student',
                            createdAt,
                        },
                        content: p.content || p.caption || p.text || '',
                        timestamp: createdAt,
                        likes: Array.isArray(p.likes) ? p.likes.length : p.likes || 0,
                        comments: Array.isArray(p.comments) ? p.comments.length : p.comments || 0,
                        image: p.image,
                        imageDescription: p.imageDescription || '',
                    };
                });

                setUserPosts(mappedPosts);
            } catch (error) {
                console.error('Error fetching user posts:', error);
                setUserPosts([]);
            } finally {
                setPostsLoading(false);
            }
        };

        fetchUserPosts();
    }, [userToDisplay]);

    if (loading) {
        return (
            <div className="w-full max-w-5xl mx-auto pt-6 px-4">
                {/* Skeleton Banner */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-6 animate-pulse">
                    <div className="h-48 bg-slate-200 dark:bg-slate-700"></div>
                    
                    {/* Skeleton Profile Info */}
                    <div className="relative px-8 pb-8">
                        <div className="flex justify-between items-start -mt-16 mb-4">
                            <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-700 border-4 border-white dark:border-slate-800"></div>
                        </div>
                        
                        <div className="mt-4 space-y-3">
                            <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-4 w-56 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        </div>
                    </div>
                </div>

                {/* Skeleton Tabs */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 animate-pulse">
                    <div className="flex justify-around items-center p-4">
                        {[1,2,3].map(i => (
                            <div key={i} className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        ))}
                    </div>
                </div>

                {/* Skeleton Grid Posts */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 sm:gap-4 animate-pulse">
                    {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!profileUser || !loggedInUser) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <div className="text-4xl mb-4">👤</div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">User not found</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">This user doesn't exist or has been removed.</p>
                <Button onClick={() => navigate('/home')}>Go to Home</Button>
            </div>
        );
    }

    const renderPostSkeletons = () => (
        <div className="space-y-4">
            {[1,2,3].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                    <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-52 w-full bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'posts':
                if (postsLoading) {
                    return renderPostSkeletons();
                }

                return userPosts.length > 0
                    ? <div className="grid grid-cols-2 md:grid-cols-3 gap-1 sm:gap-4">
                        {userPosts.map(post => (
                            <div key={(post as any)._id || post.id} onClick={() => setSelectedPost(post)} className="group relative cursor-pointer aspect-square">
                                <img src={post.image} alt={post.imageDescription} className="w-full h-full object-cover rounded-md"/>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center gap-x-6 text-white font-semibold rounded-md">
                                    <div className="flex items-center gap-1"><span>♥</span> {post.likes}</div>
                                    <div className="flex items-center gap-1"><span>💬</span> {post.comments}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    : <Card><p className="text-center py-8 text-slate-500 dark:text-slate-400">No posts yet.</p></Card>;
            case 'media':
                return userMediaPosts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1 sm:gap-4">
                        {userMediaPosts.map(post => (
                            <div key={(post as any)._id || post.id} onClick={() => setSelectedPost(post)} className="group relative cursor-pointer aspect-square">
                                <img src={post.image} alt={post.imageDescription} className="w-full h-full object-cover rounded-md"/>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center gap-x-6 text-white font-semibold rounded-md"></div>
                            </div>
                        ))}
                    </div>
                ) : <Card><p className="text-center py-8 text-slate-500 dark:text-slate-400">No media found.</p></Card>;
            case 'saved':
                return <Card><p className="text-center py-8 text-slate-500 dark:text-slate-400">Saved items will appear here.</p></Card>;
            default:
                return null;
        }
    };
    
    return (
        <div className="w-full">
            <div className="w-full max-w-5xl mx-auto pt-6 px-4">
                {/* Back Button for Mobile */}
                <button onClick={handleBack} className="md:hidden mb-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    {ICONS.chevronLeft}
                </button>

            {/* Profile Card with Banner */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-visible mb-6">
                {/* Banner Image */}
                <div className="relative h-48 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
                    {userToDisplay.coverPhoto ? (
                        <img 
                            src={userToDisplay.coverPhoto} 
                            alt="Cover"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"></div>
                    )}
                    {/* Edit Banner Button */}
                    {isOwnProfile && (
                        <button className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-md">
                            ✏️ Edit Banner
                        </button>
                    )}
                    {/* Floating Message Button */}
                    {!isOwnProfile && (
                        <button
                            onClick={() => navigate(`/messages/${userToDisplay._id || userToDisplay.id}`)}
                            className="absolute bottom-0 right-8 translate-y-1/2 w-14 h-14 bg-white dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-slate-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-red-400 dark:hover:border-red-500 transition-all duration-300 hover:scale-110 active:scale-95 pointer-events-auto cursor-pointer z-10 group overflow-hidden"
                            type="button"
                        >
                            {/* Closed Envelope - Default */}
                            <svg className="w-7 h-7 text-red-500 absolute transition-all duration-300 group-hover:opacity-0 group-hover:scale-75" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} style={{pointerEvents: 'none'}}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            
                            {/* Open Envelope - Hover */}
                            <svg className="w-7 h-7 text-red-500 absolute transition-all duration-300 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} style={{pointerEvents: 'none'}}>
                                {/* Envelope body */}
                                <rect x="3" y="8" width="18" height="11" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                                {/* Bottom left */}
                                <line x1="3" y1="8" x2="12" y2="14" />
                                {/* Bottom right */}
                                <line x1="21" y1="8" x2="12" y2="14" />
                                {/* Flap left side */}
                                <path d="M3 8L12 2L21 8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Profile Info Section */}
                <div className="relative px-8 pb-8">
                    {/* Avatar - Overlapping Banner */}
                    <div className="flex justify-between items-start -mt-16 mb-4">
                        <div className="relative">
                            <img 
                                src={userToDisplay.profilePicture || userToDisplay.avatar} 
                                alt={userToDisplay.name}
                                className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg bg-white dark:bg-slate-800"
                            />
                            {isOwnProfile && (
                                <button className="absolute bottom-2 right-2 bg-white dark:bg-slate-700 rounded-full p-2 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                                    <svg className="w-4 h-4 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        
                        {/* Edit Profile Button */}
                        {isOwnProfile && (
                            <div className="mt-4">
                                <Link to="/settings">
                                    <button className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border border-slate-200 dark:border-slate-600">
                                        Edit Profile
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* User Info */}
                    <div className="mt-4">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {userToDisplay.name}
                            </h1>
                            <Badge role={userToDisplay.role || 'student'} />
                        </div>
                        
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                            {userToDisplay.bio || 'No bio available'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
                <nav className="flex justify-around items-center">
                    <button
                        onClick={() => setActiveTab('posts')}
                        className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === 'posts'
                                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            <span className="hidden sm:inline">POSTS</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('saved')}
                        className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === 'saved'
                                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            <span className="hidden sm:inline">SAVED</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('media')}
                        className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === 'media'
                                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="hidden sm:inline">TAGGED</span>
                        </div>
                    </button>
                </nav>
            </div>
            
            {/* Content */}
            <div className="pb-16">
                {renderContent()}
            </div>
            
            {selectedPost && <PostModal post={selectedPost} author={userToDisplay} onClose={() => setSelectedPost(null)} />}
            </div>
        </div>
    );
};