import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';

export class NativeNotificationService {
  private static isInitialized = false;
  private static hasPermission = false;
  private static fcmToken: string | null = null;

  public static async init(): Promise<boolean> {
    if (this.isInitialized) return this.hasPermission;

    try {
      if (Capacitor.isNativePlatform()) {
        // 1. Configure Native Status Bar so it never overlaps web headers
        try {
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setBackgroundColor({ color: '#202c33' });
          await StatusBar.setStyle({ style: Style.Dark });
        } catch (statusErr) {
          console.warn('Native status bar setup notice:', statusErr);
        }

        // 2. Create High-Priority Android Notification Channels (Android 8.0+)
        await LocalNotifications.createChannel({
          id: 'limochat_messages',
          name: 'Chat Messages & Media',
          description: 'Instant alerts for direct messages, groups, voice notes, photos & documents',
          importance: 5, // High
          visibility: 1, // Public
          vibration: true,
          lights: true,
          lightColor: '#00A884',
        }).catch(() => {});

        await LocalNotifications.createChannel({
          id: 'limochat_reactions',
          name: 'Message Reactions',
          description: 'Alerts when someone reacts to your messages with emojis',
          importance: 4,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#00A884',
        }).catch(() => {});

        await LocalNotifications.createChannel({
          id: 'limochat_status',
          name: 'Status Updates',
          description: 'Alerts when friends or contacts share new status stories',
          importance: 3,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#00A884',
        }).catch(() => {});

        await LocalNotifications.createChannel({
          id: 'limochat_status_reactions',
          name: 'Status Reactions & Replies',
          description: 'Alerts when someone reacts or replies to your status update',
          importance: 4,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#00A884',
        }).catch(() => {});

        await LocalNotifications.createChannel({
          id: 'limochat_calls',
          name: 'Incoming Audio & Video Calls',
          description: 'Urgent incoming WebRTC voice and video calls',
          importance: 5, // Max
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#00A884',
        }).catch(() => {});

        // 3. Request Local Notification Permissions
        const localPerm = await LocalNotifications.requestPermissions();
        this.hasPermission = localPerm.display === 'granted';

        // 4. Request Push Notification (FCM) Permissions
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
            console.warn('FCM registration notice:', error);
          });

          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('FCM push received:', notification);
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
      console.warn('Notification service initialization notice:', err);
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

  /**
   * Request all Android and browser permissions (Push, Background Alerts, Camera, Mic)
   */
  public static async requestAllPermissions(): Promise<{
    notifications: boolean;
    camera: boolean;
    microphone: boolean;
  }> {
    let notifGranted = false;
    let cameraGranted = false;
    let micGranted = false;

    // 1. Notifications (Local & Push Notifications)
    try {
      notifGranted = await this.init();
    } catch {}

    // 2. Camera & Microphone Media Permission
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        micGranted = stream.getAudioTracks().length > 0;
        cameraGranted = stream.getVideoTracks().length > 0;
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micGranted = audioStream.getAudioTracks().length > 0;
        audioStream.getTracks().forEach((t) => t.stop());
      } catch {}
    }

    return {
      notifications: notifGranted,
      camera: cameraGranted,
      microphone: micGranted,
    };
  }

  // 1. All message types push notification
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
              extra: { chatId: params.chatId, type: 'message' },
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

  // 2. Message reaction push notification
  public static async notifyReaction(params: {
    userName: string;
    emoji: string;
    messageSnippet: string;
    chatId: string;
  }): Promise<void> {
    try {
      const title = `${params.emoji} Reaction from ${params.userName}`;
      const body = `Reacted ${params.emoji} to: "${params.messageSnippet.slice(0, 40)}"`;
      if (Capacitor.isNativePlatform()) {
        const id = Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
          notifications: [
            {
              id,
              title,
              body,
              channelId: 'limochat_reactions',
              extra: { chatId: params.chatId, type: 'reaction' },
              smallIcon: 'ic_stat_name',
              iconColor: '#00A884',
            },
          ],
        });
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.svg',
          tag: `reaction_${params.chatId}`,
        });
      }
    } catch (e) {
      console.warn('Failed to dispatch reaction notification:', e);
    }
  }

  // 3. Status update notification
  public static async notifyStatusUpdate(params: {
    userName: string;
    statusSnippet?: string;
    userId: string;
  }): Promise<void> {
    try {
      const title = `🟢 ${params.userName} posted a Status`;
      const body = params.statusSnippet ? `${params.statusSnippet.slice(0, 60)}` : 'Tap to view new status update';
      if (Capacitor.isNativePlatform()) {
        const id = Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
          notifications: [
            {
              id,
              title,
              body,
              channelId: 'limochat_status',
              extra: { userId: params.userId, type: 'status' },
              smallIcon: 'ic_stat_name',
              iconColor: '#00A884',
            },
          ],
        });
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.svg',
          tag: `status_${params.userId}`,
        });
      }
    } catch (e) {
      console.warn('Failed to dispatch status notification:', e);
    }
  }

  // 4. Status reaction / reply notification
  public static async notifyStatusReaction(params: {
    userName: string;
    emoji?: string;
    replyText?: string;
    statusId: string;
  }): Promise<void> {
    try {
      const emojiPrefix = params.emoji ? `${params.emoji} ` : '💬 ';
      const title = `${emojiPrefix}${params.userName} reacted to your status`;
      const body = params.replyText || `Reacted with ${params.emoji || 'an emoji'} to your status update`;
      if (Capacitor.isNativePlatform()) {
        const id = Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
          notifications: [
            {
              id,
              title,
              body,
              channelId: 'limochat_status_reactions',
              extra: { statusId: params.statusId, type: 'status_reaction' },
              smallIcon: 'ic_stat_name',
              iconColor: '#00A884',
            },
          ],
        });
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.svg',
          tag: `status_react_${params.statusId}`,
        });
      }
    } catch (e) {
      console.warn('Failed to dispatch status reaction notification:', e);
    }
  }

  // 5. High-priority incoming WebRTC call
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
