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
import { getLocalUserMedia, getScreenShareMedia, rtcConfiguration } from '../utils/webrtc';
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
  startCall: (target: { chat?: Chat; user?: UserProfile; callType: CallType }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
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
  const incomingSessionRef = useRef<CallSession | null>(null);

  useEffect(() => {
    incomingSessionRef.current = incomingSession;
  }, [incomingSession]);

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  // Sync call history with local cache
  useEffect(() => {
    if (callHistory.length > 0) {
      localStorage.setItem('limochat_call_history', JSON.stringify(callHistory));
    }
  }, [callHistory]);

  // Listen for incoming calls targeted at current user
  useEffect(() => {
    if (!currentUser?.uid) return;

    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('status', '==', 'ringing'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let foundIncoming: CallSession | null = null;
      for (const docSnap of snapshot.docs) {
        const session = { id: docSnap.id, ...docSnap.data() } as CallSession;
        if (session.callerId !== currentUser.uid && session.participants && session.participants[currentUser.uid]) {
          const myParticipant = session.participants[currentUser.uid];
          const ageMs = Date.now() - (session.createdAt || 0);
          if (myParticipant.status === 'invited' && ageMs < 60000) {
            foundIncoming = session;
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
      } else {
        if (incomingSessionRef.current) {
          setIncomingSession(null);
          soundEngine.stopRingtone();
          NativeNotificationService.dismissCallNotification();
        }
      }
    }, (err) => {
      console.warn("Incoming call listener warning:", err);
    });

    return () => {
      unsubscribe();
      soundEngine.stopRingtone();
    };
  }, [currentUser?.uid]);

  // Sync active session changes
  useEffect(() => {
    if (!activeSession?.id) return;

    const sessionRef = doc(db, 'calls', activeSession.id);
    const unsub = onSnapshot(sessionRef, (docSnap) => {
      if (!docSnap.exists()) {
        cleanupCallState();
        return;
      }
      const data = { id: docSnap.id, ...docSnap.data() } as CallSession;
      setActiveSession(data);

      if (data.status === 'ended' || data.status === 'declined') {
        soundEngine.playCallEnd();
        cleanupCallState();
      }
    }, () => {});

    return () => unsub();
  }, [activeSession?.id]);

  const cleanupCallState = () => {
    soundEngine.stopDialTone();
    soundEngine.stopRingtone();

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    Object.values(pcMap.current).forEach((pc) => pc.close());
    pcMap.current = {};

    setRemoteStreams({});
    setActiveSession(null);
    setIncomingSession(null);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
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

      let otherName = 'Contact';
      let otherPhoto = '';
      let otherUid = '';

      if (isGroup && chat) {
        otherName = chat.name || 'Group';
        chat.participants.forEach((pid) => {
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
      } else if (user) {
        otherName = user.displayName;
        otherPhoto = user.photoURL || '';
        otherUid = user.uid;
        targetParticipants[user.uid] = {
          uid: user.uid,
          displayName: user.displayName || 'Contact',
          photoURL: user.photoURL || '',
          status: 'invited',
          audioMuted: false,
          videoMuted: false,
        };
      } else if (chat) {
        otherName = chat.name || 'Contact';
        otherPhoto = chat.avatar || '';
        chat.participants.forEach((pid) => {
          if (pid !== currentUser.uid) {
            otherUid = pid;
            targetParticipants[pid] = {
              uid: pid,
              displayName: chat.name || 'Contact',
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

      try {
        const callsRef = collection(db, 'calls');
        const cleanPayload = sanitizeData(newSessionData);
        const docRef = await addDoc(callsRef, cleanPayload);
        const session: CallSession = { id: docRef.id, ...newSessionData };
        setActiveSession(session);

        if (!isGroup && (user || (chat && chat.participants.length === 2))) {
          const targetUserUid = user ? user.uid : chat!.participants.find((p) => p !== currentUser.uid)!;
          await setupPeerConnectionAsCaller(session.id, targetUserUid, stream);
        }

        // Auto-end call after 45s if no answer
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
      } catch (err: any) {
        console.error("Firestore call session error:", err);
        soundEngine.stopDialTone();
        cleanupCallState();
        const isQuota = err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded') || err?.message?.includes('RESOURCE_EXHAUSTED');
        setCallAlert({
          title: isQuota ? "Database Daily Quota Reached" : "Call Connection Failed",
          description: isQuota
            ? "Firebase Spark daily free write limit (20,000 writes/day) has been reached on project 'woki-toki-69a0d'. Please upgrade to the Blaze plan in Firebase Console to enable unlimited calling."
            : (err?.message || "Could not connect call signaling. Please check connection and retry."),
        });
        return;
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
        setRemoteStreams((prev) => ({
          ...prev,
          [targetUid]: event.streams[0],
        }));
      };

      const callerCandidates = collection(db, 'calls', sessionId, 'callerCandidates');
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(callerCandidates, event.candidate.toJSON()).catch(() => {});
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callDoc = doc(db, 'calls', sessionId);
      await updateDoc(callDoc, {
        offer: { type: offer.type, sdp: offer.sdp },
      }).catch(() => {});

      const unsubCall = onSnapshot(callDoc, async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && !pc.currentRemoteDescription) {
          soundEngine.stopDialTone();
          const rtcSessionDesc = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(rtcSessionDesc);
        }
      }, () => {});

      const calleeCandidates = collection(db, 'calls', sessionId, 'calleeCandidates');
      onSnapshot(calleeCandidates, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            await pc.addIceCandidate(candidate).catch(() => {});
          }
        });
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
      setLocalStream(stream);

      const session = incomingSession;
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

      const sessionRef = doc(db, 'calls', session.id);
      await updateDoc(sessionRef, {
        status: 'accepted',
        startedAt: Date.now(),
        [`participants.${currentUser.uid}.status`]: 'joined',
      }).catch(() => {});

      const pc = new RTCPeerConnection(rtcConfiguration);
      pcMap.current[session.callerId] = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => ({
          ...prev,
          [session.callerId]: event.streams[0],
        }));
      };

      const calleeCandidates = collection(db, 'calls', session.id, 'calleeCandidates');
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(calleeCandidates, event.candidate.toJSON()).catch(() => {});
        }
      };

      const callSnapshot = await getDoc(sessionRef).catch(() => null);
      const callData = callSnapshot?.data();
      if (callData?.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateDoc(sessionRef, {
          answer: { type: answer.type, sdp: answer.sdp },
        }).catch(() => {});
      }

      const callerCandidates = collection(db, 'calls', session.id, 'callerCandidates');
      onSnapshot(callerCandidates, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            await pc.addIceCandidate(candidate).catch(() => {});
          }
        });
      }, () => {});
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
      console.warn("Could not post call log to chat:", err);
    }
  };

  // Decline Call
  const declineCall = async () => {
    soundEngine.stopRingtone();
    if (incomingSession && currentUser) {
      const historyItem: CallHistoryItem = {
        id: `call_${Date.now()}`,
        callerId: incomingSession.callerId,
        callerName: incomingSession.callerName,
        callerPhoto: incomingSession.callerPhoto,
        callType: incomingSession.callType,
        direction: 'missed',
        timestamp: Date.now(),
        isGroup: incomingSession.isGroup,
        groupName: incomingSession.groupName,
      };
      setCallHistory(prev => [historyItem, ...prev]);

      postCallLogToChat(
        incomingSession.chatId || '',
        incomingSession.callerId,
        incomingSession.callerName,
        incomingSession.callerPhoto || '',
        incomingSession.callType,
        'missed',
        0
      );

      const sessionRef = doc(db, 'calls', incomingSession.id);
      await updateDoc(sessionRef, {
        status: 'declined',
        [`participants.${currentUser.uid}.status`]: 'declined',
      }).catch(() => {});
    }
    setIncomingSession(null);
  };

  // End Call
  const endCall = async () => {
    if (activeSession) {
      const duration = activeSession.startedAt 
        ? Math.round((Date.now() - activeSession.startedAt) / 1000) 
        : 0;
      const callStatus = duration > 0 ? 'ended' : 'missed';

      postCallLogToChat(
        activeSession.chatId || '',
        activeSession.callerId,
        activeSession.callerName,
        activeSession.callerPhoto || '',
        activeSession.callType,
        callStatus,
        duration
      );

      const sessionRef = doc(db, 'calls', activeSession.id);
      await updateDoc(sessionRef, {
        status: 'ended',
        endedAt: Date.now(),
      }).catch(() => {});
    }
    soundEngine.playCallEnd();
    cleanupCallState();
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
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleAudio,
        toggleVideo,
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
