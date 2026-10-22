import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  User, 
  Lock, 
  Check, 
  Copy, 
  ArrowRight, 
  Shield, 
  Camera, 
  CheckCircle,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../common/Avatar';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { currentUser, updateUserProfile, updatePrivacySettings, completeOnboarding } = useAuth();
  const [step, setStep] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState(currentUser?.displayName || 'User');
  const [about, setAbout] = useState(currentUser?.about || 'Hey there! I am using LimoChat.');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || AVATAR_OPTIONS[0]);
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState<'everyone' | 'nobody'>('everyone');
  const [isFinishing, setIsFinishing] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(currentUser.phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = async () => {
    try {
      setIsFinishing(true);
      await updateUserProfile({
        displayName: displayName.trim(),
        about: about.trim(),
        photoURL,
      });
      await updatePrivacySettings({
        readReceipts,
        lastSeen,
      });
      await completeOnboarding();
      onComplete();
    } catch (err: any) {
      console.warn("Onboarding complete warning:", err);
      onComplete();
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 pt-safe pb-safe select-none animate-fade-in overflow-y-auto">
      <div className="bg-[#182229]/95 border border-white/10 rounded-3xl w-full max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl flex flex-col backdrop-blur-2xl my-auto">
        {/* Step Progress Bar */}
        <div className="h-1.5 bg-[#111b21] flex">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 transition-all duration-300 ${
                s <= step ? 'bg-[#00a884]' : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Virtual Line Reveal */}
        {step === 1 && (
          <div className="p-7 space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-[#00a884]/20 border border-[#00a884]/30 text-[#00a884] flex items-center justify-center mx-auto shadow-lg shadow-[#00a884]/15">
              <Sparkles className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00a884] font-semibold bg-[#00a884]/10 px-2.5 py-0.5 rounded-full border border-[#00a884]/20">
                Welcome to LimoChat
              </span>
              <h2 className="text-xl font-bold text-white mt-2">
                Your Private Virtual Line is Allocated
              </h2>
              <p className="text-xs text-[#8696a0] max-w-sm mx-auto mt-1 leading-relaxed">
                Connect and call anywhere in the world without exposing your personal phone number or physical SIM card.
              </p>
            </div>

            {/* Glowing Virtual Number Badge */}
            <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44] flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#00a884]/20 text-[#00a884]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-[#8696a0] uppercase font-mono">Assigned Private Line</div>
                  <div className="text-base font-mono font-bold text-white tracking-wider">
                    {currentUser.phoneNumber}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyPhone}
                className="px-3 py-1.5 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-xs text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#00a884]" /> : <Copy className="w-3.5 h-3.5 text-[#8696a0]" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-3 bg-[#00a884] hover:bg-[#02906f] text-white rounded-2xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-[#00a884]/20"
            >
              <span>Continue to Profile Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Profile Customization */}
        {step === 2 && (
          <div className="p-7 space-y-5 animate-fade-in">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Customize Your Profile</h3>
              <p className="text-xs text-[#8696a0] mt-0.5">
                Choose an avatar and enter how you'll appear to your contacts.
              </p>
            </div>

            {/* Avatar Selection */}
            <div className="flex flex-col items-center gap-3">
              <Avatar src={photoURL} name={displayName} size="xl" />
              <div className="flex items-center gap-2">
                {AVATAR_OPTIONS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoURL(url)}
                    className={`w-9 h-9 rounded-full overflow-hidden border-2 transition ${
                      photoURL === url ? 'border-[#00a884] scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Display Name Input */}
            <div>
              <label className="text-xs text-[#8696a0] font-medium block mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
              />
            </div>

            {/* About / Tagline */}
            <div>
              <label className="text-xs text-[#8696a0] font-medium block mb-1">About / Status</label>
              <input
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="What's your status?"
                className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2.5 px-4 bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-white rounded-xl text-xs font-semibold transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                <span>Continue to Privacy</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Privacy & Security Settings */}
        {step === 3 && (
          <div className="p-7 space-y-5 animate-fade-in">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Privacy by Default</h3>
              <p className="text-xs text-[#8696a0] mt-0.5">
                Configure your privacy controls. You can update these anytime in Settings.
              </p>
            </div>

            <div className="bg-[#111b21] rounded-2xl border border-[#2e3b44] p-4 divide-y divide-[#222e35] space-y-3">
              {/* Last Seen Privacy */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <div className="text-xs font-semibold text-white">Last Seen & Online Status</div>
                  <div className="text-[11px] text-[#8696a0]">Show contacts when you're online</div>
                </div>
                <select
                  value={lastSeen}
                  onChange={(e) => setLastSeen(e.target.value as any)}
                  className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#00a884]"
                >
                  <option value="everyone">Everyone</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              {/* Read Receipts */}
              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-white">Read Receipts (Blue Ticks)</div>
                  <div className="text-[11px] text-[#8696a0]">Show two blue ticks when read</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReadReceipts(!readReceipts)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    readReceipts ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      readReceipts ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* End to End Encryption Confirmation */}
              <div className="flex items-center gap-3 pt-3">
                <div className="p-2 rounded-xl bg-[#00a884]/20 text-[#00a884]">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">End-to-End Encrypted Tunnel</div>
                  <div className="text-[11px] text-[#8696a0]">
                    Audio, video, voice notes, and messages are encrypted.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-2.5 px-4 bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-white rounded-xl text-xs font-semibold transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={isFinishing}
                className="flex-1 py-3 bg-[#00a884] hover:bg-[#02906f] text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-[#00a884]/20 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isFinishing ? 'Setting Up...' : 'Enter LimoChat'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
