import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  PhoneCall, 
  Camera, 
  Mic, 
  ShieldCheck, 
  Sparkles, 
  X, 
  Check, 
  Layers,
  BatteryCharging 
} from 'lucide-react';
import { NativeNotificationService } from '../../utils/nativeNotifications';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';
import { useAuth } from '../../context/AuthContext';
import { Capacitor } from '@capacitor/core';

interface PermissionPromptModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const PermissionPromptModal: React.FC<PermissionPromptModalProps> = ({ 
  forceOpen = false, 
  onClose 
}) => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [grantedState, setGrantedState] = useState<{
    notifications: boolean;
    camera: boolean;
    microphone: boolean;
  }>({ notifications: false, camera: false, microphone: false });
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    // Check if user has already granted or dismissed previously
    const dismissed = localStorage.getItem('limochat_perm_prompt_dismissed');
    if (dismissed === 'true') {
      return;
    }

    // If notifications are already granted on web or native, don't nag
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      return;
    }

    // Slight delay so the user first sees the app interface cleanly
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [forceOpen]);

  const handleGrantPermissions = async () => {
    try {
      setIsRequesting(true);
      const res = await NativeNotificationService.requestAllPermissions();
      setGrantedState(res);

      // Save FCM token if available
      const fcmToken = NativeNotificationService.getFcmToken();
      if (fcmToken && currentUser?.uid) {
        await RealtimeCoordinator.saveFcmToken(currentUser.uid, fcmToken);
      }

      setSuccessNotice("Permissions configured! Background call alerts & messages active.");
      localStorage.setItem('limochat_perm_prompt_dismissed', 'true');

      setTimeout(() => {
        setIsOpen(false);
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.warn("Permission request error:", err);
      setIsOpen(false);
      if (onClose) onClose();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('limochat_perm_prompt_dismissed', 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-[#1f2c34] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-full text-[#8696a0] hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Branding and Shield Icon */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884] shadow-lg shadow-[#00a884]/15">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Enable Calls & Notifications
            </h2>
            <p className="text-xs text-[#00a884] font-medium">
              High-Priority WhatsApp-Grade Alerts
            </p>
          </div>
        </div>

        <p className="text-xs text-[#8696a0] leading-relaxed">
          To receive incoming audio and video calls and urgent messages when LimoChat is in the background or your device screen is locked, please allow the following permissions:
        </p>

        {/* Feature Permissions List */}
        <div className="space-y-2.5 pt-1">
          {/* Incoming Call & Full-Screen Alerts */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#111b21] border border-white/5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-[#00a884] flex-shrink-0 mt-0.5">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">Full-Screen Call Alerts & Ringing</div>
              <div className="text-[11px] text-[#8696a0] leading-tight mt-0.5">
                Displays incoming call heads-up screen over other apps and on lock screen.
              </div>
            </div>
          </div>

          {/* Messages & Status Notifications */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#111b21] border border-white/5">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 flex-shrink-0 mt-0.5">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">Chat Messages & Status Stories</div>
              <div className="text-[11px] text-[#8696a0] leading-tight mt-0.5">
                Instant vibration and notifications when contacts message or share stories.
              </div>
            </div>
          </div>

          {/* Microphone & Camera */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#111b21] border border-white/5">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 flex-shrink-0 mt-0.5">
              <div className="flex items-center gap-1">
                <Mic className="w-3.5 h-3.5" />
                <Camera className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">Microphone & HD Camera</div>
              <div className="text-[11px] text-[#8696a0] leading-tight mt-0.5">
                Enables clear 48kHz noise-cancelled audio and front/rear camera flipping.
              </div>
            </div>
          </div>
        </div>

        {/* Success feedback */}
        {successNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-[#00a884] flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={handleGrantPermissions}
            disabled={isRequesting}
            className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-[#00a884]/25 flex items-center justify-center gap-2"
          >
            {isRequesting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Enable All Permissions</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto py-2.5 px-4 rounded-2xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer hover:bg-white/5"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
