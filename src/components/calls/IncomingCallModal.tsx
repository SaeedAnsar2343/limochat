import React from 'react';
import { Phone, PhoneOff, Video, ShieldCheck } from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { Avatar } from '../common/Avatar';

export const IncomingCallModal: React.FC = () => {
  const { incomingSession, acceptCall, declineCall } = useCall();

  if (!incomingSession) return null;

  const isVideo = incomingSession.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 pt-safe pb-safe animate-fade-in select-none">
      <div className="bg-[#202c33] text-[#e9edef] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#2e3b44] p-7 flex flex-col items-center text-center">
        {/* Caller Avatar with Animated Wave Ring */}
        <div className="relative mb-6">
          <span className="absolute -inset-3 rounded-full bg-[#00a884]/30 animate-pulse-ring"></span>
          <Avatar
            src={incomingSession.callerPhoto}
            name={incomingSession.callerName}
            size="xl"
            className="relative z-10 border-4 border-[#00a884] shadow-2xl"
          />
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-bold text-white mb-1">
          {incomingSession.callerName}
        </h3>
        
        {incomingSession.isGroup && incomingSession.groupName && (
          <p className="text-xs text-[#53bdeb] font-medium mb-1">
            Group: {incomingSession.groupName}
          </p>
        )}

        <div className="flex items-center gap-1.5 text-xs text-[#00a884] font-medium mb-8">
          {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          <span>Incoming LimoChat {isVideo ? 'Video' : 'Audio'} Call...</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-10 w-full">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={declineCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition transform hover:scale-110 active:scale-95"
              title="Decline"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs text-[#8696a0]">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center shadow-lg shadow-[#00a884]/30 transition transform hover:scale-110 active:scale-95"
              title="Accept"
            >
              {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </button>
            <span className="text-xs text-[#8696a0]">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};
