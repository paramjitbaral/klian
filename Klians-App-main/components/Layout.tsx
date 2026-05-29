import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { SearchPage } from '../pages/SearchPage';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../contexts/SocketContext';

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const { socket } = useSocket();
  const [activeToast, setActiveToast] = useState<{ id: string; title: string; content: string } | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notif: any) => {
      setActiveToast({
        id: notif.id ? String(notif.id) : String(Date.now()),
        title: notif.type === 'EVENT_REMINDER' ? '📅 Event Reminder' : '🔔 New Notification',
        content: notif.content || 'You have a new update.'
      });
    };

    socket.on('new_notification', handleNewNotification);
    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket]);

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

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
  const showBottomNav = ['/home', '/events', '/profile', '/mailbox', '/settings', '/broadcast', '/announcements'].includes(location.pathname);

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

    // Pull-to-refresh init (checking whichever container is actually scrolling on the page)
    startYRef.current = e.targetTouches[0].clientY;
    
    let scrollTop = 0;
    const homeScroll = document.querySelector('.lg\\:col-span-8.overflow-y-auto');
    if (homeScroll) {
      scrollTop = homeScroll.scrollTop;
    } else if (mainRef.current) {
      scrollTop = mainRef.current.scrollTop;
    }
    isAtTopRef.current = scrollTop === 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);

    // Pull-to-refresh logic
    if (isAtTopRef.current && !isRefreshing && window.innerWidth < 768 && touchStart) {
      const currentY = e.targetTouches[0].clientY;
      const diff = currentY - startYRef.current;
      const diffX = Math.abs(e.targetTouches[0].clientX - touchStart);
      
      // Only pull down if vertical drag exceeds horizontal drag to prevent swipe conflicts
      if (diff > 0 && diff > diffX * 1.5) {
        // Elastic resistance for a deliberate "hard drag"
        setPullY(Math.min(diff * 0.25, 95));
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || window.innerWidth >= 768) return;

    // Pull-to-refresh check (firm 80px threshold to prevent accidental activations)
    if (pullY >= 80 && !isRefreshing) {
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
            <div className={`p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-100 dark:border-slate-700 transition-all duration-200 ${pullY >= 80 ? 'scale-115 ring-2 ring-blue-500 bg-blue-50 dark:bg-slate-700 opacity-100' : 'scale-95 opacity-80'}`}>
              <svg className={`w-5 h-5 text-blue-500 transition-all ${pullY >= 80 ? 'rotate-180 scale-110' : ''} ${isRefreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        )}

        {/* Main content area - allow vertical overflow for page content */}
        <main
          ref={mainRef}
          className={`flex-1 ${isChatPage ? 'overflow-hidden' : 'overflow-y-auto'} scrollbar-hide transition-transform duration-150 ease-out`}
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

      {/* Global Real-Time Toast Notification Banner */}
      {activeToast && (
        <div
          onClick={() => setActiveToast(null)}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-[400px] bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.22)] border border-slate-800 dark:border-slate-100 backdrop-blur-md flex items-start gap-3 cursor-pointer transition-all duration-300 transform animate-in slide-in-from-top-6 duration-300"
        >
          <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 rounded-xl flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 1.623.233 3.193.666 4.677A2.495 2.495 0 0 1 17.137 18H6.863a2.495 2.495 0 0 1-2.279-3.573 17.065 17.065 0 0 0 .666-4.677V9ZM10.5 21a2.25 2.25 0 0 0 4.5 0h-4.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm tracking-tight">{activeToast.title}</h4>
            <p className="text-xs text-slate-300 dark:text-slate-600 font-medium mt-0.5 leading-relaxed">{activeToast.content}</p>
          </div>
          <button className="text-slate-500 hover:text-slate-350 dark:hover:text-slate-700 text-xs font-bold self-start mt-0.5">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
