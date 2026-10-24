import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { supabase } from '../supabase/config';
import { RealtimeCoordinator } from './realtimeCoordinator';
import { Message } from '../types';

export interface AppVersionData {
  version: string;
  buildNumber: string | number;
  releaseNotes: string;
  forceUpdate?: boolean;
  minSupportedVersion?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_APP_VERSION: AppVersionData = {
  version: '1.0.8',
  buildNumber: 8,
  releaseNotes: 'Welcome to LimoChat! Native voice & video calling, encrypted messaging, and custom Limo emojis.',
  forceUpdate: false,
  minSupportedVersion: '1.0.0',
};

const VERSION_DOC_REF = doc(db, 'system_config', 'app_version');
const LOCAL_STORAGE_KEY = 'limochat_cached_app_version';

/**
 * Get current cached version synchronously (instant for splash screen)
 */
export const getCachedAppVersion = (): AppVersionData => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      return { ...DEFAULT_APP_VERSION, ...JSON.parse(cached) };
    }
  } catch (e) {
    console.warn('[VersionConfig] Failed to read cached version:', e);
  }
  return DEFAULT_APP_VERSION;
};

/**
 * Subscribe to real-time app version changes from Firestore
 */
export const subscribeToAppVersion = (
  callback: (versionData: AppVersionData) => void
): (() => void) => {
  try {
    return onSnapshot(
      VERSION_DOC_REF,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as AppVersionData;
          const merged: AppVersionData = {
            version: data.version || DEFAULT_APP_VERSION.version,
            buildNumber: data.buildNumber || DEFAULT_APP_VERSION.buildNumber,
            releaseNotes: data.releaseNotes || DEFAULT_APP_VERSION.releaseNotes,
            forceUpdate: !!data.forceUpdate,
            minSupportedVersion: data.minSupportedVersion || DEFAULT_APP_VERSION.minSupportedVersion,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
          } catch (e) {
            // ignore quota errors
          }
          callback(merged);
        } else {
          // Document does not exist yet: initialize with defaults in background
          callback(DEFAULT_APP_VERSION);
        }
      },
      (error) => {
        console.warn('[VersionConfig] Firestore version subscription error:', error);
        callback(getCachedAppVersion());
      }
    );
  } catch (error) {
    console.warn('[VersionConfig] Failed to initiate version listener:', error);
    callback(getCachedAppVersion());
    return () => {};
  }
};

/**
 * Admin action: Update app version configuration in both Firestore & Supabase,
 * and dispatch an official release announcement to LimoChat Support chats.
 */
export const updateAppVersionConfig = async (
  newData: Partial<AppVersionData>,
  adminEmail: string
): Promise<void> => {
  const current = getCachedAppVersion();
  const payload: AppVersionData = {
    version: newData.version?.trim() || current.version,
    buildNumber: newData.buildNumber || current.buildNumber,
    releaseNotes: newData.releaseNotes?.trim() || current.releaseNotes,
    forceUpdate: newData.forceUpdate ?? current.forceUpdate ?? false,
    minSupportedVersion: newData.minSupportedVersion?.trim() || current.minSupportedVersion || '1.0.0',
    updatedAt: serverTimestamp(),
    updatedBy: adminEmail,
  };

  // 1. Dual-Database: Update Firestore
  await setDoc(VERSION_DOC_REF, payload, { merge: true });

  // 2. Dual-Database: Update Supabase system_config
  try {
    await supabase.from('system_config').upsert({
      key: 'app_version',
      value: payload,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[VersionConfig] Supabase update warning:', e);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // ignore
  }

  // 3. Broadcast release announcement to all LimoChat Support chats
  try {
    await broadcastVersionAnnouncement(payload);
  } catch (err) {
    console.warn('[VersionConfig] Broadcast to support chats notice:', err);
  }
};

/**
 * Dispatches the official release announcement into every user's LimoChat Support chat
 */
export async function broadcastVersionAnnouncement(payload: AppVersionData): Promise<void> {
  const announcementText = `🚀 Official LimoChat Update Released!\n\nVersion: v${payload.version} (Build ${payload.buildNumber})\n\nWhat's New:\n${payload.releaseNotes}\n\n• Minimum Supported: v${payload.minSupportedVersion || '1.0.0'}\n• Mandatory Update: ${payload.forceUpdate ? 'Yes' : 'No'}\n\nPlease restart or update your app to experience the latest features and security improvements!`;

  const supportChatIds = new Set<string>();

  // Find support chats in Firestore
  try {
    const chatsSnap = await getDocs(
      query(collection(db, 'chats'), where('participants', 'array-contains', 'limochat_official_support'))
    );
    chatsSnap.docs.forEach((d) => supportChatIds.add(d.id));
  } catch {}

  // Find support chats in Supabase
  try {
    const { data: supaChats } = await supabase.from('chats').select('id, participants');
    if (supaChats) {
      supaChats.forEach((c) => {
        if (
          c.id?.startsWith('support_') ||
          (Array.isArray(c.participants) && c.participants.includes('limochat_official_support'))
        ) {
          supportChatIds.add(c.id);
        }
      });
    }
  } catch {}

  const now = Date.now();
  for (const chatId of supportChatIds) {
    const msgId = `msg_ota_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const updateMsg: Message = {
      id: msgId,
      chatId,
      senderId: 'limochat_official_support',
      senderName: 'LimoChat Support',
      senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=LimoSupport',
      text: announcementText,
      type: 'text',
      status: 'delivered',
      timestamp: now,
      isDeletedForEveryone: false,
      deletedForUsers: [],
      starredBy: [],
    };

    // Dual-Database persistence
    await RealtimeCoordinator.persistAndBroadcastMessage(chatId, updateMsg).catch(() => {});
    await addDoc(collection(db, 'chats', chatId, 'messages'), updateMsg).catch(() => {});
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: updateMsg,
      updatedAt: now,
    }).catch(() => {});
  }
}
