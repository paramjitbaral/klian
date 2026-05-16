
import React from 'react';
import { useMessages } from '../contexts/MessagesContext';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';
import { ICONS } from '../constants';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useMessages();
  const location = useLocation();
  const isCollapsedPage = location.pathname.startsWith('/messages') || location.pathname.startsWith('/groups') || location.pathname.startsWith('/settings');

  // Main navigation links (top section)
  const mainNavLinks = [
    { to: '/home', label: 'Home', icon: ICONS.home, roles: [Role.STUDENT, Role.TEACHER, Role.ADMIN] },
    { to: '/messages', label: 'Messages', icon: ICONS.messages, roles: [Role.STUDENT, Role.TEACHER, Role.ADMIN] },
    { to: '/users', label: 'Users', icon: ICONS.groups, roles: [Role.STUDENT, Role.TEACHER, Role.ADMIN] },
    { to: '/mailbox', label: 'Mailbox', icon: ICONS.mailbox, roles: [Role.STUDENT, Role.TEACHER, Role.ADMIN] },
    { to: '/events', label: 'Events', icon: ICONS.events, roles: [Role.STUDENT, Role.TEACHER, Role.ADMIN] },
  ];

  // Secondary navigation links (middle section)
  const secondaryNavLinks = [
    { to: '/profile', label: 'Profile', icon: ICONS.profile, roles: [Role.STUDENT, Role.TEACHER, Role.ADMIN] },
    { to: '/settings', label: 'Settings', icon: ICONS.settings, roles: [Role.STUDENT, Role.TEACHER, Role.ADMIN] },
    { to: '/analytics', label: 'Analytics', icon: ICONS.analytics, roles: [Role.TEACHER, Role.ADMIN] },
    { to: '/broadcast', label: 'Broadcast', icon: ICONS.broadcast, roles: [Role.TEACHER, Role.ADMIN] },
  ];

  const availableMainLinks = user ? mainNavLinks.filter(link => link.roles.includes(user.role)) : [];
  const availableSecondaryLinks = user ? secondaryNavLinks.filter(link => link.roles.includes(user.role)) : [];

  return (
    <aside className={`bg-white dark:bg-slate-800 px-3 py-6 flex flex-col h-screen border-r border-slate-200 dark:border-slate-700 hidden md:flex overflow-hidden transition-all duration-300 ${
      isCollapsedPage ? 'w-20' : 'w-64'
    }`}>
      {/* Logo */}
      <div className={`text-3xl font-bold text-center py-2 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-pink-500 flex-shrink-0 transition-all duration-300 ${
        isCollapsedPage ? 'text-sm' : 'text-3xl'
      }`}>
        {isCollapsedPage ? '◆' : 'KLIAS'}
      </div>

      {/* Main Navigation - Scrollable without scrollbar */}
      <nav className="flex-grow overflow-y-auto scrollbar-hide">
        <ul className="space-y-1">
          {availableMainLinks.map(link => (
            <li key={link.to}>
              <NavLink 
                to={link.to} 
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium ${isCollapsedPage ? 'justify-center' : ''} ${
                    isActive 
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-l-4 border-red-500' 
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-l-4 hover:border-slate-400 dark:hover:border-slate-500'
                  }`
                }
              >
                <span className="relative w-6 h-6 flex-shrink-0">
                  {link.icon}
                  {link.label === 'Messages' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className={`text-base transition-opacity duration-300 ${isCollapsedPage ? 'hidden' : 'block'}`}>{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div className="my-4 border-t border-slate-200 dark:border-slate-700"></div>

        {/* Secondary Navigation */}
        <ul className="space-y-1">
          {availableSecondaryLinks.map(link => (
            <li key={link.to}>
              <NavLink 
                to={link.to} 
                end={link.to === '/profile'}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium ${isCollapsedPage ? 'justify-center' : ''} ${
                    isActive 
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-l-4 border-red-500' 
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-l-4 hover:border-slate-400 dark:hover:border-slate-500'
                  }`
                }
              >
                <span className="w-6 h-6 flex-shrink-0">
                  {link.icon}
                </span>
                <span className={`text-base transition-opacity duration-300 ${isCollapsedPage ? 'hidden' : 'block'}`}>{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Divider before Logout */}
      <div className="my-2 border-t border-slate-200 dark:border-slate-700 flex-shrink-0"></div>

      {/* Logout */}
      <button 
        onClick={logout}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-l-4 hover:border-slate-400 dark:hover:border-slate-500 w-full flex-shrink-0 ${isCollapsedPage ? 'justify-center' : ''}`}
      >
        <span className="w-6 h-6 flex-shrink-0">
          {ICONS.logout}
        </span>
        <span className={`text-base transition-opacity duration-300 ${isCollapsedPage ? 'hidden' : 'block'}`}>Logout</span>
      </button>
    </aside>
  );
};
