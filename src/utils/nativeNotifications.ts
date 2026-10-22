import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

export class NativeNotificationService {
  private static isInitialized = false;
  private static hasPermission = false;
  private static fcmToken: string | null = null;

  public static async init(): Promise<boolean> {
    if (this.isInitialized) return this.hasPermission;

    try {
      if (Capacitor.isNativePlatform()) {
        // 1. Create Android Notification Channels (Android 8.0+)
        await LocalNotifications.createChannel({
          id: 'limochat_messages',
          name: 'Chat Messages',
          description: 'Notifications for new direct messages, group chats and media',
          importance: 4, // High
          visibility: 1, // Public
          vibration: true,
          lights: true,
          lightColor: '#00A884',
        }).catch(() => {});

        await LocalNotifications.createChannel({
          id: 'limochat_calls',
          name: 'Incoming Calls',
          description: 'High-priority alerts for incoming WebRTC audio and video calls',
          importance: 5, // Max
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#00A884',
        }).catch(() => {});

        // 2. Request Local Notification Permissions
        const localPerm = await LocalNotifications.requestPermissions();
        this.hasPermission = localPerm.display === 'granted';

        // 3. Request Push Notification (FCM) Permissions
        const pushPerm = await PushNotifications.requestPermissions();
        if (pushPerm.receive === 'granted') {
          await PushNotifications.register().catch(() => {});
          
          PushNotifications.addListener('registration', (token) => {
            this.fcmToken = token.value;
            try {
              localStorage.setItem('limochat_fcm_token', token.value);
            } catch {}
          });

          PushNotifications.addListener('registrationError', (error) => {
            console.warn('FCM registration error:', error);
          });

          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push notification received in foreground:', notification);
          });
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        // Web Browser / PWA fallback
        if (Notification.permission === 'granted') {
          this.hasPermission = true;
        } else if (Notification.permission !== 'denied') {
          const res = await Notification.requestPermission();
          this.hasPermission = res === 'granted';
        }
      }

      this.isInitialized = true;
      return this.hasPermission;
    } catch (err) {
      console.warn('Native notification initialization notice:', err);
      return false;
    }
  }

  public static getFcmToken(): string | null {
    if (this.fcmToken) return this.fcmToken;
    try {
      return localStorage.getItem('limochat_fcm_token');
    } catch {
      return null;
    }
  }

  public static async notifyMessage(params: {
    title: string;
    body: string;
    chatId: string;
    avatarUrl?: string;
  }): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const id = Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
          notifications: [
            {
              id,
              title: params.title,
              body: params.body,
              channelId: 'limochat_messages',
              extra: { chatId: params.chatId },
              smallIcon: 'ic_stat_name',
              iconColor: '#00A884',
            },
          ],
        });
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(params.title, {
          body: params.body,
          icon: params.avatarUrl || '/favicon.svg',
          tag: `chat_${params.chatId}`,
        });
      }
    } catch (e) {
      console.warn('Failed to dispatch message notification:', e);
    }
  }

  public static async notifyCall(params: {
    callerName: string;
    callType: 'audio' | 'video';
    callId: string;
  }): Promise<void> {
    try {
      const typeText = params.callType === 'video' ? 'Video Call' : 'Voice Call';
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 999999, // Distinct call notification slot
              title: `Incoming ${typeText}`,
              body: `${params.callerName} is calling you on LimoChat...`,
              channelId: 'limochat_calls',
              ongoing: true,
              extra: { callId: params.callId, action: 'incoming_call' },
              smallIcon: 'ic_stat_name',
              iconColor: '#00A884',
            },
          ],
        });
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`Incoming ${typeText}`, {
          body: `${params.callerName} is calling you on LimoChat...`,
          icon: '/favicon.svg',
          requireInteraction: true,
          tag: `call_${params.callId}`,
        });
      }
    } catch (e) {
      console.warn('Failed to dispatch call notification:', e);
    }
  }

  public static async dismissCallNotification(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.cancel({
          notifications: [{ id: 999999 }],
        });
      }
    } catch {}
  }
}
