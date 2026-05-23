import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { usersAPI } from '../src/api/users';
import { User } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../contexts/SocketContext';

export const SuggestedUsers: React.FC = () => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const getRandomUsers = (users: User[], count: number = 3) => {
        if (users.length <= count) return users;
        const shuffled = [...users].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    };

    const fetchSuggestedUsers = async () => {
        try {
            setLoading(true);
            const response = await usersAPI.getUsers();
            const allUsers = Array.isArray(response.data) ? response.data : response.data.users || [];
            
            // Normalize users to ensure all fields are properly mapped
            const normalizedUsers = allUsers.map((u: any) => ({
                ...u,
                id: u.id || u._id,
                // Use profilePicture from backend, fallback to avatar
                avatar: u.profilePicture || u.avatar || '',
                // Ensure username exists - extract from email if not present
                username: u.username || u.email?.split('@')[0] || u.name?.toLowerCase().replace(/\s+/g, '') || 'user',
            }));
            
            // Filter out the current user
            const currentUserId = currentUser?.id || (currentUser as any)?._id;
            const filteredUsers = normalizedUsers.filter(
                (u: any) => u.id !== currentUserId && u._id !== currentUserId
            );
            
            // Get 3 random users
            const randomUsers = getRandomUsers(filteredUsers, 3);
            setSuggestedUsers(randomUsers);
        } catch (error) {
            console.error('Error fetching suggested users:', error);
        } finally {
            setLoading(false);
        }
    };

    const { socket } = useSocket();

    useEffect(() => {
        fetchSuggestedUsers();

        // Refresh suggestions every 5 minutes (300,000 ms)
        const interval = setInterval(fetchSuggestedUsers, 300000);

        if (socket) {
            socket.on('new-post', fetchSuggestedUsers);
            socket.on('user-registered', fetchSuggestedUsers);
        }

        return () => {
            clearInterval(interval);
            if (socket) {
                socket.off('new-post', fetchSuggestedUsers);
                socket.off('user-registered', fetchSuggestedUsers);
            }
        };
    }, [currentUser?.id, socket]);

    const handleViewProfile = (user: User) => {
        // Use _id if available (MongoDB format), otherwise use id
        const userId = (user as any)._id || user.id;
        navigate(`/profile/${userId}`);
    };

    return (
        <Card>
            <div className="p-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Recent Suggestions</h3>
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
                            Loading suggestions...
                        </div>
                    ) : suggestedUsers.length > 0 ? (
                        suggestedUsers.map(user => (
                            <div key={(user as any)._id || user.id} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <Avatar 
                                        src={(user as any).profilePicture || user.avatar} 
                                        alt={user.name} 
                                        size="md" 
                                        className="flex-shrink-0" 
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                            {user.name}
                                        </p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                            @{user.username || (user as any).email?.split('@')[0] || 'user'}
                                        </p>
                                    </div>
                                </div>
                                <Button 
                                    variant="secondary" 
                                    className="!px-4 !py-1.5 !text-sm !font-bold flex-shrink-0"
                                    onClick={() => handleViewProfile(user)}
                                >
                                    View
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
                            No suggestions available
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};