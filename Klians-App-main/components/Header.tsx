import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Avatar } from './ui/Avatar';
import { Input } from './ui/Input';
import { ICONS } from '../constants';
import { Theme, Role } from '../types';
import { SearchResultsDropdown } from './SearchResultsDropdown';
import { NotificationsDropdown } from './NotificationsDropdown';
import { AnnouncementsDropdown } from './AnnouncementsDropdown';
import { notificationsAPI, Notification } from '../src/api/notifications';
import { announcementsAPI } from '../src/api/announcements';
import { groupsAPI } from '../src/api/groups';
import { useSocket } from '../contexts/SocketContext';
import { useMessages } from '../contexts/MessagesContext';

interface HeaderProps {
    isAnnouncementsOpen?: boolean;
    setAnnouncementsOpen?: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ isAnnouncementsOpen, setAnnouncementsOpen }) => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownVisible, setDropdownVisible] = useState(false);
    const [isNotificationsVisible, setNotificationsVisible] = useState(false);

    // Use props if available, otherwise fallback to local state (for desktop)
    const [isAnnouncementsVisibleLocal, setAnnouncementsVisibleLocal] = useState(false);
    const isAnnouncementsVisible = isAnnouncementsOpen ?? isAnnouncementsVisibleLocal;
    const setAnnouncementsVisible = setAnnouncementsOpen ?? setAnnouncementsVisibleLocal;
    const searchRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const announcementsRef = useRef<HTMLDivElement>(null);
    const mobileAnnouncementsRef = useRef<HTMLButtonElement>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [broadcastUnreadCount, setBroadcastUnreadCount] = useState(0);
    const { socket } = useSocket();
    const {
        unreadCount: dmUnreadCount,
        groupUnreadCount,
        groupAddedNotifsCount,
        refreshGroupCounts
    } = useMessages();

    const totalMessageCount = dmUnreadCount + groupUnreadCount + groupAddedNotifsCount;
    const shouldBellRing = unreadCount > 0 || broadcastUnreadCount > 0;




    // Fetch initial notifications and announcements
    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const [notifRes, broadcastCount] = await Promise.all([
                    notificationsAPI.getNotifications(),
                    announcementsAPI.getUnreadCount()
                ]);
                setNotifications(notifRes.data);
                setUnreadCount(notifRes.data.filter(n => !n.isRead).length);
                setBroadcastUnreadCount(broadcastCount);
            } catch (error) {
                console.error('Error fetching initial data:', error);
            }
        };
        fetchCounts();
    }, []);

    // Socket listeners for real-time updates
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notif: Notification) => {
            setNotifications(prev => [notif, ...prev].slice(0, 50));
            setUnreadCount(prev => prev + 1);
        };

        const handleDeleteNotification = (data: { type?: string; groupId?: number | string; id?: number | string }) => {
            setNotifications(prev => {
                const toRemove = prev.find(n =>
                    data.id ? String(n.id) === String(data.id) :
                        (data.type && data.groupId && n.type === data.type && String(n.groupId) === String(data.groupId))
                );
                if (toRemove) {
                    if (!toRemove.isRead) setUnreadCount(c => Math.max(0, c - 1));
                    return prev.filter(n => n.id !== toRemove.id);
                }
                return prev;
            });
        };

        const handleUpdateNotification = (data: { id?: number | string; isRead?: boolean }) => {
            setNotifications(prev => prev.map(n => {
                if (String(n.id) === String(data.id) && !n.isRead && data.isRead) {
                    setUnreadCount(c => Math.max(0, c - 1));
                    return { ...n, isRead: true };
                }
                return n;
            }));
        };

        const handleEventNotificationsDeleted = (data: { type: string; content: string }) => {
            setNotifications(prev => {
                const toRemove = prev.filter(n => n.type === data.type && n.content === data.content);
                const unreadRemoved = toRemove.filter(n => !n.isRead).length;
                if (unreadRemoved > 0) {
                    setUnreadCount(c => Math.max(0, c - unreadRemoved));
                }
                return prev.filter(n => !(n.type === data.type && n.content === data.content));
            });
        };

        const handleNewAnnouncement = (data: any) => {
            const target = (data?.target || 'All').toLowerCase();
            const role = user?.role?.toLowerCase() || '';
            let isVisible = role === 'admin' ||
                (role === 'teacher' && ['all', 'all users', 'teacher', 'teachers'].includes(target)) ||
                (['all', 'all users', 'student', 'students'].includes(target));

            if (isVisible) setBroadcastUnreadCount(prev => prev + 1);
        };

        socket.on('new_notification', handleNewNotification);
        socket.on('delete_notification', handleDeleteNotification);
        socket.on('update_notification', handleUpdateNotification);
        socket.on('event-notifications-deleted', handleEventNotificationsDeleted);
        socket.on('announcement-created', handleNewAnnouncement);

        // Group synchronization
        socket.on('new_group_message', () => refreshGroupCounts());
        socket.on('group_added_to', () => refreshGroupCounts());
        socket.on('group_removed_from', () => refreshGroupCounts());

        return () => {
            socket.off('new_notification');
            socket.off('delete_notification');
            socket.off('update_notification');
            socket.off('event-notifications-deleted', handleEventNotificationsDeleted);
            socket.off('announcement-created');
            socket.off('new_group_message');
            socket.off('group_added_to');
            socket.off('group_removed_from');
        };
    }, [socket, user, refreshGroupCounts]);


    // Auto-mark as read if dropdown is open when new notifs arrive
    useEffect(() => {
        // Mark as read if desktop dropdown is open OR if mobile unified overlay is open
        const isMobileOverlay = window.innerWidth < 768 && isAnnouncementsVisible;
        if ((isNotificationsVisible || isMobileOverlay) && unreadCount > 0) {
            handleMarkAllRead();
        }
    }, [isNotificationsVisible, isAnnouncementsVisible, unreadCount, notifications.length]);

    useEffect(() => {
        if (isAnnouncementsVisible && broadcastUnreadCount > 0) {
            handleMarkAllBroadcastsRead();
        }
    }, [isAnnouncementsVisible, broadcastUnreadCount]);

    const handleMarkAllRead = async () => {
        if (unreadCount === 0) return;
        try {
            await notificationsAPI.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking notifications read:', error);
        }
    };

    const handleDeleteNotification = (id: number) => {
        setNotifications(prev => {
            const notif = prev.find(n => n.id === id);
            if (notif && !notif.isRead) {
                setUnreadCount(count => Math.max(0, count - 1));
            }
            return prev.filter(n => n.id !== id);
        });
    };

    const handleMarkAllBroadcastsRead = async () => {
        if (broadcastUnreadCount === 0) return;
        try {
            await announcementsAPI.markAllAsRead();
            setBroadcastUnreadCount(0);
        } catch (error) {
            console.error('Error marking broadcasts read:', error);
        }
    };

    // Effect to handle clicks outside of the search component and notifications
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setDropdownVisible(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setNotificationsVisible(false);
            }
            if (announcementsRef.current && !announcementsRef.current.contains(event.target as Node) &&
                mobileAnnouncementsRef.current && !mobileAnnouncementsRef.current.contains(event.target as Node)) {
                setAnnouncementsVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    if (!user) return null;

    const SearchIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;

    return (
        <>
            <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md fixed md:sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800">
                {/* Mobile Header */}
                <div className="md:hidden px-4 h-14 grid grid-cols-3 items-center">
                    {/* Left: Combined Activity (Mobile) */}
                    <div className="relative justify-self-start">
                        <button
                            ref={mobileAnnouncementsRef}
                            className={`p-2 -ml-2 rounded-full text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 active:scale-90 transition-all duration-150 relative ${isAnnouncementsVisible ? 'bg-slate-100 dark:bg-slate-700/60' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAnnouncementsVisible(!isAnnouncementsVisible);
                            }}
                        >
                            {React.cloneElement(ICONS.bell, { className: "h-[24px] w-[24px]" })}
                            {(unreadCount > 0 || broadcastUnreadCount > 0) && (
                                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-800"></span>
                            )}
                        </button>
                    </div>

                    {/* Center: Logo */}
                    <div className="flex justify-center">
                        <Link to="/home" className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to tracking-tight">
                            KLIAS
                        </Link>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex justify-end items-center gap-1">
                        <Link to="/messages" className="p-2 rounded-full text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 active:scale-90 transition-all duration-150 relative">
                            {React.cloneElement(ICONS.messages, { className: "h-[24px] w-[24px]" })}
                            {totalMessageCount > 0 && (
                                <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-800 animate-in zoom-in duration-300">
                                    {totalMessageCount > 9 ? '9+' : totalMessageCount}
                                </span>
                            )}
                        </Link>
                        {(user.role === Role.TEACHER || user.role === Role.ADMIN) && (
                            <Link to="/profile" className="ml-1 active:scale-90 transition-all duration-150">
                                <Avatar src={user.avatar} alt={user.name} size="xs" />
                            </Link>
                        )}
                    </div>
                </div>

                {/* Desktop Header */}
                <div className="max-w-7xl mx-auto px-4 hidden md:flex items-center justify-between gap-6 h-16">
                    {/* Left: Brand */}
                    <div className="flex-shrink-0">
                        <Link to="/home" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to">
                            KLIAS
                        </Link>
                    </div>

                    {/* Center: Search */}
                    <div className="flex-1 max-w-xl relative" ref={searchRef}>
                        <Input
                            placeholder="Search KLIAS..."
                            icon={SearchIcon}
                            className="bg-slate-100 dark:bg-slate-700 !rounded-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setDropdownVisible(true)}
                        />
                        {isDropdownVisible && (
                            <SearchResultsDropdown
                                searchTerm={searchTerm}
                                onClose={() => {
                                    setDropdownVisible(false);
                                    setSearchTerm('');
                                }}
                            />
                        )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-6">
                        <div ref={announcementsRef} className="relative">
                            <button
                                onClick={() => setAnnouncementsVisible(!isAnnouncementsVisible)}
                                className={`text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all ${broadcastUnreadCount > 0 ? 'bell-ring' : ''}`}
                            >
                                {ICONS.announcement}
                                {broadcastUnreadCount > 0 && (
                                    <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 animate-in zoom-in duration-300">
                                        {broadcastUnreadCount > 9 ? '9+' : broadcastUnreadCount}
                                    </span>
                                )}
                            </button>
                            {isAnnouncementsVisible && (
                                <AnnouncementsDropdown
                                    isOpen={isAnnouncementsVisible}
                                    onClose={() => {
                                        setAnnouncementsVisible(false);
                                        setBroadcastUnreadCount(0);
                                    }}
                                />
                            )}
                        </div>

                        <div ref={notificationsRef} className="relative">
                            <button
                                onClick={() => {
                                    setNotificationsVisible(!isNotificationsVisible);
                                }}
                                className={`text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all ${shouldBellRing ? 'bell-ring' : ''}`}
                            >
                                {ICONS.bell}
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 animate-in zoom-in duration-300">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                            {isNotificationsVisible && (
                                <NotificationsDropdown
                                    notifications={notifications}
                                    onClose={() => setNotificationsVisible(false)}
                                    onMarkAllRead={handleMarkAllRead}
                                    onDelete={handleDeleteNotification}
                                />
                            )}
                        </div>

                        <button onClick={toggleTheme} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                            {theme === Theme.LIGHT ? ICONS.moon : ICONS.sun}
                        </button>

                        <Link to="/profile" className="flex items-center space-x-3">
                            <Avatar src={user.avatar} alt={user.name} size="md" />
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">@{user.username}</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Mobile Drawer */}
            {isAnnouncementsVisible && (
                <div className="md:hidden fixed inset-x-0 top-14 bottom-16 bg-black/20 z-[90] animate-in fade-in" onClick={() => setAnnouncementsVisible(false)}>
                    <div className="absolute top-0 left-0 w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 shadow-xl border-t border-slate-200 dark:border-slate-700 pb-20" onClick={e => e.stopPropagation()}>
                        <NotificationsDropdown
                            notifications={notifications}
                            onClose={() => setAnnouncementsVisible(false)}
                            onMarkAllRead={handleMarkAllRead}
                            onDelete={handleDeleteNotification}
                            className="w-full flex flex-col shadow-none border-none rounded-none bg-white dark:bg-slate-800"
                        />
                        <div className="h-2 bg-slate-100 dark:bg-slate-900 w-full border-y border-slate-200 dark:border-slate-700" />
                        <AnnouncementsDropdown
                            isOpen={isAnnouncementsVisible}
                            onClose={() => setAnnouncementsVisible(false)}
                            className="w-full flex flex-col shadow-none border-none rounded-none bg-white dark:bg-slate-800"
                        />
                    </div>
                </div>
            )}
        </>
    );
};