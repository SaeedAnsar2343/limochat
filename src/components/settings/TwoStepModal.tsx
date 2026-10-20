import React, { useState } from 'react';
import { X, ShieldCheck, KeyRound, Check, AlertTriangle, Mail, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { UserProfile } from '../../types';

interface TwoStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSaveTwoStep: (pin: string, recoveryEmail?: string) => Promise<void>;
  onDisableTwoStep: () => Promise<void>;
}

export const TwoStepModal: React.FC<TwoStepModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveTwoStep,
  onDisableTwoStep,
}) => {
  const isCurrentlyEnabled = !!currentUser.preferences?.twoStepPin;
  const [mode, setMode] = useState<'status' | 'setup_pin' | 'confirm_pin' | 'email'>(
    isCurrentlyEnabled ? 'status' : 'setup_pin'
  );

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState(currentUser.email || '');
  const [showDigits, setShowDigits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handlePinInput = (val: string, target: 'pin' | 'confirm') => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    if (target === 'pin') {
      setPin(clean);
      setError(null);
    } else {
      setConfirmPin(clean);
      setError(null);
    }
  };

  const handleNextToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) {
      setError('Please enter a full 6-digit PIN.');
      return;
    }
    setError(null);
    setMode('confirm_pin');
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmPin !== pin) {
      setError('PINs do not match. Please re-enter.');
      return;
    }
    setError(null);
    setMode('email');
  };

  const handleFinalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onSaveTwoStep(pin, recoveryEmail.trim());
      setMode('status');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to enable Two-Step Verification');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable = async () => {
    try {
      setIsSaving(true);
      await onDisableTwoStep();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to disable');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-fade-in">
      <div 
        className="fixed inset-0 cursor-default" 
        onClick={() => { if (!isSaving) onClose(); }} 
      />

      <div 
        className="relative z-50 w-full max-w-md bg-[#202c33] border border-[#2e3b44] rounded-3xl shadow-2xl p-5 sm:p-6 text-white flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2e3b44] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00a884]/20 text-[#00a884]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Two-Step Verification</h3>
              <p className="text-xs text-[#8696a0]">Extra layer of security with a 6-digit PIN</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-3 p-3 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* MODE: STATUS VIEW (When already active) */}
        {mode === 'status' && isCurrentlyEnabled && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] mx-auto flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Two-Step Verification is Active</h4>
              <p className="text-xs text-[#8696a0] max-w-xs mx-auto mt-1 leading-relaxed">
                Your LimoChat account is protected with a 6-digit PIN. You will be asked to enter this PIN periodically and when registering your number on a new device.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setPin('');
                  setConfirmPin('');
                  setMode('setup_pin');
                }}
                className="w-full py-2.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-semibold text-xs transition cursor-pointer shadow-md"
              >
                Change 6-Digit PIN
              </button>

              <button
                type="button"
                onClick={handleDisable}
                disabled={isSaving}
                className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold text-xs transition cursor-pointer border border-red-500/30 disabled:opacity-50"
              >
                {isSaving ? 'Turning off...' : 'Turn Off Two-Step Verification'}
              </button>
            </div>
          </div>
        )}

        {/* MODE: SETUP PIN */}
        {mode === 'setup_pin' && (
          <form onSubmit={handleNextToConfirm} className="space-y-4 py-3">
            <div className="text-center space-y-1">
              <h4 className="text-sm font-semibold text-white">Enter a 6-Digit PIN</h4>
              <p className="text-xs text-[#8696a0]">
                Choose a 6-digit PIN that you can easily remember.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="relative w-48">
                <input
                  type={showDigits ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => handlePinInput(e.target.value, 'pin')}
                  placeholder="••••••"
                  autoFocus
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-2xl py-3 px-4 text-center font-mono text-xl tracking-widest text-[#00a884] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                />
                <button
                  type="button"
                  onClick={() => setShowDigits(!showDigits)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-white"
                >
                  {showDigits ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-[#8696a0]">{pin.length} / 6 digits</span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#2e3b44]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pin.length !== 6}
                className="px-5 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs transition cursor-pointer shadow-md disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </form>
        )}

        {/* MODE: CONFIRM PIN */}
        {mode === 'confirm_pin' && (
          <form onSubmit={handleConfirmPin} className="space-y-4 py-3">
            <div className="text-center space-y-1">
              <h4 className="text-sm font-semibold text-white">Confirm Your 6-Digit PIN</h4>
              <p className="text-xs text-[#8696a0]">
                Re-enter the 6 digits to make sure they match.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="relative w-48">
                <input
                  type={showDigits ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => handlePinInput(e.target.value, 'confirm')}
                  placeholder="••••••"
                  autoFocus
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-2xl py-3 px-4 text-center font-mono text-xl tracking-widest text-[#00a884] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                />
                <button
                  type="button"
                  onClick={() => setShowDigits(!showDigits)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-white"
                >
                  {showDigits ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-[#8696a0]">{confirmPin.length} / 6 digits</span>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#2e3b44]">
              <button
                type="button"
                onClick={() => setMode('setup_pin')}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={confirmPin.length !== 6}
                className="px-5 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs transition cursor-pointer shadow-md disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </form>
        )}

        {/* MODE: EMAIL RECOVERY (OPTIONAL) */}
        {mode === 'email' && (
          <form onSubmit={handleFinalSave} className="space-y-4 py-3">
            <div className="text-center space-y-1">
              <h4 className="text-sm font-semibold text-white">Add Recovery Email</h4>
              <p className="text-xs text-[#8696a0]">
                Used to reset your PIN if you forget it and safeguards your account.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white">Email Address:</label>
              <div className="flex items-center gap-2 bg-[#111b21] border border-[#2e3b44] rounded-2xl px-3.5 py-2.5">
                <Mail className="w-4 h-4 text-[#8696a0]" />
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  autoFocus
                  className="flex-1 bg-transparent text-xs text-white placeholder-[#8696a0] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#2e3b44]">
              <button
                type="button"
                onClick={() => setMode('confirm_pin')}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Enabling...' : 'Enable Two-Step'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
