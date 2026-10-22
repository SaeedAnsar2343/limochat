import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Shield, 
  MessageCircle, 
  Bell, 
  LogOut, 
  FileText, 
  Activity, 
  Sparkles, 
  Palette, 
  ChevronRight,
  ShieldCheck, 
  KeyRound, 
  Download, 
  Upload,
  Trash2, 
  Volume2, 
  VolumeX, 
  Type, 
  Lock, 
  QrCode, 
  Check, 
  Copy, 
  RefreshCw, 
  Edit2, 
  ShieldAlert, 
  Languages, 
  Globe, 
  Sun, 
  Moon, 
  Headphones, 
  Camera,
  Smartphone,
  Laptop,
  Fingerprint,
  Eye,
  EyeOff,
  Ban,
  HardDrive,
  Play,
  Square,
  CheckCheck,
  AlertTriangle,
  Radio,
  Sliders,
  Music,
  Clock
} from 'lucide-react';
import { UserProfile, ChatWallpaper, AppTheme, UserPrivacy, MessageToneType } from '../../types';
import { Avatar } from '../common/Avatar';
import { AvatarEditorModal } from './AvatarEditorModal';
import { TwoStepModal } from './TwoStepModal';
import { PasscodeModal } from './PasscodeModal';
import { PrivacyPolicyModal } from '../pages/PrivacyPolicyModal';
import { TermsConditionsModal } from '../pages/TermsConditionsModal';
import { OperationalStatusModal } from '../pages/OperationalStatusModal';
import { WhatsNewModal } from '../pages/WhatsNewModal';
import { QRCodeModal } from '../common/QRCodeModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { AdminPortalModal } from '../admin/AdminPortalModal';
import { useAuth, getClientDeviceInfo } from '../../context/AuthContext';
import { useChat, SYSTEM_SUPPORT_USER } from '../../context/ChatContext';
import { soundEngine } from '../../utils/sound';
import { subscribeToAppVersion, getCachedAppVersion, AppVersionData } from '../../utils/versionConfig';
import { SUPPORTED_LANGUAGES, translateText } from '../../utils/translate';

