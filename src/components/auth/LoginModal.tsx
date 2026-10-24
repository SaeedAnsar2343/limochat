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
  Sparkles,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { PrivacyPolicyModal } from '../pages/PrivacyPolicyModal';
import { TermsConditionsModal } from '../pages/TermsConditionsModal';
import { OperationalStatusModal } from '../pages/OperationalStatusModal';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, limit } from 'firebase/firestore';
import { OtpBoxInput } from '../common/OtpBoxInput';
import { formatAuthErrorMessage } from '../../utils/authErrors';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';
import { supabase } from '../../supabase/config';
import { verifyTotpToken, verifyRecoveryCode } from '../../utils/totp';

export const LoginModal: React.FC = () => {
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    createOrUpdatePasswordForUser,
    loading, 
    isAuthenticating,
    authError, 
    setAuthError 
  } = useAuth();

  const { theme, setTheme } = useChat();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Multi-Step Sign-In State
  // Step 1: 'enter_identifier'
  // Step 2A: 'enter_password' (Standard password account)
  // Step 2B: 'google_verify_totp' (Google account requiring 2FA Authenticator before password setup)
  // Step 2C: 'google_create_password' (Google account setting/changing password)
  const [signInStep, setSignInStep] = useState<
    'enter_identifier' | 'enter_password' | 'google_verify_totp' | 'google_create_password'
  >('enter_identifier');

  const [identifier, setIdentifier] = useState('');
  const [resolvedAccount, setResolvedAccount] = useState<any | null>(null);
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);

  // Sign In Password State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up State
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Google 2FA & Password Creation States
  const [googleTotpCode, setGoogleTotpCode] = useState('');
  const [googleRecoveryCode, setGoogleRecoveryCode] = useState('');
  const [googleUseRecovery, setGoogleUseRecovery] = useState(false);
  const [googleTotpError, setGoogleTotpError] = useState<string | null>(null);
  const [googleNewPassword, setGoogleNewPassword] = useState('');
  const [googleConfirmPassword, setGoogleConfirmPassword] = useState('');
  const [showGoogleNewPassword, setShowGoogleNewPassword] = useState(false);
  const [showGoogleConfirmPassword, setShowGoogleConfirmPassword] = useState(false);

  // Forgot Password with Authenticator States
  const [forgotInput, setForgotInput] = useState('');
  const [forgotStep, setForgotStep] = useState<'find' | 'verify_totp' | 'new_password' | 'done'>('find');
  const [forgotUser, setForgotUser] = useState<any | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [useRecoveryMode, setUseRecoveryMode] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [forgotSuccessNotice, setForgotSuccessNotice] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // Modals
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const isBusy = loading || isAuthenticating || isResolvingAccount;

  // Determine if input is phone-like (digits, spaces, plus, hyphens)
  const isIdentifierPhoneLike = /^[+0-9\s-]+$/.test(identifier.trim()) && identifier.trim().length > 0;
  const isForgotPhoneLike = /^[+0-9\s-]+$/.test(forgotInput.trim()) && forgotInput.trim().length > 0;

  const toggleTheme = () => {
    setTheme(isLight ? 'dark' : 'light');
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', barClass: 'bg-gray-400', textClass: 'text-gray-400' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', barClass: 'bg-red-500', textClass: 'text-red-400' };
    if (score <= 3) return { score: 2, label: 'Good', barClass: 'bg-amber-500', textClass: 'text-amber-400' };
    return { score: 3, label: 'Strong', barClass: 'bg-emerald-500', textClass: 'text-emerald-400' };
  };

  // =========================================================================
  // UNIVERSAL USER RESOLVER (SUPABASE + FIRESTORE DUAL SYNC)
  // Matches any phone format: with/without spaces, with/without +991, or email
  // =========================================================================
  const findUserUniversal = async (queryTerm: string) => {
    const trimmed = queryTerm.trim();
    if (!trimmed) return null;

    // 1. Supabase search with multi-pattern phone matching
    let user = await RealtimeCoordinator.findUserByEmailOrPhone(trimmed);

    // 2. Merge with Firestore to guarantee all 2FA & preferences fields
    if (user?.uid) {
      try {
        const fsDocSnap = await getDoc(doc(db, 'users', user.uid));
        if (fsDocSnap.exists()) {
          const fsData = fsDocSnap.data();
          user = {
            ...user,
            ...fsData,
            displayName: user.display_name || fsData.displayName,
            photoURL: user.photo_url || fsData.photoURL,
            phoneNumber: user.phone_number || fsData.phoneNumber,
            authenticator_secret: user.authenticator_secret || fsData.authenticatorSecret || fsData.preferences?.authenticatorSecret,
            recovery_codes: user.recovery_codes || fsData.recoveryCodes || fsData.preferences?.recoveryCodes || [],
            authenticator_enabled: !!(user.authenticator_enabled || fsData.authenticatorEnabled || fsData.preferences?.authenticatorEnabled || user.authenticator_secret || fsData.authenticatorSecret),
            hasPassword: !!(user.hasPassword || fsData.hasPassword || fsData.preferences?.hasPassword),
          };
        }
      } catch (e) {
        console.warn('[LoginModal] Firestore merge warning:', e);
      }
    } else {
      // 3. Fallback: Search Firestore directly across all format variations
      user = await findFirestoreUserByEmailOrPhone(trimmed);
    }

    return user;
  };

  // Firestore multi-pattern lookup helper
  const findFirestoreUserByEmailOrPhone = async (queryStr: string) => {
    const trimmed = queryStr.trim();
    const clean = trimmed.toLowerCase();

    // If email
    if (clean.includes('@')) {
      const emailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', clean))).catch(() => null);
      if (emailSnap && !emailSnap.empty) {
        const docSnap = emailSnap.docs[0];
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          ...data,
          authenticator_secret: data.authenticatorSecret || data.preferences?.authenticatorSecret,
          recovery_codes: data.recoveryCodes || data.preferences?.recoveryCodes || [],
          authenticator_enabled: !!(data.authenticatorEnabled || data.preferences?.authenticatorEnabled || data.authenticatorSecret),
          hasPassword: !!(data.hasPassword || data.preferences?.hasPassword),
        };
      }
    }

    // Generate phone variations
    const digits = trimmed.replace(/\D/g, '');
    let coreDigits = digits;
    if (digits.startsWith('991') && digits.length >= 10) {
      coreDigits = digits.slice(3);
    } else if (digits.startsWith('0') && digits.length === 8) {
      coreDigits = digits.slice(1);
    }

    const variations = new Set<string>();
    variations.add(trimmed);
    if (digits) {
      variations.add(digits);
      variations.add(`+${digits}`);
    }
    if (coreDigits.length === 7) {
      variations.add(`+991 ${coreDigits.slice(0, 3)} ${coreDigits.slice(3)}`);
      variations.add(`+991${coreDigits}`);
      variations.add(`+991 ${coreDigits}`);
      variations.add(coreDigits);
      variations.add(`${coreDigits.slice(0, 3)} ${coreDigits.slice(3)}`);
    }

    const varList = Array.from(variations).slice(0, 10);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('phoneNumber', 'in', varList)));
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          ...data,
          authenticator_secret: data.authenticatorSecret || data.preferences?.authenticatorSecret,
          recovery_codes: data.recoveryCodes || data.preferences?.recoveryCodes || [],
          authenticator_enabled: !!(data.authenticatorEnabled || data.preferences?.authenticatorEnabled || data.authenticatorSecret),
          hasPassword: !!(data.hasPassword || data.preferences?.hasPassword),
        };
      }
    } catch {}

    // In-memory scan fallback
    if (digits.length >= 6) {
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(50)));
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const uDigits = (data.phoneNumber || '').replace(/\D/g, '');
          if (uDigits && (uDigits.includes(coreDigits) || coreDigits.includes(uDigits))) {
            return {
              uid: docSnap.id,
              ...data,
              authenticator_secret: data.authenticatorSecret || data.preferences?.authenticatorSecret,
              recovery_codes: data.recoveryCodes || data.preferences?.recoveryCodes || [],
              authenticator_enabled: !!(data.authenticatorEnabled || data.preferences?.authenticatorEnabled || data.authenticatorSecret),
              hasPassword: !!(data.hasPassword || data.preferences?.hasPassword),
            };
          }
        }
      } catch {}
    }

    return null;
  };

  // =========================================================================
  // STEP 1: PROCEED FROM IDENTIFIER (EMAIL OR PHONE NUMBER)
  // =========================================================================
  const handleProceedFromIdentifier = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryTerm = identifier.trim();
    if (!queryTerm) return;

    try {
      setIsResolvingAccount(true);
      setAuthError(null);

      const user = await findUserUniversal(queryTerm);

      if (!user) {
        setAuthError('No account found with this email or virtual phone number. Please check your entry or switch to Create Account.');
        return;
      }

      setResolvedAccount(user);

      // Check if this account was created with Google and lacks a password
      const isGoogle = !!(
        user.photoURL?.includes('googleusercontent.com') ||
        user.photo_url?.includes('googleusercontent.com') ||
        user.providerId === 'google.com' ||
        user.provider_id === 'google.com' ||
        user.email?.endsWith('@gmail.com')
      );
      const hasPwd = !!(user.hasPassword || user.preferences?.hasPassword);

      if (isGoogle && !hasPwd) {
        // Account created with Google, no password yet!
        const hasAuth2FA = !!(
          user.authenticator_enabled || 
          user.authenticatorEnabled || 
          user.preferences?.authenticatorEnabled || 
          user.authenticator_secret || 
          user.authenticatorSecret ||
          user.preferences?.authenticatorSecret
        );

        if (hasAuth2FA) {
          // Verify with Authenticator first before password creation
          setGoogleTotpCode('');
          setGoogleRecoveryCode('');
          setGoogleUseRecovery(false);
          setGoogleTotpError(null);
          setSignInStep('google_verify_totp');
        } else {
          // Authenticator not enabled: allow setting password directly
          setGoogleNewPassword('');
          setGoogleConfirmPassword('');
          setSignInStep('google_create_password');
        }
      } else {
        // Standard password account
        setPassword('');
        setSignInStep('enter_password');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error checking account.');
    } finally {
      setIsResolvingAccount(false);
    }
  };

  // =========================================================================
  // STEP 2A: STANDARD PASSWORD SIGN IN
  // =========================================================================
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    try {
      setIsResolvingAccount(true);
      setAuthError(null);
      const targetEmail = resolvedAccount?.email || (identifier.includes('@') ? identifier : `${resolvedAccount?.uid || identifier}@limochat.internal`);
      await signInWithEmail(targetEmail, password);
    } catch (err: any) {
      const isGoogle = !!(
        resolvedAccount?.photoURL?.includes('googleusercontent.com') ||
        resolvedAccount?.photo_url?.includes('googleusercontent.com') ||
        resolvedAccount?.providerId === 'google.com' ||
        resolvedAccount?.provider_id === 'google.com'
      );
      if (isGoogle && !resolvedAccount?.hasPassword) {
        setAuthError('This email is registered with Google. You can create a password below or sign in directly with Google.');
        setSignInStep('google_create_password');
        return;
      }
      setAuthError(formatAuthErrorMessage(err, { email: resolvedAccount?.email || identifier, isGoogleUser: isGoogle }));
    } finally {
      setIsResolvingAccount(false);
    }
  };

  // =========================================================================
  // STEP 2B: GOOGLE ACCOUNT - VERIFY 2FA AUTHENTICATOR
  // =========================================================================
  const handleVerifyGoogleTotp = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const rawCode = (codeOverride !== undefined ? codeOverride : (googleUseRecovery ? googleRecoveryCode : googleTotpCode)).trim();
    if (!rawCode) return;

    if (!resolvedAccount) {
      setAuthError('Account session lost. Please try again.');
      setSignInStep('enter_identifier');
      return;
    }

    try {
      setIsResolvingAccount(true);
      setGoogleTotpError(null);

      const secret = resolvedAccount.authenticator_secret || resolvedAccount.authenticatorSecret || resolvedAccount.preferences?.authenticatorSecret;
      const recoveryCodes = resolvedAccount.recovery_codes || resolvedAccount.recoveryCodes || resolvedAccount.preferences?.recoveryCodes || [];

      let isValid = false;

      // Try 6-digit TOTP
      const cleanDigits = rawCode.replace(/\D/g, '');
      if (cleanDigits.length === 6 && secret) {
        isValid = await verifyTotpToken(cleanDigits, secret);
      }

      // Try recovery code
      if (!isValid && recoveryCodes.length > 0) {
        const recResult = verifyRecoveryCode(rawCode, recoveryCodes);
        if (recResult.valid) {
          isValid = true;
          // Update remaining recovery codes in both Supabase and Firestore
          if (resolvedAccount.uid) {
            await RealtimeCoordinator.updateUserAuthenticator(resolvedAccount.uid, true, secret, recResult.remainingCodes).catch(() => {});
            await updateDoc(doc(db, 'users', resolvedAccount.uid), { 
              recoveryCodes: recResult.remainingCodes,
              'preferences.recoveryCodes': recResult.remainingCodes
            }).catch(() => {});
          }
        }
      }

      if (!isValid) {
        setGoogleTotpError('Invalid 6-digit Authenticator code. Please check Google/Microsoft Authenticator and ensure your device clock is accurate.');
        return;
      }

      // Verified! Proceed to password creation
      setGoogleNewPassword('');
      setGoogleConfirmPassword('');
      setSignInStep('google_create_password');
    } catch (err: any) {
      setGoogleTotpError(err.message || 'Verification failed.');
    } finally {
      setIsResolvingAccount(false);
    }
  };

  // =========================================================================
  // STEP 2C: GOOGLE ACCOUNT - CREATE / CHANGE PASSWORD & SIGN IN
  // Persists to both Firestore AND Supabase
  // =========================================================================
  const handleSaveGooglePasswordAndSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (googleNewPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (googleNewPassword !== googleConfirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    try {
      setIsResolvingAccount(true);
      setAuthError(null);

      if (resolvedAccount.uid && resolvedAccount.email) {
        await createOrUpdatePasswordForUser(resolvedAccount.uid, resolvedAccount.email, googleNewPassword);
      }

      // Complete login:
      // Attempt email sign in with the new password
      try {
        await signInWithEmail(resolvedAccount.email, googleNewPassword);
      } catch (err: any) {
        // Queue password to link with Google session
        sessionStorage.setItem('limochat_pending_password_link', googleNewPassword);
        await signInWithGoogle();
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to set password.');
    } finally {
      setIsResolvingAccount(false);
    }
  };

  // =========================================================================
  // CREATE ACCOUNT (SIGN UP)
  // =========================================================================
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!fullName.trim() || !signupEmail.trim()) return;
    try {
      await signUpWithEmail(fullName.trim(), signupEmail.trim(), signupPassword || 'Password123!');
    } catch (err: any) {
      setAuthError(formatAuthErrorMessage(err));
    }
  };

  // =========================================================================
  // FORGOT PASSWORD FLOW (AUTHENTICATOR 2FA VERIFICATION & DUAL-DB SYNC)
  // =========================================================================
  const handleFindForgotAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryTerm = forgotInput.trim();
    if (!queryTerm) return;
    try {
      setIsForgotLoading(true);
      setForgotError(null);

      const user = await findUserUniversal(queryTerm);

      if (!user) {
        setForgotError('No account found with this email or virtual phone number.');
        return;
      }

      setForgotUser(user);
      setTotpCode('');
      setRecoveryCodeInput('');
      setUseRecoveryMode(false);

      const hasAuth = !!(
        user.authenticator_enabled || 
        user.authenticatorEnabled || 
        user.preferences?.authenticatorEnabled || 
        user.authenticator_secret || 
        user.authenticatorSecret || 
        user.preferences?.authenticatorSecret
      );

      if (hasAuth) {
        setForgotStep('verify_totp');
      } else {
        setForgotError('Password reset requires Two-Factor Authentication (Authenticator App / 2FA) previously enabled in Settings. If you have not configured 2FA yet, please sign in with your credentials or contact official support.');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Error finding account.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleVerifyForgotTotp = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const rawCode = (codeOverride !== undefined ? codeOverride : (useRecoveryMode ? recoveryCodeInput : totpCode)).trim();
    if (!rawCode) return;

    if (!forgotUser) {
      setForgotError('Account session lost. Please try again.');
      setForgotStep('find');
      return;
    }

    try {
      setIsForgotLoading(true);
      setForgotError(null);

      const secret = forgotUser.authenticator_secret || forgotUser.authenticatorSecret || forgotUser.preferences?.authenticatorSecret;
      const recoveryCodes = forgotUser.recovery_codes || forgotUser.recoveryCodes || forgotUser.preferences?.recoveryCodes || [];

      let isValid = false;

      // Try 6-digit TOTP
      const cleanDigits = rawCode.replace(/\D/g, '');
      if (cleanDigits.length === 6 && secret) {
        isValid = await verifyTotpToken(cleanDigits, secret);
      }

      // Try backup recovery code
      if (!isValid && recoveryCodes.length > 0) {
        const recResult = verifyRecoveryCode(rawCode, recoveryCodes);
        if (recResult.valid) {
          isValid = true;
          if (forgotUser.uid) {
            await RealtimeCoordinator.updateUserAuthenticator(forgotUser.uid, true, secret, recResult.remainingCodes).catch(() => {});
            await updateDoc(doc(db, 'users', forgotUser.uid), { 
              recoveryCodes: recResult.remainingCodes,
              'preferences.recoveryCodes': recResult.remainingCodes
            }).catch(() => {});
          }
        }
      }

      if (!isValid) {
        if (cleanDigits.length === 6) {
          setForgotError('Invalid 6-digit Authenticator code. Ensure your device clock is accurate and check Google/Microsoft Authenticator.');
        } else {
          setForgotError('Invalid code. Please enter the current 6-digit Authenticator code or a valid 8-character backup recovery code.');
        }
        return;
      }

      setForgotStep('new_password');
    } catch (err: any) {
      setForgotError(err.message || 'Verification failed.');
    } finally {
      setIsForgotLoading(false);
    }
  };

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

      if (forgotUser.uid && forgotUser.email) {
        await createOrUpdatePasswordForUser(forgotUser.uid, forgotUser.email, newPassword);
      }

      if (forgotUser.email && !forgotUser.email.endsWith('@limochat.internal')) {
        await sendPasswordResetEmail(auth, forgotUser.email).catch(() => {});
        setForgotSuccessNotice(`Identity verified via Authenticator! Password updated and official confirmation sent to ${forgotUser.email}. You can now sign in.`);
      } else {
        setForgotSuccessNotice('Identity verified via Authenticator! Your password has been successfully updated in both cloud databases. You can now sign in.');
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

          {/* Theme Switcher Pill */}
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

        {/* Error Alert Banner */}
        {authError && activeTab !== 'forgot' && (
          <div className="w-full bg-red-500/10 border border-red-500/25 rounded-2xl p-3.5 mb-4 text-xs text-red-200 animate-fade-in shadow-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium text-red-200">{authError}</div>
          </div>
        )}

        {/* =========================================================================
            VIEW A: SIGN IN & CREATE ACCOUNT
            ========================================================================= */}
        {activeTab !== 'forgot' && (
          <>
            {/* Google Sign-In Button */}
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
                or with email or number
              </span>
              <div className="flex-1 border-t border-gray-200 dark:border-[#222e35]" />
            </div>

            {/* Segmented Tab Switcher (Sign In vs Create Account) */}
            <div className="login-tabs-wrap flex w-full p-1 rounded-2xl my-2 bg-gray-100 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setSignInStep('enter_identifier');
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

            {/* ===============================================================
                TAB 1: SIGN IN (ADAPTIVE MULTI-STEP)
                =============================================================== */}
            {activeTab === 'signin' && (
              <div className="w-full mt-2 space-y-3">
                {/* -------------------------------------------------------------
                    SUB-STEP 1: ENTER IDENTIFIER (EMAIL OR NUMBER)
                    ------------------------------------------------------------- */}
                {signInStep === 'enter_identifier' && (
                  <form onSubmit={handleProceedFromIdentifier} className="space-y-3 animate-fade-in">
                    <div className="space-y-1">
                      <div className="relative flex items-center">
                        {isIdentifierPhoneLike ? (
                          <Smartphone className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-[#00a884]" />
                        ) : (
                          <Mail className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
                        )}
                        <input
                          type="text"
                          placeholder="Email address or +991 virtual number"
                          value={identifier}
                          onChange={(e) => {
                            setIdentifier(e.target.value);
                            setAuthError(null);
                          }}
                          required
                          autoFocus
                          className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-[#8696a0] px-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#00a884]" />
                        <span>Supports any format (e.g. +991 454 5160, +9914545160, or 4545160)</span>
                      </p>
                    </div>

                    {/* Forgot Password link */}
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('forgot');
                          setForgotStep('find');
                          setForgotError(null);
                          setForgotSuccessNotice(null);
                          setForgotInput(identifier);
                        }}
                        className="text-xs text-[#00a884] hover:underline cursor-pointer font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy || !identifier.trim()}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer mt-1 bg-[#00a884] hover:bg-[#02906f] text-white shadow-md shadow-[#00a884]/20 transition active:scale-95 disabled:opacity-50"
                    >
                      {isResolvingAccount ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Next</span>
                          <ArrowRight className="w-4 h-4 text-white" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* -------------------------------------------------------------
                    SUB-STEP 2A: STANDARD PASSWORD ENTRY
                    ------------------------------------------------------------- */}
                {signInStep === 'enter_password' && resolvedAccount && (
                  <form onSubmit={handlePasswordSignIn} className="space-y-3.5 animate-fade-in">
                    {/* Resolved Account Card */}
                    <div className="w-full bg-gray-100 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={resolvedAccount.photoURL || resolvedAccount.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resolvedAccount.uid}`}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full object-cover border border-[#00a884]/40 flex-shrink-0"
                        />
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {resolvedAccount.displayName || resolvedAccount.display_name || 'LimoChat Member'}
                          </div>
                          <div className="text-[11px] text-[#00a884] font-mono truncate">
                            {resolvedAccount.phoneNumber || resolvedAccount.phone_number || resolvedAccount.email}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSignInStep('enter_identifier');
                          setAuthError(null);
                        }}
                        className="text-[11px] text-[#8696a0] hover:text-[#00a884] hover:underline px-2 py-1 rounded-lg transition cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
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
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('forgot');
                          setForgotStep('find');
                          setForgotError(null);
                          setForgotSuccessNotice(null);
                          setForgotInput(resolvedAccount.phoneNumber || resolvedAccount.email || identifier);
                        }}
                        className="text-xs text-[#00a884] hover:underline cursor-pointer font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy || !password}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer bg-[#00a884] hover:bg-[#02906f] text-white shadow-md shadow-[#00a884]/20 transition active:scale-95 disabled:opacity-50"
                    >
                      {isResolvingAccount ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Sign In to LimoChat</span>
                          <ArrowRight className="w-4 h-4 text-white" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* -------------------------------------------------------------
                    SUB-STEP 2B: GOOGLE ACCOUNT 2FA AUTHENTICATOR VERIFICATION
                    ------------------------------------------------------------- */}
                {signInStep === 'google_verify_totp' && resolvedAccount && (
                  <form onSubmit={(e) => handleVerifyGoogleTotp(e)} className="space-y-4 animate-fade-in">
                    {/* Resolved Account Card */}
                    <div className="w-full bg-gray-100 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={resolvedAccount.photoURL || resolvedAccount.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resolvedAccount.uid}`}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full object-cover border border-[#00a884]/40 flex-shrink-0"
                        />
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {resolvedAccount.displayName || resolvedAccount.display_name || 'LimoChat Member'}
                          </div>
                          <div className="text-[11px] text-[#00a884] font-mono truncate">
                            {resolvedAccount.phoneNumber || resolvedAccount.phone_number || resolvedAccount.email}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSignInStep('enter_identifier');
                          setAuthError(null);
                        }}
                        className="text-[11px] text-[#8696a0] hover:text-[#00a884] hover:underline px-2 py-1 rounded-lg transition cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#00a884]/10 border border-[#00a884]/25 flex items-center gap-2.5 text-xs text-[#00a884]">
                      <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                      <span className="font-semibold">Google Account Protected with Authenticator</span>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-[#8696a0] leading-relaxed text-center">
                      {googleUseRecovery
                        ? 'Enter your 8-character backup recovery code:'
                        : 'Enter the 6-digit code from Google/Microsoft Authenticator to verify identity:'}
                    </p>

                    {googleTotpError && (
                      <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{googleTotpError}</span>
                      </div>
                    )}

                    {googleUseRecovery ? (
                      <div className="relative flex items-center">
                        <KeyRound className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="ABCD-1234"
                          value={googleRecoveryCode}
                          onChange={(e) => {
                            setGoogleRecoveryCode(e.target.value.toUpperCase());
                            setGoogleTotpError(null);
                          }}
                          required
                          className="w-full text-center text-lg font-mono font-bold tracking-widest py-3 bg-gray-50 dark:bg-[#111b21] border-2 border-[#00a884] rounded-2xl text-gray-900 dark:text-white focus:outline-none uppercase"
                        />
                      </div>
                    ) : (
                      <div className="py-1">
                        <OtpBoxInput
                          length={6}
                          value={googleTotpCode}
                          onChange={(val) => {
                            setGoogleTotpCode(val);
                            setGoogleTotpError(null);
                          }}
                          onComplete={(code) => {
                            handleVerifyGoogleTotp(undefined, code);
                          }}
                          disabled={isResolvingAccount}
                          isError={!!googleTotpError}
                          autoFocus={true}
                        />
                        <p className="text-[11px] text-gray-400 dark:text-[#8696a0] text-center mt-2 flex items-center justify-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
                          <span>Auto-verifies immediately on 6th digit</span>
                        </p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isResolvingAccount || (googleUseRecovery ? !googleRecoveryCode.trim() : googleTotpCode.length !== 6)}
                      className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      {isResolvingAccount ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Verify & Continue</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleUseRecovery(!googleUseRecovery);
                          setGoogleTotpError(null);
                        }}
                        className="text-xs text-[#00a884] hover:underline cursor-pointer font-medium"
                      >
                        {googleUseRecovery ? 'Use 6-digit Authenticator code instead' : 'Lost authenticator? Use backup recovery code'}
                      </button>
                    </div>
                  </form>
                )}

                {/* -------------------------------------------------------------
                    SUB-STEP 2C: GOOGLE ACCOUNT - CREATE / CHANGE PASSWORD
                    ------------------------------------------------------------- */}
                {signInStep === 'google_create_password' && resolvedAccount && (
                  <form onSubmit={handleSaveGooglePasswordAndSignIn} className="space-y-3.5 animate-fade-in">
                    {/* Resolved Account Card */}
                    <div className="w-full bg-gray-100 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={resolvedAccount.photoURL || resolvedAccount.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resolvedAccount.uid}`}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full object-cover border border-[#00a884]/40 flex-shrink-0"
                        />
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {resolvedAccount.displayName || resolvedAccount.display_name || 'LimoChat Member'}
                          </div>
                          <div className="text-[11px] text-[#00a884] font-mono truncate">
                            {resolvedAccount.phoneNumber || resolvedAccount.phone_number || resolvedAccount.email}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSignInStep('enter_identifier');
                          setAuthError(null);
                        }}
                        className="text-[11px] text-[#8696a0] hover:text-[#00a884] hover:underline px-2 py-1 rounded-lg transition cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-[#00a884]" />
                        <span>Create Password for Direct Login</span>
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-[#8696a0] leading-relaxed">
                        Set a secure password so you can log in directly with your virtual number or email anytime.
                      </p>
                    </div>

                    {/* New Password */}
                    <div className="space-y-1">
                      <div className="relative flex items-center">
                        <KeyRound className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                        <input
                          type={showGoogleNewPassword ? 'text' : 'password'}
                          placeholder="New password (min 6 characters)"
                          value={googleNewPassword}
                          onChange={(e) => {
                            setGoogleNewPassword(e.target.value);
                            setAuthError(null);
                          }}
                          required
                          autoFocus
                          className="login-form-input w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGoogleNewPassword(!showGoogleNewPassword)}
                          aria-label={showGoogleNewPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3.5 p-1 text-gray-400 hover:text-gray-600 dark:text-[#8696a0] dark:hover:text-white transition cursor-pointer"
                        >
                          {showGoogleNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Strength Indicator */}
                      {googleNewPassword && (
                        <div className="px-1 pt-1 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 flex-1 mr-3">
                            <div className="h-1.5 flex-1 bg-gray-200 dark:bg-[#2e3b44] rounded-full overflow-hidden flex gap-1">
                              <div
                                className={`h-full transition-all duration-300 rounded-full ${
                                  getPasswordStrength(googleNewPassword).score >= 1 ? 'w-1/3 ' + getPasswordStrength(googleNewPassword).barClass : 'w-0'
                                }`}
                              />
                              <div
                                className={`h-full transition-all duration-300 rounded-full ${
                                  getPasswordStrength(googleNewPassword).score >= 2 ? 'w-1/3 ' + getPasswordStrength(googleNewPassword).barClass : 'w-0'
                                }`}
                              />
                              <div
                                className={`h-full transition-all duration-300 rounded-full ${
                                  getPasswordStrength(googleNewPassword).score >= 3 ? 'w-1/3 ' + getPasswordStrength(googleNewPassword).barClass : 'w-0'
                                }`}
                              />
                            </div>
                          </div>
                          <span className={`font-semibold ${getPasswordStrength(googleNewPassword).textClass}`}>
                            {getPasswordStrength(googleNewPassword).label}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1">
                      <div className="relative flex items-center">
                        <KeyRound className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                        <input
                          type={showGoogleConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm new password"
                          value={googleConfirmPassword}
                          onChange={(e) => {
                            setGoogleConfirmPassword(e.target.value);
                            setAuthError(null);
                          }}
                          required
                          className="login-form-input w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGoogleConfirmPassword(!showGoogleConfirmPassword)}
                          aria-label={showGoogleConfirmPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3.5 p-1 text-gray-400 hover:text-gray-600 dark:text-[#8696a0] dark:hover:text-white transition cursor-pointer"
                        >
                          {showGoogleConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {googleConfirmPassword && (
                        <div className="px-1 flex items-center gap-1.5 text-[11px]">
                          {googleNewPassword === googleConfirmPassword ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                              <Check className="w-3.5 h-3.5" /> Passwords match
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1 font-semibold">
                              <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy || !googleNewPassword || !googleConfirmPassword || googleNewPassword !== googleConfirmPassword || googleNewPassword.length < 6}
                      className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2 mt-1"
                    >
                      {isResolvingAccount ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Save Password & Sign In</span>
                        </>
                      )}
                    </button>

                    <div className="relative flex items-center my-2">
                      <div className="flex-1 border-t border-gray-200 dark:border-[#2e3b44]" />
                      <span className="px-2 text-[10px] text-[#8696a0] uppercase">or</span>
                      <div className="flex-1 border-t border-gray-200 dark:border-[#2e3b44]" />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (googleNewPassword && googleNewPassword.length >= 6 && googleNewPassword === googleConfirmPassword) {
                          sessionStorage.setItem('limochat_pending_password_link', googleNewPassword);
                        }
                        signInWithGoogle();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Sign In directly with Google</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ===============================================================
                TAB 2: CREATE ACCOUNT (SIGN UP)
                =============================================================== */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignUpSubmit} className="w-full space-y-3 mt-2 animate-fade-in">
                <div className="relative flex items-center">
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

                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                  />
                </div>

                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    placeholder="Password (min 6 characters)"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    className="login-form-input w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 p-1 text-gray-400 hover:text-gray-600 dark:text-[#8696a0] dark:hover:text-white transition cursor-pointer"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isBusy || !fullName.trim() || !signupEmail.trim()}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer mt-1 bg-[#00a884] hover:bg-[#02906f] text-white shadow-md shadow-[#00a884]/20 transition active:scale-95 disabled:opacity-50"
                >
                  <span>Create Account & Get +991 Number</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </form>
            )}
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
                  setSignInStep('enter_identifier');
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
                <div className="space-y-1">
                  <div className="relative flex items-center">
                    {isForgotPhoneLike ? (
                      <Smartphone className="w-4 h-4 absolute left-3.5 text-[#00a884] pointer-events-none" />
                    ) : (
                      <Mail className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                    )}
                    <input
                      type="text"
                      placeholder="Email or +991 virtual number"
                      value={forgotInput}
                      onChange={(e) => {
                        setForgotInput(e.target.value);
                        setForgotError(null);
                      }}
                      required
                      autoFocus
                      className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-[#8696a0] px-1">
                    Supports any format (with or without spaces, with or without +991)
                  </p>
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
              <form onSubmit={(e) => handleVerifyForgotTotp(e)} className="space-y-4">
                <div className="p-3 rounded-2xl bg-[#00a884]/10 border border-[#00a884]/25 flex items-center gap-2.5 text-xs text-[#00a884]">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span className="font-semibold">Authenticator Connected & Protected</span>
                </div>

                <p className="text-xs text-gray-500 dark:text-[#8696a0] leading-relaxed text-center">
                  {useRecoveryMode
                    ? 'Enter your 8-character backup recovery code:'
                    : 'Enter the 6-digit code from your Authenticator app:'}
                </p>

                {useRecoveryMode ? (
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="ABCD-1234"
                      value={recoveryCodeInput}
                      onChange={(e) => {
                        setRecoveryCodeInput(e.target.value.toUpperCase());
                        setForgotError(null);
                      }}
                      required
                      className="w-full text-center text-lg font-mono font-bold tracking-widest py-3 bg-gray-50 dark:bg-[#111b21] border-2 border-[#00a884] rounded-2xl text-gray-900 dark:text-white focus:outline-none uppercase"
                    />
                  </div>
                ) : (
                  <div className="py-1">
                    <OtpBoxInput
                      length={6}
                      value={totpCode}
                      onChange={(val) => {
                        setTotpCode(val);
                        setForgotError(null);
                      }}
                      onComplete={(code) => {
                        handleVerifyForgotTotp(undefined, code);
                      }}
                      disabled={isForgotLoading}
                      isError={!!forgotError}
                      autoFocus={true}
                    />
                    <p className="text-[11px] text-gray-400 dark:text-[#8696a0] text-center mt-2 flex items-center justify-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
                      <span>Auto-verifies instantly on 6th digit</span>
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isForgotLoading || (useRecoveryMode ? !recoveryCodeInput.trim() : totpCode.length !== 6)}
                  className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  {isForgotLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Verify & Proceed</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUseRecoveryMode(!useRecoveryMode);
                      setForgotError(null);
                    }}
                    className="text-xs text-[#00a884] hover:underline cursor-pointer font-medium"
                  >
                    {useRecoveryMode ? 'Use 6-digit Authenticator code instead' : 'Lost authenticator? Use backup recovery code'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Set New Password */}
            {forgotStep === 'new_password' && (
              <form onSubmit={handleSaveNewPassword} className="space-y-3.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-400">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Identity Verified! Create your new secure password:</span>
                </div>

                {/* New Password Input */}
                <div className="space-y-1">
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="New password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setForgotError(null);
                      }}
                      required
                      autoFocus
                      className="login-form-input w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 p-1 text-gray-400 hover:text-gray-600 dark:text-[#8696a0] dark:hover:text-white transition cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength Indicator */}
                  {newPassword && (
                    <div className="px-1 pt-1 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 flex-1 mr-3">
                        <div className="h-1.5 flex-1 bg-gray-200 dark:bg-[#2e3b44] rounded-full overflow-hidden flex gap-1">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              getPasswordStrength(newPassword).score >= 1 ? 'w-1/3 ' + getPasswordStrength(newPassword).barClass : 'w-0'
                            }`}
                          />
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              getPasswordStrength(newPassword).score >= 2 ? 'w-1/3 ' + getPasswordStrength(newPassword).barClass : 'w-0'
                            }`}
                          />
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              getPasswordStrength(newPassword).score >= 3 ? 'w-1/3 ' + getPasswordStrength(newPassword).barClass : 'w-0'
                            }`}
                          />
                        </div>
                      </div>
                      <span className={`font-semibold ${getPasswordStrength(newPassword).textClass}`}>
                        {getPasswordStrength(newPassword).label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-1">
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 absolute left-3.5 text-gray-400 dark:text-[#8696a0] pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        setForgotError(null);
                      }}
                      required
                      className="login-form-input w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all bg-gray-50 dark:bg-[#111b21] border border-gray-200 dark:border-[#2e3b44] text-gray-900 dark:text-white focus:border-[#00a884]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 p-1 text-gray-400 hover:text-gray-600 dark:text-[#8696a0] dark:hover:text-white transition cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {confirmNewPassword && (
                    <div className="px-1 flex items-center gap-1.5 text-[11px]">
                      {newPassword === confirmNewPassword ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <Check className="w-3.5 h-3.5" /> Passwords match
                        </span>
                      ) : (
                        <span className="text-red-400 flex items-center gap-1 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isForgotLoading || !newPassword || !confirmNewPassword || newPassword !== confirmNewPassword || newPassword.length < 6}
                  className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2 mt-2"
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
                    setSignInStep('enter_identifier');
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
