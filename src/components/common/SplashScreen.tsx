import React, { useEffect, useState } from 'react';
import { Lock, Sparkles, MessageSquare } from 'lucide-react';
import { getCachedAppVersion, subscribeToAppVersion, AppVersionData } from '../../utils/versionConfig';

interface SplashScreenProps {
  onFinish?: () => void;
  minDisplayTimeMs?: number;
  fadeOutDurationMs?: number;
  isReady?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDisplayTimeMs = 1800,
  fadeOutDurationMs = 500,
  isReady = true,
}) => {
  const [versionData, setVersionData] = useState<AppVersionData>(getCachedAppVersion);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Subscribe to real-time version from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToAppVersion((data) => {
      setVersionData(data);
    });
    return () => unsubscribe();
  }, []);

  // Guarantee minimum display time for smooth WhatsApp branding experience
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDisplayTimeMs);
    return () => clearTimeout(timer);
  }, [minDisplayTimeMs]);

  // When both minTime has elapsed and app is ready, initiate smooth fade out
  useEffect(() => {
    if (minTimeElapsed && isReady && !isFadingOut) {
      setIsFadingOut(true);
      const removeTimer = setTimeout(() => {
        setIsMounted(false);
        if (onFinish) onFinish();
      }, fadeOutDurationMs);
      return () => clearTimeout(removeTimer);
    }
  }, [minTimeElapsed, isReady, isFadingOut, fadeOutDurationMs, onFinish]);

  if (!isMounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-between select-none transition-opacity duration-500 pointer-events-auto bg-[#111b21] text-white ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        // Supports safe area padding for modern Android and iOS devices
        paddingTop: 'env(safe-area-inset-top, 24px)',
        paddingBottom: 'env(safe-area-inset-bottom, 32px)',
      }}
    >
      {/* Top spacer */}
      <div className="w-full h-12" />

      {/* Center: Iconic WhatsApp-Style LimoChat Brand Emblem */}
      <div className="flex flex-col items-center justify-center -mt-6">
        {/* Glowing Logo Container */}
        <div className="relative group">
          {/* Ambient Glow Aura */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-[#00a884]/30 to-[#005c4b]/10 rounded-3xl blur-xl animate-pulse" />
          
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#005c4b] via-[#00a884] to-[#25d366] p-0.5 shadow-2xl shadow-[#00a884]/30 transform transition-transform hover:scale-105 duration-300">
            <div className="w-full h-full rounded-[22px] bg-[#111b21] flex flex-col items-center justify-center overflow-hidden relative">
              {/* Subtle glossy glass reflection */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              
              {/* LimoChat emblem */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00a884] to-[#25d366] flex items-center justify-center shadow-inner">
                <MessageSquare className="w-7 h-7 text-white fill-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Brand App Name */}
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
          <span>LimoChat</span>
          <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
        </h1>

        {/* WhatsApp-style indeterminate progress bar */}
        <div className="mt-6 w-36 h-[2.5px] bg-[#202c33] rounded-full overflow-hidden relative shadow-inner">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#00a884] to-[#25d366] w-1/2 rounded-full animate-progress-indeterminate" />
        </div>
      </div>

      {/* Bottom: WhatsApp "from LIMO" signature branding & Dynamic Version */}
      <div className="flex flex-col items-center justify-center space-y-2 pb-4 text-center">
        {/* End to End Encryption indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8696a0] bg-[#202c33]/70 px-3 py-1 rounded-full border border-white/5 backdrop-blur-md shadow-sm">
          <Lock className="w-3 h-3 text-[#00a884]" />
          <span>End-to-end encrypted</span>
        </div>

        {/* WhatsApp-Style 'from' branding */}
        <div className="flex flex-col items-center pt-1">
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#8696a0] font-semibold">from</span>
          <span className="text-sm font-extrabold tracking-[0.22em] bg-gradient-to-r from-[#00a884] to-[#25d366] bg-clip-text text-transparent">
            LIMO
          </span>
        </div>

        {/* Dynamic App Version from Admin Portal */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#202c33]/50 text-[11px] font-mono font-medium text-emerald-400 border border-emerald-500/20">
          <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
          <span>v{versionData.version}</span>
          {versionData.buildNumber ? (
            <span className="text-[9px] text-[#8696a0]">({versionData.buildNumber})</span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
