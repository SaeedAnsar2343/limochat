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
  RotateCcw,
  Wifi, 
  X,
  UserPlus,
  Search,
  Check,
  Sparkles
} from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { formatDuration } from '../../utils/formatters';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserProfile, CallParticipant } from '../../types';
import { supabase } from '../../supabase/config';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';

export const ActiveCallModal: React.FC = () => {
  const { 
    activeSession, 
    localStream, 
    remoteStreams, 
    isAudioMuted, 
    isVideoMuted, 
    isScreenSharing, 
    isSpeakerOn,
    cameraFacing,
    flipCamera,
    toggleAudio, 
    toggleVideo, 
    toggleScreenShare, 
    toggleSpeaker,
    endCall 
  } = useCall();

  const { currentUser } = useAuth();
  const { getAllContacts } = useChat();
  const [duration, setDuration] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [contactsList, setContactsList] = useState<UserProfile[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [invitedUids, setInvitedUids] = useState<string[]>([]);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  // Dynamic Island Draggable Coordinates
  const [islandPos, setIslandPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(12, (window.innerWidth - 300) / 2) : 50,
    y: 28,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    moved: false,
  });

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

  // Load contacts for adding to call
  useEffect(() => {
    if (showAddParticipant && currentUser) {
      getAllContacts().then((all) => {
        const valid = all.filter(
          (c) =>
            c.uid !== currentUser.uid &&
            c.uid !== 'limochat_official_support' &&
            !(currentUser.blockedUsers || []).includes(c.uid) &&
            !(activeSession?.participantUids || []).includes(c.uid)
        );
        setContactsList(valid);
      });
    }
  }, [showAddParticipant, currentUser, activeSession?.participantUids]);

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

  // Bind local stream without flickering
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream, activeSession]);

  // Bind remote streams without flickering
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([uid, stream]) => {
      const el = remoteVideoRefs.current[uid];
      if (el && stream) {
        if (el.srcObject !== stream) {
          el.srcObject = stream;
        }
        el.volume = isSpeakerOn ? 1.0 : 0.4;
      }
    });
  }, [remoteStreams, isSpeakerOn]);

  // Draggable Pointer Event Handlers for iPhone Dynamic Island
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current.startX && !dragRef.current.startY) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragRef.current.moved = true;
      }
      const newX = Math.max(12, Math.min(window.innerWidth - 300, dragRef.current.initX + dx));
      const newY = Math.max(12, Math.min(window.innerHeight - 80, dragRef.current.initY + dy));
      setIslandPos({ x: newX, y: newY });
    };

    const handleUp = () => {
      dragRef.current.startX = 0;
      dragRef.current.startY = 0;
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [isDragging]);

  const onIslandPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: islandPos.x,
      initY: islandPos.y,
      moved: false,
    };
  };

  // Invite an additional contact into the active call
  const handleAddParticipant = async (contact: UserProfile) => {
    if (!activeSession) return;
    try {
      const currentUids = activeSession.participantUids || [];
      if (currentUids.includes(contact.uid)) return;

      const nextUids = [...currentUids, contact.uid];
      const nextParticipants: { [uid: string]: CallParticipant } = {
        ...(activeSession.participants || {}),
        [contact.uid]: {
          uid: contact.uid,
          displayName: contact.displayName || 'Participant',
          photoURL: contact.photoURL,
          status: 'invited',
          audioMuted: false,
          videoMuted: false,
        },
      };

      // 1. Dual-Database: Update call session in Supabase
      await RealtimeCoordinator.updateCallSession(activeSession.id, {
        participantUids: nextUids,
        participants: nextParticipants,
      });

      // 2. Broadcast live incoming call notification to new participant
      const userCallChannel = supabase.channel(`user_calls:${contact.uid}`);
      await userCallChannel.send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          ...activeSession,
          participantUids: nextUids,
          participants: nextParticipants,
          isGroup: true,
        },
      });

      // 3. Update call in Firestore
      await updateDoc(doc(db, 'calls', activeSession.id), {
        participantUids: nextUids,
        [`participants.${contact.uid}`]: {
          uid: contact.uid,
          status: 'ringing',
          joinedAt: Date.now(),
        },
      }).catch(() => {});

      setInvitedUids((prev) => [...prev, contact.uid]);
      setAddedNotice(`Call invitation dispatched to ${contact.displayName}`);
      setTimeout(() => setAddedNotice(null), 3000);
    } catch (e: any) {
      console.warn("Could not invite contact:", e);
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

  const filteredContacts = contactsList.filter((c) => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      c.displayName?.toLowerCase().includes(q) ||
      c.phoneNumber?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  // Dynamic Island Minimized Call Widget (iPhone style + Draggable)
  if (isMinimized) {
    return (
      <div 
        style={{ left: `${islandPos.x}px`, top: `${islandPos.y}px`, touchAction: 'none' }}
        onPointerDown={onIslandPointerDown}
        onClick={() => {
          if (!dragRef.current.moved) {
            setIsMinimized(false);
          }
        }}
        className={`fixed z-50 select-none cursor-grab active:cursor-grabbing bg-black/95 text-white px-3.5 py-2.5 rounded-full shadow-[0_12px_45px_rgba(0,0,0,0.85)] border border-white/20 backdrop-blur-2xl flex items-center gap-3 animate-scale-in transition-transform ${
          isDragging ? 'scale-105 shadow-[0_18px_60px_rgba(0,0,0,0.95)] border-[#00a884]/50' : 'hover:scale-[1.02]'
        }`}
      >
        {/* Contact avatar with status beacon */}
        <div className="relative flex-shrink-0">
          <Avatar src={displayPhoto} name={displayName} size="sm" />
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#00a884]' : 'bg-amber-400'} ring-2 ring-black`} />
        </div>

        {/* Dynamic Island Voice Waveform & Call Info */}
        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white max-w-[100px] truncate">{displayName}</span>
            {/* Live Audio Equalizer Waveform Bars */}
            {isConnected && (
              <div className="flex items-center gap-0.5 h-3">
                <span className="w-0.5 bg-[#00a884] rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
                <span className="w-0.5 bg-[#00a884] rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }} />
                <span className="w-0.5 bg-[#00a884] rounded-full animate-bounce h-1.5" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
          <span className="text-[10px] text-[#00a884] font-mono font-medium">
            {isConnected ? formatDuration(duration) : callStateLabel}
          </span>
        </div>

        {/* Mic Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleAudio();
          }}
          className={`p-1.5 rounded-full transition flex-shrink-0 cursor-pointer ${
            isAudioMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isAudioMuted ? "Unmute mic" : "Mute mic"}
        >
          {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            endCall();
          }}
          className="p-2 bg-[#ea0038] hover:bg-[#c90030] text-white rounded-full flex-shrink-0 cursor-pointer shadow-md"
          title="End Call"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a] flex flex-col justify-between overflow-hidden select-none animate-fade-in">
      {/* Background ambient gradient glow for WhatsApp / iOS feel */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#122822]/40 via-[#0b141a] to-[#0b141a]" />

      {/* Top Header Bar */}
      <div className="relative z-20 pt-safe px-4 sm:px-6 py-3 flex items-center justify-between text-[#8696a0]">
        <button
          onClick={() => setIsMinimized(true)}
          className="p-2.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
          title="Minimize Call (Dynamic Island)"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* E2EE Lock Banner */}
        <div className="flex items-center gap-1.5 text-xs text-[#8696a0] font-medium bg-black/30 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/5">
          <Lock className="w-3 h-3 text-[#00a884]" />
          <span>End-to-end encrypted</span>
        </div>

        {/* Quality indicator & Header Flip camera */}
        <div className="flex items-center gap-2">
          {isVideo && (
            <button
              onClick={flipCamera}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer flex items-center gap-1.5 text-xs"
              title={`Switch to ${cameraFacing === 'user' ? 'Back' : 'Front'} Camera`}
            >
              <RotateCcw className="w-4 h-4 text-[#00a884]" />
              <span className="hidden sm:inline text-[11px] font-medium">{cameraFacing === 'user' ? 'Rear' : 'Front'}</span>
            </button>
          )}
          <div className="flex items-center gap-1 text-[11px] text-[#00a884] font-mono bg-[#00a884]/10 px-2.5 py-1 rounded-full border border-[#00a884]/20">
            <Wifi className="w-3 h-3" />
            <span>HD</span>
          </div>
        </div>
      </div>

      {/* Center Stage: Audio vs Video Layout */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden">
        {isVideo ? (
          /* Video Call Stage (Adaptive Grid for 1, 2, 3, 4, 5+ participants) */
          <div className="w-full h-full relative flex items-center justify-center min-h-0">
            {remoteUids.length > 0 ? (
              <div className="w-full h-full p-1 sm:p-2">
                {remoteUids.length === 1 ? (
                  /* Single Remote Participant */
                  <div className="relative w-full h-full bg-[#182229] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
                    <video
                      ref={(el) => {
                        remoteVideoRefs.current[remoteUids[0]] = el;
                        if (el && remoteStreams[remoteUids[0]] && el.srcObject !== remoteStreams[remoteUids[0]]) {
                          el.srcObject = remoteStreams[remoteUids[0]];
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs text-white flex items-center gap-2 z-10 shadow-lg border border-white/10">
                      <span className="font-semibold">{displayName}</span>
                      {activeSession.participants?.[remoteUids[0]]?.audioMuted && (
                        <MicOff className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                  </div>
                ) : (
                  /* Group Adaptive Responsive Video Grid */
                  <div
                    className={`w-full h-full ${
                      remoteUids.length === 2
                        ? 'grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3'
                        : remoteUids.length <= 4
                        ? 'grid grid-cols-2 grid-rows-2 gap-2 sm:gap-3'
                        : 'grid grid-cols-2 sm:grid-cols-3 auto-rows-fr gap-2 sm:gap-3'
                    }`}
                  >
                    {remoteUids.map((uid) => {
                      const p = activeSession.participants?.[uid];
                      const pName = p?.displayName || (uid === otherUid ? (otherUser?.displayName || 'Contact') : 'Participant');
                      const pPhoto = p?.photoURL || (uid === otherUid ? otherUser?.photoURL : undefined);
                      const stream = remoteStreams[uid];
                      const hasLiveVideo = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');

                      return (
                        <div
                          key={uid}
                          className="relative w-full h-full bg-[#182229] rounded-2xl overflow-hidden border border-white/10 shadow-lg flex items-center justify-center min-h-0"
                        >
                          <video
                            ref={(el) => {
                              remoteVideoRefs.current[uid] = el;
                              if (el && stream && el.srcObject !== stream) {
                                el.srcObject = stream;
                              }
                            }}
                            autoPlay
                            playsInline
                            className={`w-full h-full object-cover ${hasLiveVideo ? 'block' : 'hidden'}`}
                          />
                          {!hasLiveVideo && (
                            <div className="flex flex-col items-center justify-center space-y-2 p-3 text-center">
                              <Avatar src={pPhoto} name={pName} size="md" />
                              <span className="text-xs text-white font-medium truncate max-w-[120px]">{pName}</span>
                              <span className="text-[10px] text-[#8696a0] flex items-center gap-1">
                                <VideoOff className="w-3 h-3 text-red-400" /> Camera Off
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs text-white flex items-center gap-1.5 z-10 shadow border border-white/5">
                            <span className="truncate max-w-[110px] font-medium">{pName}</span>
                            {p?.audioMuted && <MicOff className="w-3 h-3 text-red-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Waiting for remote video */
              <div className="flex flex-col items-center text-center space-y-5">
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
                  <span className={`absolute -inset-4 sm:-inset-6 rounded-full ${isConnected ? 'bg-[#00a884]/20' : 'bg-amber-400/20'} animate-ping opacity-30`} />
                  <span className={`absolute -inset-8 sm:-inset-12 rounded-full ${isConnected ? 'bg-[#00a884]/15' : 'bg-amber-400/15'} animate-pulse`} />
                  <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-[#00a884] shadow-2xl relative z-10 bg-[#182229]">
                    <img
                      src={displayPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
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
                title={`Switch camera (current: ${cameraFacing})`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#00a884]" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">
                You {isAudioMuted && '• Muted'}
              </div>
            </div>
          </div>
        ) : (
          /* Audio Call Stage (Centered WhatsApp Audio Layout with Concentric Glowing Rings) */
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
              {/* Concentric Pulsing Green Rings centered exactly around avatar */}
              <span className={`absolute -inset-4 sm:-inset-6 rounded-full ${isConnected ? 'bg-[#00a884]/20' : 'bg-amber-400/20'} animate-ping opacity-30`} />
              <span className={`absolute -inset-8 sm:-inset-12 rounded-full ${isConnected ? 'bg-[#00a884]/15' : 'bg-amber-400/15'} animate-pulse`} />
              <span className={`absolute -inset-1 sm:-inset-2 rounded-full border-2 ${isConnected ? 'border-[#00a884]/40' : 'border-amber-400/40'}`} />
              
              {/* Large Perfectly Centered Avatar */}
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-[#00a884] shadow-[0_0_50px_rgba(0,168,132,0.35)] relative z-10 bg-[#182229] flex items-center justify-center select-none">
                <img
                  src={displayPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-wide">
                {displayName}
              </h2>
              <div className="flex items-center justify-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#00a884]' : 'bg-amber-400'} animate-pulse`} />
                <span className="text-sm sm:text-base text-[#00a884] font-mono font-medium">
                  {isConnected ? formatDuration(duration) : callStateLabel}
                </span>
              </div>
              <p className="text-xs text-[#8696a0]">{callSubtitle}</p>
            </div>
          </div>
        )}

        {/* Notice feedback banner */}
        {addedNotice && (
          <div className="absolute top-4 bg-[#00a884] text-white px-4 py-2 rounded-2xl text-xs font-semibold shadow-xl border border-white/20 animate-fade-in flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{addedNotice}</span>
          </div>
        )}

        {/* ADD PARTICIPANT MODAL SHEET */}
        {showAddParticipant && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-4 animate-scale-in">
            <div className="bg-[#1f2c34] p-5 rounded-3xl border border-white/10 w-full max-w-sm text-left space-y-4 shadow-2xl flex flex-col max-h-[75vh]">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#00a884]" />
                  <span className="text-sm font-bold text-white">Add Contact to Call</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddParticipant(false)}
                  className="p-1 rounded-full text-[#8696a0] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search contacts */}
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-[#8696a0] absolute left-3" />
                <input
                  type="text"
                  placeholder="Search contacts by name or phone..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                />
              </div>

              {/* Contacts List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-60">
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => {
                    const isInvited = invitedUids.includes(contact.uid);
                    return (
                      <div
                        key={contact.uid}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#111b21] border border-white/5 hover:border-[#00a884]/40 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar src={contact.photoURL} name={contact.displayName} size="sm" isOnline={contact.isOnline} />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{contact.displayName}</div>
                            <div className="text-[10px] text-[#00a884] font-mono">{contact.phoneNumber}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddParticipant(contact)}
                          disabled={isInvited}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                            isInvited
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-[#00a884] hover:bg-[#02906f] text-white shadow-md'
                          }`}
                        >
                          {isInvited ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Invited</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3 h-3" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-[#8696a0]">
                    {contactSearch ? "No matching contacts found." : "No available contacts to add."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Bottom Control Bar: Iconic Floating Pill with Add Contact */}
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

          {/* Flip Camera Button (Always available in Video Mode) */}
          {isVideo && (
            <button
              onClick={flipCamera}
              className="p-3.5 rounded-full bg-[#2a3942] hover:bg-[#32444f] text-white transition cursor-pointer active:scale-90"
              title={`Flip camera (${cameraFacing === 'user' ? 'Rear' : 'Front'})`}
            >
              <RotateCcw className="w-5 h-5 text-[#00a884]" />
            </button>
          )}

          {/* Add Contact to Call (Replacing Keypad!) */}
          <button
            onClick={() => setShowAddParticipant(true)}
            className="p-3.5 rounded-full bg-[#2a3942] hover:bg-[#32444f] text-white transition cursor-pointer"
            title="Add contact to call"
          >
            <UserPlus className="w-5 h-5 text-[#00a884]" />
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
