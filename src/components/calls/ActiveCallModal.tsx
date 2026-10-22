import React, { useEffect, useRef, useState } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  Users, 
  Lock, 
  ChevronDown,
  Volume2, 
  VolumeX, 
  Grid, 
  RotateCcw,
  Wifi, 
  X,
  UserPlus
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
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

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
        el.volume = isSpeakerOn ? 1.0 : 0.4;
      }
    });
  }, [remoteStreams, isSpeakerOn]);

  // Camera flip for mobile
  const flipCamera = async () => {
    if (!localStream) return;
    try {
      const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      localStream.addTrack(newVideoTrack);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      setCameraFacing(nextFacing);
    } catch (e) {
      console.warn('Camera flip error:', e);
    }
  };

  if (!activeSession) return null;

  const isVideo = activeSession.callType === 'video';
  const remoteUids = Object.keys(remoteStreams);
  const displayName = activeSession.isGroup
    ? (activeSession.groupName || 'Group Call')
    : (activeSession.callerId === currentUser?.uid
        ? (otherUser?.displayName || 'Contact')
        : activeSession.callerName);
  const displayPhoto = activeSession.callerId === currentUser?.uid
    ? (otherUser?.photoURL || activeSession.callerPhoto)
    : activeSession.callerPhoto;

  const handleKeyPress = (k: string) => {
    setKeypadInput((prev) => prev + k);
  };

  // Minimized Floating Pill Mode
  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 bg-[#1f2c34] text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 cursor-pointer animate-fade-in hover:bg-[#2a3942] transition"
      >
        <div className="relative">
          <Avatar src={displayPhoto} name={displayName} size="sm" />
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#00a884]' : 'bg-amber-400'} ring-2 ring-[#1f2c34]`} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold max-w-[120px] truncate">{displayName}</span>
          <span className="text-[11px] text-[#00a884] font-mono">
            {isConnected ? formatDuration(duration) : callStateLabel}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            endCall();
          }}
          className="p-2 bg-[#ea0038] hover:bg-[#c90030] text-white rounded-full ml-1"
          title="End Call"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a] flex flex-col justify-between overflow-hidden select-none animate-fade-in">
      {/* Background ambient gradient glow for WhatsApp feel */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#122822]/40 via-[#0b141a] to-[#0b141a]" />

      {/* Top Header Bar */}
      <div className="relative z-20 pt-safe px-4 sm:px-6 py-3 flex items-center justify-between text-[#8696a0]">
        <button
          onClick={() => setIsMinimized(true)}
          className="p-2.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
          title="Minimize Call"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* E2EE Lock Banner */}
        <div className="flex items-center gap-1.5 text-xs text-[#8696a0] font-medium bg-black/30 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/5">
          <Lock className="w-3 h-3 text-[#00a884]" />
          <span>End-to-end encrypted</span>
        </div>

        {/* Quality indicator / Speaker state */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[11px] text-[#00a884] font-mono bg-[#00a884]/10 px-2.5 py-1 rounded-full border border-[#00a884]/20">
            <Wifi className="w-3 h-3" />
            <span>HD</span>
          </div>
        </div>
      </div>

      {/* Center Stage: Audio vs Video Layout */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        {isVideo ? (
          /* Video Call Stage */
          <div className="w-full h-full relative flex items-center justify-center">
            {remoteUids.length > 0 ? (
              <div className="absolute inset-0 w-full h-full">
                {remoteUids.map((uid) => (
                  <video
                    key={uid}
                    ref={(el) => {
                      remoteVideoRefs.current[uid] = el;
                      if (el && remoteStreams[uid]) el.srcObject = remoteStreams[uid];
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ))}
                {/* Remote Participant overlay */}
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white">
                  {displayName}
                </div>
              </div>
            ) : (
              /* Waiting for remote video */
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <span className="absolute -inset-4 rounded-full bg-[#00a884]/20 animate-pulse-ring" />
                  <Avatar
                    src={displayPhoto}
                    name={displayName}
                    size="xl"
                    className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-[#00a884] shadow-2xl relative z-10"
                  />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-semibold text-white tracking-wide">
                    {displayName}
                  </h3>
                  <p className="text-sm text-[#00a884] font-mono mt-1">
                    {isConnected ? formatDuration(duration) : callStateLabel}
                  </p>
                  <p className="text-xs text-[#8696a0] mt-0.5">{callSubtitle}</p>
                </div>
              </div>
            )}

            {/* Floating Local Video PiP Preview */}
            <div className="absolute top-4 right-4 w-28 h-40 sm:w-36 sm:h-52 bg-[#182229] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-20 group">
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
              {/* Flip camera overlay button on PiP */}
              <button
                onClick={flipCamera}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                title="Flip Camera"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">
                You {isAudioMuted && '• Muted'}
              </div>
            </div>
          </div>
        ) : (
          /* Audio Call Stage (Authentic WhatsApp Audio Layout) */
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              {/* Pulsing Voice Activity Rings */}
              <span className={`absolute -inset-6 rounded-full ${isConnected ? 'bg-[#00a884]/20' : 'bg-amber-400/20'} animate-pulse-ring`} />
              <span className={`absolute -inset-12 rounded-full ${isConnected ? 'bg-[#00a884]/10' : 'bg-amber-400/10'} animate-pulse`} />
              
              <Avatar
                src={displayPhoto}
                name={displayName}
                size="xl"
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-[#00a884]/60 shadow-2xl relative z-10"
              />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-wide">
                {displayName}
              </h2>
              <div className="flex items-center justify-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00a884]' : 'bg-amber-400'} animate-pulse`} />
                <span className="text-sm sm:text-base text-[#00a884] font-mono font-medium">
                  {isConnected ? formatDuration(duration) : callStateLabel}
                </span>
              </div>
              <p className="text-xs text-[#8696a0]">{callSubtitle}</p>
            </div>
          </div>
        )}

        {/* Dialpad Overlay Modal */}
        {showKeypad && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-4 animate-scale-in">
            <div className="bg-[#1f2c34] p-6 rounded-3xl border border-white/10 w-full max-w-xs text-center space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Touch-Tone Keypad</span>
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
                    className="p-3 bg-[#2a3942] hover:bg-[#32444f] active:bg-[#00a884] text-white rounded-2xl text-base font-semibold font-mono transition"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Bottom Control Bar: Iconic Floating Pill */}
      <div className="relative z-20 pb-safe px-4 py-6">
        <div className="bg-[#1f2c34]/95 backdrop-blur-2xl rounded-full px-5 sm:px-8 py-3.5 shadow-2xl border border-white/10 flex items-center justify-between gap-3 sm:gap-6 max-w-md mx-auto">
          {/* Mute Microphone */}
          <button
            onClick={toggleAudio}
            className={`p-3.5 rounded-full transition cursor-pointer ${
              isAudioMuted
                ? 'bg-white text-black'
                : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
            }`}
            title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5 text-red-600" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Speakerphone Toggle */}
          <button
            onClick={toggleSpeaker}
            className={`p-3.5 rounded-full transition cursor-pointer ${
              isSpeakerOn
                ? 'bg-white text-black'
                : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
            }`}
            title={isSpeakerOn ? 'Speaker On' : 'Switch to Speaker'}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5 text-[#00a884]" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Toggle Video */}
          <button
            onClick={toggleVideo}
            className={`p-3.5 rounded-full transition cursor-pointer ${
              isVideoMuted
                ? 'bg-[#2a3942] text-[#8696a0] hover:text-white'
                : isVideo
                ? 'bg-white text-black'
                : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
            }`}
            title={isVideo ? 'Camera On' : 'Switch to Video'}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5 text-red-400" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Toggle Keypad */}
          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className={`p-3.5 rounded-full transition cursor-pointer ${
              showKeypad ? 'bg-white text-black' : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
            }`}
            title="Dialpad"
          >
            <Grid className="w-5 h-5" />
          </button>

          {/* Screen Share (Desktop) */}
          <button
            onClick={toggleScreenShare}
            className={`hidden sm:flex p-3.5 rounded-full transition cursor-pointer ${
              isScreenSharing ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-white hover:bg-[#32444f]'
            }`}
            title="Share Screen"
          >
            <Monitor className="w-5 h-5" />
          </button>

          {/* Large Red WhatsApp Hang Up Button */}
          <button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-[#ea0038] hover:bg-[#c90030] text-white flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 transition cursor-pointer flex-shrink-0"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
