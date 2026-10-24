import React, { useRef } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Users2, 
  Scale, 
  Gavel, 
  Ban,
  ShieldAlert,
  Smartphone,
  Check,
  ArrowLeft,
  ShieldCheck,
  Lock,
  ExternalLink
} from 'lucide-react';
import { useRouter } from '../../utils/router';
import { useAuth } from '../../context/AuthContext';

export const TermsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleBack = () => {
    if (currentUser) {
      navigate('/home');
    } else {
      navigate('/login');
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#111b21] text-[#e9edef] flex flex-col overflow-y-auto selection:bg-[#00a884]/30">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-[#111b21]/95 backdrop-blur-xl border-b border-[#2e3b44] px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#202c33] transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-[#2e3b44]"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-[#00a884]" />
            <span className="hidden sm:inline">{currentUser ? 'Back to Chats' : 'Back to Login'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00a884]/20 border border-[#00a884]/30 flex items-center justify-center text-[#00a884]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">Terms of Service</h1>
              <p className="text-[10px] text-[#8696a0]">LimoChat Service Agreement • Updated 2026</p>
            </div>
          </div>
        </div>

        {/* Tab switch to Privacy */}
        <div className="flex items-center gap-1 bg-[#202c33] p-1 rounded-xl border border-[#2e3b44]">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00a884] text-white shadow-xs cursor-default"
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#8696a0] hover:text-white hover:bg-[#111b21] transition cursor-pointer"
          >
            Privacy Policy
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-8" ref={scrollRef}>
        {/* Quick Jump Bar */}
        <div className="flex items-center gap-2 p-3 bg-[#202c33] rounded-2xl border border-[#2e3b44] overflow-x-auto text-xs whitespace-nowrap scrollbar-none shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8696a0] mr-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" /> Quick Jump:
          </span>
          {[
            { id: 'sec-eligibility', label: '1. Eligibility & Accounts' },
            { id: 'sec-acceptable-use', label: '2. Acceptable Use & Groups' },
            { id: 'sec-violations', label: '3. Prohibited Content & Punishments' },
            { id: 'sec-telephony', label: '4. +991 Telephony Rules' },
            { id: 'sec-ip', label: '5. IP & Encryption Scope' },
            { id: 'sec-liability', label: '6. Disclaimers & SLA' },
            { id: 'sec-governing', label: '7. Disputes & Law' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="px-2.5 py-1 rounded-lg bg-[#111b21] hover:bg-[#2a3942] text-[#d1d7db] hover:text-[#00a884] border border-[#2e3b44] transition cursor-pointer font-medium text-[11px]"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Hero Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-[#005c4b]/20 to-[#00a884]/10 border border-[#00a884]/30 shadow-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#00a884] uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>End-to-End Encrypted Platform Standards</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            LimoChat Master User Agreement
          </h2>
          <p className="text-xs sm:text-sm text-[#8696a0] leading-relaxed">
            Welcome to LimoChat. These Terms of Service outline the acceptable use, cryptographic privacy protocols, virtual telephony guidelines, and safety standards governing your account across all platforms.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-6 text-xs sm:text-sm text-[#d1d7db] leading-relaxed">
          {/* Section 1 */}
          <section id="sec-eligibility" className="p-6 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-[#00a884]/20 rounded-lg text-[#00a884]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>1. Agreement to Terms & User Eligibility</span>
            </div>
            <p>
              By accessing LimoChat, authenticating with Google credentials, or utilizing any of our messaging, voice, video conference, community, or status features, you enter into a legally binding contract governed by these Terms of Service.
            </p>
            <p>
              You represent and warrant that you are at least 13 years old (or the legal age of digital consent in your jurisdiction) and possess full legal capacity to enter into these Terms. If you are using LimoChat on behalf of a corporation or entity, you confirm you hold requisite authorization.
            </p>
          </section>

          {/* Section 2 */}
          <section id="sec-acceptable-use" className="p-6 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
                <Users2 className="w-4 h-4" />
              </div>
              <span>2. Acceptable Use, Groups & Community Administration</span>
            </div>
            <p>
              LimoChat empowers individuals and organizations to collaborate freely. In using the platform, you agree to:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-[#111b21] p-3.5 rounded-2xl border border-[#2e3b44]">
                <div className="font-semibold text-white mb-1">Group Responsibility</div>
                <p className="text-xs text-[#8696a0]">
                  Group and Community administrators are responsible for managing member conduct, moderating topics, and setting appropriate message permissions.
                </p>
              </div>
              <div className="bg-[#111b21] p-3.5 rounded-2xl border border-[#2e3b44]">
                <div className="font-semibold text-white mb-1">Fair Network Usage</div>
                <p className="text-xs text-[#8696a0]">
                  Users must refrain from automated script spamming, bulk bot message distribution, or attempting denial-of-service disruptions against the network.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="sec-violations" className="p-6 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-red-500/20 rounded-lg text-red-400">
                <Ban className="w-4 h-4" />
              </div>
              <span>3. Prohibited Content, Zero Tolerance & Sanctions</span>
            </div>
            <p className="font-semibold text-white">Strictly Prohibited Behaviors & Materials:</p>
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl space-y-2">
              <h4 className="font-semibold text-red-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Zero-Tolerance Violations (Immediate Ban):
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-[#d1d7db] pl-1">
                <li><strong>Child Sexual Abuse Material (CSAM) or Child Exploitation:</strong> Handled with immediate permanent ban and direct reporting to statutory authorities (NCMEC).</li>
                <li><strong>Non-consensual sexual content, explicit pornography, or prostitution solicitation.</strong></li>
                <li><strong>Hate speech, violent extremism, terrorism promotion, or harassment campaigns.</strong></li>
                <li><strong>Fraud, identity theft, malware dissemination, or phishing exploits.</strong></li>
              </ul>
            </div>
            <p className="text-xs text-[#8696a0] pt-1">
              Violations detected through automated keyword moderation or user reports will lead to warnings, temporary time-based suspensions, or permanent account deactivations. Official LimoChat Support retains ultimate authority on sanction enforcement.
            </p>
          </section>

          {/* Section 4 */}
          <section id="sec-telephony" className="p-6 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-[#00a884]/20 rounded-lg text-[#00a884]">
                <Smartphone className="w-4 h-4" />
              </div>
              <span>4. Lifetime +991 Telephony & Routing Protocol</span>
            </div>
            <p>
              The <strong className="text-[#00a884] font-mono">+991</strong> virtual numbering plan is proprietary to LimoChat. Numbers are virtual routing identifiers designed for peer-to-peer data transport over IP and do not connect to physical PSTN emergency services (e.g., 911, 999, 112).
            </p>
            <div className="bg-[#111b21] p-3.5 rounded-2xl border border-[#2e3b44] text-xs space-y-1.5">
              <div className="font-semibold text-white">Emergency Services Notice:</div>
              <p className="text-[#8696a0]">
                LimoChat is not a replacement for traditional landline or mobile cellular telephone service. You must maintain alternative telecommunication access to reach emergency first responders.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="sec-ip" className="p-6 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                <Scale className="w-4 h-4" />
              </div>
              <span>5. Intellectual Property & End-to-End Encryption Scope</span>
            </div>
            <p>
              You retain full ownership of all text, photographs, audio notes, and media files you transmit across LimoChat. By sending content, you grant LimoChat only the technical license strictly required to deliver, route, and display that content to your designated recipients.
            </p>
            <p>
              The LimoChat software, interface designs, brand names, and source code are protected by international copyright, trademark, and intellectual property treaties.
            </p>
          </section>

          {/* Section 6 */}
          <section id="sec-liability" className="p-6 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-slate-500/20 rounded-lg text-slate-300">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span>6. Service Disclaimers, SLA & Limitations of Liability</span>
            </div>
            <p>
              LimoChat is provided on an "AS IS" and "AS AVAILABLE" basis. While we strive for 99.9% uptime, we do not guarantee uninterrupted, bug-free, or error-free operational continuity. Under no circumstances shall LimoChat or its operators be liable for indirect, incidental, punitive, or consequential damages arising from service usage or unavailability.
            </p>
          </section>

          {/* Section 7 */}
          <section id="sec-governing" className="p-6 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-cyan-500/20 rounded-lg text-cyan-400">
                <Gavel className="w-4 h-4" />
              </div>
              <span>7. Dispute Resolution & Governing Law</span>
            </div>
            <p>
              These Terms shall be interpreted and governed in accordance with international digital commerce laws. Any disputes, claims, or controversies shall first be submitted to good-faith informal mediation with LimoChat Legal Operations before initiating any formal arbitration.
            </p>
            <div className="bg-[#111b21] p-3.5 rounded-xl border border-[#2e3b44] text-xs text-[#8696a0]">
              Official Legal Operations: <span className="text-[#00a884] font-mono">legal@limochat.app</span> • LimoChat Service Agreement
            </div>
          </section>
        </div>

        {/* Bottom Actions */}
        <div className="p-6 rounded-2xl bg-[#202c33] border border-[#2e3b44] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[#8696a0]">
            <Check className="w-4 h-4 text-[#00a884]" />
            <span>By using LimoChat, you confirm agreement to these terms.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/privacy')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8696a0] hover:text-white hover:bg-[#111b21] transition cursor-pointer border border-[#2e3b44]"
            >
              View Privacy Policy
            </button>
            <button
              onClick={handleBack}
              className="px-6 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold transition shadow-md cursor-pointer"
            >
              {currentUser ? 'Return to Chats' : 'Return to Login'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
