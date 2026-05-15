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
import { useSocket } from '../contexts/SocketContext';

export const Header: React.FC = () => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownVisible, setDropdownVisible] = useState(false);
    const [isNotificationsVisible, setNotificationsVisible] = useState(false);
    const [isAnnouncementsVisible, setAnnouncementsVisible] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const announcementsRef = useRef<HTMLDivElement>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { socket } = useSocket();

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await notificationsAPI.getNotifications();
                setNotifications(response.data);
                setUnreadCount(response.data.filter(n => !n.isRead).length);
            } catch (error) {
                console.error('Error fetching notifications:', error);
            }
        };
        fetchNotifications();
    }, []);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notif: Notification) => {
            setNotifications(prev => [notif, ...prev].slice(0, 50));
            setUnreadCount(prev => prev + 1);
        };

        socket.on('new_notification', handleNewNotification);
        
        socket.on('delete_notification', (data: { id: number }) => {
            setNotifications(prev => {
                const notifToDelete = prev.find(n => n.id === data.id);
                if (notifToDelete && !notifToDelete.isRead) {
                    setUnreadCount(count => Math.max(0, count - 1));
                }
                return prev.filter(n => n.id !== data.id);
            });
        });

        return () => {
            socket.off('new_notification', handleNewNotification);
            socket.off('delete_notification');
        };
    }, [socket]);
    
    // Auto-mark as read if dropdown is open when new notifs arrive
    useEffect(() => {
        if (isNotificationsVisible && unreadCount > 0) {
            handleMarkAllRead();
        }
    }, [isNotificationsVisible, unreadCount, notifications.length]);

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

    // Effect to handle clicks outside of the search component and notifications
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setDropdownVisible(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setNotificationsVisible(false);
            }
            if (announcementsRef.current && !announcementsRef.current.contains(event.target as Node)) {
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
        <header className="bg-white dark:bg-slate-800 fixed md:sticky top-0 z-20 w-full border-b border-slate-200 dark:border-slate-700">
            {/* Mobile Header */}
            <div className="md:hidden p-4 h-16 flex items-center justify-between">
                <Link to="/home" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to">
                    KLIAS
                </Link>
                <div className="flex items-center space-x-3">
                    <Link to="/messages" className="text-slate-600 dark:text-slate-300">
                        {React.cloneElement(ICONS.messages, { className: "h-6 w-6" })}
                    </Link>
                    <div ref={announcementsRef} className="relative">
                        <button
                            className="text-slate-600 dark:text-slate-300 relative"
                            onClick={() => setAnnouncementsVisible(!isAnnouncementsVisible)}
                        >
                            {React.cloneElement(ICONS.announcement, { className: "h-6 w-6" })}
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                        </button>
                        {isAnnouncementsVisible && <AnnouncementsDropdown isOpen={isAnnouncementsVisible} onClose={() => setAnnouncementsVisible(false)} />}
                    </div>
                    <Link to="/profile">
                        <Avatar src={user.avatar} alt={user.name} size="sm" />
                    </Link>
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
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 relative"
                        >
                            {ICONS.announcement}
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                        </button>
                        {isAnnouncementsVisible && <AnnouncementsDropdown isOpen={isAnnouncementsVisible} onClose={() => setAnnouncementsVisible(false)} />}
                    </div>

                    <div ref={notificationsRef} className="relative">
                        <button
                            onClick={() => {
                                setNotificationsVisible(!isNotificationsVisible);
                                if (!isNotificationsVisible) {
                                    handleMarkAllRead();
                                }
                            }}
                            className={`text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all ${unreadCount > 0 ? 'bell-ring' : ''}`}
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
    );
};