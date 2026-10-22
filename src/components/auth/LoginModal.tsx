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
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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

  const isBusy = loading || isAuthenticating;

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0b141a] p-4 whatsapp-bg overflow-y-auto">
      <div className="bg-[#111b21] border border-[#222e35] text-[#e9edef] rounded-3xl w-full max-w-md shadow-2xl p-7 flex flex-col items-center relative my-auto">
        {/* Top Badges */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setShowWhatsNew(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 hover:bg-[#00a884]/25 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>v2.4.0 What's New</span>
          </button>

          <button
            onClick={() => setShowStatus(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#202c33] text-[#8696a0] hover:text-white border border-[#2e3b44] transition"
          >
            <Activity className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Operational</span>
          </button>
        </div>

        {/* Brand Icon */}
        <div className="relative mb-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#005c4b] to-[#00a884] flex items-center justify-center shadow-lg shadow-[#00a884]/20">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <span className="absolute -bottom-1 -right-1 bg-[#111b21] p-1 rounded-full">
            <Lock className="w-3.5 h-3.5 text-[#00a884]" />
          </span>
        </div>

        {/* App Title */}
        <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">LimoChat</h1>
        <p className="text-xs text-[#8696a0] text-center mb-5 max-w-xs leading-relaxed">
          Private messaging and peer-to-peer audio & video calls.
        </p>

        {/* Virtual Phone Highlight Box */}
        <div className="w-full bg-[#1e2a30] border border-[#2a3942] rounded-2xl p-3.5 mb-5">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-[#00a884]/15 text-[#00a884] flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white mb-0.5">
                Private Virtual Number Assigned
              </h4>
              <p className="text-[11px] text-[#8696a0] leading-relaxed">
                When you sign up or log in, a unique virtual number starting with <strong className="text-[#00a884] font-mono">+991</strong> is allocated. Your physical SIM card is never exposed.
              </p>
            </div>
          </div>
        </div>

        {/* Error / Unauthorized Domain Banner */}
        {authError && (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 mb-5 text-xs text-amber-200 space-y-2 animate-fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{authError}</div>
            </div>
            {window.location.hostname !== 'localhost' && (
              <a
                href={`http://localhost:${window.location.port || '5173'}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium transition"
              >
                <span>Switch to localhost:{window.location.port || '5173'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          onClick={signInWithGoogle}
          disabled={isBusy}
          className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-medium text-sm flex items-center justify-center gap-3 transition shadow-md shadow-[#00a884]/25 disabled:opacity-50 cursor-pointer active:scale-[0.99] mb-4"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          <span className="font-semibold">{isBusy ? 'Connecting with Google...' : 'Continue with Google'}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center w-full my-2">
          <div className="flex-1 border-t border-[#222e35]"></div>
          <span className="px-3 text-[11px] text-[#8696a0] uppercase tracking-wider">or with email</span>
          <div className="flex-1 border-t border-[#222e35]"></div>
        </div>

        {/* Tab Switcher: Sign In vs Create Account */}
        <div className="flex w-full bg-[#182229] p-1 rounded-xl border border-[#2a3942] my-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              setAuthError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'signin' ? 'bg-[#202c33] text-white shadow' : 'text-[#8696a0] hover:text-white'
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
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'signup' ? 'bg-[#00a884] text-white shadow' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleEmailSubmit} className="w-full space-y-2.5">
          {activeTab === 'signup' && (
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-[#8696a0] absolute left-3" />
              <input
                type="text"
                placeholder="Full Name (e.g. John Doe)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-[#182229] border border-[#2a3942] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
              />
            </div>
          )}

          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[#8696a0] absolute left-3" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#182229] border border-[#2a3942] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
            />
          </div>

          <div className="relative flex items-center">
            <KeyRound className="w-4 h-4 text-[#8696a0] absolute left-3" />
            <input
              type="password"
              placeholder="Password (optional for quick login)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#182229] border border-[#2a3942] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-white text-xs font-semibold flex items-center justify-center gap-2 border border-[#2e3b44] transition mt-1 cursor-pointer"
          >
            <span>{activeTab === 'signin' ? 'Sign In to LimoChat' : 'Create Account & Get +991 Number'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#00a884]" />
          </button>
        </form>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2 w-full mt-5 pt-4 border-t border-[#222e35] text-center">
          <div className="p-1">
            <PhoneCall className="w-4 h-4 text-[#00a884] mx-auto mb-1" />
            <div className="text-[10px] text-[#8696a0]">HD Calls</div>
          </div>
          <div className="p-1">
            <Users className="w-4 h-4 text-[#00a884] mx-auto mb-1" />
            <div className="text-[10px] text-[#8696a0]">Communities</div>
          </div>
          <div className="p-1">
            <ShieldCheck className="w-4 h-4 text-[#00a884] mx-auto mb-1" />
            <div className="text-[10px] text-[#8696a0]">End-to-End Safe</div>
          </div>
        </div>

        {/* Legal & Operational Links */}
        <div className="mt-4 text-[11px] text-[#8696a0] text-center space-x-1.5">
          <span>By continuing, you agree to our</span>
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-[#00a884] hover:underline cursor-pointer"
          >
            Terms
          </button>
          <span>and</span>
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="text-[#00a884] hover:underline cursor-pointer"
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Modals */}
      <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsConditionsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      <OperationalStatusModal isOpen={showStatus} onClose={() => setShowStatus(false)} />
      <WhatsNewModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
    </div>
  );
};
