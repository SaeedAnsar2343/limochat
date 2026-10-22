import React from 'react';
import { Phone, PhoneOff, Video, Lock } from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { Avatar } from '../common/Avatar';

export const IncomingCallModal: React.FC = () => {
  const { incomingSession, acceptCall, declineCall } = useCall();

  if (!incomingSession) return null;

  const isVideo = incomingSession.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0b141a]/95 backdrop-blur-2xl select-none animate-fade-in p-6 pt-safe pb-safe">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00a884]/15 via-transparent to-black/40" />

      {/* Top Banner */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-1 pt-6">
        <div className="flex items-center gap-1.5 text-xs text-[#8696a0] font-medium bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/5">
          <Lock className="w-3 h-3 text-[#00a884]" />
          <span>WhatsApp End-to-end Encrypted</span>
        </div>
        <p className="text-xs text-[#00a884] font-medium mt-1">
          Incoming LimoChat {isVideo ? 'Video' : 'Audio'} Call...
        </p>
      </div>

      {/* Center Caller Profile */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-6 my-auto">
        <div className="relative">
          {/* Animated WhatsApp Concentric Ripple Rings */}
          <span className="absolute -inset-6 rounded-full bg-[#00a884]/25 animate-pulse-ring" />
          <span className="absolute -inset-12 rounded-full bg-[#00a884]/15 animate-pulse" />

          <Avatar
            src={incomingSession.callerPhoto}
            name={incomingSession.callerName}
            size="xl"
            className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 border-[#00a884] shadow-2xl relative z-10"
          />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
            {incomingSession.callerName}
          </h2>
          {incomingSession.isGroup && incomingSession.groupName ? (
            <p className="text-sm text-[#53bdeb] font-medium">
              Group: {incomingSession.groupName}
            </p>
          ) : (
            <p className="text-xs text-[#8696a0]">
              LimoChat High-Definition {isVideo ? 'Video' : 'Voice'} Call
            </p>
          )}
        </div>
      </div>

      {/* Bottom Accept & Decline Action Controls */}
      <div className="relative z-10 flex items-center justify-around max-w-xs sm:max-w-sm mx-auto w-full pb-8">
        {/* Decline Button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={declineCall}
            className="w-16 h-16 rounded-full bg-[#ea0038] hover:bg-[#c90030] text-white flex items-center justify-center shadow-xl shadow-red-600/40 active:scale-95 transition cursor-pointer"
            title="Decline"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          <span className="text-xs font-medium text-[#8696a0]">Decline</span>
        </div>

        {/* Accept Button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={acceptCall}
            className="w-16 h-16 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center shadow-xl shadow-[#00a884]/40 active:scale-95 transition animate-bounce cursor-pointer"
            title="Accept"
          >
            {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
          </button>
          <span className="text-xs font-medium text-[#00a884]">Accept</span>
        </div>
      </div>
    </div>
  );
};
