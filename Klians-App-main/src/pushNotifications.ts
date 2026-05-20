// Capacitor Push Notification setup for both Android and iOS
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { Badge } from '@capawesome/capacitor-badge';

export function registerPushNotifications(
  onNoticeReceived: (notice: any) => void,
  setToken?: (token: string) => void
) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  // Request permission
  PushNotifications.requestPermissions().then(result => {
    if (result.receive === 'granted') {
      PushNotifications.register();
    }
  }).catch(error => {
    console.warn('Push permissions request skipped on web or failed:', error);
  });

  // On registration
    PushNotifications.addListener('registration', (token) => {
      console.log('FCM Registration Token:', token.value);
      if (setToken) {
        setToken(token.value);
      }
      // Optionally, send this token to your backend here
    });

  // On registration error
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('Push registration error:', error);
  });

  // On push received
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push received:', notification);
    onNoticeReceived(notification);
  });

  // On notification action performed
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push action performed:', notification);
  });
}

export async function setAppBadge(count: number) {
  if (!Capacitor.isNativePlatform()) return;

  if (count > 0) {
    await Badge.set({ count });
  } else {
    await Badge.clear();
  }
}
