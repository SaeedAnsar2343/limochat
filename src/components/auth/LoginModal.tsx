import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  MessageSquare, 
  PhoneCall, 
  Users, 
  Lock, 
  Activity, 
  AlertCircle, 
  ExternalLink, 
  Mail, 
  User, 
  KeyRound, 
  ArrowRight,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { PrivacyPolicyModal } from '../pages/PrivacyPolicyModal';
import { TermsConditionsModal } from '../pages/TermsConditionsModal';
import { OperationalStatusModal } from '../pages/OperationalStatusModal';
import { WhatsNewModal } from '../pages/WhatsNewModal';

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

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  const toggleTheme = () => {
    setTheme(isLight ? 'dark' : 'light');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'signin') {
      if (!email.trim()) return;
      await signInWithEmail(email.trim(), password || 'Password123!');
    } else {
      if (!fullName.trim() || !email.trim()) return;
      await signUpWithEmail(fullName.trim(), email.trim(), password || 'Password123!');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center login-screen-bg p-4 overflow-y-auto select-none relative">
      {/* Interactive Background Floating Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="login-card rounded-3xl w-full max-w-md p-6 sm:p-8 flex flex-col items-center relative my-auto z-10 transition-all duration-300 animate-scale-in">
        
        {/* Top Header Bar with Badges & Theme Toggle */}
        <div className="flex items-center justify-between w-full mb-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWhatsNew(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 hover:bg-[#00a884]/25 transition cursor-pointer active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>v2.4.0 What's New</span>
            </button>

            <button
              type="button"
              onClick={() => setShowStatus(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/5 dark:bg-[#202c33] text-gray-700 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white border border-black/10 dark:border-[#2e3b44] transition cursor-pointer active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>Operational</span>
            </button>
          </div>

          {/* Interactive Light/Dark Theme Switcher Pill */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle visual theme"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-gray-700 dark:text-gray-200 border border-gray-300/80 dark:border-[#2e3b44] transition cursor-pointer active:scale-95 shadow-xs"
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight login-title">
          LimoChat
        </h1>
        <p className="text-xs text-gray-500 dark:text-[#8696a0] text-center mb-5 max-w-xs leading-relaxed login-subtitle">
          Private messaging, encrypted channels, and peer-to-peer audio & video calls.
        </p>

        {/* Virtual Phone Highlight Box */}
        <div className="virtual-number-card w-full rounded-2xl p-4 mb-5 transition-all duration-300 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-[#00a884] flex-shrink-0 mt-0.5 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  Private Virtual Line Assigned
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                  FREE
                </span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-[#8696a0] leading-relaxed">
                When you sign in or register, an encrypted virtual number starting with{' '}
                <strong className="text-emerald-700 dark:text-[#00a884] font-mono font-bold">+991</strong>{' '}
                is allocated. Your personal SIM is never exposed.
              </p>
            </div>
          </div>
        </div>

        {/* Error / Warning Alert Banner */}
        {authError && (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 mb-5 text-xs text-amber-900 dark:text-amber-200 space-y-2 animate-fade-in shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{authError}</div>
            </div>
            {window.location.hostname !== 'localhost' && (
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

        {/* Google Sign-In Action Button */}
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={isBusy}
          className="login-google-btn w-full py-3.5 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition cursor-pointer active:scale-[0.98] mb-4 disabled:opacity-60"
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
          <span className="text-white font-bold tracking-wide">
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
        <div className="login-tabs-wrap flex w-full p-1 rounded-2xl my-2 shadow-xs transition-colors">
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              setAuthError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'signin'
                ? 'login-tab-active bg-[#00a884] text-white shadow-sm'
                : 'login-tab-inactive text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white'
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
                ? 'login-tab-active bg-[#00a884] text-white shadow-sm'
                : 'login-tab-inactive text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white'
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
                className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-2.5 text-xs focus:outline-none transition-all"
              />
            </div>
          )}

          <div className="relative flex items-center">
            <Mail className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-form-input w-full rounded-xl pl-10 pr-3.5 py-2.5 text-xs focus:outline-none transition-all"
            />
          </div>

          <div className="relative flex items-center">
            <KeyRound className="w-4 h-4 login-input-icon absolute left-3.5 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (optional for quick login)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-form-input w-full rounded-xl pl-10 pr-10 py-2.5 text-xs focus:outline-none transition-all"
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

          <button
            type="submit"
            disabled={isBusy}
            className="login-submit-btn w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <span>
              {activeTab === 'signin' ? 'Sign In to LimoChat' : 'Create Account & Get +991 Number'}
            </span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        </form>

        {/* Feature Highlights Grid */}
        <div className="login-feature-item grid grid-cols-3 gap-3 w-full mt-6 pt-5 border-t border-gray-200 dark:border-[#222e35] text-center">
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
            <div className="text-[11px] text-gray-700 dark:text-[#8696a0] font-semibold">End-to-End Safe</div>
          </div>
        </div>

        {/* Legal & Terms Footer */}
        <div className="login-footer-text mt-5 text-[11px] text-gray-500 dark:text-[#8696a0] text-center space-x-1">
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
      <WhatsNewModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
    </div>
  );
};
