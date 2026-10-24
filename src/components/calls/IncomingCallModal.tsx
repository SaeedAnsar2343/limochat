import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, PhoneOff, Video, Lock, MessageSquare, VolumeX, Volume2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { useChat } from '../../context/ChatContext';
import { soundEngine } from '../../utils/sound';

export const IncomingCallModal: React.FC = () => {
  const { incomingSession, acceptCall, declineCall } = useCall();
  const { sendMessage, createDirectChat } = useChat();

  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [isRingtoneMuted, setIsRingtoneMuted] = useState(false);

  if (!incomingSession) return null;

  const isVideo = incomingSession.callType === 'video';

  const quickDeclineMessages = [
    "Can't talk right now. What's up?",
    "I'll call you right back.",
    "I'm in a meeting. Please message me.",
    "Can you message me the details?",
  ];

  const handleDeclineWithMessage = async (text: string) => {
    // 1. Decline call
    await declineCall();
    setShowMessageOptions(false);

    // 2. Post quick message into chat with caller
    if (incomingSession.chatId) {
      sendMessage(text, 'text');
    } else if (incomingSession.callerId) {
      const chat = await createDirectChat({
        uid: incomingSession.callerId,
        displayName: incomingSession.callerName,
        photoURL: incomingSession.callerPhoto,
      } as any);
      if (chat) {
        sendMessage(text, 'text');
      }
    }
  };

  const handleToggleMuteRingtone = () => {
    if (isRingtoneMuted) {
      soundEngine.startIncomingRingtone();
      setIsRingtoneMuted(false);
    } else {
      soundEngine.stopRingtone();
      setIsRingtoneMuted(true);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex flex-col justify-between bg-[#0b141a]/95 backdrop-blur-3xl select-none animate-fade-in p-6 pt-safe pb-safe overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00a884]/20 via-transparent to-black/60" />

      {/* Top Banner & Security Info */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-1.5 pt-4">
        <div className="flex items-center gap-1.5 text-xs text-[#8696a0] font-medium bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
          <span>LimoChat End-to-End Encrypted</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#00a884] font-semibold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
          <span>Incoming LimoChat High-Definition {isVideo ? 'Video' : 'Voice'} Call</span>
        </div>
      </div>

      {/* Center Caller Profile */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-5 my-auto">
        {/* Ripple Waves & Centered Avatar */}
        <div className="relative flex items-center justify-center w-52 h-52 sm:w-60 sm:h-60">
          {/* Animated WhatsApp Concentric Ripple Rings */}
          <span className="absolute w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-[#00a884]/15 animate-ping opacity-40 pointer-events-none" />
          <span className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-[#00a884]/20 animate-pulse pointer-events-none" />
          <span className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 border-[#00a884]/35 pointer-events-none" />

          {/* Centered Avatar Image */}
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-[#00a884] shadow-[0_0_50px_rgba(0,168,132,0.45)] relative z-10 bg-[#202c33] flex items-center justify-center flex-shrink-0">
            {incomingSession.callerPhoto ? (
              <img
                src={incomingSession.callerPhoto}
                alt={incomingSession.callerName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-bold text-white bg-gradient-to-tr from-[#005c4b] to-[#00a884]">
                {incomingSession.callerName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
        </div>

        {/* Caller Name & Meta */}
        <div className="space-y-1 px-4 max-w-sm">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-wide truncate">
            {incomingSession.callerName}
          </h2>
          {incomingSession.isGroup && incomingSession.groupName ? (
            <p className="text-sm text-[#53bdeb] font-medium flex items-center justify-center gap-1">
              <span>Group:</span>
              <strong className="text-white">{incomingSession.groupName}</strong>
            </p>
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-xs text-[#8696a0]">
                {isVideo ? 'Tap Accept to connect live video & audio' : 'Tap Accept to answer live audio call'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Decline with Message Popup */}
      {showMessageOptions && (
        <div className="relative z-20 max-w-xs sm:max-w-sm mx-auto w-full mb-3 bg-[#202c33] border border-[#2e3b44] rounded-2xl p-3 space-y-2 shadow-2xl animate-scale-in">
          <div className="flex items-center justify-between pb-2 border-b border-[#2e3b44]">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#00a884]" />
              <span>Decline with quick message</span>
            </span>
            <button
              onClick={() => setShowMessageOptions(false)}
              className="p-1 rounded-full text-[#8696a0] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {quickDeclineMessages.map((msg, idx) => (
              <button
                key={idx}
                onClick={() => handleDeclineWithMessage(msg)}
                className="w-full text-left px-3 py-2 rounded-xl bg-[#111b21] hover:bg-[#2a3942] text-xs text-[#d1d7db] hover:text-white transition cursor-pointer truncate"
              >
                {msg}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Accept & Decline Action Controls */}
      <div className="relative z-10 flex flex-col items-center gap-4 max-w-xs sm:max-w-sm mx-auto w-full pb-6">
        {/* Silence Ringtone & Message options row */}
        <div className="flex items-center justify-around w-full px-6">
          <button
            onClick={handleToggleMuteRingtone}
            className="flex flex-col items-center gap-1 text-[#8696a0] hover:text-white transition cursor-pointer"
            title={isRingtoneMuted ? 'Unmute Ringtone' : 'Silence Ringtone'}
          >
            <div className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white">
              {isRingtoneMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </div>
            <span className="text-[10px]">{isRingtoneMuted ? 'Silenced' : 'Silence'}</span>
          </button>

          <button
            onClick={() => setShowMessageOptions(!showMessageOptions)}
            className="flex flex-col items-center gap-1 text-[#8696a0] hover:text-white transition cursor-pointer"
            title="Reply with Message"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-[10px]">Reply</span>
          </button>
        </div>

        {/* Big Decline & Accept Buttons */}
        <div className="flex items-center justify-around w-full pt-1">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={declineCall}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#ea0038] hover:bg-[#c90030] text-white flex items-center justify-center shadow-2xl shadow-red-600/50 active:scale-95 transition cursor-pointer"
              title="Decline"
            >
              <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>
            <span className="text-xs font-semibold text-red-400">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={acceptCall}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center shadow-2xl shadow-[#00a884]/50 active:scale-95 transition animate-bounce cursor-pointer"
              title="Accept"
            >
              {isVideo ? <Video className="w-7 h-7 sm:w-8 sm:h-8" /> : <Phone className="w-7 h-7 sm:w-8 sm:h-8" />}
            </button>
            <span className="text-xs font-semibold text-[#00a884]">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
};