interface SettingsDrawerProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'all' | 'profile' | 'security' | 'chats' | 'notifications' | 'storage' | 'language' | 'legal';

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ user, isOpen, onClose }) => {
  const { 
    signOut, 
    updateUserProfile, 
    updateUserPreferences,
    updatePrivacySettings, 
    unblockUser, 
    logOutOtherSessions,
    isAdmin 
  } = useAuth();

  const { 
    theme, 
    setTheme, 
    wallpaper, 
    setWallpaper, 
    enterIsSend, 
    setEnterIsSend,
    fontSize,
    setFontSize,
    chats,
    createDirectChat,
    showAlertNotice,
  } = useChat();

  // One-page section filter: 'all' shows all sections on one continuous page
  const [filterTab, setFilterTab] = useState<SettingsSection>('all');

  // Inline profile editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [about, setAbout] = useState(user.about);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sub-Modals
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showTwoStepModal, setShowTwoStepModal] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [isPlayingRingtoneSample, setIsPlayingRingtoneSample] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [adminPortalInitialTab, setAdminPortalInitialTab] = useState<'overview' | 'support' | 'users' | 'chats' | 'policies' | 'admins' | 'version'>('overview');
  const [appVersionData, setAppVersionData] = useState<AppVersionData>(getCachedAppVersion);

  useEffect(() => {
    const unsub = subscribeToAppVersion((data) => setAppVersionData(data));
    return () => unsub();
  }, []);
  
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Hidden File Input Ref for Restoring Chat Backup
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Security & App Lock states
  const isAppLockActive = !!user.preferences?.appLockEnabled && !!user.preferences?.appLockPin;
  const autoLockTimeout = user.preferences?.appLockTimeout || '1m';

  // Preferences states initialized directly from user profile
  const [messageSound, setMessageSound] = useState(user.preferences?.notificationSound ?? true);
  const [messageTone, setMessageTone] = useState<MessageToneType>(user.preferences?.messageTone || 'pop');
  const [ringtoneSound, setRingtoneSound] = useState(user.preferences?.ringtoneSound ?? true);
  const [desktopNotifs, setDesktopNotifs] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : false
  );
  const [twoStepEnabled, setTwoStepEnabled] = useState(!!user.preferences?.twoStepPin);
  const [securityNotifs, setSecurityNotifs] = useState(user.preferences?.securityNotifications ?? true);
  const [inAppVibration, setInAppVibration] = useState(user.preferences?.inAppVibration ?? true);
  const [highPriorityNotifs, setHighPriorityNotifs] = useState(user.preferences?.highPriorityNotifs ?? true);
  const [reactionNotifs, setReactionNotifs] = useState(user.preferences?.reactionNotifs ?? true);
  const [lowDataCalls, setLowDataCalls] = useState(user.preferences?.lowDataCalls ?? false);

  const [disappearingTimer, setDisappearingTimer] = useState(
    user.preferences?.disappearingDuration === 24 
      ? '24h' 
      : user.preferences?.disappearingDuration === 168 
      ? '7d' 
      : user.preferences?.disappearingDuration === 2160 
      ? '90d' 
      : 'off'
  );

  // Calculate real storage stats from localStorage
  const calculateStorageUsage = () => {
    let messagesBytes = 0;
    let mediaBytes = 0;
    let cacheBytes = 0;
    let otherBytes = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key) || '';
        const byteSize = (key.length + val.length) * 2;

        if (key.startsWith('limochat_msgs_') || key.startsWith('limochat_chats')) {
          messagesBytes += byteSize;
        } else if (key.startsWith('limochat_cached_media_') || key.includes('avatar') || key.includes('wallpaper')) {
          mediaBytes += byteSize;
        } else if (key.startsWith('limochat_cached_') || key.startsWith('limochat_temp_') || key.startsWith('limochat_preview_')) {
          cacheBytes += byteSize;
        } else {
          otherBytes += byteSize;
        }
      }
    } catch {}

    const totalBytes = messagesBytes + mediaBytes + cacheBytes + otherBytes;
    return {
      messagesBytes,
      mediaBytes,
      cacheBytes,
      otherBytes,
      totalBytes: Math.max(totalBytes, 2048),
    };
  };

  const [storageStats, setStorageStats] = useState(calculateStorageUsage);

  useEffect(() => {
    if (isOpen) {
      setStorageStats(calculateStorageUsage());
    }
  }, [isOpen]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSaveAvatar = async (photoURL: string) => {
    await updateUserProfile({ photoURL });
  };

  const handleSaveTwoStep = async (pin: string, recoveryEmail?: string) => {
    await updateUserPreferences({
      twoStepPin: pin,
      twoStepRecoveryEmail: recoveryEmail || '',
    });
    setTwoStepEnabled(true);
    showAlertNotice?.("Two-Step Verification Enabled", "Your account is protected with a 6-digit registration PIN.", "primary");
  };

  const handleDisableTwoStep = async () => {
    await updateUserPreferences({
      twoStepPin: '',
    });
    setTwoStepEnabled(false);
    showAlertNotice?.("Two-Step Verification Disabled", "Two-step PIN verification has been turned off.", "warning");
  };

  // Passcode Lock handlers
  const handleSavePasscode = async (pin: string, timeout: 'immediately' | '1m' | '15m' | '1h', biometric: boolean) => {
    await updateUserPreferences({
      appLockEnabled: true,
      appLockPin: pin,
      appLockTimeout: timeout,
      biometricEnabled: biometric,
    });
    sessionStorage.setItem(`limochat_unlocked_${user.uid}`, 'true');
    showAlertNotice?.("Passcode Lock Enabled", "LimoChat is now secured with your passcode and timeout preferences.", "primary");
  };

  const handleDisablePasscode = async () => {
    await updateUserPreferences({
      appLockEnabled: false,
      appLockPin: '',
    });
    sessionStorage.setItem(`limochat_unlocked_${user.uid}`, 'true');
    showAlertNotice?.("Passcode Lock Disabled", "Screen lock has been deactivated.", "warning");
  };

  const handleLockNow = () => {
    window.dispatchEvent(new Event('limochat_lock_now'));
    onClose();
  };

  // Sound Engine Tone Selector & Toggles
  const handleTestMessageTone = (tone?: MessageToneType) => {
    soundEngine.playMessageReceived(tone || messageTone);
  };

  const handleSelectMessageTone = async (tone: MessageToneType) => {
    setMessageTone(tone);
    soundEngine.playMessageReceived(tone);
    await updateUserPreferences({ messageTone: tone });
  };

  const handleToggleTestRingtone = () => {
    if (isPlayingRingtoneSample) {
      soundEngine.stopRingtone();
      setIsPlayingRingtoneSample(false);
    } else {
      setIsPlayingRingtoneSample(true);
      soundEngine.startIncomingRingtone();
      setTimeout(() => {
        soundEngine.stopRingtone();
        setIsPlayingRingtoneSample(false);
      }, 5000);
    }
  };

  const handleToggleMessageSound = async () => {
    const nextVal = !messageSound;
    setMessageSound(nextVal);
    if (nextVal) soundEngine.playMessageReceived(messageTone);
    await updateUserPreferences({ notificationSound: nextVal });
  };

  const handleToggleRingtoneSound = async () => {
    const nextVal = !ringtoneSound;
    setRingtoneSound(nextVal);
    if (nextVal) {
      soundEngine.startIncomingRingtone();
      setTimeout(() => soundEngine.stopRingtone(), 1500);
    }
    await updateUserPreferences({ ringtoneSound: nextVal });
  };

  const handleToggleInAppVibration = async () => {
    const nextVal = !inAppVibration;
    setInAppVibration(nextVal);
    if (nextVal && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(100); } catch {}
    }
    await updateUserPreferences({ inAppVibration: nextVal });
  };

  const handleToggleReactionNotifs = async () => {
    const nextVal = !reactionNotifs;
    setReactionNotifs(nextVal);
    await updateUserPreferences({ reactionNotifs: nextVal });
  };

  const handleToggleHighPriorityNotifs = async () => {
    const nextVal = !highPriorityNotifs;
    setHighPriorityNotifs(nextVal);
    await updateUserPreferences({ highPriorityNotifs: nextVal });
  };

  const handleToggleLowDataCalls = async () => {
    const nextVal = !lowDataCalls;
    setLowDataCalls(nextVal);
    await updateUserPreferences({ lowDataCalls: nextVal });
  };

  const handleToggleSecurityNotifs = async () => {
    const nextVal = !securityNotifs;
    setSecurityNotifs(nextVal);
    await updateUserPreferences({ securityNotifications: nextVal });
  };

  const handleChangeDisappearing = async (val: string) => {
    setDisappearingTimer(val);
    const hours = val === '24h' ? 24 : val === '7d' ? 168 : val === '90d' ? 2160 : 0;
    await updateUserPreferences({ disappearingDuration: hours });
  };

  // Active Sessions Management
  const clientDevice = getClientDeviceInfo();
  const activeSessionsList = (user.activeSessions && user.activeSessions.length > 0)
    ? user.activeSessions
    : [
        {
          id: 'current_session',
          deviceName: clientDevice.deviceName,
          browser: clientDevice.browser,
          os: clientDevice.os,
          lastActive: Date.now(),
          isCurrent: true,
        }
      ];

  const handleLogOutOtherSessions = async () => {
    try {
      await logOutOtherSessions();
      showAlertNotice?.("Sessions Synchronized", "All other device sessions have been safely logged out.", "primary");
    } catch (err: any) {
      showAlertNotice?.("Action Failed", err.message || "Failed to log out other sessions", "danger");
    }
  };

  // Cache & Storage Management
  const handleClearCache = () => {
    try {
      let clearedBytes = 0;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('limochat_cached_') ||
          key.startsWith('limochat_temp_') ||
          key.startsWith('limochat_preview_') ||
          key.startsWith('limochat_media_blob_')
        )) {
          const val = localStorage.getItem(key) || '';
          clearedBytes += (key.length + val.length) * 2;
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      setStorageStats(calculateStorageUsage());
      const freedStr = formatBytes(clearedBytes);
      showAlertNotice?.("Cache Cleared", `Cleaned temporary buffers (${clearedBytes > 0 ? freedStr : '0 B'}). Chat history is untouched.`, "primary");
    } catch {}
  };

  const handleClearAllChats = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Clear All Local Chat Data?",
      description: "This will remove all locally cached messages from this browser. Your server account, profile, and contacts will remain safe.",
      confirmText: "Clear All Chats",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: () => {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('limochat_msgs_') || key.startsWith('limochat_chats'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
          setStorageStats(calculateStorageUsage());
          showAlertNotice?.("Chats Cleared", "Local message cache has been cleaned.", "warning");
        } catch {}
        setConfirmConfig(null);
      }
    });
  };

  // Chat History Export & Restore
  const handleExportData = () => {
    const allMessages: any[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('limochat_msgs_')) {
          const msgs = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(msgs)) allMessages.push(...msgs);
        }
      }
    } catch {}

    const data = {
      version: '2.0',
      userProfile: {
        uid: user.uid,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        preferences: user.preferences,
        privacy: user.privacy,
      },
      activeChatsCount: chats.length,
      chatsSummary: chats.map(c => ({ id: c.id, name: c.name, type: c.type, lastMessage: c.lastMessage })),
      messagesCount: allMessages.length,
      messages: allMessages,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `limochat-backup-${(user.displayName || 'user').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showAlertNotice?.("Backup Exported", `Saved ${allMessages.length} messages and user profile to JSON file.`, "primary");
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (!data || (!data.userProfile && !data.chatsSummary && !data.messages)) {
          throw new Error("Invalid backup JSON. Missing LimoChat metadata.");
        }

        let restoredCount = 0;
        if (data.messages && Array.isArray(data.messages)) {
          const grouped: Record<string, any[]> = {};
          data.messages.forEach((m: any) => {
            if (m.chatId) {
              if (!grouped[m.chatId]) grouped[m.chatId] = [];
              grouped[m.chatId].push(m);
              restoredCount++;
            }
          });
          Object.entries(grouped).forEach(([cid, msgs]) => {
            try {
              localStorage.setItem(`limochat_msgs_${cid}`, JSON.stringify(msgs));
            } catch {}
          });
        }

        if (data.userProfile?.preferences) {
          await updateUserPreferences(data.userProfile.preferences);
        }

        setStorageStats(calculateStorageUsage());
        showAlertNotice?.("Backup Restored", `Restored ${restoredCount} messages and user preferences successfully.`, "primary");
      } catch (err: any) {
        showAlertNotice?.("Restore Failed", err.message || "Failed to restore backup file.", "danger");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Language & Translation states
  const [appLanguage, setAppLanguage] = useState(user.preferences?.appLanguage || 'en');
  const [translateTargetLanguage, setTranslateTargetLanguage] = useState(user.preferences?.translateTargetLanguage || 'en');
  const [testText, setTestText] = useState('Hello! Welcome to LimoChat.');
  const [testTranslated, setTestTranslated] = useState('');
  const [testingTranslation, setTestingTranslation] = useState(false);

  if (!isOpen) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(user.phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContactSupportForNumber = async () => {
    onClose();
    await createDirectChat(SYSTEM_SUPPORT_USER);
  };

  const handleSaveLanguageSettings = async (targetLang: string, appLang: string) => {
    setTranslateTargetLanguage(targetLang);
    setAppLanguage(appLang);
    await updateUserPreferences({
      appLanguage: appLang,
      translateTargetLanguage: targetLang,
    });
  };

  const handleTestTranslation = async () => {
    if (!testText.trim()) return;
    try {
      setTestingTranslation(true);
      const res = await translateText(testText, translateTargetLanguage);
      setTestTranslated(res.translatedText);
    } catch {
      setTestTranslated("Translation test error");
    } finally {
      setTestingTranslation(false);
    }
  };

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    await updateUserProfile({ displayName: displayName.trim() });
    setIsEditingName(false);
  };

  const handleSaveAbout = async (text: string) => {
    setAbout(text);
    await updateUserProfile({ about: text });
    setIsEditingAbout(false);
  };

  const handleRequestDesktopNotifs = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setDesktopNotifs(permission === 'granted');
      if (permission === 'granted') {
        new Notification("LimoChat Notifications", {
          body: "Notifications are now active for incoming messages & calls.",
          icon: "/favicon.svg"
        });
      }
    }
  };

  const statusPresets = [
    "Available",
    "Busy",
    "At work",
    "In a meeting",
    "Battery about to die",
    "Urgent calls only",
    "Sleeping",
    "Offline for study"
  ];

  const wallpaperList: { id: ChatWallpaper; label: string; bgClass: string }[] = [
    { id: 'default', label: 'Classic WhatsApp Doodle', bgClass: 'whatsapp-bg' },
    { id: 'dark-slate', label: 'Slate Night', bgClass: 'bg-slate-900 border-slate-700' },
    { id: 'emerald', label: 'Emerald Forest', bgClass: 'bg-emerald-950 border-emerald-800' },
    { id: 'navy', label: 'Midnight Navy', bgClass: 'bg-blue-950 border-blue-900' },
    { id: 'apple-glass', label: 'Aurora Glass', bgClass: 'bg-gradient-to-tr from-slate-900 via-teal-950 to-emerald-950' },
    { id: 'blurred-mesh', label: 'Minimal Mesh', bgClass: 'bg-[#111b21]' },
  ];

  const messageToneList: { id: MessageToneType; label: string; desc: string }[] = [
    { id: 'pop', label: 'Classic Pop', desc: 'Light & snappy bubble' },
    { id: 'chime', label: 'Crystal Chime', desc: 'Melodic dual-note chime' },
    { id: 'submarine', label: 'Submarine Ping', desc: 'Sonar low-frequency echo' },
    { id: 'aurora', label: 'Aurora Chord', desc: 'Harmonic atmospheric synth' },
    { id: 'bell', label: 'Brass Bell', desc: 'Crisp traditional telephone bell' },
  ];

  const shouldShow = (sec: SettingsSection) => filterTab === 'all' || filterTab === sec;

  // Calculate breakdown percentages
  const messagesPct = Math.round((storageStats.messagesBytes / storageStats.totalBytes) * 100);
  const mediaPct = Math.round((storageStats.mediaBytes / storageStats.totalBytes) * 100);
  const cachePct = Math.max(10, 100 - messagesPct - mediaPct);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
        {/* Outside Backdrop */}
        <div className="fixed inset-0 cursor-default" onClick={onClose} />

        {/* Unified One-Page Settings Dialog */}
        <div className="relative z-10 bg-[#202c33] text-[#e9edef] w-full max-w-2xl h-[92vh] rounded-3xl overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col animate-scale-in modal-content">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e3b44] bg-[#111b21] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00a884]/20 rounded-xl text-[#00a884]">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-snug">LimoChat Settings & Preferences</h3>
                <p className="text-xs text-[#8696a0]">All preferences unified on one page • Instant cross-device sync</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick-Filter Navigation Pills */}
          <div className="flex items-center gap-1.5 px-6 py-2.5 bg-[#182229] border-b border-[#2e3b44] overflow-x-auto text-xs whitespace-nowrap scrollbar-none flex-shrink-0">
            {[
              { id: 'all', label: '✨ All Sections' },
              { id: 'profile', label: '👤 Profile & +991' },
              { id: 'security', label: '🛡️ Security & Privacy' },
              { id: 'chats', label: '💬 Chats & Themes' },
              { id: 'notifications', label: '🔔 Notifications' },
              { id: 'storage', label: '💾 Storage & Data' },
              { id: 'language', label: '🌐 Language' },
              { id: 'legal', label: '📜 Legal & Policies' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as SettingsSection)}
                className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer text-xs ${
                  filterTab === tab.id
                    ? 'bg-[#00a884] text-white shadow-md'
                    : 'bg-[#111b21] text-[#8696a0] hover:text-white hover:bg-[#202c33] border border-[#2e3b44]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* One-Page Scrollable Body containing ALL sections */}
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
            
            {/* =========================================================================
                SECTION 1: PROFILE & +991 NUMBER
                ========================================================================= */}
            {shouldShow('profile') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00a884]">
                  <User className="w-4 h-4" />
                  <span>Profile & Lifetime Virtual Number</span>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4">
                  <div className="flex items-center gap-4">
                    <div 
                      onClick={() => setShowAvatarEditor(true)}
                      className="relative cursor-pointer group flex-shrink-0"
                      title="Change Profile Photo"
                    >
                      <Avatar src={user.photoURL} name={user.displayName} size="xl" isOnline={user.isOnline} />
                      <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg">
                        <Camera className="w-5 h-5 text-white" />
                        <span className="text-[9px] font-semibold text-white mt-0.5">Edit</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="bg-[#202c33] border border-[#00a884] rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none flex-1"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveName}
                            className="p-1.5 rounded-xl bg-[#00a884] text-white hover:bg-[#02906f]"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setIsEditingName(false); setDisplayName(user.displayName); }}
                            className="p-1.5 rounded-xl bg-[#202c33] text-[#8696a0] hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-bold text-white truncate">{user.displayName}</h4>
                          <button
                            onClick={() => setIsEditingName(true)}
                            className="text-[#8696a0] hover:text-white p-1"
                            title="Edit name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-[#8696a0] truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>

                  {/* +991 Lifetime Virtual Number Banner */}
                  <div className="p-3 bg-[#202c33] rounded-xl border border-[#2e3b44] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-[#00a884]/20 text-[#00a884] rounded-lg flex-shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-[#8696a0] font-medium">Virtual Telephone Line</div>
                        <div className="text-sm font-mono font-bold text-[#00a884] tracking-wide truncate">
                          {user.phoneNumber}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={handleCopyPhone}
                        className="px-2.5 py-1.5 rounded-lg bg-[#111b21] hover:bg-[#2a3942] text-xs text-[#d1d7db] transition flex items-center gap-1 cursor-pointer border border-[#2e3b44]"
                        title="Copy Number"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={() => setShowQR(true)}
                        className="p-1.5 rounded-lg bg-[#111b21] hover:bg-[#2a3942] text-[#d1d7db] transition cursor-pointer border border-[#2e3b44]"
                        title="Show QR Code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* About Bio Section */}
                  <div className="space-y-2 pt-1 border-t border-[#2e3b44]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">About Bio</span>
                      <button
                        onClick={() => setIsEditingAbout(!isEditingAbout)}
                        className="text-xs text-[#00a884] hover:underline"
                      >
                        {isEditingAbout ? 'Done' : 'Edit'}
                      </button>
                    </div>

                    {isEditingAbout ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={about}
                          onChange={(e) => setAbout(e.target.value)}
                          onBlur={() => handleSaveAbout(about)}
                          className="w-full bg-[#202c33] border border-[#00a884] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                          maxLength={120}
                        />
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {statusPresets.map((preset) => (
                            <button
                              key={preset}
                              onClick={() => handleSaveAbout(preset)}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#202c33] hover:bg-[#00a884] hover:text-white text-[#8696a0] transition"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#d1d7db] italic">{user.about || "Hey there! I am using LimoChat."}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                SECTION 2: SECURITY, PASSCODE LOCK & PRIVACY
                ========================================================================= */}
            {shouldShow('security') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00a884]">
                  <Shield className="w-4 h-4" />
                  <span>Security, Passcode & Privacy Protection</span>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4">
                  {/* End-to-End Tunnel Indicator */}
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/20 text-[#00a884] rounded-lg mt-0.5">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <div className="font-semibold text-white">End-to-End Cryptographic Tunnel</div>
                      <p className="text-[#8696a0] mt-0.5 leading-relaxed">
                        Messages, media attachments, and WebRTC calls are encrypted peer-to-peer. Only you and your recipients can listen or read them.
                      </p>
                    </div>
                  </div>

                  {/* Active Sessions & Linked Devices */}
                  <div className="pt-2 border-t border-[#2e3b44] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-[#00a884]" />
                          <span>Active Linked Sessions</span>
                        </div>
                        <div className="text-[11px] text-[#8696a0]">Current browser & connected devices</div>
                      </div>
                      <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] font-semibold px-2 py-0.5 rounded-full border border-[#00a884]/30">
                        {activeSessionsList.length} Active {activeSessionsList.length === 1 ? 'Device' : 'Devices'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {activeSessionsList.map((sess) => {
                        const isMobile = sess.os.includes('Android') || sess.os.includes('iOS') || sess.os.includes('iPhone');
                        return (
                          <div key={sess.id} className="p-2.5 bg-[#202c33] rounded-xl border border-[#2e3b44] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-1.5 bg-[#111b21] rounded-lg text-[#00a884] flex-shrink-0">
                                {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white flex items-center gap-1.5 truncate">
                                  <span>{sess.os} • {sess.browser}</span>
                                  {sess.isCurrent && (
                                    <span className="text-[9px] bg-emerald-500/20 text-[#00a884] px-1.5 py-0.5 rounded-md font-semibold">
                                      This Device
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[#8696a0] flex items-center gap-1 mt-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Active now</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleLogOutOtherSessions}
                        className="text-[11px] text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-bold px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition cursor-pointer border border-red-200 dark:border-red-500/20"
                      >
                        Log out all other devices
                      </button>
                    </div>
                  </div>

                  {/* App Passcode & Biometric Screen Lock */}
                  <div className="pt-2 border-t border-[#2e3b44] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-[#00a884]" />
                          <span>App Passcode & Screen Lock</span>
                          {isAppLockActive && (
                            <span className="text-[9px] bg-[#00a884]/20 text-[#00a884] font-semibold px-1.5 py-0.5 rounded-md border border-[#00a884]/30">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8696a0]">
                          {isAppLockActive 
                            ? `Secured with PIN (Auto-lock: ${autoLockTimeout === 'immediately' ? 'Instant' : autoLockTimeout})` 
                            : 'Require passcode or Touch ID when idle'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowPasscodeModal(true)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
                            isAppLockActive
                              ? 'bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-[#00a884]'
                              : 'bg-[#00a884] hover:bg-[#02906f] text-white'
                          }`}
                        >
                          {isAppLockActive ? 'Manage' : 'Set Up'}
                        </button>
                      </div>
                    </div>

                    {/* Quick Lock Action if Active */}
                    {isAppLockActive && (
                      <div className="flex items-center justify-between bg-[#202c33] p-2.5 rounded-xl border border-[#2e3b44]">
                        <div className="text-xs text-white">Need to step away right now?</div>
                        <button
                          onClick={handleLockNow}
                          className="px-2.5 py-1 bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Lock Now</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Two-Step Verification PIN */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>Two-Step Verification PIN</span>
                        {twoStepEnabled && (
                          <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] font-semibold px-2 py-0.5 rounded-full border border-[#00a884]/30">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8696a0]">
                        {twoStepEnabled ? '6-digit PIN is configured' : 'Require a 6-digit passcode on registration'}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTwoStepModal(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
                        twoStepEnabled 
                          ? 'bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-[#00a884]' 
                          : 'bg-[#00a884] hover:bg-[#02906f] text-white'
                      }`}
                    >
                      {twoStepEnabled ? 'Manage' : 'Enable'}
                    </button>
                  </div>

                  {/* Security Notifications Toggle */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Security Alerts</div>
                      <div className="text-[11px] text-[#8696a0]">Notify when security codes change</div>
                    </div>
                    <button
                      onClick={handleToggleSecurityNotifs}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securityNotifs ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          securityNotifs ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* In-Line Privacy Controls */}
                  <div className="pt-3 border-t border-[#2e3b44] space-y-3">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#00a884]" />
                      <span>In-Line Privacy Controls</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#202c33] p-2.5 rounded-xl border border-[#2e3b44]">
                        <span className="text-[#8696a0] block mb-1">Last Seen & Online</span>
                        <select
                          value={user.privacy?.lastSeen || 'everyone'}
                          onChange={(e) => updatePrivacySettings({ lastSeen: e.target.value as any })}
                          className="w-full bg-[#111b21] border border-[#2e3b44] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="contacts">My Contacts</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>

                      <div className="bg-[#202c33] p-2.5 rounded-xl border border-[#2e3b44]">
                        <span className="text-[#8696a0] block mb-1">Profile Photo</span>
                        <select
                          value={user.privacy?.profilePhoto || 'everyone'}
                          onChange={(e) => updatePrivacySettings({ profilePhoto: e.target.value as any })}
                          className="w-full bg-[#111b21] border border-[#2e3b44] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="contacts">My Contacts</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>

                      <div className="bg-[#202c33] p-2.5 rounded-xl border border-[#2e3b44]">
                        <span className="text-[#8696a0] block mb-1">About Info</span>
                        <select
                          value={user.privacy?.about || 'everyone'}
                          onChange={(e) => updatePrivacySettings({ about: e.target.value as any })}
                          className="w-full bg-[#111b21] border border-[#2e3b44] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="contacts">My Contacts</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>

                      <div className="bg-[#202c33] p-2.5 rounded-xl border border-[#2e3b44]">
                        <span className="text-[#8696a0] block mb-1">Status Updates</span>
                        <select
                          value={user.privacy?.status || 'everyone'}
                          onChange={(e) => updatePrivacySettings({ status: e.target.value as any })}
                          className="w-full bg-[#111b21] border border-[#2e3b44] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="contacts">My Contacts</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>
                    </div>

                    {/* Read Receipts */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-xs font-semibold text-white">Read Receipts</div>
                        <div className="text-[11px] text-[#8696a0]">Show blue checkmarks when messages are read</div>
                      </div>
                      <button
                        onClick={() => updatePrivacySettings({ readReceipts: !user.privacy?.readReceipts })}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          user.privacy?.readReceipts ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            user.privacy?.readReceipts ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Default Disappearing Messages */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-xs font-semibold text-white">Default Disappearing Timer</div>
                        <div className="text-[11px] text-[#8696a0]">Auto-expire new messages</div>
                      </div>
                      <select
                        value={disappearingTimer}
                        onChange={(e) => handleChangeDisappearing(e.target.value)}
                        className="bg-[#202c33] border border-[#2e3b44] rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
                      >
                        <option value="off">Off</option>
                        <option value="24h">24 Hours</option>
                        <option value="7d">7 Days</option>
                        <option value="90d">90 Days</option>
                      </select>
                    </div>

                    {/* Blocked Users Count & Management */}
                    <div className="p-3 bg-[#202c33] rounded-xl border border-[#2e3b44] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white">
                          <Ban className="w-3.5 h-3.5 text-red-400" />
                          <span>Blocked Contacts</span>
                        </div>
                        <span className="text-xs text-[#8696a0]">
                          {(user.blockedUsers || []).length} blocked
                        </span>
                      </div>
                      {(user.blockedUsers || []).length > 0 ? (
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1">
                          {(user.blockedUsers || []).map((uid) => (
                            <div key={uid} className="flex items-center justify-between bg-[#111b21] px-2.5 py-1.5 rounded-lg text-xs">
                              <span className="text-white font-mono truncate max-w-[140px]">{uid}</span>
                              <button
                                onClick={() => unblockUser(uid)}
                                className="text-xs text-[#00a884] hover:underline cursor-pointer"
                              >
                                Unblock
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#8696a0] italic">No blocked contacts.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                SECTION 3: CHATS, THEMES & WALLPAPERS
                ========================================================================= */}
            {shouldShow('chats') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00a884]">
                  <MessageCircle className="w-4 h-4" />
                  <span>Chats, Themes & Wallpapers</span>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4">
                  {/* Theme Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-white block">Display Theme</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => setTheme('dark')}
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition cursor-pointer ${
                          theme === 'dark' 
                            ? 'border-[#00a884] bg-[#00a884]/10 text-white font-semibold' 
                            : 'border-[#2e3b44] bg-[#202c33] text-[#8696a0] hover:text-white'
                        }`}
                      >
                        <Moon className="w-4 h-4 text-emerald-400" />
                        <span>Classic Dark</span>
                      </button>

                      <button
                        onClick={() => setTheme('light')}
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition cursor-pointer ${
                          theme === 'light' 
                            ? 'border-[#00a884] bg-[#00a884]/10 text-white font-semibold' 
                            : 'border-[#2e3b44] bg-[#202c33] text-[#8696a0] hover:text-white'
                        }`}
                      >
                        <Sun className="w-4 h-4 text-amber-400" />
                        <span>Crisp Light</span>
                      </button>
                    </div>
                  </div>

                  {/* Wallpaper Grid */}
                  <div className="pt-2 border-t border-[#2e3b44] space-y-2">
                    <label className="text-xs font-semibold text-white block">Chat Wallpaper</label>
                    <div className="grid grid-cols-3 gap-2">
                      {wallpaperList.map((wp) => (
                        <div
                          key={wp.id}
                          onClick={() => setWallpaper(wp.id)}
                          className={`h-16 rounded-xl border-2 flex items-center justify-center p-2 text-center cursor-pointer transition overflow-hidden relative ${wp.bgClass} ${
                            wallpaper === wp.id ? 'border-[#00a884] ring-2 ring-[#00a884]/40' : 'border-[#2e3b44] hover:border-white/30'
                          }`}
                        >
                          <span className="text-[10px] font-medium text-white drop-shadow-md z-10">{wp.label}</span>
                          {wallpaper === wp.id && (
                            <div className="absolute top-1 right-1 p-0.5 bg-[#00a884] rounded-full text-white">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enter is Send */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Enter is Send</div>
                      <div className="text-[11px] text-[#8696a0]">Pressing Enter sends your message immediately</div>
                    </div>
                    <button
                      onClick={() => setEnterIsSend(!enterIsSend)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        enterIsSend ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          enterIsSend ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Font Size Selector */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Type className="w-3.5 h-3.5 text-[#00a884]" />
                        <span>Chat Font Size</span>
                      </div>
                      <div className="text-[11px] text-[#8696a0]">Adjust text scale inside conversations</div>
                    </div>
                    <select
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value as any)}
                      className="bg-[#202c33] border border-[#2e3b44] rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="sm">Small</option>
                      <option value="base">Medium (Default)</option>
                      <option value="lg">Large</option>
                    </select>
                  </div>

                  {/* Chat Backup, Restore & Clear Data */}
                  <div className="pt-2 border-t border-[#2e3b44] space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-white">Chat Data & Local Storage</div>
                      <div className="text-[11px] text-[#8696a0]">Export, restore or purge cached conversations</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleExportData}
                        className="px-3 py-1.5 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-xs font-semibold text-[#00a884] transition flex items-center gap-1.5 cursor-pointer"
                        title="Download JSON file containing your chats & messages"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Backup</span>
                      </button>

                      <button
                        onClick={() => backupFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-xs font-semibold text-blue-400 transition flex items-center gap-1.5 cursor-pointer"
                        title="Import JSON backup to restore messages and preferences"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Restore from Backup</span>
                      </button>
                      <input
                        type="file"
                        ref={backupFileInputRef}
                        accept=".json"
                        onChange={handleRestoreBackup}
                        className="hidden"
                      />

                      <button
                        onClick={handleClearAllChats}
                        className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 text-xs font-bold text-red-600 dark:text-red-400 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span>Clear All Chats</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                SECTION 4: NOTIFICATIONS & AUDIO
                ========================================================================= */}
            {shouldShow('notifications') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00a884]">
                  <Bell className="w-4 h-4" />
                  <span>Notifications & Sound Alerts</span>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4">
                  {/* Message Sound & Preview */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Message Alert Sound</div>
                      <div className="text-[11px] text-[#8696a0]">Play audio chime on incoming messages</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestMessageTone()}
                        className="p-1.5 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] text-xs transition cursor-pointer"
                        title="Test current message sound"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleToggleMessageSound}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          messageSound ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            messageSound ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Customizable Tone Selector */}
                  <div className="pt-2 border-t border-[#2e3b44] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-[#00a884]" />
                        <span>Incoming Message Tone</span>
                      </div>
                      <span className="text-[10px] text-[#8696a0]">5 Synthesized Tones</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {messageToneList.map((tone) => {
                        const isSelected = messageTone === tone.id;
                        return (
                          <div
                            key={tone.id}
                            onClick={() => handleSelectMessageTone(tone.id)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                              isSelected
                                ? 'bg-[#00a884]/15 border-[#00a884] text-white'
                                : 'bg-[#202c33] border-[#2e3b44] text-[#8696a0] hover:text-white hover:border-[#3b4a54]'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-xs flex items-center gap-1.5 truncate">
                                <span>{tone.label}</span>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                              </div>
                              <div className="text-[10px] text-[#8696a0] truncate">{tone.desc}</div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                soundEngine.playMessageReceived(tone.id);
                              }}
                              className="p-1 rounded-lg bg-[#111b21] hover:bg-[#2a3942] text-[#00a884] transition flex-shrink-0 cursor-pointer"
                              title={`Preview ${tone.label}`}
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ringtone Sound */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Incoming Call Ringtone</div>
                      <div className="text-[11px] text-[#8696a0]">Play ringtone on voice and video calls</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleTestRingtone}
                        className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                          isPlayingRingtoneSample ? 'bg-red-500 text-white' : 'bg-[#202c33] hover:bg-[#2a3942] text-[#00a884]'
                        }`}
                        title="Preview ringtone"
                      >
                        {isPlayingRingtoneSample ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={handleToggleRingtoneSound}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          ringtoneSound ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            ringtoneSound ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* In-App Vibration */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">In-App Vibration</div>
                      <div className="text-[11px] text-[#8696a0]">Haptic feedback on incoming messages & reactions</div>
                    </div>
                    <button
                      onClick={handleToggleInAppVibration}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        inAppVibration ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          inAppVibration ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Reaction Notifications */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Reaction Notifications</div>
                      <div className="text-[11px] text-[#8696a0]">Notify when someone reacts to your messages</div>
                    </div>
                    <button
                      onClick={handleToggleReactionNotifs}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        reactionNotifs ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          reactionNotifs ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* High Priority Alerts */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">High Priority Alerts</div>
                      <div className="text-[11px] text-[#8696a0]">Show urgent preview banners for direct DMs</div>
                    </div>
                    <button
                      onClick={handleToggleHighPriorityNotifs}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        highPriorityNotifs ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          highPriorityNotifs ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Desktop Push Notifications */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Desktop Push Notifications</div>
                      <div className="text-[11px] text-[#8696a0]">Show system banners when browser is in background</div>
                    </div>
                    <button
                      onClick={handleRequestDesktopNotifs}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        desktopNotifs 
                          ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30' 
                          : 'bg-[#202c33] hover:bg-[#2a3942] text-white border border-[#2e3b44]'
                      }`}
                    >
                      {desktopNotifs ? 'Enabled' : 'Allow'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                SECTION 5: STORAGE & DATA MANAGEMENT
                ========================================================================= */}
            {shouldShow('storage') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00a884]">
                  <HardDrive className="w-4 h-4" />
                  <span>Storage Usage & Data Management</span>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4">
                  {/* Dynamic Visual Storage Breakdown Meter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">Browser Storage Usage</span>
                      <span className="text-[#00a884] font-mono font-semibold">
                        ~{formatBytes(storageStats.totalBytes)} Used
                      </span>
                    </div>

                    <div className="h-3 w-full bg-[#202c33] rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-[#00a884] transition-all duration-300" 
                        style={{ width: `${Math.max(15, messagesPct)}%` }} 
                        title={`Messages: ${formatBytes(storageStats.messagesBytes)}`} 
                      />
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300" 
                        style={{ width: `${Math.max(10, mediaPct)}%` }} 
                        title={`Media & Avatars: ${formatBytes(storageStats.mediaBytes)}`} 
                      />
                      <div 
                        className="h-full bg-amber-500 transition-all duration-300" 
                        style={{ width: `${Math.max(15, cachePct)}%` }} 
                        title={`Cache: ${formatBytes(storageStats.cacheBytes)}`} 
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#8696a0] pt-1">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#00a884]" /> 
                        Messages ({formatBytes(storageStats.messagesBytes)})
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> 
                        Media ({formatBytes(storageStats.mediaBytes)})
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> 
                        Temp Cache ({formatBytes(storageStats.cacheBytes)})
                      </span>
                    </div>
                  </div>

                  {/* Clear Cache Button */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Local Cache & Media Buffers</div>
                      <div className="text-[11px] text-[#8696a0]">Free up disk space without deleting chat messages</div>
                    </div>
                    <button
                      onClick={handleClearCache}
                      className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs transition border border-red-200 dark:border-red-500/20 cursor-pointer"
                    >
                      Clear Cache
                    </button>
                  </div>

                  {/* Low Data Usage for Calls */}
                  <div className="pt-2 border-t border-[#2e3b44] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Low Data Usage for Calls</div>
                      <div className="text-[11px] text-[#8696a0]">Optimize WebRTC bandwidth on metered networks</div>
                    </div>
                    <button
                      onClick={handleToggleLowDataCalls}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        lowDataCalls ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          lowDataCalls ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                SECTION 6: LANGUAGE & TRANSLATION
                ========================================================================= */}
            {shouldShow('language') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00a884]">
                  <Globe className="w-4 h-4" />
                  <span>Language & Real-Time Translation</span>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-white block mb-1.5">App Interface Language</label>
                      <select
                        value={appLanguage}
                        onChange={(e) => handleSaveLanguageSettings(translateTargetLanguage, e.target.value)}
                        className="w-full bg-[#202c33] border border-[#2e3b44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.nativeName} ({lang.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white block mb-1.5">Auto-Translate Target</label>
                      <select
                        value={translateTargetLanguage}
                        onChange={(e) => handleSaveLanguageSettings(e.target.value, appLanguage)}
                        className="w-full bg-[#202c33] border border-[#2e3b44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.nativeName} ({lang.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Live Translation Test Utility */}
                  <div className="p-3 bg-[#202c33] rounded-xl border border-[#2e3b44] space-y-2">
                    <span className="text-xs font-semibold text-white block">Test Real-Time Translation:</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        className="flex-1 bg-[#111b21] border border-[#2e3b44] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                        placeholder="Type text to test translation..."
                      />
                      <button
                        onClick={handleTestTranslation}
                        disabled={testingTranslation}
                        className="px-3 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        {testingTranslation ? "..." : "Translate"}
                      </button>
                    </div>
                    {testTranslated && (
                      <p className="text-xs text-emerald-400 font-medium pt-1">
                        Result: {testTranslated}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                SECTION 7: LEGAL, POLICIES & COMPLIANCE
                ========================================================================= */}
            {shouldShow('legal') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00a884]">
                  <FileText className="w-4 h-4" />
                  <span>Legal, Policies & Operations</span>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-3">
                  {/* Full-Page Privacy Policy Button */}
                  <button
                    onClick={() => setShowPolicy(true)}
                    className="w-full p-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] flex items-center justify-between transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#00a884]" />
                      <div>
                        <div className="text-xs font-semibold text-white">Full Privacy Policy</div>
                        <div className="text-[10px] text-[#8696a0]">Zero-knowledge standards, WebRTC & GDPR data rights</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8696a0]" />
                  </button>

                  {/* Full-Page Terms of Service Button */}
                  <button
                    onClick={() => setShowTerms(true)}
                    className="w-full p-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] flex items-center justify-between transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">Terms of Service & User Agreement</div>
                        <div className="text-[10px] text-[#8696a0]">Acceptable use, +991 rules & zero tolerance abuse sanctions</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8696a0]" />
                  </button>

                  {/* System Operational Status */}
                  <button
                    onClick={() => setShowStatus(true)}
                    className="w-full p-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] flex items-center justify-between transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">Operational Network Health</div>
                        <div className="text-[10px] text-[#8696a0]">Live WebRTC gateway, Firestore & signaling pulse</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8696a0]" />
                  </button>

                  {/* Official Support Channel */}
                  <button
                    onClick={handleContactSupportForNumber}
                    className="w-full p-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] flex items-center justify-between transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Headphones className="w-4 h-4 text-[#00a884]" />
                      <div>
                        <div className="text-xs font-semibold text-white">Contact Official LimoChat Support</div>
                        <div className="text-[10px] text-[#8696a0]">Direct 24/7 support channel for appeals & assistance</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8696a0]" />
                  </button>

                  {/* Admin Compliance Desk (VISIBLE TO ADMINS ONLY) */}
                  {isAdmin && (
                    <button
                      onClick={() => setShowAdminPortal(true)}
                      className="w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-between transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <div>
                          <div className="text-xs font-semibold text-amber-400">Admin Safety & Moderation Desk</div>
                          <div className="text-[10px] text-[#8696a0]">Review reported incidents, sanction approvals & audit logs</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-400" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* WhatsApp-Style App Info & Dynamic Version Card */}
            <div className="p-4 rounded-2xl bg-[#202c33]/70 border border-[#2e3b44] flex flex-col items-center justify-center text-center space-y-2 select-none shadow-inner">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#005c4b] to-[#00a884] flex items-center justify-center shadow-md">
                  <MessageCircle className="w-3.5 h-3.5 text-white fill-white" />
                </div>
                <span className="text-xs font-bold text-white tracking-wide">LimoChat for Android</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-400">
                  Version {appVersionData.version}
                </span>
                <span className="text-[10px] text-[#8696a0] font-mono">
                  (Build {appVersionData.buildNumber})
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-[#8696a0]">
                <Lock className="w-3 h-3 text-[#00a884]" />
                <span>End-to-End Encrypted • Private & Secure</span>
              </div>

              {/* Admin shortcut to change version */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setAdminPortalInitialTab('version');
                    setShowAdminPortal(true);
                  }}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[11px] font-semibold text-amber-400 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Change Version in Admin Portal</span>
                </button>
              )}
            </div>

            {/* Sign Out Button */}
            <div className="pt-2">
              <button
                onClick={signOut}
                className="w-full py-3 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer border border-red-200 dark:border-red-500/20 shadow-sm"
              >
                <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span>Log Out of LimoChat</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modals for focused tasks */}
      {showAvatarEditor && (
        <AvatarEditorModal
          isOpen={showAvatarEditor}
          currentUser={user}
          onClose={() => setShowAvatarEditor(false)}
          onSaveAvatar={handleSaveAvatar}
        />
      )}

      {showTwoStepModal && (
        <TwoStepModal
          isOpen={showTwoStepModal}
          onClose={() => setShowTwoStepModal(false)}
          currentUser={user}
          onSaveTwoStep={handleSaveTwoStep}
          onDisableTwoStep={handleDisableTwoStep}
        />
      )}

      {showPasscodeModal && (
        <PasscodeModal
          isOpen={showPasscodeModal}
          currentUser={user}
          onClose={() => setShowPasscodeModal(false)}
          onSavePasscode={handleSavePasscode}
          onDisablePasscode={handleDisablePasscode}
          onLockNow={handleLockNow}
        />
      )}

      {showQR && (
        <QRCodeModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          user={user}
        />
      )}

      {showPolicy && (
        <PrivacyPolicyModal
          isOpen={showPolicy}
          onClose={() => setShowPolicy(false)}
        />
      )}

      {showTerms && (
        <TermsConditionsModal
          isOpen={showTerms}
          onClose={() => setShowTerms(false)}
        />
      )}

      {showStatus && (
        <OperationalStatusModal
          isOpen={showStatus}
          onClose={() => setShowStatus(false)}
        />
      )}

      {showWhatsNew && (
        <WhatsNewModal
          isOpen={showWhatsNew}
          onClose={() => setShowWhatsNew(false)}
        />
      )}

      {showAdminPortal && (
        <AdminPortalModal
          isOpen={showAdminPortal}
          onClose={() => setShowAdminPortal(false)}
          initialTab={adminPortalInitialTab}
        />
      )}

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmText={confirmConfig.confirmText}
          cancelText={confirmConfig.cancelText}
          variant={confirmConfig.variant}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </>
  );
};
