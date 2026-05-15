
import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { SearchPage } from '../pages/SearchPage';

export const Layout: React.FC = () => {
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isChatPage = ['/messages', '/groups'].some(path => location.pathname.startsWith(path));
  const showHeader = location.pathname === '/home' || location.pathname.startsWith('/settings');
  const showBottomNav = ['/home', '/groups', '/events', '/profile', '/mailbox', '/settings'].includes(location.pathname);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {showHeader && <Header />}

        {/* Main content area - allow vertical overflow for page content */}
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className={`${isChatPage ? 'h-full' : `${showHeader ? 'pt-20 md:pt-0' : ''} ${showBottomNav ? 'pb-24 md:pb-0' : ''} `}`}>
            <Outlet />
          </div>
        </main>

        {showBottomNav && <BottomNav onSearchClick={() => setIsSearchOpen(true)} />}
        <SearchPage isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      </div>
    </div>
  );
};