import React from 'react';
import { NavLink } from 'react-router-dom';
import { ICONS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';

import { Avatar } from './ui/Avatar';

interface BottomNavProps {
  onSearchClick: () => void;
  onLinkClick?: () => void;
}

const NavItem: React.FC<{ to: string, icon: React.ReactNode, activeIcon: React.ReactNode, label: string, onClick?: () => void }> = ({ to, icon, activeIcon, label, onClick }) => {
  const linkClasses = "flex flex-col items-center justify-center w-full pt-2 pb-1 text-slate-500 dark:text-slate-400 transition-colors duration-200 hover:text-brand-gradient-from";
  const activeLinkClasses = "text-brand-gradient-from";

  return (
    <NavLink
      to={to}
      aria-label={label}
      onClick={onClick}
      className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : ''}`}
    >
      {({ isActive }) => (isActive ? activeIcon : icon)}
    </NavLink>
  )
}

export const BottomNav: React.FC<BottomNavProps> = ({ onSearchClick, onLinkClick }) => {
  const { user } = useAuth();

  if (!user) return null;

  const isTeacherOrAdmin = user.role === Role.TEACHER || user.role === Role.ADMIN;

  return (
    <>
      {/* The main navigation bar with items and a placeholder for the central button */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 grid grid-cols-5 items-center z-[100] md:hidden border-t border-slate-200 dark:border-slate-700">
        <NavItem to="/home" icon={ICONS.home} activeIcon={ICONS.homeSolid} label="Home" onClick={onLinkClick} />
        <NavItem to="/mailbox" icon={ICONS.mailbox} activeIcon={ICONS.mailboxSolid} label="Mailbox" onClick={onLinkClick} />
        <div /> {/* Placeholder for central button */}
        <NavItem to="/events" icon={ICONS.events} activeIcon={ICONS.eventsSolid} label="Events" onClick={onLinkClick} />
        {isTeacherOrAdmin ? (
          <NavItem to="/broadcast" icon={ICONS.broadcast} activeIcon={ICONS.broadcast} label="Broadcast" onClick={onLinkClick} />
        ) : (
          <NavItem
            to="/profile"
            icon={<Avatar src={user.avatar} alt={user.name} size="xs" className="opacity-80 transition-all duration-200 hover:opacity-100" />}
            activeIcon={<Avatar src={user.avatar} alt={user.name} size="xs" className="ring-[2px] ring-brand-gradient-from ring-offset-2 dark:ring-offset-slate-800 transition-all duration-200" />}
            label="Profile"
            onClick={onLinkClick}
          />
        )}
      </nav>

      {/* The elevated central search button assembly */}
      <div
        className="fixed z-[110] left-1/2 -translate-x-1/2 bottom-5 md:hidden group"
        onClick={onSearchClick}
        role="button"
        aria-label="Search"
      >
        {/* The background "notch" element which creates the bump effect over the nav bar */}
        <div className="absolute -inset-2 bg-white dark:bg-slate-800 rounded-full" />

        {/* The actual button visual */}
        <div className="relative h-16 w-16 bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-105 group-active:scale-95">
          {React.cloneElement(ICONS.search, { className: "h-7 w-7" })}
        </div>
      </div>
    </>
  );
};