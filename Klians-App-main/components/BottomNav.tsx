import React from 'react';
import { NavLink } from 'react-router-dom';
import { ICONS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';

interface BottomNavProps {
  onSearchClick: () => void;
}

const NavItem: React.FC<{ to: string, icon: React.ReactNode, activeIcon: React.ReactNode, label: string }> = ({ to, icon, activeIcon, label }) => {
  const linkClasses = "flex flex-col items-center justify-center w-full pt-2 pb-1 text-slate-500 dark:text-slate-400 transition-colors duration-200 hover:text-brand-gradient-from";
  const activeLinkClasses = "text-brand-gradient-from";

  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : ''}`}
    >
      {({ isActive }) => (isActive ? activeIcon : icon)}
    </NavLink>
  )
}

export const BottomNav: React.FC<BottomNavProps> = ({ onSearchClick }) => {
  const { user } = useAuth();

  if (!user) return null;

  const isTeacherOrAdmin = user.role === Role.TEACHER || user.role === Role.ADMIN;

  return (
    <>
      {/* The main navigation bar with items and a placeholder for the central button */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 grid grid-cols-5 items-center z-20 md:hidden border-t border-slate-200 dark:border-slate-700">
        <NavItem to="/home" icon={ICONS.home} activeIcon={ICONS.homeSolid} label="Home" />
        <NavItem to="/mailbox" icon={ICONS.mailbox} activeIcon={ICONS.mailboxSolid} label="Mailbox" />
        <div /> {/* Placeholder for central button */}
        <NavItem to="/events" icon={ICONS.events} activeIcon={ICONS.eventsSolid} label="Events" />
        {isTeacherOrAdmin ? (
          <NavItem to="/broadcast" icon={ICONS.broadcast} activeIcon={ICONS.broadcast} label="Broadcast" />
        ) : (
          <NavItem to="/profile" icon={ICONS.profile} activeIcon={ICONS.profileSolid} label="Profile" />
        )}
      </nav>

      {/* The elevated central search button assembly */}
      <div
        className="fixed z-30 left-1/2 -translate-x-1/2 bottom-5 md:hidden group"
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