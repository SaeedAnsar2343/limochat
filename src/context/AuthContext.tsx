import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile as updateFbProfile,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  arrayUnion,
  increment,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import { UserProfile, UserPrivacy, UserPreferences, UserPunishment, PolicyWarning, UserSession } from '../types';
import { supabase } from '../supabase/config';
import { RealtimeCoordinator } from '../utils/realtimeCoordinator';
import { formatAuthErrorMessage } from '../utils/authErrors';
import { generateTemporaryNumber, getOrAssignLifetimeNumber } from '../utils/formatters';

export const getClientDeviceInfo = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browser = 'Chrome';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  let os = 'Windows';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return {
    browser,
    os,
    deviceName: `${os} (${browser})`,
  };
};

const DEFAULT_ADMIN_EMAIL = 'saeed.samadelivery@gmail.com'.toLowerCase();

const getInitialAdminEmails = (): string[] => {
  try {
    const cached = localStorage.getItem('limochat_admin_emails');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(new Set([DEFAULT_ADMIN_EMAIL, ...parsed.map((e: string) => e.toLowerCase().trim())]));
      }
    }
  } catch {}
  return [DEFAULT_ADMIN_EMAIL];
};

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  isAdmin: boolean;
  adminEmails: string[];
  setAuthError: (err: string | null) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password?: string) => Promise<void>;
  signUpWithEmail: (displayName: string, email: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateUserPreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  updatePrivacySettings: (privacy: Partial<UserPrivacy>) => Promise<void>;
  blockUser: (targetUid: string) => Promise<void>;
  unblockUser: (targetUid: string) => Promise<void>;
  deleteContact: (targetUid: string) => Promise<void>;
  addAdminEmail: (newEmail: string) => Promise<void>;
  removeAdminEmail: (emailToRemove: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateUserPhoneNumberByAdmin: (targetUid: string, newNumber: string) => Promise<void>;
  applyUserPunishment: (targetUid: string, punishment: UserPunishment | null) => Promise<void>;
  issuePolicyWarning: (targetUid: string, reason: string, ruleName?: string) => Promise<void>;
  liftAdminSuspension: () => Promise<void>;
  logOutOtherSessions: () => Promise<void>;
  setAuthenticator: (enabled: boolean, secret: string | null, recoveryCodes?: string[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Safety watchdog: reset authenticating spinner if returning to foreground without completing
  useEffect(() => {
    if (!isAuthenticating) return;
    const handleForeground = () => {
      const timer = setTimeout(() => {
        if (!auth.currentUser) {
          setIsAuthenticating(false);
        }
      }, 3500);
      return () => clearTimeout(timer);
    };
    window.addEventListener('focus', handleForeground);
    document.addEventListener('visibilitychange', handleForeground);
    return () => {
      window.removeEventListener('focus', handleForeground);
      document.removeEventListener('visibilitychange', handleForeground);
    };
  }, [isAuthenticating]);
  const [adminEmails, setAdminEmails] = useState<string[]>(getInitialAdminEmails);

  // Sync admin configuration from Firestore
  useEffect(() => {
    const adminDocRef = doc(db, 'system_config', 'admins');
    const unsubAdmins = onSnapshot(adminDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.adminEmails)) {
          const list = Array.from(new Set([DEFAULT_ADMIN_EMAIL, ...data.adminEmails.map((e: string) => e.toLowerCase().trim())]));
          setAdminEmails(list);
          try {
            localStorage.setItem('limochat_admin_emails', JSON.stringify(list));
          } catch {}
        }
      } else {
        // Initialize admin configuration in Firestore using any existing cached admin emails
        const cachedList = getInitialAdminEmails();
        await setDoc(adminDocRef, {
          adminEmails: cachedList,
          updatedAt: Date.now(),
          updatedBy: 'system_init'
        }, { merge: true }).catch(() => {});
      }
    }, () => {
      // In case of error/offline, keep cached list
      setAdminEmails(getInitialAdminEmails());
    });

    return () => unsubAdmins();
  }, []);

  // Determine if current user is an authorized admin
  const userEmail = (currentUser?.email || firebaseUser?.email || '').toLowerCase().trim();
  const isAdmin = 
    currentUser?.isAdmin === true || 
    userEmail === DEFAULT_ADMIN_EMAIL || 
    adminEmails.includes(userEmail);

  // Sync user profile document from Firestore
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // Listen to Firestore profile updates
        unsubProfile = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile;
            const lifetimePhone = getOrAssignLifetimeNumber(user.uid, data.phoneNumber);
            if (!data.phoneNumber) {
              updateDoc(userRef, { phoneNumber: lifetimePhone }).catch(() => {});
            }

            // Check admin authorization status
            const profileEmail = (data.email || user.email || '').toLowerCase().trim();
            const cachedAdmins = getInitialAdminEmails();
            const isThisAdmin = 
              data.isAdmin === true || 
              profileEmail === DEFAULT_ADMIN_EMAIL || 
              cachedAdmins.includes(profileEmail) || 
              adminEmails.includes(profileEmail);

            if (isThisAdmin) {
              // Administrators CANNOT be suspended or banned under any circumstances.
              // Auto-purge any stale punishment or banned flag from Firestore immediately:
              if (data.punishment || data.isBanned || !data.isAdmin) {
                updateDoc(userRef, {
                  punishment: null,
                  isBanned: false,
                  isAdmin: true
                }).catch((err) => console.warn("Failed to auto-lift admin punishment in Firestore:", err));
              }

              data.punishment = undefined;
              data.isBanned = false;
              data.isAdmin = true;
            }

            setCurrentUser({ ...data, phoneNumber: lifetimePhone });
          } else {
            // First time registration: assign permanent lifetime virtual +991 phone number
            const lifetimePhone = getOrAssignLifetimeNumber(user.uid);
            const profileEmail = (user.email || `${user.uid}@limochat.app`).toLowerCase().trim();
            const cachedAdmins = getInitialAdminEmails();
            const isInitialAdmin = 
              profileEmail === DEFAULT_ADMIN_EMAIL || 
              cachedAdmins.includes(profileEmail) || 
              adminEmails.includes(profileEmail);

            const initialProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              email: user.email || `${user.uid}@limochat.app`,
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
              phoneNumber: lifetimePhone,
              about: 'Hey there! I am using LimoChat.',
              isOnline: true,
              lastSeen: Date.now(),
              isAdmin: isInitialAdmin,
              privacy: {
                lastSeen: 'everyone',
                profilePhoto: 'everyone',
                readReceipts: true,
              },
              blockedUsers: [],
              createdAt: Date.now(),
            };
            await setDoc(userRef, initialProfile).catch((err) => {
              console.warn("Could not save initial profile to Firestore:", err);
            });
            setCurrentUser(initialProfile);
          }
          setLoading(false);
        }, (err) => {
          console.warn("Firestore user profile snapshot notification:", err.message);
          if (!currentUser) {
            const fallbackPhone = getOrAssignLifetimeNumber(user.uid);
            const fallbackProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || 'User',
              email: user.email || `${user.uid}@limochat.app`,
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
              phoneNumber: fallbackPhone,
              about: 'Hey there! I am using LimoChat.',
              isOnline: true,
              lastSeen: Date.now(),
              privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', readReceipts: true },
              blockedUsers: [],
              createdAt: Date.now(),
            };
            setCurrentUser(fallbackProfile);
          }
          setLoading(false);
        });

        // Best effort set online status
        updateDoc(userRef, {
          isOnline: true,
          lastSeen: Date.now()
        }).catch(() => {});
      } else {
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // Manage Real-Time Presence Heartbeat (every 40s) & Graceful Disconnect
  useEffect(() => {
    if (!currentUser?.uid) return;
    const userRef = doc(db, 'users', currentUser.uid);

    // Immediate online beacon
    updateDoc(userRef, { isOnline: true, lastSeen: Date.now() }).catch(() => {});

    // Periodic heartbeat throttled to 3 minutes when window is active (saves thousands of writes/day)
    const heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        updateDoc(userRef, { isOnline: true, lastSeen: Date.now() }).catch(() => {});
      }
    }, 180000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateDoc(userRef, { isOnline: true, lastSeen: Date.now() }).catch(() => {});
      }
    };

    const handleBeforeUnload = () => {
      updateDoc(userRef, { isOnline: false, lastSeen: Date.now() }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.uid]);

  const signInWithGoogle = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);

      // 1. Native Android Google Sign-In via Credential Manager (never leaves the app)
      if (Capacitor.isNativePlatform()) {
        try {
          console.log("[Auth] Initiating native Android Google Sign-In via Credential Manager...");
          const result = await FirebaseAuthentication.signInWithGoogle();
          console.log("[Auth] Native Google Sign-In response received:", result);

          if (result?.credential?.idToken) {
            const credential = GoogleAuthProvider.credential(result.credential.idToken);
            await signInWithCredential(auth, credential);
            return;
          } else if (result?.user) {
            return;
          }
        } catch (nativeErr: any) {
          console.warn("[Auth] Native Google Sign-In error:", nativeErr);
          const msg = (nativeErr?.message || '').toLowerCase();
          if (msg.includes('cancel') || msg.includes('16') || msg.includes('12501')) {
            setAuthError("Sign-in cancelled.");
            return;
          }
          // If native failed with another error, fall back to browser popup
        }
      }

      // 2. Web Popup Sign-In
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google sign in error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("Google Sign-In is not configured for this domain yet. Please sign in with your email or virtual number below.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in was cancelled.");
      } else {
        setAuthError(formatAuthErrorMessage(error));
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signInWithEmail = async (email: string, password = 'Password123!') => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      const cleanEmail = email.trim();

      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (authErr: any) {
        if (
          authErr.code === 'auth/operation-not-allowed' ||
          authErr.code === 'auth/unauthorized-domain' ||
          authErr.code === 'auth/configuration-not-found'
        ) {
          const anonRes = await signInAnonymously(auth);
          await updateFbProfile(anonRes.user, {
            displayName: cleanEmail.split('@')[0],
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanEmail}`
          });
        } else {
          throw authErr;
        }
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(formatAuthErrorMessage(error));
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signUpWithEmail = async (displayName: string, email: string, password = 'Password123!') => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);

      const cleanEmail = email.trim();
      const cleanName = displayName.trim();

      try {
        const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateFbProfile(res.user, {
          displayName: cleanName,
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName)}`
        });
      } catch (authErr: any) {
        if (
          authErr.code === 'auth/operation-not-allowed' ||
          authErr.code === 'auth/unauthorized-domain' ||
          authErr.code === 'auth/configuration-not-found'
        ) {
          const anonRes = await signInAnonymously(auth);
          await updateFbProfile(anonRes.user, {
            displayName: cleanName,
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName)}`
          });
        } else {
          throw authErr;
        }
      }
    } catch (error: any) {
      console.error("Sign up error:", error);
      setAuthError(formatAuthErrorMessage(error));
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signOut = async () => {
    const uid = currentUser?.uid;
    if (uid) {
      try {
        await updateDoc(doc(db, 'users', uid), {
          isOnline: false,
          lastSeen: Date.now()
        }).catch(() => {});
        await supabase
          .from('users')
          .update({ is_online: false, last_seen: Date.now() })
          .eq('uid', uid);
        await supabase.auth.signOut().catch(() => {});
      } catch {}
    }
    try {
      await fbSignOut(auth);
    } catch {}
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('limochat_auth_token');
        localStorage.removeItem('supabase.auth.token');
        if (uid) {
          localStorage.removeItem(`limochat_2fa_verified_${uid}`);
          localStorage.removeItem(`limochat_unlocked_${uid}`);
        }
      }
    } catch {}

    // Reset browser history so pressing Android back button won't return to old pages
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', '/');
    }

    setCurrentUser(null);
  };

  const setAuthenticator = async (enabled: boolean, secret: string | null, recoveryCodes: string[] = []) => {
    if (!currentUser?.uid) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const updatedPrefs = {
      ...(currentUser.preferences || {}),
      authenticatorEnabled: enabled,
      authenticatorSecret: secret || undefined,
      recoveryCodes,
    };
    try {
      await updateDoc(userRef, {
        authenticatorEnabled: enabled,
        authenticatorSecret: secret,
        recoveryCodes,
        preferences: updatedPrefs,
      });
    } catch {
      await setDoc(userRef, {
        authenticatorEnabled: enabled,
        authenticatorSecret: secret,
        recoveryCodes,
        preferences: updatedPrefs,
      }, { merge: true }).catch(() => {});
    }

    await RealtimeCoordinator.updateUserAuthenticator(currentUser.uid, enabled, secret, recoveryCodes).catch(() => {});

    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            authenticatorEnabled: enabled,
            authenticatorSecret: secret || undefined,
            recoveryCodes,
            preferences: updatedPrefs as any,
          }
        : null
    );
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser?.uid) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, updates).catch(() => {});
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const updateUserPreferences = async (newPrefs: Partial<UserPreferences>) => {
    if (!currentUser?.uid) return;
    const merged = { ...(currentUser.preferences || {}), ...newPrefs };
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, { preferences: merged }).catch(() => {});
    try {
      await supabase.from('users').update({
        preferences: merged,
        updated_at: Date.now(),
      }).eq('uid', currentUser.uid);
    } catch (e) {
      console.warn('[AuthContext] Supabase updateUserPreferences warning:', e);
    }
    setCurrentUser(prev => prev ? { ...prev, preferences: merged as any } : null);
  };

  const deleteContact = async (targetUid: string) => {
    if (!currentUser?.uid) return;
    if (targetUid === 'limochat_official_support') {
      console.warn("LimoChat Support cannot be deleted.");
      return;
    }
    const updatedDeleted = Array.from(new Set([...(currentUser.deletedContactUids || []), targetUid]));
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, { deletedContactUids: updatedDeleted }).catch(() => {});
    setCurrentUser(prev => prev ? { ...prev, deletedContactUids: updatedDeleted } : null);
  };

  const updatePrivacySettings = async (privacyUpdates: Partial<UserPrivacy>) => {
    if (!currentUser?.uid) return;
    const defaultPrivacy: UserPrivacy = {
      lastSeen: 'everyone',
      profilePhoto: 'everyone',
      about: 'everyone',
      status: 'everyone',
      readReceipts: true,
    };
    const newPrivacy: UserPrivacy = {
      ...defaultPrivacy,
      ...(currentUser.privacy || {}),
      ...privacyUpdates,
    };
    await updateDoc(doc(db, 'users', currentUser.uid), { privacy: newPrivacy }).catch(() => {});
    try {
      await supabase.from('users').update({
        privacy: newPrivacy,
        updated_at: Date.now(),
      }).eq('uid', currentUser.uid);
    } catch (e) {
      console.warn('[AuthContext] Supabase updatePrivacySettings warning:', e);
    }
    setCurrentUser(prev => prev ? { ...prev, privacy: newPrivacy } : null);
  };

  const blockUser = async (targetUid: string) => {
    if (!currentUser?.uid) return;
    if (targetUid === 'limochat_official_support') {
      console.warn("LimoChat Support cannot be blocked.");
      return;
    }
    const updatedBlocked = Array.from(new Set([...(currentUser.blockedUsers || []), targetUid]));
    await updateDoc(doc(db, 'users', currentUser.uid), { blockedUsers: updatedBlocked }).catch(() => {});
  };

  const unblockUser = async (targetUid: string) => {
    if (!currentUser?.uid) return;
    const updatedBlocked = (currentUser.blockedUsers || []).filter(id => id !== targetUid);
    await updateDoc(doc(db, 'users', currentUser.uid), { blockedUsers: updatedBlocked }).catch(() => {});
  };

  // Add new admin email to Firestore and user profile
  const addAdminEmail = async (newEmail: string) => {
    const clean = newEmail.toLowerCase().trim();
    if (!clean || adminEmails.includes(clean)) return;

    const updated = Array.from(new Set([...adminEmails, clean]));
    setAdminEmails(updated);
    try {
      localStorage.setItem('limochat_admin_emails', JSON.stringify(updated));
    } catch {}

    const adminDocRef = doc(db, 'system_config', 'admins');
    await setDoc(adminDocRef, {
      adminEmails: updated,
      updatedAt: Date.now(),
      updatedBy: userEmail
    }, { merge: true }).catch((err) => {
      console.warn("Could not save admin email update:", err);
    });

    // Also update user's document in Firestore if account exists
    try {
      const q = query(collection(db, 'users'), where('email', '==', clean));
      const userSnap = await getDocs(q);
      userSnap.forEach(async (d) => {
        await updateDoc(d.ref, { isAdmin: true });
      });
    } catch {}
  };

  // Remove admin email from Firestore
  const removeAdminEmail = async (emailToRemove: string) => {
    const clean = emailToRemove.toLowerCase().trim();
    if (clean === DEFAULT_ADMIN_EMAIL) {
      alert("The primary owner email cannot be removed.");
      return;
    }

    const updated = adminEmails.filter(e => e !== clean);
    setAdminEmails(updated);
    try {
      localStorage.setItem('limochat_admin_emails', JSON.stringify(updated));
    } catch {}

    const adminDocRef = doc(db, 'system_config', 'admins');
    await setDoc(adminDocRef, {
      adminEmails: updated,
      updatedAt: Date.now(),
      updatedBy: userEmail
    }, { merge: true }).catch((err) => {
      console.warn("Could not update admin emails in Firestore:", err);
    });

    // Also update user's document in Firestore
    try {
      const q = query(collection(db, 'users'), where('email', '==', clean));
      const userSnap = await getDocs(q);
      userSnap.forEach(async (d) => {
        await updateDoc(d.ref, { isAdmin: false });
      });
    } catch {}
  };

  // Mark user as onboarded
  const completeOnboarding = async () => {
    if (!currentUser?.uid) return;
    await updateUserProfile({ isOnboarded: true });
    try {
      localStorage.setItem(`limochat_onboarded_${currentUser.uid}`, 'true');
    } catch {}
  };

  // Admin: Update user's lifetime assigned phone number with duplicate collision prevention
  const updateUserPhoneNumberByAdmin = async (targetUid: string, newNumber: string) => {
    const trimmed = newNumber.trim();
    if (!trimmed.startsWith('+991')) {
      throw new Error("Phone number must start with '+991'");
    }

    // Verify uniqueness across all users in Firestore
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phoneNumber', '==', trimmed));
    const snapshot = await getDocs(q);
    const conflict = snapshot.docs.find(d => d.id !== targetUid);

    if (conflict) {
      const conflictData = conflict.data();
      throw new Error(`The virtual number "${trimmed}" is already assigned to "${conflictData.displayName || 'another user'}" (${conflictData.email || 'account'}). Numbers must be strictly unique.`);
    }

    await updateDoc(doc(db, 'users', targetUid), { phoneNumber: trimmed });
    await RealtimeCoordinator.updateUserAdmin(targetUid, { phoneNumber: trimmed }).catch(() => {});
    try {
      localStorage.setItem(`limochat_assigned_phone_${targetUid}`, trimmed);
    } catch {}
    if (currentUser?.uid === targetUid) {
      setCurrentUser((prev) => (prev ? { ...prev, phoneNumber: trimmed } : null));
    }
  };

  // Admin: Apply or lift user sanctions and punishments (Admins CANNOT be banned)
  const applyUserPunishment = async (targetUid: string, punishment: UserPunishment | null) => {
    const userRef = doc(db, 'users', targetUid);
    if (punishment) {
      // Check if target user is an administrator
      const targetSnap = await getDoc(userRef).catch(() => null);
      const targetData = targetSnap?.data() as UserProfile | undefined;
      const targetEmail = (targetData?.email || '').toLowerCase().trim();

      if (
        targetEmail === DEFAULT_ADMIN_EMAIL ||
        adminEmails.includes(targetEmail) ||
        targetData?.isAdmin === true
      ) {
        throw new Error("Action Prohibited: Administrators are protected and cannot be banned or sanctioned.");
      }

      await updateDoc(userRef, { 
        punishment, 
        isBanned: punishment.isSuspended 
      });
      await RealtimeCoordinator.updateUserAdmin(targetUid, { punishment, isBanned: punishment.isSuspended }).catch(() => {});
      if (currentUser?.uid === targetUid) {
        setCurrentUser((prev) => (prev ? { ...prev, punishment, isBanned: punishment.isSuspended } : null));
      }
    } else {
      await updateDoc(userRef, { 
        punishment: null,
        isBanned: false
      });
      await RealtimeCoordinator.updateUserAdmin(targetUid, { punishment: null, isBanned: false }).catch(() => {});
      if (currentUser?.uid === targetUid) {
        setCurrentUser((prev) => (prev ? { ...prev, punishment: undefined, isBanned: false } : null));
      }
    }
  };

  // Admin: Issue policy violation warning (Admins CANNOT be warned)
  const issuePolicyWarning = async (targetUid: string, reason: string, ruleName?: string) => {
    const userRef = doc(db, 'users', targetUid);
    const targetSnap = await getDoc(userRef).catch(() => null);
    const targetData = targetSnap?.data() as UserProfile | undefined;
    const targetEmail = (targetData?.email || '').toLowerCase().trim();

    if (
      targetEmail === DEFAULT_ADMIN_EMAIL ||
      adminEmails.includes(targetEmail) ||
      targetData?.isAdmin === true
    ) {
      throw new Error("Action Prohibited: Administrators cannot be warned or sanctioned.");
    }

    const newWarning: PolicyWarning = {
      id: `warn_${Date.now()}`,
      reason,
      ruleId: ruleName,
      timestamp: Date.now(),
      appliedBy: currentUser?.email || 'admin@limochat.app',
    };
    await updateDoc(userRef, {
      policyWarnings: arrayUnion(newWarning),
      violationsCount: increment(1),
    }).catch(() => {});
  };

  // Emergency method: Lift current admin user's suspension
  const liftAdminSuspension = async () => {
    if (!currentUser?.uid) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, { 
      punishment: null, 
      isBanned: false, 
      isAdmin: true 
    }).catch(console.warn);
    setCurrentUser((prev) => (prev ? { ...prev, punishment: undefined, isBanned: false, isAdmin: true } : null));
  };

  const logOutOtherSessions = async () => {
    if (!currentUser?.uid) return;
    const clientDev = getClientDeviceInfo();
    const currSession: UserSession = {
      id: `sess_${Date.now()}`,
      deviceName: clientDev.deviceName,
      browser: clientDev.browser,
      os: clientDev.os,
      lastActive: Date.now(),
      isCurrent: true,
    };
    await updateDoc(doc(db, 'users', currentUser.uid), {
      activeSessions: [currSession],
    }).catch(console.warn);
    setCurrentUser((prev) => (prev ? { ...prev, activeSessions: [currSession] } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        loading,
        isAuthenticating,
        authError,
        isAdmin,
        adminEmails,
        setAuthError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateUserProfile,
        updateUserPreferences,
        updatePrivacySettings,
        blockUser,
        unblockUser,
        deleteContact,
        addAdminEmail,
        removeAdminEmail,
        completeOnboarding,
        updateUserPhoneNumberByAdmin,
        applyUserPunishment,
        issuePolicyWarning,
        liftAdminSuspension,
        logOutOtherSessions,
        setAuthenticator,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
