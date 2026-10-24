import { RealtimeCoordinator } from '../utils/realtimeCoordinator';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  addDoc, 
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { CallSession, CallType, CallStatus, Chat, UserProfile, CallHistoryItem } from '../types';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { soundEngine } from '../utils/sound';
import { getLocalUserMedia, getScreenShareMedia, getFlippedCameraTrack, rtcConfiguration } from '../utils/webrtc';
import { NativeNotificationService } from '../utils/nativeNotifications';

interface CallContextType {
  activeSession: CallSession | null;
  incomingSession: CallSession | null;
  localStream: MediaStream | null;
  remoteStreams: { [uid: string]: MediaStream };
  callHistory: CallHistoryItem[];
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  cameraFacing: 'user' | 'environment';
  startCall: (target: { chat?: Chat; user?: UserProfile; callType: CallType }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  flipCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  isSpeakerOn: boolean;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextType | null>(null);


const sanitizeData = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeData).filter((v) => v !== undefined);
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = sanitizeData(val);
      }
    }
    return result;
  }
  return obj;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [activeSession, setActiveSession] = useState<CallSession | null>(null);
  const [incomingSession, setIncomingSession] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [uid: string]: MediaStream }>({});
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('limochat_call_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [callAlert, setCallAlert] = useState<{ title: string; description: string } | null>(null);

  const pcMap = useRef<{ [uid: string]: RTCPeerConnection }>({});
  const originalVideoTrack = useRef<MediaStreamTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const incomingSessionRef = useRef<CallSession | null>(null);
  const activeSessionRef = useRef<CallSession | null>(null);

  useEffect(() => {
    incomingSessionRef.current = incomingSession;
  }, [incomingSession]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  // Sync call history with local cache
  useEffect(() => {
    if (callHistory.length > 0) {
      localStorage.setItem('limochat_call_history', JSON.stringify(callHistory));
    }
  }, [callHistory]);

  // Dual-Database: Load and subscribe to cross-device call history
  useEffect(() => {
    if (!currentUser?.uid) return;

    // 1. Fetch from Supabase PostgreSQL
    RealtimeCoordinator.fetchCallLogs(currentUser.uid).then((logs) => {
      if (logs.length > 0) {
        setCallHistory((prev) => {
          const map = new Map<string, CallHistoryItem>();
          prev.forEach((item) => map.set(item.id, item));
          logs.forEach((item) => map.set(item.id, item));
          const sorted = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          try {
            localStorage.setItem('limochat_call_history', JSON.stringify(sorted));
          } catch {}
          return sorted;
        });
      }
    }).catch(() => {});

    // 2. Real-time subscription to incoming call logs from other devices
    const unsubSupaLogs = RealtimeCoordinator.subscribeToCallLogs(currentUser.uid, (newLog) => {
      setCallHistory((prev) => {
        const map = new Map<string, CallHistoryItem>();
        prev.forEach((item) => map.set(item.id, item));
        map.set(newLog.id, newLog);
        const sorted = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        try {
          localStorage.setItem('limochat_call_history', JSON.stringify(sorted));
        } catch {}
        return sorted;
      });
    });

    // 3. Firestore call logs listener
    const logsCol = collection(db, 'users', currentUser.uid, 'call_logs');
    const unsubFsLogs = onSnapshot(query(logsCol, orderBy('timestamp', 'desc')), (snap) => {
      const list: CallHistoryItem[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as CallHistoryItem));
      if (list.length > 0) {
        setCallHistory((prev) => {
          const map = new Map<string, CallHistoryItem>();
          prev.forEach((item) => map.set(item.id, item));
          list.forEach((item) => map.set(item.id, item));
          const sorted = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          try {
            localStorage.setItem('limochat_call_history', JSON.stringify(sorted));
          } catch {}
          return sorted;
        });
      }
    }, () => {});

    return () => {
      unsubSupaLogs();
      unsubFsLogs();
    };
  }, [currentUser?.uid]);

  // Listen for incoming calls targeted at current user (Dual Engine: Supabase + Firestore)
  useEffect(() => {
    if (!currentUser?.uid) return;

    // 1. Supabase incoming call listener (Instant WebSocket broadcast + Postgres changes)
    const unsubSupa = RealtimeCoordinator.subscribeToIncomingCalls(
      currentUser.uid,
      (session) => {
        if (!incomingSessionRef.current || incomingSessionRef.current.id !== session.id) {
          setIncomingSession(session);
          soundEngine.startIncomingRingtone();
          NativeNotificationService.notifyCall({
            callerName: session.callerName,
            callType: session.callType,
            callId: session.id,
          });
        }
      },
      (callId) => {
        // Immediate termination if remote user ended or declined the call
        if (!callId || activeSessionRef.current?.id === callId || incomingSessionRef.current?.id === callId) {
          soundEngine.playCallEnd();
          cleanupCallState();
        }
      }
    );

    // Support line listener for authorized Admins
    let unsubSupaSupport = () => {};
    if (currentUser?.isAdmin) {
      unsubSupaSupport = RealtimeCoordinator.subscribeToIncomingCalls(
        'limochat_official_support',
        (session) => {
          if (!incomingSessionRef.current || incomingSessionRef.current.id !== session.id) {
            setIncomingSession({ ...session, callerName: `${session.callerName} (Support Ticket)` });
            soundEngine.startIncomingRingtone();
            NativeNotificationService.notifyCall({
              callerName: `${session.callerName} (Support Ticket)`,
              callType: session.callType,
              callId: session.id,
            });
          }
        },
        (callId) => {
          if (!callId || activeSessionRef.current?.id === callId || incomingSessionRef.current?.id === callId) {
            soundEngine.playCallEnd();
            cleanupCallState();
          }
        }
      );
    }

    // 2. Firestore listener as secondary companion
    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('status', '==', 'ringing'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let foundIncoming: CallSession | null = null;
      for (const docSnap of snapshot.docs) {
        const session = { id: docSnap.id, ...docSnap.data() } as CallSession;
        const isTargeted = session.participants && (session.participants[currentUser.uid] || (currentUser.isAdmin && session.participants['limochat_official_support']));
        if (session.callerId !== currentUser.uid && isTargeted) {
          const pKey = (session.participants && session.participants[currentUser.uid]) ? currentUser.uid : 'limochat_official_support';
          const myParticipant = session.participants[pKey];
          const ageMs = Date.now() - (session.createdAt || 0);
          if (myParticipant.status === 'invited' && ageMs < 60000) {
            foundIncoming = pKey === 'limochat_official_support' ? { ...session, callerName: `${session.callerName} (Support Ticket)` } : session;
            break;
          }
        }
      }

      if (foundIncoming) {
        if (!incomingSessionRef.current || incomingSessionRef.current.id !== foundIncoming.id) {
          setIncomingSession(foundIncoming);
          soundEngine.startIncomingRingtone();
          NativeNotificationService.notifyCall({
            callerName: foundIncoming.callerName,
            callType: foundIncoming.callType,
            callId: foundIncoming.id,
          });
        }
      }
    }, (err) => {
      console.warn("Incoming call listener warning (Supabase active):", err);
    });

    return () => {
      unsubSupa();
      unsubSupaSupport();
      unsubscribe();
      soundEngine.stopRingtone();
    };
  }, [currentUser?.uid]);

  // Sync active session changes (Dual Engine: Supabase Realtime + Firestore)
  useEffect(() => {
    if (!activeSession?.id) return;

    // 1. Supabase active call updates
    const unsubSupaUpdates = RealtimeCoordinator.subscribeToCallUpdates(activeSession.id, (updates) => {
      setActiveSession((prev) => (prev ? { ...prev, ...updates } : null));
      if (updates.status === 'ended' || updates.status === 'declined') {
        soundEngine.playCallEnd();
        cleanupCallState();
      }
    });

    // 2. Firestore fallback listener (DO NOT cleanup if document is absent in Firestore!)
    const sessionRef = doc(db, 'calls', activeSession.id);
    const unsub = onSnapshot(sessionRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = { id: docSnap.id, ...docSnap.data() } as CallSession;
      setActiveSession((prev) => (prev ? { ...prev, ...data } : data));

      if (data.status === 'ended' || data.status === 'declined') {
        soundEngine.playCallEnd();
        cleanupCallState();
      }
    }, () => {});

    return () => {
      unsubSupaUpdates();
      unsub();
    };
  }, [activeSession?.id]);

  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  const cleanupCallState = () => {
    soundEngine.stopDialTone();
    soundEngine.stopRingtone();
    NativeNotificationService.dismissCallNotification();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      localStreamRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      setLocalStream(null);
    }

    Object.values(pcMap.current).forEach((pc) => {
      try { pc.close(); } catch {}
    });
    pcMap.current = {};

    setRemoteStreams({});
    setActiveSession(null);
    setIncomingSession(null);
    activeSessionRef.current = null;
    incomingSessionRef.current = null;
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
  };

  const flipCamera = async () => {
    if (!localStream) return;
    try {
      const { track: newVideoTrack, facing } = await getFlippedCameraTrack(cameraFacing);
      const oldVideoTrack = localStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }

      localStream.addTrack(newVideoTrack);

      // Seamlessly replace video track on all active WebRTC senders without renegotiation
      const replacePromises = Object.values(pcMap.current).map((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          return sender.replaceTrack(newVideoTrack).catch(() => {});
        }
        return Promise.resolve();
      });
      await Promise.all(replacePromises);

      setCameraFacing(facing);
    } catch (err) {
      console.warn("Could not flip camera:", err);
    }
  };

  // Start 1-on-1 or Group Call
  const startCall = async ({
    chat,
    user,
    callType,
  }: {
    chat?: Chat;
    user?: UserProfile;
    callType: CallType;
  }) => {
    if (!currentUser) return;

    // Check account call restriction (Administrators are exempt)
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const isUserAdmin = currentUser?.isAdmin === true || userEmail === 'saeed.samadelivery@gmail.com';
    if (!isUserAdmin && currentUser?.punishment?.restrictions?.disableCalls) {
      setCallAlert({
        title: "Calling Suspended",
        description: `Voice and video calls are restricted on your account: "${currentUser.punishment.reason || 'Policy violation'}".`,
      });
      return;
    }

    // RESTRICTION: No call should be made to LimoChat Support unless allowed by admin
    const isSupportChat = chat?.participants?.includes('limochat_official_support') || 
                          user?.uid === 'limochat_official_support' || 
                          chat?.name?.includes('Support');
                          
    if (isSupportChat) {
      const allowed = chat?.supportCallsAllowed === true || currentUser?.allowSupportCalls === true;
      if (!allowed) {
        setCallAlert({
          title: "Support Calls Restricted",
          description: "Voice and video calls to LimoChat Support require staff authorization. Please send a message in this support chat to request live call assistance.",
        });
        return;
      }
    }

    try {
      soundEngine.startDialTone();
      const stream = await getLocalUserMedia(callType);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const isGroup = chat ? chat.type === 'group' : false;
      const targetParticipants: { [uid: string]: any } = {
        [currentUser.uid]: {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'User',
          photoURL: currentUser.photoURL || '',
          status: 'joined',
          audioMuted: false,
          videoMuted: callType === 'audio',
        },
      };

      // Resolve participants list safely (handles empty participants arrays on legacy/Supabase chats)
      let participantsList = chat?.participants && chat.participants.length > 0
        ? [...chat.participants]
        : (chat?.id ? chat.id.replace(/^chat_/, '').split('_').filter(Boolean) : []);
      if (user?.uid && !participantsList.includes(user.uid)) {
        participantsList.push(user.uid);
      }
      if (!participantsList.includes(currentUser.uid)) {
        participantsList.push(currentUser.uid);
      }

      let otherName = user?.displayName || chat?.name || 'Contact';
      let otherPhoto = user?.photoURL || chat?.avatar || '';
      let otherUid = user?.uid || participantsList.find((p) => p !== currentUser.uid) || '';

      if (isGroup && chat) {
        otherName = chat.name || 'Group';
        participantsList.forEach((pid) => {
          if (pid !== currentUser.uid) {
            targetParticipants[pid] = {
              uid: pid,
              displayName: 'Group Member',
              status: 'invited',
              audioMuted: false,
              videoMuted: false,
            };
          }
        });
      } else {
        participantsList.forEach((pid) => {
          if (pid !== currentUser.uid) {
            targetParticipants[pid] = {
              uid: pid,
              displayName: pid === otherUid ? otherName : 'Contact',
              photoURL: pid === otherUid ? otherPhoto : '',
              status: 'invited',
              audioMuted: false,
              videoMuted: false,
            };
          }
        });
      }

      // Record in Call History
      const historyItem: CallHistoryItem = {
        id: `call_${Date.now()}`,
        callerId: currentUser.uid,
        callerName: currentUser.displayName || 'User',
        callerPhoto: currentUser.photoURL || '',
        receiverId: otherUid,
        receiverName: otherName,
        receiverPhoto: otherPhoto,
        callType,
        direction: 'outgoing',
        timestamp: Date.now(),
        isGroup,
        groupName: isGroup ? otherName : undefined,
      };

      setCallHistory(prev => [historyItem, ...prev]);

      // Ensure targetChatId is resolved
      let targetChatId = chat?.id || '';
      if (!targetChatId && otherUid) {
        targetChatId = `chat_${[currentUser.uid, otherUid].sort().join('_')}`;
      }

      // Check recipient online status
      let calleeIsOnline = false;
      if (otherUid) {
        try {
          const userSnap = await getDoc(doc(db, 'users', otherUid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            calleeIsOnline = data.isOnline === true && (Date.now() - (data.lastSeen || 0) < 60000);
          }
        } catch {}
      }

      // SANITIZED DATA (Firestore throws if any field is undefined)
      const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newSessionData: any = {
        chatId: targetChatId,
        isGroup: !!isGroup,
        groupName: isGroup && chat?.name ? chat.name : '',
        callerId: currentUser.uid,
        callerName: currentUser.displayName || 'User',
        callerPhoto: currentUser.photoURL || '',
        callType,
        status: 'ringing' as CallStatus,
        calleeIsOnline,
        participants: targetParticipants,
        participantUids: Object.keys(targetParticipants),
        createdAt: Date.now(),
      };

      // 1. Initialize session with unified callId
      const session: CallSession = { id: callId, ...newSessionData };
      setActiveSession(session);

      // 2. Persist in Supabase PostgreSQL & broadcast incoming_call to callee
      await RealtimeCoordinator.createCallSession(session);

      // 3. Establish WebRTC PeerConnection as caller immediately for all participants
      if (isGroup) {
        const otherParticipantUids = Object.keys(targetParticipants).filter((id) => id !== currentUser.uid);
        for (const targetUid of otherParticipantUids) {
          await setupPeerConnectionAsCaller(session.id, targetUid, stream).catch((err) => {
            console.warn(`Group peer connection notice for ${targetUid}:`, err);
          });
        }
      } else if (otherUid) {
        await setupPeerConnectionAsCaller(session.id, otherUid, stream);
      }

      // 4. Auto-end call after 45s if no answer
      setTimeout(() => {
        setActiveSession(current => {
          if (current && current.id === session.id && current.status === 'ringing') {
            cleanupCallState();
            soundEngine.playCallEnd();
            return null;
          }
          return current;
        });
      }, 45000);

      // 5. Secondary background save to Firestore
      try {
        const cleanPayload = sanitizeData(newSessionData);
        await setDoc(doc(db, 'calls', callId), cleanPayload, { merge: true });
      } catch (err: any) {
        console.warn("Firestore call sync notice (active in Supabase):", err);
      }
    } catch (err: any) {
      console.error("Start call error:", err);
      soundEngine.stopDialTone();
      setCallAlert({
        title: "Call Failed",
        description: err.message || "Could not establish call. Please check device permissions.",
      });
    }
  };

  // Setup PeerConnection for Caller
  const setupPeerConnectionAsCaller = async (
    sessionId: string,
    targetUid: string,
    stream: MediaStream
  ) => {
    try {
      const pc = new RTCPeerConnection(rtcConfiguration);
      pcMap.current[targetUid] = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        soundEngine.stopDialTone();
        const incomingStream = event.streams[0] || new MediaStream([event.track]);
        try { event.track.enabled = true; } catch {}
        setRemoteStreams((prev) => ({
          ...prev,
          [targetUid]: incomingStream,
        }));
      };

      const pendingCandidates: RTCIceCandidateInit[] = [];

      // Stream ICE candidates via dual-channel RTDB + Supabase (0 Firestore writes)
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          RealtimeCoordinator.sendCallSignal(sessionId, {
            type: 'candidate',
            role: 'caller',
            candidate: event.candidate.toJSON()
          }).catch(() => {});
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerPayload = { type: offer.type, sdp: offer.sdp };

      // 1. Save offer to Supabase calls table row
      await RealtimeCoordinator.updateCallSession(sessionId, {
        offer: offerPayload
      });

      // 2. Broadcast and persist offer in call_signals table
      RealtimeCoordinator.sendCallSignal(sessionId, {
        type: 'offer',
        offer: offerPayload
      }).catch(() => {});

      // 3. Background persistence in Firestore
      const callDoc = doc(db, 'calls', sessionId);
      updateDoc(callDoc, {
        offer: offerPayload,
      }).catch(() => {});

      const applyAnswer = async (answerData: any) => {
        if (!pc.currentRemoteDescription && answerData) {
          soundEngine.stopDialTone();
          const rtcSessionDesc = new RTCSessionDescription(answerData);
          await pc.setRemoteDescription(rtcSessionDesc).catch(() => {});
          while (pendingCandidates.length > 0) {
            const c = pendingCandidates.shift();
            if (c) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          setActiveSession((prev) => (prev ? { ...prev, status: 'accepted', startedAt: prev.startedAt || Date.now() } : null));
        }
      };

      // 4. Live signaling listener via Supabase persistent signals & Realtime broadcast
      RealtimeCoordinator.subscribeToCallSignals(sessionId, async (signal) => {
        if (signal.type === 'end') {
          soundEngine.playCallEnd();
          cleanupCallState();
          return;
        } else if (signal.type === 'answer') {
          await applyAnswer(signal.answer);
        } else if (signal.type === 'candidate' && signal.role === 'callee') {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          } else {
            pendingCandidates.push(signal.candidate);
          }
        }
      });

      // 5. Watch for answer on Supabase calls table directly
      RealtimeCoordinator.subscribeToCallUpdates(sessionId, async (updates) => {
        if (updates.answer) {
          await applyAnswer(updates.answer);
        }
      });

      // 6. Secondary fallback listener on Firestore document
      onSnapshot(callDoc, async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer) {
          await applyAnswer(data.answer);
        }
      }, () => {});
    } catch (err) {
      console.warn("Peer connection setup notice:", err);
    }
  };

  // Accept Incoming Call
  const acceptCall = async () => {
    if (!incomingSession || !currentUser) return;
    soundEngine.stopRingtone();

    try {
      const stream = await getLocalUserMedia(incomingSession.callType);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const session: CallSession = {
        ...incomingSession,
        status: 'accepted',
        startedAt: Date.now(),
      };
      setActiveSession(session);
      setIncomingSession(null);

      // Record in call history
      const historyItem: CallHistoryItem = {
        id: `call_${Date.now()}`,
        callerId: session.callerId,
        callerName: session.callerName,
        callerPhoto: session.callerPhoto,
        receiverId: currentUser.uid,
        receiverName: currentUser.displayName,
        receiverPhoto: currentUser.photoURL,
        callType: session.callType,
        direction: 'incoming',
        timestamp: Date.now(),
        isGroup: session.isGroup,
        groupName: session.groupName,
      };
      setCallHistory(prev => [historyItem, ...prev]);

      // 1. Update status to 'accepted' in Supabase calls table
      await RealtimeCoordinator.updateCallSession(session.id, {
        status: 'accepted',
        startedAt: Date.now(),
      });

      const sessionRef = doc(db, 'calls', session.id);
      updateDoc(sessionRef, {
        status: 'accepted',
        startedAt: Date.now(),
        [`participants.${currentUser.uid}.status`]: 'joined',
      }).catch(() => {});

      const pc = new RTCPeerConnection(rtcConfiguration);
      pcMap.current[session.callerId] = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        soundEngine.stopDialTone();
        const incomingStream = event.streams[0] || new MediaStream([event.track]);
        try { event.track.enabled = true; } catch {}
        setRemoteStreams((prev) => ({
          ...prev,
          [session.callerId]: incomingStream,
        }));
      };

      const pendingCandidates: RTCIceCandidateInit[] = [];

      // Stream callee candidates via dual-channel RTDB + Supabase (0 Firestore writes)
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          RealtimeCoordinator.sendCallSignal(session.id, {
            type: 'candidate',
            role: 'callee',
            candidate: event.candidate.toJSON()
          }).catch(() => {});
        }
      };

      // 2. Fetch offer from incoming session or Supabase calls table
      let offerData = session.offer;
      if (!offerData) {
        const latestCall = await RealtimeCoordinator.fetchCallSession(session.id);
        if (latestCall?.offer) {
          offerData = latestCall.offer;
        }
      }

      const applyOfferAndAnswer = async (offerPayload: any) => {
        if (!pc.currentRemoteDescription && offerPayload) {
          await pc.setRemoteDescription(new RTCSessionDescription(offerPayload)).catch(() => {});
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          const answerPayload = { type: answer.type, sdp: answer.sdp };

          // Save answer in Supabase calls table
          await RealtimeCoordinator.updateCallSession(session.id, {
            answer: answerPayload,
          });

          // Broadcast & persist answer in call_signals table
          RealtimeCoordinator.sendCallSignal(session.id, {
            type: 'answer',
            answer: answerPayload,
          }).catch(() => {});

          // Save to Firestore in background
          updateDoc(sessionRef, {
            answer: answerPayload,
          }).catch(() => {});

          // Flush any queued caller candidates
          while (pendingCandidates.length > 0) {
            const c = pendingCandidates.shift();
            if (c) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
        }
      };

      if (offerData) {
        await applyOfferAndAnswer(offerData);
      }

      // 3. Dual-channel listener for caller candidates and offers
      RealtimeCoordinator.subscribeToCallSignals(session.id, async (signal) => {
        if (signal.type === 'end') {
          soundEngine.playCallEnd();
          cleanupCallState();
          return;
        } else if (signal.type === 'offer') {
          await applyOfferAndAnswer(signal.offer);
        } else if (signal.type === 'candidate' && signal.role === 'caller') {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          } else {
            pendingCandidates.push(signal.candidate);
          }
        }
      });
    } catch (err: any) {
      console.error("Accept call error:", err);
      cleanupCallState();
    }
  };

  // Post call log to Chat conversation thread
  const postCallLogToChat = async (
    chatId: string,
    callerId: string,
    callerName: string,
    callerPhoto: string,
    callType: CallType,
    status: 'missed' | 'ended' | 'declined',
    duration: number
  ) => {
    if (!chatId) return;
    const now = Date.now();
    const isMissed = status === 'missed' || status === 'declined' || duration === 0;
    const callLabel = isMissed
      ? `Missed ${callType === 'video' ? 'video' : 'voice'} call`
      : `${callType === 'video' ? 'Video' : 'Voice'} call (${Math.floor(duration / 60)}m ${duration % 60}s)`;

    const logMessage = {
      id: `msg_call_${now}_${Math.random().toString(36).slice(2, 6)}`,
      chatId,
      senderId: callerId,
      senderName: callerName,
      senderPhoto: callerPhoto,
      text: callLabel,
      type: 'call_log' as const,
      status: 'delivered' as const,
      timestamp: now,
      callType,
      callStatus: isMissed ? 'missed' : 'ended',
      mediaDuration: duration,
      isDeletedForEveryone: false,
      deletedForUsers: [],
      starredBy: [],
    };

    // Persist and broadcast call log in Supabase PostgreSQL
    const pUids = activeSession?.participantUids || [callerId];
    RealtimeCoordinator.persistAndBroadcastMessage(
      chatId,
      logMessage as any,
      { participants: pUids }
    ).catch(() => {});

    try {
      const cachedChats = localStorage.getItem('limochat_cached_chats');
      if (cachedChats) {
        const parsed = JSON.parse(cachedChats);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((c: any) => c.id === chatId ? {
            ...c,
            updatedAt: now,
            lastMessage: {
              text: callLabel,
              senderId: callerId,
              timestamp: now,
              type: 'call_log',
              status: 'delivered',
              callType,
              callStatus: isMissed ? 'missed' : 'ended',
            }
          } : c);
          localStorage.setItem('limochat_cached_chats', JSON.stringify(updated));
        }
      }
    } catch {}

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, logMessage);

      await updateDoc(doc(db, 'chats', chatId), {
        updatedAt: now,
        lastMessage: {
          text: callLabel,
          senderId: callerId,
          timestamp: now,
          type: 'call_log',
          status: 'delivered',
          callType,
          callStatus: isMissed ? 'missed' : 'ended',
        },
      });

      // Update cached messages in localStorage if exists
      const cached = localStorage.getItem(`limochat_msgs_${chatId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          localStorage.setItem(`limochat_msgs_${chatId}`, JSON.stringify([...parsed, logMessage]));
        }
      }
    } catch (err) {
      console.warn("Could not post call log to chat (persisted in Supabase):", err);
    }
  };

  // Decline Call
  const declineCall = async () => {
    soundEngine.stopRingtone();
    soundEngine.stopDialTone();
    NativeNotificationService.dismissCallNotification();
    const sessionToDecline = incomingSessionRef.current || incomingSession;
    if (sessionToDecline && currentUser) {
      const historyItem: CallHistoryItem = {
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        callerId: sessionToDecline.callerId,
        callerName: sessionToDecline.callerName,
        callerPhoto: sessionToDecline.callerPhoto,
        receiverId: currentUser.uid,
        receiverName: currentUser.displayName || 'User',
        receiverPhoto: currentUser.photoURL || '',
        callType: sessionToDecline.callType,
        direction: 'missed',
        duration: 0,
        timestamp: Date.now(),
        isGroup: sessionToDecline.isGroup,
        groupName: sessionToDecline.groupName,
      };

      setCallHistory(prev => [historyItem, ...prev]);

      // Dual-Database: Save call log for both recipient and caller
      RealtimeCoordinator.saveCallLog(historyItem, currentUser.uid).catch(() => {});
      setDoc(doc(db, 'users', currentUser.uid, 'call_logs', historyItem.id), historyItem).catch(() => {});
      if (sessionToDecline.callerId && sessionToDecline.callerId !== currentUser.uid) {
        RealtimeCoordinator.saveCallLog(historyItem, sessionToDecline.callerId).catch(() => {});
        setDoc(doc(db, 'users', sessionToDecline.callerId, 'call_logs', historyItem.id), historyItem).catch(() => {});
      }

      postCallLogToChat(
        sessionToDecline.chatId || '',
        sessionToDecline.callerId,
        sessionToDecline.callerName,
        sessionToDecline.callerPhoto || '',
        sessionToDecline.callType,
        'missed',
        0
      );

      // Instant WebRTC signal termination
      RealtimeCoordinator.sendCallSignal(sessionToDecline.id, {
        type: 'end',
      }).catch(() => {});

      if (sessionToDecline.callerId && sessionToDecline.callerId !== currentUser.uid) {
        RealtimeCoordinator.sendUserCallEnded(sessionToDecline.callerId, sessionToDecline.id).catch(() => {});
      }

      RealtimeCoordinator.updateCallSession(sessionToDecline.id, {
        status: 'declined',
      }).catch(() => {});

      const sessionRef = doc(db, 'calls', sessionToDecline.id);
      await updateDoc(sessionRef, {
        status: 'declined',
        [`participants.${currentUser.uid}.status`]: 'declined',
      }).catch(() => {});
    }
    soundEngine.playCallEnd();
    cleanupCallState();
  };

  // End Call
  const endCall = async () => {
    soundEngine.stopDialTone();
    soundEngine.stopRingtone();
    NativeNotificationService.dismissCallNotification();
    const sessionToEnd = activeSessionRef.current || incomingSessionRef.current || activeSession || incomingSession;
    if (sessionToEnd) {
      const duration = sessionToEnd.startedAt 
        ? Math.round((Date.now() - sessionToEnd.startedAt) / 1000) 
        : 0;
      const callStatus = duration > 0 ? 'ended' : 'missed';
      const isCaller = sessionToEnd.callerId === currentUser?.uid;
      const otherUid = isCaller
        ? sessionToEnd.participantUids?.find((id) => id !== currentUser?.uid)
        : sessionToEnd.callerId;

      const historyLog: CallHistoryItem = {
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        callerId: sessionToEnd.callerId,
        callerName: sessionToEnd.callerName,
        callerPhoto: sessionToEnd.callerPhoto || '',
        receiverId: otherUid || '',
        receiverName: isCaller ? (sessionToEnd.groupName || 'Contact') : (currentUser?.displayName || 'Contact'),
        receiverPhoto: '',
        callType: sessionToEnd.callType,
        direction: isCaller ? 'outgoing' : (duration > 0 ? 'incoming' : 'missed'),
        timestamp: Date.now(),
        duration,
        isGroup: sessionToEnd.isGroup,
        groupName: sessionToEnd.groupName,
      };

      // Dual-Database persistence for call log
      if (currentUser?.uid) {
        RealtimeCoordinator.saveCallLog(historyLog, currentUser.uid).catch(() => {});
        setDoc(doc(db, 'users', currentUser.uid, 'call_logs', historyLog.id), historyLog).catch(() => {});
      }
      if (otherUid && otherUid !== currentUser?.uid) {
        const calleeLog: CallHistoryItem = {
          ...historyLog,
          id: `call_${Date.now()}_callee_${Math.random().toString(36).slice(2, 6)}`,
          direction: duration > 0 ? 'incoming' : 'missed',
        };
        RealtimeCoordinator.saveCallLog(calleeLog, otherUid).catch(() => {});
        setDoc(doc(db, 'users', otherUid, 'call_logs', calleeLog.id), calleeLog).catch(() => {});
      }

      setCallHistory((prev) => [historyLog, ...prev.filter((c) => c.id !== historyLog.id)]);

      postCallLogToChat(
        sessionToEnd.chatId || '',
        sessionToEnd.callerId,
        sessionToEnd.callerName,
        sessionToEnd.callerPhoto || '',
        sessionToEnd.callType,
        callStatus,
        duration
      );

      // 1. Instant WebRTC signal termination
      RealtimeCoordinator.sendCallSignal(sessionToEnd.id, {
        type: 'end',
      }).catch(() => {});

      // 2. Broadcast call_ended directly to all remote participants' user_calls channel
      const allUids = sessionToEnd.participantUids || [sessionToEnd.callerId, otherUid].filter(Boolean);
      allUids.forEach((uid) => {
        if (uid && uid !== currentUser?.uid) {
          RealtimeCoordinator.sendUserCallEnded(uid as string, sessionToEnd.id).catch(() => {});
        }
      });

      RealtimeCoordinator.updateCallSession(sessionToEnd.id, {
        status: 'ended',
        endedAt: Date.now(),
      }).catch(() => {});

      const sessionRef = doc(db, 'calls', sessionToEnd.id);
      await updateDoc(sessionRef, {
        status: 'ended',
        endedAt: Date.now(),
      }).catch(() => {});
    }
    soundEngine.playCallEnd();
    setTimeout(() => {
      cleanupCallState();
    }, 250);
  };

  const toggleAudio = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoMuted(!videoTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (!localStream) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await getScreenShareMedia();
        const screenTrack = screenStream.getVideoTracks()[0];
        const currentVideoTrack = localStream.getVideoTracks()[0];
        originalVideoTrack.current = currentVideoTrack;

        Object.values(pcMap.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        if (currentVideoTrack) {
          localStream.removeTrack(currentVideoTrack);
        }
        localStream.addTrack(screenTrack);

        screenTrack.onended = () => {
          stopScreenSharing();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn("Screen share cancelled:", err);
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
    if (!isScreenSharing || !localStream) return;
    const screenTrack = localStream.getVideoTracks()[0];
    if (screenTrack) {
      screenTrack.stop();
      localStream.removeTrack(screenTrack);
    }

    if (originalVideoTrack.current) {
      localStream.addTrack(originalVideoTrack.current);
      Object.values(pcMap.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && originalVideoTrack.current) {
          sender.replaceTrack(originalVideoTrack.current);
        }
      });
    }

    setIsScreenSharing(false);
  };

  return (
    <CallContext.Provider
      value={{
        activeSession,
        incomingSession,
        localStream,
        remoteStreams,
        callHistory,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
        cameraFacing,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleAudio,
        toggleVideo,
        flipCamera,
        toggleScreenShare,
        isSpeakerOn,
        toggleSpeaker,
      }}
    >
      {children}
      {callAlert && (
        <ConfirmModal
          isOpen={true}
          title={callAlert.title}
          description={callAlert.description}
          variant="warning"
          singleAction={true}
          confirmText="OK"
          onConfirm={() => setCallAlert(null)}
        />
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
