import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CallProvider, useCall } from './context/CallContext';
import { LoginModal } from './components/auth/LoginModal';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatWindow } from './components/chat/ChatWindow';
import { IncomingCallModal } from './components/calls/IncomingCallModal';
import { ActiveCallModal } from './components/calls/ActiveCallModal';
import { OnboardingModal } from './components/auth/OnboardingModal';
import { SuspensionScreen } from './components/common/SuspensionScreen';
import { AppLockScreen } from './components/auth/AppLockScreen';
import { SplashScreen } from './components/common/SplashScreen';
import { MessageSquare, Lock, ShieldCheck, Sparkles, Ban } from 'lucide-react';
import { NativeNotificationService } from './utils/nativeNotifications';

const MainLayout: React.FC = () => {
  const { currentUser, loading, signOut, isAdmin } = useAuth();
  const { activeChat, setActiveChat } = useChat();
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');
  const [splashFinished, setSplashFinished] = useState(false);

  // Initialize native push and local notifications on start
  useEffect(() => {
    NativeNotificationService.init();
  }, []);

  // App Passcode Lock state & active enforcement
  const isLockConfigured = !!currentUser?.preferences?.appLockEnabled && !!currentUser?.preferences?.appLockPin;
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    if (!currentUser?.preferences?.appLockEnabled || !currentUser?.preferences?.appLockPin) return false;
    return sessionStorage.getItem(`limochat_unlocked_${currentUser.uid}`) !== 'true';
  });

  // Listen for manual lock trigger from Settings
  useEffect(() => {
    const handleManualLock = () => {
      if (currentUser?.uid) {
        sessionStorage.removeItem(`limochat_unlocked_${currentUser.uid}`);
      }
      setIsAppLocked(true);
    };
    window.addEventListener('limochat_lock_now', handleManualLock);
    return () => window.removeEventListener('limochat_lock_now', handleManualLock);
  }, [currentUser?.uid]);

  // Handle auto-lock on idle or timeout
  useEffect(() => {
    if (!isLockConfigured || isAppLocked || !currentUser?.uid) return;

    const timeoutSetting = currentUser.preferences?.appLockTimeout || '1m';
    if (timeoutSetting === 'immediately') {
      const handleBlur = () => {
        sessionStorage.removeItem(`limochat_unlocked_${currentUser.uid}`);
        setIsAppLocked(true);
      };
      window.addEventListener('blur', handleBlur);
      return () => window.removeEventListener('blur', handleBlur);
    }

    const timeoutMs = timeoutSetting === '1m' ? 60000 : timeoutSetting === '15m' ? 15 * 60000 : 60 * 60000;
    let timer: any = null;

    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.removeItem(`limochat_unlocked_${currentUser.uid}`);
        setIsAppLocked(true);
      }, timeoutMs);
    };

    resetIdleTimer();
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer));

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
    };
  }, [isLockConfigured, isAppLocked, currentUser?.uid, currentUser?.preferences?.appLockTimeout]);

  // Auto-switch to chat view on mobile when an active chat is selected
  React.useEffect(() => {
    if (activeChat) {
      setMobileView('chat');
    }
  }, [activeChat]);

  if (loading) {
    return <SplashScreen isReady={false} minDisplayTimeMs={1800} />;
  }

  if (!currentUser) {
    return (
      <>
        {!splashFinished && (
          <SplashScreen isReady={true} onFinish={() => setSplashFinished(true)} />
        )}
        <LoginModal />
      </>
    );
  }

  // Administrators CANNOT be suspended or banned
  const isSuspendedActive = !isAdmin && currentUser.punishment?.isSuspended && (
    currentUser.punishment.suspensionType === 'permanent' ||
    (currentUser.punishment.suspendedUntil ? currentUser.punishment.suspendedUntil > Date.now() : true)
  );

  if (!isAdmin && (currentUser.isBanned || isSuspendedActive)) {
    return <SuspensionScreen currentUser={currentUser} onSignOut={signOut} />;
  }

  // App Passcode Lock Screen
  if (isLockConfigured && isAppLocked) {
    return (
      <AppLockScreen
        currentUser={currentUser}
        onUnlock={() => {
          sessionStorage.setItem(`limochat_unlocked_${currentUser.uid}`, 'true');
          setIsAppLocked(false);
        }}
        onSignOut={signOut}
      />
    );
  }

  return (
    <>
      {!splashFinished && (
        <SplashScreen isReady={true} onFinish={() => setSplashFinished(true)} />
      )}
      <div className="h-screen w-screen flex bg-[#111b21] overflow-hidden app-layout-root">
      {/* Sidebar: Visible on desktop, or on mobile when mobileView is 'sidebar' */}
      <div
        className={`h-full ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex w-full md:w-auto'
        }`}
      >
        <Sidebar
          onSelectChat={() => {
            setMobileView('chat');
          }}
        />
      </div>

      {/* Chat Area: Visible on desktop, or on mobile when mobileView is 'chat' */}
      <div
        className={`flex-1 h-full flex flex-col ${
          mobileView === 'sidebar' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeChat ? (
          <ChatWindow
            onBack={() => {
              setActiveChat(null);
              setMobileView('sidebar');
            }}
          />
        ) : (
          /* Desktop Empty State (WhatsApp Web Style) */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35]/30 border-l border-[#222e35] p-8 text-center select-none whatsapp-bg">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#005c4b] to-[#00a884] flex items-center justify-center shadow-2xl mb-6 shadow-[#00a884]/20 animate-fade-in">
              <MessageSquare className="w-12 h-12 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              LimoChat for Web & Desktop
            </h2>

            <p className="text-sm text-[#8696a0] max-w-md leading-relaxed mb-8">
              Send and receive messages with WhatsApp-grade privacy. Connect using your private <strong className="text-[#00a884] font-mono">+991</strong> virtual number, host HD audio/video group calls, and organize communities.
            </p>

            <div className="flex items-center gap-2 text-xs text-[#8696a0] border border-[#2e3b44] bg-[#111b21] px-4 py-2 rounded-full shadow-sm">
              <Lock className="w-3.5 h-3.5 text-[#00a884]" />
              <span>End-to-End Encrypted Peer-to-Peer Calls & Messages</span>
            </div>
          </div>
        )}
      </div>

      {/* Global In-Call Modals */}
      <IncomingCallModal />
      <ActiveCallModal />

      {/* First-time Onboarding Flow */}
      <OnboardingModal
        isOpen={!currentUser?.isOnboarded && !localStorage.getItem(`limochat_onboarded_${currentUser?.uid}`)}
        onComplete={() => {}}
      />
    </div>
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <CallProvider>
          <MainLayout />
        </CallProvider>
      </ChatProvider>
    </AuthProvider>
  );
}
