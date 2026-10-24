import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  PhoneCall, 
  Camera, 
  Mic, 
  ShieldCheck, 
  X, 
  Check, 
  Loader2,
  Sparkles,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { NativeNotificationService } from '../../utils/nativeNotifications';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';
import { useAuth } from '../../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

interface PermissionPromptModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

type PermStatus = 'idle' | 'checking' | 'granted' | 'denied' | 'requesting';

export const PermissionPromptModal: React.FC<PermissionPromptModalProps> = ({ 
  forceOpen = false, 
  onClose 
}) => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [activeStepText, setActiveStepText] = useState<string>('');

  const [notifStatus, setNotifStatus] = useState<PermStatus>('checking');
  const [micStatus, setMicStatus] = useState<PermStatus>('checking');
  const [cameraStatus, setCameraStatus] = useState<PermStatus>('checking');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Probe existing permission state natively
  const checkCurrentPermissions = useCallback(async () => {
    // 1. Check Notifications
    try {
      if (Capacitor.isNativePlatform()) {
        const lperm = await LocalNotifications.checkPermissions();
        setNotifStatus(lperm.display === 'granted' ? 'granted' : 'idle');
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifStatus(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'idle');
      } else {
        setNotifStatus('idle');
      }
    } catch {
      setNotifStatus('idle');
    }

    // 2. Check Microphone
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const p = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicStatus(p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'idle');
      } else {
        setMicStatus('idle');
      }
    } catch {
      setMicStatus('idle');
    }

    // 3. Check Camera
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const p = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraStatus(p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'idle');
      } else {
        setCameraStatus('idle');
      }
    } catch {
      setCameraStatus('idle');
    }
  }, []);

  useEffect(() => {
    checkCurrentPermissions();

    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    const dismissed = localStorage.getItem('limochat_perm_prompt_dismissed');
    if (dismissed === 'true') {
      return;
    }

    // If notifications are already granted, don't auto-popup on every load
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      return;
    }

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 2200);

    return () => clearTimeout(timer);
  }, [forceOpen, checkCurrentPermissions]);

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (notifStatus === 'granted') return true;
    try {
      setNotifStatus('requesting');
      if (Capacitor.isNativePlatform()) {
        await NativeNotificationService.init();
        const lres = await LocalNotifications.requestPermissions();
        const ok = lres.display === 'granted';
        try {
          const pres = await PushNotifications.requestPermissions();
          if (pres.receive === 'granted') {
            await PushNotifications.register().catch(() => {});
          }
        } catch {}
        setNotifStatus(ok ? 'granted' : 'denied');
        return ok;
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        const res = await Notification.requestPermission();
        const ok = res === 'granted';
        setNotifStatus(ok ? 'granted' : 'denied');
        return ok;
      }
      return false;
    } catch {
      setNotifStatus('denied');
      return false;
    }
  };

  const requestMicrophonePermission = async (): Promise<boolean> => {
    if (micStatus === 'granted') return true;
    try {
      setMicStatus('requesting');
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        stream.getTracks().forEach((t) => t.stop());
        setMicStatus('granted');
        return true;
      }
      setMicStatus('denied');
      return false;
    } catch {
      setMicStatus('denied');
      return false;
    }
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    if (cameraStatus === 'granted') return true;
    try {
      setCameraStatus('requesting');
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        stream.getTracks().forEach((t) => t.stop());
        setCameraStatus('granted');
        return true;
      }
      setCameraStatus('denied');
      return false;
    } catch {
      setCameraStatus('denied');
      return false;
    }
  };

  // Master Action: sequentially enable missing permissions one-by-one, skipping already enabled ones
  const handleEnableAllPermissions = async () => {
    try {
      setIsProcessingAll(true);
      setSuccessNotice(null);

      // Step 1: Notifications
      if (notifStatus !== 'granted') {
        setActiveStepText('Requesting notifications & background alerts...');
        await requestNotificationPermission();
        await new Promise((r) => setTimeout(r, 400));
      }

      // Step 2: Microphone
      if (micStatus !== 'granted') {
        setActiveStepText('Requesting microphone access for HD audio...');
        await requestMicrophonePermission();
        await new Promise((r) => setTimeout(r, 400));
      }

      // Step 3: Camera
      if (cameraStatus !== 'granted') {
        setActiveStepText('Requesting HD camera for video calls...');
        await requestCameraPermission();
        await new Promise((r) => setTimeout(r, 400));
      }

      // Save FCM Token if native
      const token = NativeNotificationService.getFcmToken();
      if (token && currentUser?.uid) {
        await RealtimeCoordinator.saveFcmToken(currentUser.uid, token).catch(() => {});
      }

      setActiveStepText('');
      setSuccessNotice('All available permissions configured successfully!');
      localStorage.setItem('limochat_perm_prompt_dismissed', 'true');

      setTimeout(() => {
        setIsOpen(false);
        if (onClose) onClose();
      }, 1800);
    } catch (err) {
      console.warn('Error in permission setup:', err);
      setActiveStepText('');
      setIsOpen(false);
      if (onClose) onClose();
    } finally {
      setIsProcessingAll(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('limochat_perm_prompt_dismissed', 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  const allGranted = notifStatus === 'granted' && micStatus === 'granted' && cameraStatus === 'granted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-[#1f2c34] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in">
        {/* Close Button */}
        {!isProcessingAll && (
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 rounded-full text-[#8696a0] hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884] shadow-lg shadow-[#00a884]/15 flex-shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              Device Permissions
            </h2>
            <p className="text-xs text-[#00a884] font-medium">
              Native High-Priority Calls & Push Alerts
            </p>
          </div>
        </div>

        <p className="text-xs text-[#8696a0] leading-relaxed">
          Allow permissions to ensure your phone rings for incoming voice/video calls and displays instant messages even when locked or running in the background.
        </p>

        {/* Sequential Permission Items */}
        <div className="space-y-2.5 pt-1">
          {/* 1. Notifications */}
          <div className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
            notifStatus === 'granted' 
              ? 'bg-[#00a884]/10 border-[#00a884]/30' 
              : notifStatus === 'denied'
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-[#111b21] border-white/5'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-[#00a884] flex-shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">Push Notifications & Ringing</div>
                <div className="text-[11px] text-[#8696a0] truncate mt-0.5">
                  {notifStatus === 'granted' ? 'High-priority alerts enabled' : 'Full-screen incoming call banner'}
                </div>
              </div>
            </div>

            {notifStatus === 'granted' ? (
              <span className="text-[11px] font-semibold text-[#00a884] bg-[#00a884]/20 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>Granted</span>
              </span>
            ) : notifStatus === 'requesting' ? (
              <Loader2 className="w-4 h-4 text-[#00a884] animate-spin flex-shrink-0" />
            ) : (
              <button
                type="button"
                onClick={requestNotificationPermission}
                disabled={isProcessingAll}
                className="px-3 py-1 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-xs font-semibold text-white border border-[#2e3b44] transition cursor-pointer flex-shrink-0"
              >
                Allow
              </button>
            )}
          </div>

          {/* 2. Microphone */}
          <div className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
            micStatus === 'granted' 
              ? 'bg-[#00a884]/10 border-[#00a884]/30' 
              : micStatus === 'denied'
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-[#111b21] border-white/5'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 flex-shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">Microphone Access</div>
                <div className="text-[11px] text-[#8696a0] truncate mt-0.5">
                  {micStatus === 'granted' ? '48kHz studio audio active' : 'Voice messages and VoIP calls'}
                </div>
              </div>
            </div>

            {micStatus === 'granted' ? (
              <span className="text-[11px] font-semibold text-[#00a884] bg-[#00a884]/20 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>Granted</span>
              </span>
            ) : micStatus === 'requesting' ? (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
            ) : (
              <button
                type="button"
                onClick={requestMicrophonePermission}
                disabled={isProcessingAll}
                className="px-3 py-1 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-xs font-semibold text-white border border-[#2e3b44] transition cursor-pointer flex-shrink-0"
              >
                Allow
              </button>
            )}
          </div>

          {/* 3. Camera */}
          <div className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
            cameraStatus === 'granted' 
              ? 'bg-[#00a884]/10 border-[#00a884]/30' 
              : cameraStatus === 'denied'
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-[#111b21] border-white/5'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 flex-shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">Camera (Front & Back)</div>
                <div className="text-[11px] text-[#8696a0] truncate mt-0.5">
                  {cameraStatus === 'granted' ? 'HD video streaming active' : 'Video calls and status stories'}
                </div>
              </div>
            </div>

            {cameraStatus === 'granted' ? (
              <span className="text-[11px] font-semibold text-[#00a884] bg-[#00a884]/20 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>Granted</span>
              </span>
            ) : cameraStatus === 'requesting' ? (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
            ) : (
              <button
                type="button"
                onClick={requestCameraPermission}
                disabled={isProcessingAll}
                className="px-3 py-1 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-xs font-semibold text-white border border-[#2e3b44] transition cursor-pointer flex-shrink-0"
              >
                Allow
              </button>
            )}
          </div>
        </div>

        {/* Real-time processing label */}
        {activeStepText && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
            <Loader2 className="w-3.5 h-3.5 text-[#00a884] animate-spin flex-shrink-0" />
            <span className="text-[11px] text-[#8696a0]">{activeStepText}</span>
          </div>
        )}

        {/* Success Banner */}
        {successNotice && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-[#00a884] flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Master Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={handleEnableAllPermissions}
            disabled={isProcessingAll || allGranted}
            className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-[#00a884]/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isProcessingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enabling Missing Permissions...</span>
              </>
            ) : allGranted ? (
              <>
                <Check className="w-4 h-4" />
                <span>All Permissions Active</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Enable All Permissions</span>
              </>
            )}
          </button>

          {!isProcessingAll && (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full sm:w-auto py-2.5 px-4 rounded-2xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer hover:bg-white/5"
            >
              {allGranted ? 'Close' : 'Maybe Later'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
