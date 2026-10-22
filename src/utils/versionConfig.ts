import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

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
  version: '1.0.0',
  buildNumber: 1,
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
 * Admin action: Update app version configuration in Firestore
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

  await setDoc(VERSION_DOC_REF, payload, { merge: true });
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // ignore
  }
};
