import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, LogOut, Mail, RefreshCw, AlertTriangle, ShieldCheck, Headphones } from 'lucide-react';
import { UserProfile } from '../../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { AppealSupportModal } from './AppealSupportModal';

interface SuspensionScreenProps {
  currentUser: UserProfile;
  onSignOut: () => void;
}

export const SuspensionScreen: React.FC<SuspensionScreenProps> = ({ currentUser, onSignOut }) => {
  const punishment = currentUser.punishment;
  const isTemporary = punishment?.suspensionType === 'temporary';
  const suspendedUntil = punishment?.suspendedUntil || 0;
  const userEmail = (currentUser?.email || '').toLowerCase().trim();
  const isPotentialAdmin = 
    currentUser.isAdmin === true || 
    userEmail === 'saeed.samadelivery@gmail.com';

  const [isLifting, setIsLifting] = useState(false);
  const [showAppealChat, setShowAppealChat] = useState(false);

  const handleAdminRestore = async () => {
    try {
      setIsLifting(true);
      if (currentUser.uid) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          punishment: null,
          isBanned: false,
          isAdmin: true
        });
      }
      window.location.reload();
    } catch (err) {
      console.warn("Failed to lift admin ban:", err);
      window.location.reload();
    }
  };

  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(() => {
    if (!isTemporary || !suspendedUntil) return 0;
    return Math.max(0, Math.floor((suspendedUntil - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!isTemporary || !suspendedUntil) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((suspendedUntil - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isTemporary, suspendedUntil]);

  const formatTimer = (totalSec: number) => {
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    if (days > 0) {
      return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const isExpired = isTemporary && timeLeftSeconds <= 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a] flex items-center justify-center p-4 suspension-screen-root">
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial from-red-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-[#202c33]/90 backdrop-blur-2xl border border-red-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl animate-scale-in suspension-card">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 shadow-lg">
          {isTemporary ? <Clock className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
          {isTemporary ? "Account Temporarily Suspended" : "Account Permanently Suspended"}
        </h2>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-[#8696a0] mb-5">
          {isTemporary
            ? "Your access to LimoChat has been temporarily paused due to community policy violations."
            : "Your LimoChat account and assigned virtual line have been permanently deactivated."}
        </p>

        {/* Live Timer if Temporary */}
        {isTemporary && (
          <div className="bg-[#111b21] border border-[#2e3b44] rounded-2xl p-4 mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8696a0] mb-1">
              {isExpired ? "Suspension Status" : "Time Remaining Until Unban"}
            </div>
            {isExpired ? (
              <div className="text-emerald-400 font-bold text-base flex items-center justify-center gap-2">
                <span>Suspension period elapsed</span>
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-mono font-bold text-amber-400 tracking-wider">
                {formatTimer(timeLeftSeconds)}
              </div>
            )}
          </div>
        )}

        {/* Reason Box */}
        <div className="bg-[#182229] border border-[#2e3b44] rounded-2xl p-4 text-left mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Violation Reason</span>
          </div>
          <p className="text-xs text-[#e9edef] leading-relaxed">
            {punishment?.reason || "Violation of LimoChat Terms of Service and Community Guidelines."}
          </p>
          <div className="text-[10px] text-[#8696a0] mt-2 pt-2 border-t border-[#2e3b44]">
            Enforced by Safety & Compliance Desk • {new Date(punishment?.appliedAt || Date.now()).toLocaleDateString()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {isPotentialAdmin && (
            <button
              type="button"
              disabled={isLifting}
              onClick={handleAdminRestore}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-[#00a884] hover:from-emerald-500 hover:to-[#02906f] text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 mb-1"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>{isLifting ? 'Restoring Admin Access...' : 'Admin Override: Lift Suspension & Enter'}</span>
            </button>
          )}

          {isExpired ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#00a884] hover:bg-[#02906f] text-white font-semibold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh & Resume Account</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAppealChat(true)}
              className="w-full py-3 bg-[#233138] hover:bg-[#2a3942] text-white font-semibold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer border border-[#2e3b44] shadow-md"
            >
              <Headphones className="w-4 h-4 text-[#00a884]" />
              <span>Submit Appeal to Support</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-2.5 text-gray-700 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs sm:text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* In-App Support Appeal Chat Channel */}
      {showAppealChat && (
        <AppealSupportModal
          isOpen={showAppealChat}
          onClose={() => setShowAppealChat(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
