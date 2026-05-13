// React hook to update app badge based on unread notices
import { useEffect } from 'react';
import { setAppBadge } from './pushNotifications';

export function useUnreadBadge(unreadCount: number) {
  useEffect(() => {
    setAppBadge(unreadCount);
  }, [unreadCount]);
}
