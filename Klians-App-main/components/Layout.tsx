import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { SearchPage } from '../pages/SearchPage';
import { useQueryClient } from '@tanstack/react-query';

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  
  // Swipe Logic State
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 70;

  // Pull-to-refresh State
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isAtTopRef = useRef(true);

  const isChatPage = ['/messages', '/groups'].some(path => location.pathname.startsWith(path));
  const showHeader = ['/home', '/settings', '/announcements'].some(path => location.pathname.startsWith(path));
  const showBottomNav = ['/home', '/groups', '/events', '/profile', '/mailbox', '/settings', '/broadcast', '/announcements'].includes(location.pathname) || location.pathname.startsWith('/groups/');

  // Scroll to top and close search on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    setIsSearchOpen(false);
    setIsAnnouncementsOpen(false);
  }, [location.pathname]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    
    // Pull-to-refresh init
    startYRef.current = e.targetTouches[0].clientY;
    isAtTopRef.current = mainRef.current ? mainRef.current.scrollTop === 0 : true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);

    // Pull-to-refresh logic
    if (isAtTopRef.current && !isRefreshing && window.innerWidth < 768) {
      const currentY = e.targetTouches[0].clientY;
      const diff = currentY - startYRef.current;
      if (diff > 0) {
        // Apply tighter elastic resistance
        setPullY(Math.min(diff * 0.3, 70));
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || window.innerWidth >= 768) return;
    
    // Pull-to-refresh check
    if (pullY > 55 && !isRefreshing) {
      triggerRefresh();
    } else {
      setPullY(0);
    }

    // Swipe logic
    if (!touchEnd) return;
    const distanceX = touchStart - touchEnd;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    // Home is center, Notifications is left (dropdown), Messages is right
    if (isLeftSwipe) {
      if (location.pathname === '/home') {
        if (isAnnouncementsOpen) setIsAnnouncementsOpen(false);
        else navigate('/messages');
      }
    }
    
    if (isRightSwipe) {
      if (location.pathname === '/home') {
        setIsAnnouncementsOpen(true);
      }
      if (location.pathname.startsWith('/messages')) navigate('/home');
    }
  };

  const triggerRefresh = async () => {
    setIsRefreshing(true);
    setPullY(50); // Keep spinner visible at a comfortable height
    
    try {
      // Invalidate all queries to trigger a fresh data fetch
      await queryClient.invalidateQueries();
      // Artificial delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setPullY(0);
    }
  };

  return (
    <div 
      className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {showHeader && (
          <div className={location.pathname.startsWith('/settings') ? 'hidden md:block' : ''}>
            <Header 
              isAnnouncementsOpen={isAnnouncementsOpen} 
              setAnnouncementsOpen={setIsAnnouncementsOpen} 
            />
          </div>
        )}

        {/* Pull-to-refresh Indicator - Positioned elegantly below header */}
        {pullY > 0 && (
          <div 
            className="absolute left-0 right-0 z-10 flex justify-center items-center pointer-events-none"
            style={{ 
              top: showHeader ? '4rem' : '0',
              height: pullY 
            }}
          >
            <div className={`p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-100 dark:border-slate-700 transition-all duration-200 ${pullY > 50 ? 'scale-110 opacity-100' : 'scale-90 opacity-60'}`}>
               <svg className={`w-5 h-5 text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
               </svg>
            </div>
          </div>
        )}

        {/* Main content area - allow vertical overflow for page content */}
        <main 
          ref={mainRef} 
          className="flex-1 overflow-y-auto scrollbar-hide transition-transform duration-150 ease-out"
          style={{ transform: pullY > 0 ? `translateY(${pullY}px)` : 'none' }}
        >
          <div className={`${isChatPage ? 'h-full' : `${showHeader ? (location.pathname.startsWith('/settings') ? 'md:pt-0' : 'pt-16 md:pt-0') : ''} ${showBottomNav ? 'pb-24 md:pb-0' : ''} `}`}>
            <Outlet />
          </div>
        </main>

        {showBottomNav && (
          <BottomNav 
            onSearchClick={() => setIsSearchOpen(true)} 
            onLinkClick={() => {
              setIsSearchOpen(false);
              setIsAnnouncementsOpen(false);
            }}
          />
        )}
        <SearchPage isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      </div>
    </div>
  );
};