import { OnboardingNotices } from './src/OnboardingNotices';
import React, { useEffect, useState } from 'react';
import { registerPushNotifications } from './src/pushNotifications';
import FCMTokenDisplay from './components/FCMTokenDisplay';
import { useUnreadBadge } from './src/useUnreadBadge';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import { initMobileFeatures } from './src/mobileSetup';
import { MessagesProvider } from './contexts/MessagesContext';
import { QueryProvider } from './providers/QueryProvider';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { MessagesPage } from './pages/MessagesPage';
import { ProfilePage } from './pages/ProfilePage';
import { MailboxPage } from './pages/MailboxPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EventsPage } from './pages/EventsPage';
import { BroadcastPage } from './pages/BroadcastPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { Role } from './types';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { GroupsPage } from './pages/GroupsPage';
import { VerifyPage } from './pages/VerifyPage';
import NotificationsPage from './pages/NotificationsPage';
import { prefetchPosts } from './hooks/usePosts';


const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        
        {isAuthenticated ? (
            <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/home" />} />
                <Route path="home" element={<HomePage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="messages/:conversationId" element={<MessagesPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/:userId" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="mailbox" element={<MailboxPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="analytics" element={
                  <ProtectedRoute allowedRoles={[Role.TEACHER, Role.ADMIN]}>
                    <AnalyticsPage />
                  </ProtectedRoute>
                } />
                <Route path="broadcast" element={
                    <ProtectedRoute allowedRoles={[Role.TEACHER, Role.ADMIN]}>
                        <BroadcastPage />
                    </ProtectedRoute>
                } />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="groups/:groupId" element={<GroupsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        ) : (
            <Route path="*" element={<Navigate to="/auth" />} />
        )}
    </Routes>
  );
};


import { CookieConsent } from './components/CookieConsent';

const App: React.FC = () => {
  const [unreadNotices, setUnreadNotices] = useState<Array<{ id: string; title: string; body: string }>>([]);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const unreadCount = unreadNotices.length;

  useEffect(() => {
    // Initialize native mobile features (Status bar overlays, styles, keyboard settings)
    initMobileFeatures();

    // Prefetch posts when app starts
    prefetchPosts();

    // Register push notifications
    registerPushNotifications(
      (notice) => {
        // Add new notice to unread list
        setUnreadNotices((prev) => [
          ...prev,
          {
            id: notice.id || Date.now().toString(),
            title: notice.title || 'Notice',
            body: notice.body || '',
          },
        ]);
      },
      setFcmToken
    );
  }, []);

  // Update badge when unreadCount changes
  useUnreadBadge(unreadCount);

  const handleMarkAllRead = () => {
    setUnreadNotices([]);
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <MessagesProvider>
            <QueryProvider>
              <HashRouter>
                <FCMTokenDisplay token={fcmToken} />
                {unreadNotices.length > 0 && (
                  <OnboardingNotices unreadNotices={unreadNotices} onMarkAllRead={handleMarkAllRead} />
                )}
                <AppRoutes />
                <CookieConsent />
              </HashRouter>
            </QueryProvider>
          </MessagesProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
