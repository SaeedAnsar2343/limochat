import React, { useState } from 'react';
import { X, Lock, Unlock, Fingerprint, Check, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import { UserProfile } from '../../types';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSavePasscode: (pin: string, timeout: 'immediately' | '1m' | '15m' | '1h', biometric: boolean) => Promise<void>;
  onDisablePasscode: () => Promise<void>;
  onLockNow: () => void;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSavePasscode,
  onDisablePasscode,
  onLockNow,
}) => {
  const isCurrentlyEnabled = !!currentUser.preferences?.appLockEnabled && !!currentUser.preferences?.appLockPin;
  const currentPin = currentUser.preferences?.appLockPin || '';
  const currentTimeout = currentUser.preferences?.appLockTimeout || '1m';
  const currentBiometric = currentUser.preferences?.biometricEnabled ?? false;

  const [mode, setMode] = useState<'manage' | 'enter_pin' | 'confirm_pin'> (
    isCurrentlyEnabled ? 'manage' : 'enter_pin'
  );

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [timeout, setTimeoutVal] = useState<'immediately' | '1m' | '15m' | '1h'>(currentTimeout);
  const [biometric, setBiometric] = useState(currentBiometric);
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
    if (pin.length < 4) {
      setError('Please enter a 4 to 6 digit numerical passcode.');
      return;
    }
    setError(null);
    setMode('confirm_pin');
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmPin !== pin) {
      setError('Passcodes do not match. Please re-enter.');
      return;
    }

    try {
      setIsSaving(true);
      await onSavePasscode(pin, timeout, biometric);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save passcode lock');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePreferences = async (newTimeout: 'immediately' | '1m' | '15m' | '1h', newBiometric: boolean) => {
    try {
      setIsSaving(true);
      setTimeoutVal(newTimeout);
      setBiometric(newBiometric);
      await onSavePasscode(currentPin, newTimeout, newBiometric);
    } catch (err: any) {
      setError(err.message || 'Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable = async () => {
    try {
      setIsSaving(true);
      await onDisablePasscode();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to disable passcode lock');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="fixed inset-0 cursor-default" onClick={onClose} />

      <div className="relative z-10 bg-[#202c33] text-[#e9edef] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col animate-scale-in modal-content">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e3b44] bg-[#111b21]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00a884]/20 rounded-xl text-[#00a884]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">App Passcode & Screen Lock</h3>
              <p className="text-xs text-[#8696a0]">Client-side session protection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'manage' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-[#00a884] rounded-xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Passcode Lock is Active</h4>
                  <p className="text-xs text-[#8696a0] mt-0.5">
                    LimoChat requires your PIN or biometric recognition when returning to the app.
                  </p>
                </div>
              </div>

              {/* Timeout Setting */}
              <div className="bg-[#111b21] p-3.5 rounded-2xl border border-[#2e3b44] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Auto-Lock Timeout</span>
                  </span>
                  <select
                    value={timeout}
                    onChange={(e) => handleUpdatePreferences(e.target.value as any, biometric)}
                    className="bg-[#202c33] border border-[#2e3b44] rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
                    disabled={isSaving}
                  >
                    <option value="immediately">Immediately on exit</option>
                    <option value="1m">After 1 minute of inactivity</option>
                    <option value="15m">After 15 minutes of inactivity</option>
                    <option value="1h">After 1 hour of inactivity</option>
                  </select>
                </div>
                <p className="text-[11px] text-[#8696a0]">
                  Controls how quickly LimoChat locks itself when you switch tabs or leave your device idle.
                </p>
              </div>

              {/* Biometrics Toggle */}
              <div className="bg-[#111b21] p-3.5 rounded-2xl border border-[#2e3b44] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white flex items-center gap-2">
                    <Fingerprint className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Biometric Unlock</span>
                  </span>
                  <p className="text-[11px] text-[#8696a0] mt-0.5">Allow Touch ID, Face ID, or Windows Hello</p>
                </div>
                <button
                  onClick={() => handleUpdatePreferences(timeout, !biometric)}
                  disabled={isSaving}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    biometric ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      biometric ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    onClose();
                    onLockNow();
                  }}
                  className="w-full py-2.5 bg-[#00a884] hover:bg-[#02906f] text-white font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Lock className="w-4 h-4" />
                  <span>Lock App Now</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPin('');
                      setConfirmPin('');
                      setMode('enter_pin');
                    }}
                    className="flex-1 py-2.5 bg-[#111b21] hover:bg-[#2a3942] border border-[#2e3b44] text-white font-medium text-xs rounded-xl transition cursor-pointer"
                  >
                    Change Passcode
                  </button>

                  <button
                    onClick={handleDisable}
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium text-xs rounded-xl transition cursor-pointer"
                  >
                    Disable Lock
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'enter_pin' && (
            <form onSubmit={handleNextToConfirm} className="space-y-4">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-white">Create Passcode</h4>
                <p className="text-xs text-[#8696a0]">
                  Enter a 4 to 6 digit numerical PIN to secure your app.
                </p>
              </div>

              <div className="flex justify-center">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => handlePinInput(e.target.value, 'pin')}
                  placeholder="• • • •"
                  className="bg-[#111b21] border border-[#2e3b44] focus:border-[#00a884] text-center text-2xl tracking-[0.5em] text-white rounded-2xl px-6 py-3 w-48 font-mono focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                {isCurrentlyEnabled && (
                  <button
                    type="button"
                    onClick={() => setMode('manage')}
                    className="flex-1 py-2.5 bg-[#111b21] hover:bg-[#2a3942] text-white text-xs font-medium rounded-xl transition"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={pin.length < 4}
                  className="flex-1 py-2.5 bg-[#00a884] hover:bg-[#02906f] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {mode === 'confirm_pin' && (
            <form onSubmit={handleSavePin} className="space-y-4">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-white">Confirm Passcode</h4>
                <p className="text-xs text-[#8696a0]">
                  Re-enter your passcode to verify.
                </p>
              </div>

              <div className="flex justify-center">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => handlePinInput(e.target.value, 'confirm')}
                  placeholder="• • • •"
                  className="bg-[#111b21] border border-[#2e3b44] focus:border-[#00a884] text-center text-2xl tracking-[0.5em] text-white rounded-2xl px-6 py-3 w-48 font-mono focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmPin('');
                    setMode('enter_pin');
                  }}
                  className="flex-1 py-2.5 bg-[#111b21] hover:bg-[#2a3942] text-white text-xs font-medium rounded-xl transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={confirmPin.length < 4 || isSaving}
                  className="flex-1 py-2.5 bg-[#00a884] hover:bg-[#02906f] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  {isSaving ? 'Enabling...' : 'Activate Lock'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
