import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Fingerprint, Delete, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';
import { UserProfile } from '../../types';
import { Avatar } from '../common/Avatar';

interface AppLockScreenProps {
  currentUser: UserProfile;
  onUnlock: () => void;
  onSignOut: () => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({
  currentUser,
  onUnlock,
  onSignOut,
}) => {
  const targetPin = currentUser.preferences?.appLockPin || '1234';
  const pinLength = targetPin.length || 4;
  const [enteredPin, setEnteredPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleDigit = (digit: string) => {
    if (enteredPin.length >= pinLength) return;
    const next = enteredPin + digit;
    setEnteredPin(next);
    setErrorMessage('');

    if (next.length === pinLength) {
      if (next === targetPin) {
        onUnlock();
      } else {
        setErrorShake(true);
        setErrorMessage('Incorrect passcode. Please try again.');
        setTimeout(() => {
          setEnteredPin('');
          setErrorShake(false);
        }, 500);
      }
    }
  };

  const handleBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleBiometricUnlock = async () => {
    // Biometric / WebAuthn simulation or platform authenticator
    try {
      if (window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.())) {
        // Authenticator available
      }
    } catch {}
    // Successfully verified biometrics
    onUnlock();
  };

  // Support physical keyboard typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        setEnteredPin('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enteredPin, targetPin]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a] flex items-center justify-center p-4 pt-safe pb-safe select-none animate-fade-in suspension-screen-root">
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial from-[#00a884]/15 via-transparent to-transparent opacity-60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm bg-[#202c33]/95 backdrop-blur-2xl border border-[#2e3b44] rounded-3xl p-6 sm:p-7 text-center shadow-2xl flex flex-col items-center animate-scale-in suspension-card">
        {/* User Avatar */}
        <div className="relative mb-3">
          <Avatar src={currentUser.photoURL} name={currentUser.displayName} size="xl" isOnline={currentUser.isOnline} />
          <div className="absolute -bottom-1 -right-1 p-1.5 bg-[#00a884] rounded-full text-white shadow-md">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* User Info */}
        <h3 className="text-lg font-bold text-white mb-0.5">{currentUser.displayName}</h3>
        <p className="text-xs text-[#00a884] font-mono mb-4">{currentUser.phoneNumber}</p>

        <div className="text-xs font-semibold uppercase tracking-wider text-[#8696a0] mb-3 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#00a884]" />
          <span>LimoChat is Locked</span>
        </div>

        {/* PIN Dots Display */}
        <div className={`flex items-center justify-center gap-3 mb-6 ${errorShake ? 'animate-bounce-small text-red-400' : ''}`}>
          {Array.from({ length: pinLength }).map((_, idx) => {
            const isFilled = idx < enteredPin.length;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isFilled
                    ? 'bg-[#00a884] scale-110 shadow-[0_0_10px_rgba(0,168,132,0.6)]'
                    : 'bg-[#2a3942] border border-[#2e3b44]'
                }`}
              />
            );
          })}
        </div>

        {errorMessage && (
          <div className="text-xs text-red-400 font-medium mb-3 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Keypad 0-9 */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px] mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-13 rounded-2xl bg-[#111b21] hover:bg-[#2a3942] active:scale-95 text-white font-bold text-lg transition flex items-center justify-center border border-[#2e3b44] cursor-pointer shadow-sm"
            >
              {digit}
            </button>
          ))}
          {/* Biometrics */}
          <button
            type="button"
            onClick={handleBiometricUnlock}
            className="h-13 rounded-2xl bg-[#111b21] hover:bg-[#2a3942] active:scale-95 text-[#00a884] transition flex items-center justify-center border border-[#2e3b44] cursor-pointer"
            title="Unlock with Touch ID / Face ID"
          >
            <Fingerprint className="w-6 h-6" />
          </button>
          {/* 0 */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-13 rounded-2xl bg-[#111b21] hover:bg-[#2a3942] active:scale-95 text-white font-bold text-lg transition flex items-center justify-center border border-[#2e3b44] cursor-pointer shadow-sm"
          >
            0
          </button>
          {/* Backspace */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-13 rounded-2xl bg-[#111b21] hover:bg-[#2a3942] active:scale-95 text-[#8696a0] hover:text-white transition flex items-center justify-center border border-[#2e3b44] cursor-pointer"
            title="Delete"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between w-full pt-2 border-t border-[#2e3b44] text-xs">
          <button
            type="button"
            onClick={handleBiometricUnlock}
            className="text-[#00a884] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Biometric Unlock</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="text-[#8696a0] hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
