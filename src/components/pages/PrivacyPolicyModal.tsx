import React, { useRef } from 'react';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  Smartphone, 
  Database, 
  EyeOff, 
  UserCheck, 
  Globe2, 
  FileCheck, 
  Server,
  Layers,
  AlertTriangle,
  Scale,
  Check
} from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in select-none">
      <div className="bg-[#202c33] text-[#e9edef] rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col modal-content">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e3b44] bg-[#111b21] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00a884]/20 rounded-2xl text-[#00a884] shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Privacy Policy & Safety Standard</h2>
              <p className="text-xs text-[#8696a0]">LimoChat Unified Privacy Document • Complete Full-Page Edition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Jump Table of Contents Bar (All sections on one single scrollable page) */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#182229] border-b border-[#2e3b44] overflow-x-auto text-xs whitespace-nowrap scrollbar-none flex-shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8696a0] mr-1">Quick Jump:</span>
          {[
            { id: 'sec-overview', label: '1. Zero-Knowledge' },
            { id: 'sec-collection', label: '2. Data & Telemetry' },
            { id: 'sec-virtual', label: '3. +991 Numbers' },
            { id: 'sec-encryption', label: '4. Calls & Encryption' },
            { id: 'sec-moderation', label: '5. Automated Policy Moderation' },
            { id: 'sec-deletion', label: '6. Message Ephemerality' },
            { id: 'sec-rights', label: '7. GDPR & Rights' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="px-2.5 py-1 rounded-lg bg-[#111b21] hover:bg-[#202c33] text-[#d1d7db] hover:text-[#00a884] border border-[#2e3b44] transition cursor-pointer font-medium text-[11px]"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Full Single-Page Scrollable Content (No tab restrictions) */}
        <div ref={scrollRef} className="p-6 overflow-y-auto space-y-8 text-xs sm:text-sm text-[#d1d7db] leading-relaxed flex-1">
          {/* Section 1 */}
          <section id="sec-overview" className="space-y-3 pt-1 border-b border-[#2e3b44]/60 pb-6">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-[#00a884]/20 rounded-lg text-[#00a884]">
                <Lock className="w-4 h-4" />
              </div>
              <span>1. Zero-Knowledge Architecture & Core Commitment</span>
            </div>
            <p>
              At LimoChat, our foundational architecture is constructed on strict zero-knowledge principles. We operate under the philosophy that private human communication must remain inviolable, completely free from cellular carrier snooping, government surveillance, targeted advertising algorithms, and third-party data broker harvesting.
            </p>
            <p>
              We do not monetize your personal information, we never sell contact records, and we do not profile your conversations or social graphs.
            </p>
          </section>

          {/* Section 2 */}
          <section id="sec-collection" className="space-y-3 border-b border-[#2e3b44]/60 pb-6">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
                <Database className="w-4 h-4" />
              </div>
              <span>2. Information We Collect vs. What We NEVER Collect</span>
            </div>
            <p className="font-semibold text-white">Information Required to Provide the Service:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#111b21] p-3.5 rounded-2xl border border-[#2e3b44]">
                <div className="font-semibold text-white mb-1">Account Routing Identifiers</div>
                <p className="text-xs text-[#8696a0]">
                  Your authenticated Google account email, chosen display name, avatar, and your allocated lifetime <strong>+991</strong> virtual routing number.
                </p>
              </div>
              <div className="bg-[#111b21] p-3.5 rounded-2xl border border-[#2e3b44]">
                <div className="font-semibold text-white mb-1">Presence & Device Preferences</div>
                <p className="text-xs text-[#8696a0]">
                  Real-time heartbeat pulse (online/offline state according to your privacy settings), theme, notification preferences, and custom wallpaper choices.
                </p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl space-y-2 mt-2">
              <h4 className="font-semibold text-red-400 flex items-center gap-1.5">
                <EyeOff className="w-4 h-4" /> What LimoChat Explicitly NEVER Collects:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#d1d7db] pl-1">
                <li>We NEVER collect your physical cellular phone number or SIM IMSI/IMEI identifiers.</li>
                <li>We NEVER access GPS location telemetry or track geographical cell tower triangulation.</li>
                <li>We NEVER scan or upload your local phonebook address book to our servers.</li>
                <li>We NEVER inject advertising cookies, behavioral trackers, or analytics pixels.</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="sec-virtual" className="space-y-3 border-b border-[#2e3b44]/60 pb-6">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-[#00a884]/20 rounded-lg text-[#00a884]">
                <Smartphone className="w-4 h-4" />
              </div>
              <span>3. Lifetime +991 Virtual Number Architecture</span>
            </div>
            <p>
              Traditional telecommunication platforms require binding a physical cellular line, exposing your identity to SIM-swapping, spam calls, cross-service credential stuffing, and cellular eavesdropping.
            </p>
            <div className="bg-[#111b21] p-4 rounded-2xl border border-[#00a884]/30 space-y-2">
              <div className="text-xs font-semibold text-[#00a884] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Complete Identity Decoupling
              </div>
              <p className="text-xs text-[#d1d7db] leading-relaxed">
                Your LimoChat line is issued as a private <strong>+991 XXX XXXX</strong> virtual identifier. It operates as your permanent cryptographic public address across the LimoChat network:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#8696a0] pl-1">
                <li>Share your +991 line freely or via QR code without exposing personal telephone lines.</li>
                <li>Completely impervious to SMS interception, carrier throttling, or mobile provider port-out scams.</li>
                <li>Seamlessly persists across all your mobile, tablet, and desktop devices.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="sec-encryption" className="space-y-3 border-b border-[#2e3b44]/60 pb-6">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-purple-500/20 rounded-lg text-purple-400">
                <Server className="w-4 h-4" />
              </div>
              <span>4. Calling Architecture, WebRTC & Cryptographic Streams</span>
            </div>
            <p>
              All voice calls and video conferences initiated within LimoChat leverage direct peer-to-peer <strong>WebRTC</strong> (Web Real-Time Communication) pipelines backed by DTLS-SRTP (Datagram Transport Layer Security - Secure Real-time Transport Protocol):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-[#111b21] p-3 rounded-xl border border-[#2e3b44] text-xs">
                <div className="font-semibold text-white mb-1">Direct Peer-to-Peer</div>
                <p className="text-[#8696a0]">Media streams travel directly between caller and callee devices without server interception.</p>
              </div>
              <div className="bg-[#111b21] p-3 rounded-xl border border-[#2e3b44] text-xs">
                <div className="font-semibold text-white mb-1">Zero Audio Recording</div>
                <p className="text-[#8696a0]">Voice packets are processed purely in ephemeral RAM and never stored on cloud hard drives.</p>
              </div>
              <div className="bg-[#111b21] p-3 rounded-xl border border-[#2e3b44] text-xs">
                <div className="font-semibold text-white mb-1">Ephemeral Signaling</div>
                <p className="text-[#8696a0]">Call handshake signals in Firestore are automatically purged immediately when calls finish.</p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="sec-moderation" className="space-y-3 border-b border-[#2e3b44]/60 pb-6">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span>5. Automated Content Moderation & Abuse Prevention Policies</span>
            </div>
            <p>
              To maintain a safe, welcoming, and legal communication ecosystem, LimoChat implements an automated real-time Content Safety & Abuse Engine:
            </p>
            <div className="bg-[#111b21] p-4 rounded-2xl border border-amber-500/30 space-y-3">
              <div className="text-xs font-semibold text-amber-400">
                Zero Tolerance Policy: Explicit Material, Child Safety & Harassment
              </div>
              <p className="text-xs text-[#d1d7db] leading-relaxed">
                The safety engine scans outgoing message payloads for strictly prohibited terminology (including sexual abuse, pornography, child exploitation, and abusive hate speech). When detected:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#8696a0] pl-1">
                <li>Prohibited terms are masked automatically in chat view (e.g., "***x", "***n").</li>
                <li>Violation incidents are securely logged for administrative review in the Compliance Desk.</li>
                <li>Depending on the severity or configured enforcement mode, users receive formal warnings or immediate temporary / permanent account suspensions.</li>
                <li>Suspended users retain the right to submit an appeal directly to official LimoChat Support.</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section id="sec-deletion" className="space-y-3 border-b border-[#2e3b44]/60 pb-6">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <span>6. "Delete for Everyone" & Message Ephemerality Guarantee</span>
            </div>
            <p>
              When a participant triggers <em>Delete for Everyone</em> or configures disappearing messages:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-[#8696a0] pl-1">
              <li>The cloud message document in Firestore is irrevocably overwritten with a deleted tombstone marker.</li>
              <li>Any attached media payloads (images, video notes, audio recordings, documents) are permanently expunged.</li>
              <li>Contact deletion is reciprocal: once a contact is removed, they can no longer view your status updates or message history according to your configuration.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section id="sec-rights" className="space-y-3 pb-2">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="p-1.5 bg-cyan-500/20 rounded-lg text-cyan-400">
                <FileCheck className="w-4 h-4" />
              </div>
              <span>7. Universal User Rights (GDPR, CCPA, CPRA) & Data Governance</span>
            </div>
            <p>
              We grant universal data rights to all LimoChat users globally:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-[#111b21] p-3 rounded-xl border border-[#2e3b44] text-xs">
                <div className="font-semibold text-white mb-1">Right to Data Portability</div>
                <p className="text-[#8696a0]">Export your entire chat ledger and profile data in standardized JSON format directly from Settings.</p>
              </div>
              <div className="bg-[#111b21] p-3 rounded-xl border border-[#2e3b44] text-xs">
                <div className="font-semibold text-white mb-1">Right to Complete Erasure</div>
                <p className="text-[#8696a0]">Request immediate permanent deletion of your profile, virtual number, and all associated messages.</p>
              </div>
              <div className="bg-[#111b21] p-3 rounded-xl border border-[#2e3b44] text-xs">
                <div className="font-semibold text-white mb-1">Right to Restrict Processing</div>
                <p className="text-[#8696a0]">Granular controls over Read Receipts (blue checks), Last Seen, Profile Picture, and Status visibility.</p>
              </div>
            </div>
            <div className="bg-[#111b21] p-3 rounded-xl border border-[#2e3b44] text-xs text-[#8696a0] mt-3">
              Official Data Protection Office: <span className="text-[#00a884] font-mono">privacy@limochat.app</span> • LimoChat Compliance & Legal Operations
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2e3b44] bg-[#111b21] flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-[#8696a0] hidden sm:flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#00a884]" /> Enterprise Security Standards Verified
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-semibold text-xs transition cursor-pointer shadow-md ml-auto"
          >
            I Acknowledge & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
