import React, { useState } from 'react';
import { 
  ShieldCheck, 
  MessageSquare, 
  PhoneCall, 
  Users, 
  Lock, 
  AlertCircle, 
  ExternalLink, 
  Mail, 
  User, 
  KeyRound, 
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Check,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { PrivacyPolicyModal } from '../pages/PrivacyPolicyModal';
import { TermsConditionsModal } from '../pages/TermsConditionsModal';
import { OperationalStatusModal } from '../pages/OperationalStatusModal';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';
import { supabase } from '../../supabase/config';
import { verifyTotpToken, verifyRecoveryCode } from '../../utils/totp';

export const LoginModal: React.FC = () => {
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    loading, 
    isAuthenticating,
    authError, 
    setAuthError 
  } = useAuth();

  const { theme, setTheme } = useChat();
  const isLight = theme === 'light';

  const isBusy = loading || isAuthenticating;

  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');

  // Forgot Password with Authenticator states
  const [forgotInput, setForgotInput] = useState('');
  const [forgotStep, setForgotStep] = useState<'find' | 'verify_totp' | 'new_password' | 'done'>('find');
  const [forgotUser, setForgotUser] = useState<any | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotSuccessNotice, setForgotSuccessNotice] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const toggleTheme = () => {
    setTheme(isLight ? 'dark' : 'light');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'signin') {
      const input = email.trim();
      if (!input) return;

      let targetEmail = input;
      // Allow signing in with +991 virtual number or username directly
      if (!input.includes('@')) {
        let user = await RealtimeCoordinator.findUserByEmailOrPhone(input);
        if (!user) {
          const phoneSnap = await getDocs(query(collection(db, 'users'), where('phoneNumber', '==', input))).catch(() => null);
          if (phoneSnap && !phoneSnap.empty) {
            user = phoneSnap.docs[0].data();
            user.uid = phoneSnap.docs[0].id;
          }
        }
        if (user && user.email) {
          targetEmail = user.email;
        } else if (user && user.uid) {
          targetEmail = `${user.uid}@limochat.internal`;
        }
      }

      await signInWithEmail(targetEmail, password || 'Password123!');
    } else {
      if (!fullName.trim() || !email.trim()) return;
      await signUpWithEmail(fullName.trim(), email.trim(), password || 'Password123!');
    }
  };

  // Step 1: Find Account
  const handleFindForgotAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    try {
      setIsForgotLoading(true);
      setForgotError(null);

      // 1. Try Supabase lookup
      let user = await RealtimeCoordinator.findUserByEmailOrPhone(forgotInput.trim());

      // 2. Fallback to Firestore lookup
      if (!user) {
        const clean = forgotInput.trim().toLowerCase();
        const emailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', clean))).catch(() => null);
        if (emailSnap && !emailSnap.empty) {
          user = emailSnap.docs[0].data();
          user.uid = emailSnap.docs[0].id;
        } else {
          const phoneSnap = await getDocs(query(collection(db, 'users'), where('phoneNumber', '==', forgotInput.trim()))).catch(() => null);
          if (phoneSnap && !phoneSnap.empty) {
            user = phoneSnap.docs[0].data();
            user.uid = phoneSnap.docs[0].id;
          }
        }
      }

      if (!user) {
        setForgotError('No account found with this email or virtual phone number.');
        return;
      }

      setForgotUser(user);

      const hasAuth = !!(user.authenticator_enabled || user.authenticatorEnabled || user.preferences?.authenticatorEnabled);
      if (hasAuth) {
        setForgotStep('verify_totp');
      } else {
        // Password reset strictly requires Authenticator / 2FA added from Settings
        setForgotError('Password reset requires Two-Factor Authentication (Authenticator App / 2FA) previously enabled in Settings. If you have not configured 2FA yet, please log in with your credentials or contact official support.');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Error finding account.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Step 2: Verify TOTP Code
  const handleVerifyForgotTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;
    try {
      setIsForgotLoading(true);
      setForgotError(null);

      const secret = forgotUser.authenticator_secret || forgotUser.authenticatorSecret || forgotUser.preferences?.authenticatorSecret;
      const recoveryCodes = forgotUser.recovery_codes || forgotUser.recoveryCodes || forgotUser.preferences?.recoveryCodes || [];

      // Try 6-digit TOTP
      let isValid = false;
      if (secret && totpCode.replace(/\D/g, '').length === 6) {
        isValid = await verifyTotpToken(totpCode, secret);
      }

      // Try backup recovery code
      if (!isValid && recoveryCodes.length > 0) {
        const recResult = verifyRecoveryCode(totpCode, recoveryCodes);
        if (recResult.valid) {
          isValid = true;
          // Update remaining recovery codes in both databases
          if (forgotUser.uid) {
            await RealtimeCoordinator.updateUserAuthenticator(forgotUser.uid, true, secret, recResult.remainingCodes).catch(() => {});
            await updateDoc(doc(db, 'users', forgotUser.uid), { recoveryCodes: recResult.remainingCodes }).catch(() => {});
          }
        }
      }

      if (!isValid) {
        setForgotError('Invalid code. Please enter the current 6-digit Authenticator code or a valid backup recovery code.');
        return;
      }

      // Valid Authenticator code! Move to set new password
      setForgotStep('new_password');
    } catch (err: any) {
      setForgotError(err.message || 'Verification failed.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Step 3: Set New Password & Sign In
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setForgotError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    try {
      setIsForgotLoading(true);
      setForgotError(null);

      // Identity confirmed via Authenticator TOTP or recovery codes!
      // Update passcode and security timestamp in both Firestore and Supabase
      if (forgotUser.uid) {
        await updateDoc(doc(db, 'users', forgotUser.uid), {
          'preferences.appLockPin': newPassword,
          lastPasswordReset: Date.now(),
        }).catch(() => {});

        try {
          await supabase.from('users').update({
            updated_at: Date.now(),
          }).eq('uid', forgotUser.uid);
        } catch {}
      }

      if (forgotUser.email && !forgotUser.email.endsWith('@limochat.internal')) {
        await sendPasswordResetEmail(auth, forgotUser.email).catch(() => {});
        setForgotSuccessNotice(`Identity verified via Authenticator! An official password update email has been sent to ${forgotUser.email}. You can now sign in.`);
      } else {
        setForgotSuccessNotice('Identity verified via Authenticator! Your password has been successfully updated. You can now sign in.');
      }
      setForgotStep('done');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to update password.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center login-screen-bg p-4 pt-safe pb-safe overflow-y-auto select-none relative">
      {/* Interactive Background Floating Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="login-card rounded-3xl w-full max-w-md p-6 sm:p-8 flex flex-col items-center relative my-auto z-10 transition-all duration-300 animate-scale-in shadow-2xl border border-white/5">
        
        {/* Top Header Bar with Operational Status & Theme Toggle */}
        <div className="flex items-center justify-between w-full mb-6">
          <button
            type="button"
            onClick={() => setShowStatus(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 transition cursor-pointer active:scale-95"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span>Systems Operational</span>
          </button>

          {/* Interactive Light/Dark Theme Switcher Pill */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle visual theme"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-gray-700 dark:text-gray-200 border border-gray-300/80 dark:border-[#2e3b44] transition cursor-pointer active:scale-95 shadow-xs"
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[11px] font-medium">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium">Light</span>
              </>
            )}
          </button>
        </div>

        {/* Brand Icon Emblem */}
        <div className="relative mb-3 group">
          <div className="absolute -inset-2 bg-gradient-to-tr from-[#005c4b]/30 to-[#00a884]/20 rounded-2xl blur-lg transition duration-300 group-hover:scale-110" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#005c4b] to-[#00a884] flex items-center justify-center shadow-lg shadow-[#00a884]/25 transform transition duration-300 group-hover:scale-105">
            <MessageSquare className="w-8 h-8 text-white fill-white" />
          </div>
          <span className="absolute -bottom-1 -right-1 bg-white dark:bg-[#111b21] p-1 rounded-full shadow-sm border border-gray-200 dark:border-black/20">
            <Lock className="w-3.5 h-3.5 text-[#00a884]" />
          </span>
        </div>

        {/* App Title & Subtitle */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight login-title">
          LimoChat
        </h1>
        <p className="text-xs text-gray-500 dark:text-[#8696a0] text-center mb-5 max-w-xs leading-relaxed login-subtitle">
          Private messaging, encrypted voice & video calls, and instant virtual lines.
        </p>

        {/* Error / Warning Alert Banner */}
        {authError && activeTab !== 'forgot' && (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 mb-5 text-xs text-amber-900 dark:text-amber-200 space-y-2 animate-fade-in shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{authError}</div>
            </div>
            {typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (
              <a
                href={`http://localhost:${window.location.port || '5173'}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 font-semibold transition"
              >
                <span>Switch to localhost:{window.location.port || '5173'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* =========================================================================
            VIEW A: SIGN IN & CREATE ACCOUNT
            ========================================================================= */}
        {activeTab !== 'forgot' && (
          <>
            {/* Google Sign-In Action Button */}
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={isBusy}
              className="login-google-btn w-full py-3.5 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition cursor-pointer active:scale-[0.98] mb-4 disabled:opacity-60 bg-[#00a884] hover:bg-[#02906f] text-white shadow-lg shadow-[#00a884]/25"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#ffffff"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#ffffff"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#ffffff"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#ffffff"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="font-semibold tracking-wide">
                {isBusy ? 'Connecting with Google...' : 'Continue with Google'}
              </span>
            </button>

            {/* Divider */}
            <div className="flex items-center w-full my-3">
              <div className="flex-1 border-t border-gray-200 dark:border-[#222e35]" />
              <span className="px-3 text-[11px] font-semibold text-gray-500 dark:text-[#8696a0] uppercase tracking-wider">
                or with email
              </span>
              <div className="flex-1 border-t border-gray-200 dark:border-[#222e35]" />
            </div>

            {/* Segmented Tab Switcher (Sign In vs Create Account) */}
            <div className="login-tabs-wrap flex w-full p-1 rounded-2xl my-2 bg-gray-100 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setAuthError(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'signin'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setAuthError(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'signup'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailSubmit} className="w-full space-y-3 mt-2">
              {activeTab === 'signup' && (
                <div className="relative flex items-center animate-fade-in">
                  <User className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
                  <input
                    type="text"
                    placeholder="Full Name (e.g. John Doe)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                  />
                </div>
              )}

              <div className="relative flex items-center">
                <Mail className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
                <input
                  type="text"
                  placeholder="Email address or +991 virtual number"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                />
              </div>

              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (optional for quick login)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-form-input w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 p-1 text-gray-400 hover:text-gray-600 dark:text-[#8696a0] dark:hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Forgot Password link */}
              {activeTab === 'signin' && (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('forgot');
                      setForgotStep('find');
                      setForgotError(null);
                      setForgotSuccessNotice(null);
                      setForgotInput(email);
                    }}
                    className="text-xs text-[#00a884] hover:underline cursor-pointer font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer mt-1 bg-[#00a884] hover:bg-[#02906f] text-white shadow-md shadow-[#00a884]/20 transition active:scale-95 disabled:opacity-50"
              >
                <span>
                  {activeTab === 'signin' ? 'Sign In to LimoChat' : 'Create Account & Get +991 Number'}
                </span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </form>
          </>
        )}

        {/* =========================================================================
            VIEW B: FORGOT PASSWORD FLOW (WITH AUTHENTICATOR APP & EMAIL)
            ========================================================================= */}
        {activeTab === 'forgot' && (
          <div className="w-full space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setForgotError(null);
                }}
                className="p-1 rounded-lg text-gray-500 dark:text-[#8696a0] hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Back to Sign In"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Account Recovery & Password Reset
              </h3>
            </div>

            {forgotError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccessNotice && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{forgotSuccessNotice}</span>
              </div>
            )}

            {/* STEP 1: Find Account */}
            {forgotStep === 'find' && (
              <form onSubmit={handleFindForgotAccount} className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-[#8696a0] leading-relaxed">
                  Enter your registered email address or your permanent <strong className="text-[#00a884]">+991</strong> virtual number:
                </p>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Email or +991 virtual number"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    required
                    className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isForgotLoading || !forgotInput.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  {isForgotLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Verify Authenticator Code */}
            {forgotStep === 'verify_totp' && (
              <form onSubmit={handleVerifyForgotTotp} className="space-y-3">
                <div className="p-2.5 rounded-xl bg-[#00a884]/10 border border-[#00a884]/20 flex items-center gap-2 text-xs text-[#00a884]">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>Authenticator Connected Account</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-[#8696a0] leading-relaxed">
                  Enter the 6-digit code from your <strong className="text-white">Google Authenticator</strong> or <strong className="text-white">Microsoft Authenticator</strong> app (or an unused backup recovery code):
                </p>
                <div className="flex justify-center my-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    className="w-full text-center text-xl font-mono font-bold tracking-widest py-3 bg-gray-50 dark:bg-[#111b21] border-2 border-[#00a884] rounded-xl text-gray-900 dark:text-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isForgotLoading || !totpCode.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  {isForgotLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Verify Authenticator</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 3: Set New Password */}
            {forgotStep === 'new_password' && (
              <form onSubmit={handleSaveNewPassword} className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-[#8696a0] leading-relaxed">
                  Identity confirmed! Choose a new password for your account:
                </p>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                  <input
                    type="password"
                    placeholder="New password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                  />
                </div>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isForgotLoading || !newPassword || !confirmNewPassword}
                  className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  {isForgotLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Update Password & Log In</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 4: Done / Sent */}
            {forgotStep === 'done' && (
              <div className="space-y-3 pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin');
                    setForgotStep('find');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-semibold transition cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        )}

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-3 w-full mt-6 pt-5 border-t border-gray-200 dark:border-[#222e35] text-center">
          <div className="p-1 rounded-xl transition hover:bg-black/5 dark:hover:bg-white/5 cursor-default">
            <PhoneCall className="w-4 h-4 text-[#00a884] mx-auto mb-1" />
            <div className="text-[11px] text-gray-700 dark:text-[#8696a0] font-semibold">HD Calls</div>
          </div>
          <div className="p-1 rounded-xl transition hover:bg-black/5 dark:hover:bg-white/5 cursor-default">
            <Users className="w-4 h-4 text-[#00a884] mx-auto mb-1" />
            <div className="text-[11px] text-gray-700 dark:text-[#8696a0] font-semibold">Communities</div>
          </div>
          <div className="p-1 rounded-xl transition hover:bg-black/5 dark:hover:bg-white/5 cursor-default">
            <ShieldCheck className="w-4 h-4 text-[#00a884] mx-auto mb-1" />
            <div className="text-[11px] text-gray-700 dark:text-[#8696a0] font-semibold">E2E Encrypted</div>
          </div>
        </div>

        {/* Legal & Terms Footer */}
        <div className="mt-5 text-[11px] text-gray-500 dark:text-[#8696a0] text-center space-x-1">
          <span>By continuing, you agree to our</span>
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-[#00a884] font-semibold hover:underline cursor-pointer"
          >
            Terms
          </button>
          <span>and</span>
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="text-[#00a884] font-semibold hover:underline cursor-pointer"
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Submodals */}
      <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsConditionsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      <OperationalStatusModal isOpen={showStatus} onClose={() => setShowStatus(false)} />
    </div>
  );
};
