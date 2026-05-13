// Capacitor Push Notification setup for both Android and iOS
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { Badge } from '@capawesome/capacitor-badge';

export function registerPushNotifications(
  onNoticeReceived: (notice: any) => void,
  setToken?: (token: string) => void
) {
  // Request permission
  PushNotifications.requestPermissions().then(result => {
    if (result.receive === 'granted') {
      PushNotifications.register();
    }
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
  if (count > 0) {
    await Badge.set({ count });
  } else {
    await Badge.clear();
  }
}
