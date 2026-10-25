import { createPortal } from 'react-dom';
import { navigationManager } from '../../utils/navigationManager';
import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  KeyRound, 
  Check, 
  Copy, 
  Download, 
  QrCode, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  Unlock,
  Smartphone,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { UserProfile } from '../../types';
import { OtpBoxInput } from '../common/OtpBoxInput';
import { 
  generateTotpSecret, 
  getOtpAuthUrl, 
  generateRecoveryCodes, 
  verifyTotpToken,
  verifyRecoveryCode
} from '../../utils/totp';

interface AuthenticatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSaveAuthenticator: (enabled: boolean, secret: string | null, recoveryCodes?: string[]) => Promise<void>;
  isFirstTimePrompt?: boolean;
}

export const AuthenticatorModal: React.FC<AuthenticatorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveAuthenticator,
  isFirstTimePrompt = false,
}) => {
  const isCurrentlyEnabled = !!(
    currentUser.authenticatorEnabled || 
    currentUser.preferences?.authenticatorEnabled ||
    currentUser.authenticatorSecret ||
    currentUser.preferences?.authenticatorSecret
  );

  const [step, setStep] = useState<'status' | 'setup_scan' | 'verify' | 'recovery_codes' | 'disable_confirm'>(
    isCurrentlyEnabled && !isFirstTimePrompt ? 'status' : 'setup_scan'
  );

  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  // Register with navigationManager for back button / Escape key
  useEffect(() => {
    if (isOpen) {
      return navigationManager.registerModal('authenticator_modal', onClose, 30);
    }
  }, [isOpen, onClose]);

  // Initialize new secret and recovery codes when opening setup
  useEffect(() => {
    if (isOpen) {
      if (isCurrentlyEnabled && !isFirstTimePrompt) {
        setStep('status');
      } else {
        const newSecret = generateTotpSecret(16);
        const newCodes = generateRecoveryCodes(8);
        setSecret(newSecret);
        setRecoveryCodes(newCodes);
        setStep('setup_scan');
      }
      setVerificationCode('');
      setError(null);
    }
  }, [isOpen, isCurrentlyEnabled, isFirstTimePrompt]);

  if (!isOpen) return null;

  const accountIdentifier = currentUser.phoneNumber || currentUser.email || 'user';
  const otpAuthUrl = getOtpAuthUrl({
    secret,
    accountName: accountIdentifier,
    issuer: 'LimoChat',
  });

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    otpAuthUrl
  )}&color=000000&bgcolor=ffffff&margin=8`;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyAllRecoveryCodes = () => {
    const text = `LimoChat Backup Recovery Codes\nAccount: ${accountIdentifier}\nGenerated: ${new Date().toLocaleString()}\n\n` +
      recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      '\n\nKeep these codes safe. Each code can be used once to recover your account.';
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleDownloadRecoveryCodes = () => {
    const text = `LimoChat Backup Recovery Codes\nAccount: ${accountIdentifier}\nGenerated: ${new Date().toLocaleString()}\n\n` +
      recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      '\n\nKeep these codes safe. Each code can be used once to recover your account.';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `limochat-recovery-codes-${accountIdentifier}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerifyCode = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const codeToTest = (codeOverride !== undefined ? codeOverride : verificationCode).replace(/\D/g, '');
    if (codeToTest.length !== 6) {
      setError('Please enter the full 6-digit code shown in your Authenticator app.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const isValid = await verifyTotpToken(codeToTest, secret);
      if (!isValid) {
        setError('Invalid authenticator code. Check your authenticator app (make sure your device clock is accurate) and try again.');
        setIsSubmitting(false);
        return;
      }

      // Valid! Show recovery codes step
      setStep('recovery_codes');
    } catch (err: any) {
      setError(err.message || 'Verification error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishSetup = async () => {
    try {
      setIsSubmitting(true);
      await onSaveAuthenticator(true, secret, recoveryCodes);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to activate Authenticator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDisable = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const existingSecret = currentUser.authenticatorSecret || currentUser.preferences?.authenticatorSecret;
    const existingRecoveryCodes = currentUser.recoveryCodes || currentUser.preferences?.recoveryCodes || [];
    const codeToTest = (codeOverride !== undefined ? codeOverride : disableCode).trim();

    if (!existingSecret) {
      // Direct disable if no secret found
      await onSaveAuthenticator(false, null, []);
      onClose();
      return;
    }

    // Verify current 6-digit code or recovery code
    const cleanDigits = codeToTest.replace(/\D/g, '');
    let isValidTotp = false;
    if (cleanDigits.length === 6) {
      isValidTotp = await verifyTotpToken(cleanDigits, existingSecret);
    }
    const recoveryResult = verifyRecoveryCode(codeToTest, existingRecoveryCodes);

    if (!isValidTotp && !recoveryResult.valid) {
      setError('Invalid code. Enter the 6-digit Authenticator code or a backup recovery code to disable.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSaveAuthenticator(false, null, []);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to disable Authenticator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe bg-black/80 backdrop-blur-md select-none animate-fade-in">
      <div 
        className="fixed inset-0 cursor-default" 
        onClick={() => { if (!isSubmitting) onClose(); }} 
      />

      <div 
        className="relative z-50 w-full max-w-md bg-[#202c33] border border-[#2e3b44] rounded-3xl shadow-2xl p-5 sm:p-6 text-white flex flex-col overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2e3b44] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00a884]/20 text-[#00a884]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                {isFirstTimePrompt ? 'Secure Account: Add Authenticator' : 'Two-Step Verification'}
              </h3>
              <p className="text-[11px] text-[#8696a0]">
                Google / Microsoft Authenticator (TOTP)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            STATE 1: STATUS OVERVIEW (When already enabled)
            ========================================================================= */}
        {step === 'status' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-[#00a884] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-400">Authenticator App Active</div>
                <div className="text-[11px] text-[#8696a0] leading-tight mt-0.5">
                  Your account is protected with standard 6-digit TOTP two-factor codes.
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const newSecret = generateTotpSecret(16);
                  const newCodes = generateRecoveryCodes(8);
                  setSecret(newSecret);
                  setRecoveryCodes(newCodes);
                  setStep('setup_scan');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#111b21] hover:bg-[#2a3942] border border-[#2e3b44] text-xs font-semibold text-white flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#00a884]" />
                  <span>Reconfigure Authenticator / Generate New Secret</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[#8696a0]" />
              </button>

              <button
                type="button"
                onClick={() => setStep('disable_confirm')}
                className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-400 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Turn Off Authenticator</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE 2: STEP 1 - SCAN QR CODE & COPY KEY
            ========================================================================= */}
        {step === 'setup_scan' && (
          <div className="space-y-4">
            <p className="text-xs text-[#8696a0] leading-relaxed">
              Scan this QR code in <strong className="text-white">Google Authenticator</strong>, <strong className="text-white">Microsoft Authenticator</strong>, <strong className="text-white">Authy</strong>, or <strong className="text-white">1Password</strong>:
            </p>

            {/* QR Code Canvas */}
            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-lg mx-auto w-48 h-48 border border-white/20">
              <img
                src={qrImageUrl}
                alt="Authenticator QR Code"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Manual Secret Key */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">
                Or enter this key manually:
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#111b21] border border-[#2e3b44]">
                <code className="text-xs font-mono font-bold text-[#00a884] tracking-widest break-all">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="p-1.5 rounded-lg hover:bg-[#2a3942] text-[#8696a0] hover:text-white transition cursor-pointer flex-shrink-0"
                  title="Copy Secret Key"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('verify');
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-[#00a884]/25 flex items-center justify-center gap-2 mt-2"
            >
              <span>Next: Enter 6-Digit Code</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {isFirstTimePrompt && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer"
              >
                Remind Me Later / Skip for Now
              </button>
            )}
          </div>
        )}

        {/* =========================================================================
            STATE 3: STEP 2 - VERIFY 6-DIGIT CODE
            ========================================================================= */}
        {step === 'verify' && (
          <form onSubmit={(e) => handleVerifyCode(e)} className="space-y-4">
            <p className="text-xs text-[#8696a0] leading-relaxed text-center">
              Enter the 6-digit code currently displayed for <strong className="text-white">LimoChat</strong> in your authenticator app to verify the connection:
            </p>

            <div className="py-2">
              <OtpBoxInput
                length={6}
                value={verificationCode}
                onChange={(val) => {
                  setVerificationCode(val);
                  setError(null);
                }}
                onComplete={(code) => {
                  handleVerifyCode(undefined, code);
                }}
                disabled={isSubmitting}
                isError={!!error}
                autoFocus={true}
              />
              <p className="text-[11px] text-[#8696a0] text-center mt-2 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Auto-verifies instantly on 6th digit</span>
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('setup_scan')}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs text-[#8696a0] hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                Back to QR Code
              </button>
              <button
                type="submit"
                disabled={verificationCode.length !== 6 || isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* =========================================================================
            STATE 4: STEP 3 - BACKUP RECOVERY CODES
            ========================================================================= */}
        {step === 'recovery_codes' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Save Your Recovery Codes</strong>
                If you ever lose access to your authenticator app, these 8 backup codes are the only way to log in or reset your password.
              </div>
            </div>

            {/* Grid of Recovery Codes */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-[#111b21] border border-[#2e3b44] font-mono text-xs text-center">
              {recoveryCodes.map((code, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-[#202c33] text-white font-bold tracking-wider border border-white/5">
                  {code}
                </div>
              ))}
            </div>

            {/* Actions: Copy & Download */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAllRecoveryCodes}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#111b21] hover:bg-[#2a3942] border border-[#2e3b44] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {copiedCodes ? <Check className="w-3.5 h-3.5 text-[#00a884]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCodes ? 'Copied All!' : 'Copy All Codes'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadRecoveryCodes}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#111b21] hover:bg-[#2a3942] border border-[#2e3b44] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Download .txt</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleFinishSetup}
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-[#00a884]/25 flex items-center justify-center gap-2 mt-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>I Have Saved My Codes - Enable Authenticator</span>
            </button>
          </div>
        )}

        {/* =========================================================================
            STATE 5: DISABLE CONFIRMATION
            ========================================================================= */}
        {step === 'disable_confirm' && (
          <form onSubmit={(e) => handleConfirmDisable(e)} className="space-y-4">
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Disable Authenticator?</strong>
                This removes two-step verification protection from your account. Please enter your 6-digit Authenticator code to confirm.
              </div>
            </div>

            <div className="py-2">
              <OtpBoxInput
                length={6}
                value={disableCode}
                onChange={(val) => {
                  setDisableCode(val);
                  setError(null);
                }}
                onComplete={(code) => {
                  handleConfirmDisable(undefined, code);
                }}
                disabled={isSubmitting}
                isError={!!error}
                autoFocus={true}
              />
              <p className="text-[11px] text-[#8696a0] text-center mt-2 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
                <span>Auto-verifies on 6th digit</span>
              </p>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('status')}
                className="flex-1 py-2.5 px-3 rounded-xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disableCode.length !== 6 || isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md"
              >
                {isSubmitting ? 'Disabling...' : 'Confirm Disable'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
};
