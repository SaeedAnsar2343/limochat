import React from 'react';
import { X, Sparkles, PhoneCall, Users, Reply, ShieldAlert, CheckCircle2, Zap, Search } from 'lucide-react';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const updates = [
    {
      icon: PhoneCall,
      color: 'text-emerald-400 bg-emerald-500/10',
      tag: 'New Feature',
      title: 'Peer-to-Peer & Group Voice & Video Calls',
      desc: 'Connect with friends or entire groups instantly with HD audio, video streams, screen sharing, and melodic synthesized ringtones.'
    },
    {
      icon: Search,
      color: 'text-cyan-400 bg-cyan-500/10',
      tag: 'Contact Engine',
      title: 'Instant +991 Directory & Direct Number Chat',
      desc: 'Live contact search filters in real-time. Enter any +991 number or contact name to immediately initiate a direct encrypted chat session.'
    },
    {
      icon: Users,
      color: 'text-teal-400 bg-teal-500/10',
      tag: 'Communities',
      title: 'WhatsApp-Style Communities & Announcement Channels',
      desc: 'Organize related groups under one umbrella community (e.g. Neighborhood, University, Company). Broadcast announcements to all members with one click.'
    },
    {
      icon: Reply,
      color: 'text-blue-400 bg-blue-500/10',
      tag: 'Interactive Gestures',
      title: 'Drag & Swipe to Reply',
      desc: 'Swipe any message to quote it with an instant reply preview bar. Works with touch gestures on mobile and intuitive drag on desktop.'
    },
    {
      icon: ShieldAlert,
      color: 'text-amber-400 bg-amber-500/10',
      tag: 'Privacy First',
      title: 'Auto-Assigned +991 Virtual Phone Numbers',
      desc: 'Keep your real phone number 100% confidential. When you sign in, LimoChat automatically assigns a free virtual +991 number that contacts can use to find and call you.'
    },
    {
      icon: Zap,
      color: 'text-purple-400 bg-purple-500/10',
      tag: 'Messaging',
      title: 'Delete for Everyone & Live Read Receipts',
      desc: 'Accidentally sent something? Choose "Delete for Everyone" to wipe it across all devices. Double blue checkmarks inform you the instant your message is opened.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 pt-safe pb-safe animate-fade-in">
      <div className="bg-[#202c33] text-[#e9edef] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e3b44] bg-[#111b21]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00a884]/20 rounded-2xl text-[#00a884] shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">What's New in LimoChat</h2>
              <p className="text-xs text-[#8696a0]">Version 2.4.0 • Latest release notes & highlights</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
          <div className="flex items-center justify-between pb-2 border-b border-[#2e3b44]/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00a884]">Latest Changelog</span>
            <span className="text-xs text-[#8696a0]">Released October 2026</span>
          </div>

          <div className="space-y-3">
            {updates.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#111b21] p-4 rounded-2xl border border-[#2e3b44] flex items-start gap-3.5 hover:border-[#00a884]/50 transition group"
                >
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#2a3942] text-[#d1d7db]">
                        {item.tag}
                      </span>
                      <h4 className="font-semibold text-white text-sm group-hover:text-[#00a884] transition">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-[#8696a0] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2e3b44] bg-[#111b21] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-semibold text-xs transition cursor-pointer shadow-md"
          >
            Explore LimoChat Now
          </button>
        </div>
      </div>
    </div>
  );
};
