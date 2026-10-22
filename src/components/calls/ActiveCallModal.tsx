import React, { useEffect, useRef, useState } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  Users, 
  ShieldCheck, 
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Grid,
  UserPlus,
  Wifi,
  X
} from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { formatDuration } from '../../utils/formatters';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserProfile } from '../../types';

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export const ActiveCallModal: React.FC = () => {
  const { 
    activeSession, 
    localStream, 
    remoteStreams, 
    isAudioMuted, 
    isVideoMuted, 
    isScreenSharing, 
    isSpeakerOn,
    toggleAudio, 
    toggleVideo, 
    toggleScreenShare, 
    toggleSpeaker,
    endCall 
  } = useCall();

  const { currentUser } = useAuth();
  const { chats } = useChat();
  const [duration, setDuration] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<{ [uid: string]: HTMLVideoElement | null }>({});

  const otherUid = activeSession ? (
    activeSession.callerId === currentUser?.uid 
      ? activeSession.participantUids?.find(uid => uid !== currentUser?.uid) 
      : activeSession.callerId
  ) : null;

  // Real-time listener to callee presence and profile
  useEffect(() => {
    if (!otherUid) return;
    const unsub = onSnapshot(doc(db, 'users', otherUid), (snap) => {
      if (snap.exists()) {
        setOtherUser(snap.data() as UserProfile);
      }
    }, () => {});
    return () => unsub();
  }, [otherUid]);

  const isConnected = activeSession?.status === 'accepted';
  const isCalleeOnline = otherUser?.isOnline === true && (Date.now() - (otherUser?.lastSeen || 0) < 60000);
  const callStateLabel = isConnected 
    ? 'Connected' 
    : (isCalleeOnline ? 'Ringing...' : 'Calling...');
  const callSubtitle = isConnected
    ? 'High-Definition Encrypted Connection'
    : (isCalleeOnline ? 'Ringing on remote device...' : 'Calling contact (offline)...');

  // Duration Timer: only runs when call is accepted
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'accepted') {
      setDuration(0);
      return;
    }
    const startTime = activeSession.startedAt || Date.now();
    const interval = setInterval(() => {
      setDuration(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession?.status, activeSession?.startedAt]);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeSession]);

  // Bind remote streams
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([uid, stream]) => {
      const el = remoteVideoRefs.current[uid];
      if (el && stream) {
        el.srcObject = stream;
        // Apply speaker toggle volume on remote elements
        el.volume = isSpeakerOn ? 1.0 : 0.4;
      }
    });
  }, [remoteStreams, isSpeakerOn]);

  if (!activeSession) return null;

  const isVideo = activeSession.callType === 'video';
  const remoteUids = Object.keys(remoteStreams);

  const handleKeyPress = (k: string) => {
    setKeypadInput((prev) => prev + k);
  };

  return (
    <div
      className={`fixed z-50 transition-all ${
        isFullscreen
          ? 'inset-0 bg-[#0b141a]'
          : 'inset-3 sm:inset-6 md:inset-10 lg:inset-14 bg-[#111b21]/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden'
      } flex flex-col`}
    >
      {/* Call Header */}
      <div className="pt-safe mobile-header-safe min-h-16 px-6 bg-[#202c33]/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between text-white z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#00a884]/20 rounded-xl text-[#00a884]">
            {activeSession.isGroup ? (
              <Users className="w-5 h-5" />
            ) : isVideo ? (
              <Video className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">
              {activeSession.isGroup
                ? activeSession.groupName || 'Group Call'
                : activeSession.callerId === currentUser?.uid
                ? (otherUser?.displayName || 'Outgoing Call')
                : activeSession.callerName}
            </h3>
            <div className="text-xs text-[#00a884] font-mono flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00a884]' : 'bg-amber-400'} animate-pulse`}></span>
              <span>{isConnected ? formatDuration(duration) : callStateLabel}</span>
              <span className="text-[#8696a0] flex items-center gap-1">
                <Wifi className="w-3 h-3 text-[#00a884]" />
                <span>HD Audio • E2EE</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Speaker Mode Badge */}
          <div
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1 border ${
              isSpeakerOn
                ? 'bg-[#00a884]/20 text-[#00a884] border-[#00a884]/30'
                : 'bg-black/30 text-[#8696a0] border-white/10'
            }`}
          >
            {isSpeakerOn ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            <span>{isSpeakerOn ? 'SPEAKER ON' : 'EARPIECE'}</span>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl text-[#8696a0] hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Video / Participant Stage */}
      <div className="flex-1 relative bg-[#0b141a]/95 flex items-center justify-center p-4 overflow-hidden">
        {isVideo ? (
          // Video Call Layout
          <div className="w-full h-full relative flex items-center justify-center">
            {/* Remote Streams Grid */}
            {remoteUids.length > 0 ? (
              <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4">
                {remoteUids.map((uid) => (
                  <div
                    key={uid}
                    className="relative w-full h-full bg-[#182229] rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 shadow-lg"
                  >
                    <video
                      ref={(el) => {
                        remoteVideoRefs.current[uid] = el;
                        if (el && remoteStreams[uid]) el.srcObject = remoteStreams[uid];
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-xs text-white">
                      Remote Participant
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Waiting for other party to join
              <div className="flex flex-col items-center text-center space-y-4">
                <Avatar
                  src={otherUser?.photoURL || activeSession.callerPhoto}
                  name={otherUser?.displayName || activeSession.callerName}
                  size="xl"
                  className="border-4 border-[#00a884] shadow-2xl animate-pulse"
                />
                <div>
                  <h4 className="text-xl font-bold text-white mb-1">
                    {callStateLabel}
                  </h4>
                  <p className="text-xs text-[#8696a0]">{callSubtitle}</p>
                </div>
              </div>
            )}

            {/* Local Video Picture-in-Picture */}
            <div className="absolute bottom-4 right-4 w-36 h-48 sm:w-48 sm:h-64 bg-[#182229] rounded-2xl overflow-hidden border-2 border-[#00a884] shadow-2xl z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoMuted ? 'hidden' : 'block'}`}
              />
              {isVideoMuted && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#182229] text-[#8696a0] text-xs gap-1">
                  <VideoOff className="w-6 h-6 text-red-400" />
                  <span>Camera Off</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">
                You {isAudioMuted && '(Muted)'}
              </div>
            </div>
          </div>
        ) : (
          // Audio Call Layout
          <div className="flex flex-col items-center justify-center space-y-6 text-center">
            <div className="relative">
              <span className={`absolute -inset-4 rounded-full ${isConnected ? 'bg-[#00a884]/20' : 'bg-amber-400/20'} animate-pulse-ring`}></span>
              <Avatar
                src={otherUser?.photoURL || activeSession.callerPhoto}
                name={otherUser?.displayName || activeSession.callerName}
                size="xl"
                className="relative z-10 border-4 border-[#00a884] shadow-2xl"
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">
                {activeSession.isGroup ? activeSession.groupName : (otherUser?.displayName || activeSession.callerName)}
              </h3>
              <p className="text-base text-[#00a884] font-semibold font-mono">
                {isConnected ? formatDuration(duration) : callStateLabel}
              </p>
              <p className="text-xs text-[#8696a0] mt-1">{callSubtitle}</p>
            </div>
          </div>
        )}

        {/* Dialpad Overlay */}
        {showKeypad && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-4 animate-scale-in">
            <div className="bg-[#182229] p-6 rounded-3xl border border-white/10 w-full max-w-xs text-center space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Dialpad / Touch Tone</span>
                <button
                  onClick={() => setShowKeypad(false)}
                  className="p-1 rounded-full text-[#8696a0] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="h-10 bg-[#111b21] rounded-xl flex items-center justify-center text-lg font-mono text-white tracking-widest px-3">
                {keypadInput || '—'}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {KEYPAD_KEYS.map((k) => (
                  <button
                    key={k}
                    onClick={() => handleKeyPress(k)}
                    className="p-3 bg-[#202c33] hover:bg-[#2a3942] active:bg-[#00a884] text-white rounded-xl text-base font-semibold font-mono transition"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Call Bottom Controls Toolbar (Apple-style Glassmorphism) */}
      <div className="min-h-20 bg-[#202c33]/85 backdrop-blur-xl border-t border-white/10 px-6 py-2 pb-safe flex items-center justify-center gap-3 sm:gap-4 z-20">
        {/* Toggle Audio / Mic */}
        <button
          onClick={toggleAudio}
          className={`p-3.5 rounded-2xl transition shadow-lg cursor-pointer ${
            isAudioMuted
              ? 'bg-red-600/25 text-red-400 hover:bg-red-600/35 border border-red-500/30'
              : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
          }`}
          title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Speakerphone Toggle (User Request) */}
        <button
          onClick={toggleSpeaker}
          className={`p-3.5 rounded-2xl transition shadow-lg cursor-pointer ${
            isSpeakerOn
              ? 'bg-[#00a884] text-white'
              : 'bg-[#2a3942] text-[#8696a0] hover:text-white hover:bg-[#32444f]'
          }`}
          title={isSpeakerOn ? 'Speakerphone Enabled' : 'Switch to Speaker'}
        >
          {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        {/* Toggle Video */}
        {isVideo && (
          <button
            onClick={toggleVideo}
            className={`p-3.5 rounded-2xl transition shadow-lg cursor-pointer ${
              isVideoMuted
                ? 'bg-red-600/25 text-red-400 hover:bg-red-600/35 border border-red-500/30'
                : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
            }`}
            title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* Toggle Keypad */}
        <button
          onClick={() => setShowKeypad(!showKeypad)}
          className={`p-3.5 rounded-2xl transition shadow-lg cursor-pointer ${
            showKeypad ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
          }`}
          title="Keypad"
        >
          <Grid className="w-5 h-5" />
        </button>

        {/* Toggle Screen Sharing */}
        <button
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-2xl transition shadow-lg cursor-pointer ${
            isScreenSharing
              ? 'bg-[#00a884] text-white'
              : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
          }`}
          title="Share Screen"
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* End Call Button */}
        <button
          onClick={endCall}
          className="p-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white transition shadow-lg shadow-red-600/40 ml-2 cursor-pointer"
          title="End Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
