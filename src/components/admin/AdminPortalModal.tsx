import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldAlert, 
  Users, 
  MessageSquare, 
  Users2, 
  Activity, 
  UserPlus, 
  Trash2, 
  Ban, 
  CheckCircle, 
  Search, 
  Edit3, 
  ShieldCheck, 
  Send, 
  Radio, 
  AlertTriangle,
  RefreshCw,
  Mail,
  Lock,
  Headphones,
  CheckCheck,
  Phone,
  Clock,
  Sliders,
  CheckSquare,
  AlertCircle,
  Plus,
  Check,
  FileText,
  ExternalLink,
  Eraser,
  Filter,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  Pause,
  Download,
  Database,
  Mic
} from 'lucide-react';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';
import { AppVersionAdminTab } from './AppVersionAdminTab';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  addDoc,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserProfile, Chat, Message, Community, UserPunishment } from '../../types';
import { Avatar } from '../common/Avatar';
import { ConfirmModal } from '../common/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { 
  PolicyRule, 
  PolicyRuleAction, 
  ViolationAuditLog, 
  PolicyModerationSettings,
  PolicyIncident,
  getPolicyRules, 
  savePolicyRules, 
  getModerationSettings, 
  saveModerationSettings,
  subscribeToModerationSettings,
  subscribeToPolicyRules,
  getPendingPolicyIncidents,
  approvePolicyIncident,
  dismissPolicyIncident,
  getViolationAuditLogs, 
  highlightBannedWord,
  DEFAULT_POLICY_RULES,
  DEFAULT_MODERATION_SETTINGS 
} from '../../utils/policyEngine';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'overview' | 'support' | 'users' | 'chats' | 'policies' | 'admins' | 'version';
  onSelectChat?: (chat: Chat) => void;
}

const POLICY_VIOLATIONS = [
  { id: 'harassment', name: 'Abusive Language & Harassment', description: 'Using abusive, threatening, discriminatory, or harassing language against members.' },
  { id: 'spam', name: 'Spamming & Flooding', description: 'Sending unsolicited bulk advertisements, repetitive spam messages, or flooding channels.' },
  { id: 'privacy', name: 'Privacy Breach & Doxxing', description: 'Sharing personal information, private virtual numbers, or confidential documents without permission.' },
  { id: 'prohibited_media', name: 'Prohibited / Malicious Content', description: 'Uploading prohibited materials, malware, phishing links, or unauthorized files.' },
  { id: 'impersonation', name: 'Impersonation of Staff', description: 'Falsely claiming to represent LimoChat staff, support agents, or corporate representatives.' },
  { id: 'custom', name: 'Other Policy Violation', description: 'Violation of general LimoChat Terms of Service and community safety policies.' },
];

const DURATION_PRESETS = [
  { label: '15 Minutes', minutes: 15 },
  { label: '1 Hour', minutes: 60 },
  { label: '6 Hours', minutes: 360 },
  { label: '24 Hours', minutes: 1440 },
  { label: '3 Days', minutes: 4320 },
  { label: '7 Days', minutes: 10080 },
  { label: '30 Days', minutes: 43200 },
];

const AdminVoicePlayer: React.FC<{ url: string; duration?: number }> = ({ url, duration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '0:00';
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-2.5 bg-black/30 dark:bg-black/40 p-2.5 rounded-2xl border border-white/10 my-1 w-full max-w-xs">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setAudioDuration(audioRef.current.duration)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button
        type="button"
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center flex-shrink-0 transition shadow cursor-pointer"
        title={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div 
          className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden cursor-pointer" 
          onClick={(e) => {
            if (!audioRef.current || !audioDuration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = pos * audioDuration;
          }}
        >
          <div
            className="bg-[#00a884] h-full transition-all"
            style={{ width: `${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-gray-300 font-mono mt-1">
          <span>{formatSeconds(currentTime)}</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {formatSeconds(audioDuration)}
          </span>
        </div>
      </div>
    </div>
  );
};

const AdminMessageItem: React.FC<{
  message: Message;
  isSupportStaff: boolean;
  onPreviewImage?: (url: string) => void;
  onDelete?: () => void;
}> = ({ message, isSupportStaff, onPreviewImage, onDelete }) => {
  return (
    <div
      className={`p-3 rounded-2xl border transition-all ${
        isSupportStaff
          ? 'bg-[#005c4b]/80 border-[#00a884]/40 ml-auto text-white max-w-[85%]'
          : 'bg-[#182229] border-[#2e3b44] text-[#d1d7db] mr-auto max-w-[85%]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-semibold text-[#8696a0]">
          {isSupportStaff ? 'LimoChat Staff' : message.senderName || message.senderId || 'User'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-[#8696a0]">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-red-400 hover:text-red-300 p-0.5 transition cursor-pointer"
              title="Delete message"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Voice note playback */}
      {message.type === 'voice' && message.mediaUrl && (
        <AdminVoicePlayer url={message.mediaUrl} duration={message.mediaDuration} />
      )}

      {/* Image attachment */}
      {message.type === 'image' && message.mediaUrl && (
        <div className="my-1.5 rounded-xl overflow-hidden border border-white/10 max-w-sm">
          <img
            src={message.mediaUrl}
            alt="Support Photo"
            className="w-full max-h-60 object-cover cursor-pointer hover:opacity-95 transition"
            onClick={() => onPreviewImage ? onPreviewImage(message.mediaUrl!) : window.open(message.mediaUrl, '_blank')}
          />
        </div>
      )}

      {/* Video attachment */}
      {message.type === 'video' && message.mediaUrl && (
        <div className="my-1.5 rounded-xl overflow-hidden border border-white/10 max-w-sm">
          <video
            src={message.mediaUrl}
            controls
            preload="metadata"
            className="w-full max-h-60 rounded-xl object-cover"
          />
        </div>
      )}

      {/* Document / File attachment */}
      {message.type === 'file' && message.mediaUrl && (
        <a
          href={message.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={message.fileName || 'attachment'}
          className="my-1.5 flex items-center gap-2.5 p-2.5 bg-black/30 rounded-xl border border-white/10 hover:bg-black/40 transition text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{message.fileName || 'Document'}</div>
            <div className="text-[10px] text-[#8696a0]">{message.fileSize || 'Attachment'}</div>
          </div>
          <Download className="w-4 h-4 text-[#8696a0] hover:text-white flex-shrink-0" />
        </a>
      )}

      {/* Message text */}
      {message.text && (
        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
      )}
    </div>
  );
};

export const AdminPortalModal: React.FC<AdminPortalModalProps> = ({ 
  isOpen, 
  onClose,
  initialTab,
  onSelectChat 
}) => {
  const { 
    currentUser, 
    adminEmails, 
    addAdminEmail, 
    removeAdminEmail,
    updateUserPhoneNumberByAdmin,
    applyUserPunishment,
    issuePolicyWarning
  } = useAuth();
  const { sendSupportReply, chats: activeChatsContext } = useChat();

  const [activeTab, setActiveTab] = useState<'overview' | 'support' | 'users' | 'chats' | 'policies' | 'admins' | 'version'>('overview');

  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('limochat_close_all_menus'));
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  // Policy rules and automated moderation states
  const [policyRules, setPolicyRules] = useState<PolicyRule[]>(DEFAULT_POLICY_RULES);
  const [moderationSettings, setModerationSettings] = useState<PolicyModerationSettings>(DEFAULT_MODERATION_SETTINGS);
  const [pendingIncidents, setPendingIncidents] = useState<PolicyIncident[]>([]);
  const [processingIncidentId, setProcessingIncidentId] = useState<string | null>(null);
  const [violationLogs, setViolationLogs] = useState<ViolationAuditLog[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState<{ [ruleId: string]: string }>({});
  const [savingPolicyRuleId, setSavingPolicyRuleId] = useState<string | null>(null);

  // Selected action configuration per pending incident card
  const [selectedActionByIncident, setSelectedActionByIncident] = useState<{
    [incidentId: string]: { action: PolicyRuleAction; minutes: number };
  }>({});

  const getActionForIncident = (inc: PolicyIncident): { action: PolicyRuleAction; minutes: number } => {
    if (selectedActionByIncident[inc.id]) {
      return selectedActionByIncident[inc.id];
    }
    return {
      action: inc.suggestedAction || 'temporary_ban',
      minutes: inc.tempSuspensionMinutes || 60,
    };
  };

  const updateActionForIncident = (incidentId: string, action: PolicyRuleAction, minutes?: number) => {
    setSelectedActionByIncident((prev) => ({
      ...prev,
      [incidentId]: {
        action,
        minutes: minutes !== undefined ? minutes : (prev[incidentId]?.minutes || 60),
      },
    }));
  };

  // Admin management state
  const [newAdminInput, setNewAdminInput] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Firestore data states
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [chatsList, setChatsList] = useState<Chat[]>([]);
  const [communitiesList, setCommunitiesList] = useState<Community[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Search & filter
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatTypeFilter, setChatTypeFilter] = useState<'all' | 'direct' | 'group' | 'support' | 'announcement'>('all');

  // Selected chat for general inspection
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const inspectChatUnsubRef = React.useRef<(() => void) | null>(null);

  // Support desk state
  const [selectedSupportChat, setSelectedSupportChat] = useState<Chat | null>(null);
  const [supportMessages, setSupportMessages] = useState<Message[]>([]);
  const [supportReplyText, setSupportReplyText] = useState('');
  const [loadingSupportMessages, setLoadingSupportMessages] = useState(false);
  const [sendingSupportReply, setSendingSupportReply] = useState(false);
  const [supportFilter, setSupportFilter] = useState<'pending' | 'all'>('all');
  const supportUnsubRef = React.useRef<(() => void) | null>(null);
  const supportFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const supportMessagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll support chat to newest message
  useEffect(() => {
    if (selectedSupportChat && supportMessages.length > 0) {
      supportMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedSupportChat?.id, supportMessages.length]);
  const [supportAttachment, setSupportAttachment] = useState<{
    file?: File;
    type: 'image' | 'video' | 'voice' | 'file';
    dataUrl: string;
    name: string;
    size: string;
  } | null>(null);
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);

  // Broadcast announcement
  const [broadcastText, setBroadcastText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Generic Smooth Confirm / Alert modal
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    singleAction?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Phone number editor state
  const [editingPhoneUser, setEditingPhoneUser] = useState<UserProfile | null>(null);
  const [newPhoneInput, setNewPhoneInput] = useState('');

  // Policy warning modal state
  const [warningUser, setWarningUser] = useState<UserProfile | null>(null);
  const [selectedRuleName, setSelectedRuleName] = useState('Abusive Language & Harassment');
  const [customWarningText, setCustomWarningText] = useState('');
  const [autoSendSupportNotice, setAutoSendSupportNotice] = useState(true);

  // Punishments & Sanctions modal state
  const [punishingUser, setPunishingUser] = useState<UserProfile | null>(null);
  const [suspensionType, setSuspensionType] = useState<'none' | 'temporary' | 'permanent'>('none');
  const [tempDurationMinutes, setTempDurationMinutes] = useState<number>(60);
  const [restrictSendingMessages, setRestrictSendingMessages] = useState<boolean>(false);
  const [restrictAddingContacts, setRestrictAddingContacts] = useState<boolean>(false);
  const [restrictCalls, setRestrictCalls] = useState<boolean>(false);
  const [punishmentReason, setPunishmentReason] = useState<string>('');

  // Fetch all system data
  const loadSystemData = async () => {
    try {
      setLoadingData(true);
      // 1. Dual-Database: Fetch all users from Supabase + Firestore
      const [supaUsers, usersSnap] = await Promise.all([
        RealtimeCoordinator.fetchAllUsers().catch(() => []),
        getDocs(collection(db, 'users')).catch(() => null),
      ]);
      const userMap = new Map<string, UserProfile>();
      supaUsers.forEach((u) => userMap.set(u.uid, u));
      if (usersSnap) {
        usersSnap.forEach((d) => {
          const u = { ...d.data(), uid: d.id } as UserProfile;
          userMap.set(u.uid, { ...(userMap.get(u.uid) || {}), ...u });
        });
      }
      setUsersList(Array.from(userMap.values()));

      // 2. Dual-Database: Fetch all chats from Supabase + Firestore
      const [supaChats, chatsSnap] = await Promise.all([
        RealtimeCoordinator.fetchAllChatsAdmin().catch(() => []),
        getDocs(collection(db, 'chats')).catch(() => null),
      ]);
      const chatMap = new Map<string, Chat>();
      supaChats.forEach((c) => chatMap.set(c.id, c));
      if (chatsSnap) {
        chatsSnap.forEach((d) => {
          const c = { ...d.data(), id: d.id } as Chat;
          chatMap.set(c.id, { ...(chatMap.get(c.id) || {}), ...c });
        });
      }
      activeChatsContext.forEach((c) => {
        if (!chatMap.has(c.id)) chatMap.set(c.id, c);
      });
      const sortedChats = Array.from(chatMap.values()).sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
      );
      setChatsList(sortedChats);

      // 3. Fetch all communities
      const commSnap = await getDocs(collection(db, 'communities')).catch(() => null);
      const cmList: Community[] = [];
      if (commSnap) {
        commSnap.forEach((d) => cmList.push({ ...d.data(), id: d.id } as Community));
      }
      setCommunitiesList(cmList);

      // 4. Fetch policy rules, moderation settings & violation audit logs
      try {
        const [rules, modSettings, pending, logs] = await Promise.all([
          getPolicyRules(),
          getModerationSettings(),
          getPendingPolicyIncidents(),
          getViolationAuditLogs(),
        ]);
        setPolicyRules(rules);
        setModerationSettings(modSettings);
        setPendingIncidents(pending);
        setViolationLogs(logs);
      } catch {}
    } catch (err) {
      console.error("Admin data load error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadSystemData();

    // Real-time listener for users list
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uList: UserProfile[] = [];
      snap.forEach((d) => uList.push({ ...d.data(), uid: d.id } as UserProfile));
      setUsersList(uList);
    }, (err) => console.warn("Users sync notice:", err));

    // Real-time listener for incoming chats / tickets
    const unsubChats = onSnapshot(collection(db, 'chats'), (snap) => {
      const list: Chat[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Chat));
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setChatsList(list);
    }, () => {});

    // Real-time listener for pending policy moderation incidents
    const unsubIncidents = onSnapshot(collection(db, 'policy_incidents'), (snap) => {
      const list: PolicyIncident[] = [];
      snap.forEach((d) => {
        const item = { ...d.data(), id: d.id } as PolicyIncident;
        if (item.status === 'pending_review') {
          list.push(item);
        }
      });
      list.sort((a, b) => b.timestamp - a.timestamp);
      setPendingIncidents(list);
    }, () => {});

    // Real-time cross-device sync for Moderation Settings & Policy Rules
    const unsubModSettings = subscribeToModerationSettings((settings) => {
      setModerationSettings(settings);
    });

    const unsubRules = subscribeToPolicyRules((rules) => {
      setPolicyRules(rules);
    });

    return () => {
      unsubUsers();
      unsubChats();
      unsubIncidents();
      unsubModSettings();
      unsubRules();
      if (supportUnsubRef.current) {
        supportUnsubRef.current();
        supportUnsubRef.current = null;
      }
      if (inspectChatUnsubRef.current) {
        inspectChatUnsubRef.current();
        inspectChatUnsubRef.current = null;
      }
    };
  }, [isOpen]);

  // Load messages for room inspection with dual-database streaming
  const handleInspectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    setLoadingMessages(true);

    if (inspectChatUnsubRef.current) {
      inspectChatUnsubRef.current();
      inspectChatUnsubRef.current = null;
    }

    // 1. Dual-Database: Fetch messages from Supabase first for instantaneous loading
    try {
      const supaMsgs = await RealtimeCoordinator.fetchChatMessages(chat.id);
      if (supaMsgs && supaMsgs.length > 0) {
        setChatMessages(supaMsgs);
        setLoadingMessages(false);
      }
    } catch {}

    // 2. Real-time Firestore stream
    const msgRef = collection(db, 'chats', chat.id, 'messages');
    inspectChatUnsubRef.current = onSnapshot(msgRef, (snap) => {
      const list: Message[] = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Message));
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      if (list.length > 0) {
        setChatMessages(list);
      }
      setLoadingMessages(false);
    }, (err) => {
      console.warn("Chat inspect snapshot notice:", err);
      setLoadingMessages(false);
    });
  };

  // Purge all messages inside a room across both databases
  const handlePurgeAllMessages = async (chatId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Purge All Room Messages?",
      description: "This will permanently delete all messages inside this chat room from both Firebase and Supabase. This action cannot be undone.",
      variant: "danger",
      confirmText: "Purge Everything",
      onConfirm: async () => {
        try {
          const msgSnap = await getDocs(collection(db, 'chats', chatId, 'messages')).catch(() => null);
          if (msgSnap) {
            const deletes = msgSnap.docs.map((d) => deleteDoc(d.ref));
            await Promise.all(deletes).catch(() => {});
          }
          setChatMessages([]);
          await updateDoc(doc(db, 'chats', chatId), {
            lastMessage: null,
            updatedAt: Date.now(),
          }).catch(() => {});

          // Dual-Database: Purge in Supabase
          await RealtimeCoordinator.purgeAllMessages(chatId).catch(() => {});
        } catch (err: any) {
          alert("Failed to purge messages: " + err.message);
        } finally {
          setConfirmConfig(null);
        }
      },
    });
  };

  // Select user support conversation with dual-database streaming
  const handleSelectSupportTicket = async (chat: Chat) => {
    setSelectedSupportChat(chat);
    setLoadingSupportMessages(true);
    setTimeout(() => {
      supportMessagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 150);
    setSupportAttachment(null);

    // Reset unread indicator for support desk
    try {
      updateDoc(doc(db, 'chats', chat.id), {
        'unreadCount.limochat_official_support': 0,
      });
      setChatsList((prev) =>
        prev.map((c) =>
          c.id === chat.id
            ? { ...c, unreadCount: { ...(c.unreadCount || {}), limochat_official_support: 0 } }
            : c
        )
      );
    } catch {}

    if (supportUnsubRef.current) {
      supportUnsubRef.current();
      supportUnsubRef.current = null;
    }

    // 1. Dual-Database: Load messages from Supabase first
    try {
      const supaMsgs = await RealtimeCoordinator.fetchChatMessages(chat.id);
      if (supaMsgs && supaMsgs.length > 0) {
        setSupportMessages(supaMsgs);
        setLoadingSupportMessages(false);
      }
    } catch {}

    // 2. Real-time Supabase live messages stream
    const unsubLive = RealtimeCoordinator.subscribeToLiveMessages(chat.id, (liveMsg) => {
      if (liveMsg.chatId !== chat.id) return;
      setSupportMessages((prev) => {
        if (prev.some((m) => m.id === liveMsg.id)) return prev;
        return [...prev, liveMsg].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      });
    });

    // 3. Real-time Firestore stream
    const messagesRef = collection(db, 'chats', chat.id, 'messages');
    const unsubFs = onSnapshot(messagesRef, (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((d) => list.push({ ...d.data(), id: d.id } as Message));
      list.sort((a, b) => a.timestamp - b.timestamp);
      if (list.length > 0) {
        setSupportMessages((prev) => {
          const map = new Map<string, Message>();
          prev.forEach((m) => map.set(m.id, m));
          list.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        });
      }
      setLoadingSupportMessages(false);
    }, () => {
      setLoadingSupportMessages(false);
    });

    supportUnsubRef.current = () => {
      try { unsubLive(); } catch {}
      try { unsubFs(); } catch {}
    };
  };

  // Handle support media attachment
  const handleSupportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');
    const isAud = file.type.startsWith('audio/');
    const mediaType: 'image' | 'video' | 'voice' | 'file' = isImg ? 'image' : isVid ? 'video' : isAud ? 'voice' : 'file';
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setSupportAttachment({
        file,
        type: mediaType,
        dataUrl: reader.result as string,
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send official support reply with media and dual-database sync
  const handleSendSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupportChat || (!supportReplyText.trim() && !supportAttachment)) return;

    try {
      setSendingSupportReply(true);
      const text = supportReplyText.trim();
      const type = supportAttachment ? supportAttachment.type : 'text';
      const mediaUrl = supportAttachment ? supportAttachment.dataUrl : undefined;
      const extra = supportAttachment ? { fileName: supportAttachment.name, fileSize: supportAttachment.size } : undefined;

      const now = Date.now();
      const optimisticMsg: Message = {
        id: `msg_${now}_support`,
        chatId: selectedSupportChat.id,
        senderId: 'limochat_official_support',
        senderName: 'LimoChat Support',
        text: text,
        type: type as any,
        mediaUrl: mediaUrl || '',
        fileName: extra?.fileName || '',
        fileSize: extra?.fileSize || '',
        status: 'delivered',
        timestamp: now,
      };
      setSupportMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => {
        supportMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

      await sendSupportReply(selectedSupportChat.id, text, type, mediaUrl, extra);
      setSupportReplyText('');
      setSupportAttachment(null);
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Support Reply Failed",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } finally {
      setSendingSupportReply(false);
    }
  };

  // Toggle allowing user to place live calls to support
  const handleToggleSupportCalls = async (chat: Chat) => {
    const newState = !chat.supportCallsAllowed;
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        supportCallsAllowed: newState,
      }).catch(() => {});
      const clientUid = chat.participants.find((p) => p !== 'limochat_official_support');
      if (clientUid) {
        await updateDoc(doc(db, 'users', clientUid), {
          allowSupportCalls: newState,
        }).catch(() => {});
        // Dual-Database: Update Supabase
        await RealtimeCoordinator.updateUserAdmin(clientUid, { allowSupportCalls: newState }).catch(() => {});
      }
      setSelectedSupportChat((prev) => (prev ? { ...prev, supportCallsAllowed: newState } : null));
      setChatsList((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, supportCallsAllowed: newState } : c))
      );
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Call Permission Error",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    }
  };

  // Delete user from system with smooth popup across both databases
  const handleDeleteUser = (uid: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `Delete user "${name}"?`,
      description: "This will permanently remove the user profile and their data from both Firebase and Supabase.",
      confirmText: "Delete User",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          await deleteDoc(doc(db, 'users', uid)).catch(() => {});
          await RealtimeCoordinator.deleteUserAdmin(uid).catch(() => {});
          setUsersList((prev) => prev.filter((u) => u.uid !== uid));
        } catch (err: any) {
          setConfirmConfig({
            isOpen: true,
            title: "Error Deleting User",
            description: err.message,
            variant: "danger",
            singleAction: true,
            onConfirm: () => setConfirmConfig(null),
          });
        }
      },
    });
  };

  // Delete message with smooth popup across both databases
  const handleDeleteMessage = (chatId: string, messageId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Purge Message?",
      description: "Permanently delete this message from both Firebase and Supabase databases.",
      confirmText: "Purge",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId)).catch(() => {});
          await RealtimeCoordinator.deleteMessage(chatId, messageId).catch(() => {});
          setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
        } catch (err: any) {
          setConfirmConfig({
            isOpen: true,
            title: "Error Deleting Message",
            description: err.message,
            variant: "danger",
            singleAction: true,
            onConfirm: () => setConfirmConfig(null),
          });
        }
      },
    });
  };

  // Delete entire chat with smooth popup across both databases
  const handleDeleteChat = (chatId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Delete entire chat?",
      description: "All messages and logs in this chat will be permanently removed from Firebase and Supabase.",
      confirmText: "Delete Chat",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          await deleteDoc(doc(db, 'chats', chatId)).catch(() => {});
          await RealtimeCoordinator.deleteChat(chatId).catch(() => {});
          setChatsList((prev) => prev.filter((c) => c.id !== chatId));
          if (selectedChat?.id === chatId) setSelectedChat(null);
        } catch (err: any) {
          setConfirmConfig({
            isOpen: true,
            title: "Error Deleting Chat",
            description: err.message,
            variant: "danger",
            singleAction: true,
            onConfirm: () => setConfirmConfig(null),
          });
        }
      },
    });
  };

  // Add new admin email with smooth feedback
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminInput.trim() || !newAdminInput.includes('@')) {
      setConfirmConfig({
        isOpen: true,
        title: "Invalid Email",
        description: "Please enter a valid administrative email address.",
        variant: "warning",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
      return;
    }
    try {
      setIsAddingAdmin(true);
      await addAdminEmail(newAdminInput.trim());
      setNewAdminInput('');
      setConfirmConfig({
        isOpen: true,
        title: "Admin Added",
        description: "Admin email added successfully and granted full control access.",
        variant: "primary",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Failed to Add Admin",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } finally {
      setIsAddingAdmin(false);
    }
  };

  // Broadcast system notice to ALL users via personal Support Chat & communities
  const handleBroadcastAnnouncement = async () => {
    if (!broadcastText.trim()) return;
    try {
      setIsBroadcasting(true);
      const now = Date.now();
      const text = broadcastText.trim();
      let deliveredCount = 0;

      for (const u of usersList) {
        if (!u.uid || u.uid === 'limochat_official_support') continue;
        const supportChatId = `support_${u.uid}`;
        try {
          await setDoc(doc(db, 'chats', supportChatId), {
            id: supportChatId,
            type: 'direct',
            name: 'LimoChat Support',
            participants: [u.uid, 'limochat_official_support'],
            updatedAt: now,
            unreadCount: { [u.uid]: 1 },
            lastMessage: {
              text,
              senderId: 'limochat_official_support',
              timestamp: now,
              type: 'text',
              status: 'delivered',
            },
          }, { merge: true });

          await sendSupportReply(supportChatId, text);
          deliveredCount++;
        } catch {}
      }

      // Dual-Database: Persist broadcast announcement in Supabase and Firestore
      const broadcastId = `bcast_${now}`;
      await RealtimeCoordinator.saveBroadcast({
        id: broadcastId,
        title: 'Official Announcement',
        text,
        senderId: currentUser?.uid || 'limochat_official_support',
        senderName: currentUser?.displayName || 'LimoChat Admin',
        createdAt: now,
        deliveredCount,
      }).catch(() => {});

      await setDoc(doc(db, 'broadcasts', broadcastId), {
        id: broadcastId,
        title: 'Official Announcement',
        text,
        senderId: currentUser?.uid || 'limochat_official_support',
        senderName: currentUser?.displayName || 'LimoChat Admin',
        createdAt: now,
        deliveredCount,
      }).catch(() => {});

      setBroadcastText('');
      setConfirmConfig({
        isOpen: true,
        title: "Broadcast Dispatched",
        description: `Official broadcast delivered to ${deliveredCount} users via Support Chat and community channels.`,
        variant: "primary",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Broadcast Error",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Save updated virtual phone number
  const handleSavePhoneNumber = async () => {
    if (!editingPhoneUser) return;
    const trimmed = newPhoneInput.trim();
    if (!trimmed.startsWith('+991')) {
      setConfirmConfig({
        isOpen: true,
        title: "Invalid Virtual Number",
        description: "LimoChat numbers must start with '+991' (e.g. +991 555 1234).",
        variant: "warning",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
      return;
    }

    // Check if another user already has this phone number
    const duplicate = usersList.find(
      (u) =>
        u.uid !== editingPhoneUser.uid &&
        u.phoneNumber?.replace(/\s+/g, '') === trimmed.replace(/\s+/g, '')
    );
    if (duplicate) {
      setConfirmConfig({
        isOpen: true,
        title: "Number Already Assigned",
        description: `The virtual number "${trimmed}" is already assigned to "${duplicate.displayName}" (${duplicate.email || duplicate.uid}). Each user must have a unique lifetime number.`,
        variant: "warning",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
      return;
    }

    try {
      await updateUserPhoneNumberByAdmin(editingPhoneUser.uid, trimmed);
      setUsersList((prev) =>
        prev.map((u) => (u.uid === editingPhoneUser.uid ? { ...u, phoneNumber: trimmed } : u))
      );
      setEditingPhoneUser(null);
      setConfirmConfig({
        isOpen: true,
        title: "Lifetime Number Updated",
        description: `Virtual phone number for ${editingPhoneUser.displayName} updated to ${trimmed}. This number will persist indefinitely.`,
        variant: "primary",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Update Failed",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    }
  };

  // Issue policy warning with auto-dispatch via Support chat
  const handleIssuePolicyWarning = async () => {
    if (!warningUser) return;
    const reason = customWarningText.trim() || selectedRuleName;

    try {
      await issuePolicyWarning(warningUser.uid, reason, selectedRuleName);

      if (autoSendSupportNotice) {
        const targetChatId = `support_${warningUser.uid}`;
        const noticeText = `⚠️ [Official Security Warning: Policy Violation Detected]\n\nDear ${warningUser.displayName},\n\nYour account has been flagged for violating LimoChat Community Standards & Privacy Policy:\n\n• Policy Rule: ${selectedRuleName}\n• Details: "${reason}"\n\nPlease immediately review our Community Guidelines. Continued violations will result in temporary or permanent suspension of your account and virtual line.`;

        await setDoc(doc(db, 'chats', targetChatId), {
          id: targetChatId,
          type: 'direct',
          participants: [warningUser.uid, 'limochat_official_support'],
          name: 'LimoChat Support',
          updatedAt: Date.now(),
          unreadCount: { [warningUser.uid]: 1 },
        }, { merge: true }).catch(() => {});

        await sendSupportReply(targetChatId, noticeText);
      }

      setUsersList((prev) =>
        prev.map((u) => (u.uid === warningUser.uid ? { ...u, violationsCount: (u.violationsCount || 0) + 1 } : u))
      );
      setWarningUser(null);
      setConfirmConfig({
        isOpen: true,
        title: "Policy Warning Issued",
        description: `Official warning logged for ${warningUser.displayName}${autoSendSupportNotice ? ' and notification sent to user via Support Chat.' : '.'}`,
        variant: "primary",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Action Failed",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    }
  };

  // Apply or lift punishment / sanctions
  const handleApplyPunishment = async () => {
    if (!punishingUser) return;

    try {
      if (suspensionType === 'none' && !restrictSendingMessages && !restrictAddingContacts && !restrictCalls) {
        // Lift all punishments
        await applyUserPunishment(punishingUser.uid, null);
        setUsersList((prev) =>
          prev.map((u) => (u.uid === punishingUser.uid ? { ...u, punishment: undefined, isBanned: false } : u))
        );
        setPunishingUser(null);
        setConfirmConfig({
          isOpen: true,
          title: "Sanctions Lifted",
          description: `All restrictions and suspensions for ${punishingUser.displayName} have been removed. Account is restored to Good Standing.`,
          variant: "primary",
          singleAction: true,
          onConfirm: () => setConfirmConfig(null),
        });
        return;
      }

      if (!punishmentReason.trim()) {
        setConfirmConfig({
          isOpen: true,
          title: "Reason Required",
          description: "Please provide a reason for applying this sanction/suspension.",
          variant: "warning",
          singleAction: true,
          onConfirm: () => setConfirmConfig(null),
        });
        return;
      }

      const now = Date.now();
      const isTemp = suspensionType === 'temporary';
      const isPerm = suspensionType === 'permanent';
      const isSuspended = isTemp || isPerm;
      const suspendedUntil = isTemp ? now + tempDurationMinutes * 60 * 1000 : undefined;

      const punishment: UserPunishment = {
        isSuspended,
        suspensionType: isSuspended ? (isPerm ? 'permanent' : 'temporary') : undefined,
        suspendedUntil,
        reason: punishmentReason.trim(),
        appliedAt: now,
        appliedBy: currentUser?.email || 'admin@limochat.app',
        restrictions: {
          disableSendingMessages: restrictSendingMessages,
          disableAddingContacts: restrictAddingContacts,
          disableCalls: restrictCalls,
        },
      };

      await applyUserPunishment(punishingUser.uid, punishment);

      // Dual-Database: Record sanction in Firestore & Supabase violation_logs
      const logId = `vlog_${now}_${Math.random().toString(36).substring(2, 7)}`;
      const vlogEntry = {
        id: logId,
        userId: punishingUser.uid,
        userName: punishingUser.displayName || 'Unknown',
        userPhone: punishingUser.phoneNumber || '',
        action: isPerm ? 'permanent_ban' : isTemp ? 'temporary_ban' : 'restriction',
        reason: punishmentReason.trim(),
        adminEmail: currentUser?.email || 'admin@limochat.app',
        timestamp: now,
      };
      await addDoc(collection(db, 'violation_logs'), vlogEntry).catch(() => {});
      await RealtimeCoordinator.saveViolationLog(vlogEntry).catch(() => {});

      // Auto-send official notice to user via Support Chat!
      const targetChatId = `support_${punishingUser.uid}`;
      const noticeDetails = isPerm
        ? "Your account and virtual number have been permanently suspended."
        : isTemp
        ? `Your account is temporarily suspended until ${new Date(suspendedUntil!).toLocaleString()}.`
        : "Feature-specific restrictions have been applied to your account.";

      const noticeText = `🚫 [Official Notice: Account Sanction Enforced]\n\nDear ${punishingUser.displayName},\n\nA sanction has been applied to your account:\n• Status: ${isPerm ? 'Permanently Suspended' : isTemp ? 'Temporarily Suspended' : 'Restricted'}\n• Reason: "${punishmentReason.trim()}"\n• Action: ${noticeDetails}\n\nIf you believe this action was made in error, you may reply directly in this support chat to appeal.`;

      await setDoc(doc(db, 'chats', targetChatId), {
        id: targetChatId,
        type: 'direct',
        participants: [punishingUser.uid, 'limochat_official_support'],
        name: 'LimoChat Support',
        updatedAt: Date.now(),
        unreadCount: { [punishingUser.uid]: 1 },
      }, { merge: true }).catch(() => {});

      await sendSupportReply(targetChatId, noticeText);

      setUsersList((prev) =>
        prev.map((u) => (u.uid === punishingUser.uid ? { ...u, punishment, isBanned: isSuspended } : u))
      );
      setPunishingUser(null);

      setConfirmConfig({
        isOpen: true,
        title: "Sanctions Applied",
        description: `Sanctions successfully applied to ${punishingUser.displayName} and notification dispatched via Support chat.`,
        variant: "primary",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Failed to Apply Sanction",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    }
  };

  const openPunishmentModal = (u: UserProfile) => {
    setPunishingUser(u);
    const p = u.punishment;
    if (p) {
      setSuspensionType(p.suspensionType || (p.isSuspended ? 'permanent' : 'none'));
      setRestrictSendingMessages(!!p.restrictions?.disableSendingMessages);
      setRestrictAddingContacts(!!p.restrictions?.disableAddingContacts);
      setRestrictCalls(!!p.restrictions?.disableCalls);
      setPunishmentReason(p.reason || '');
    } else {
      setSuspensionType(u.isBanned ? 'permanent' : 'none');
      setRestrictSendingMessages(false);
      setRestrictAddingContacts(false);
      setRestrictCalls(false);
      setPunishmentReason('');
    }
  };

  // Automated Policy Rules Handlers
  const handleToggleRule = async (ruleId: string) => {
    const updated = policyRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r
    );
    setPolicyRules(updated);
    await savePolicyRules(updated);
  };

  const handleUpdateRuleAction = async (ruleId: string, action: PolicyRuleAction, minutes?: number) => {
    const updated = policyRules.map((r) =>
      r.id === ruleId
        ? {
            ...r,
            defaultAction: action,
            tempSuspensionMinutes: minutes !== undefined ? minutes : r.tempSuspensionMinutes,
            updatedAt: Date.now(),
          }
        : r
    );
    setPolicyRules(updated);
    await savePolicyRules(updated);
  };

  const handleToggleCheckMedia = async (ruleId: string) => {
    const updated = policyRules.map((r) =>
      r.id === ruleId ? { ...r, checkMedia: !r.checkMedia, updatedAt: Date.now() } : r
    );
    setPolicyRules(updated);
    await savePolicyRules(updated);
  };

  const handleAddKeywordToRule = async (ruleId: string) => {
    const kw = (newKeywordInput[ruleId] || '').trim();
    if (!kw) return;
    const updated = policyRules.map((r) => {
      if (r.id === ruleId) {
        if (r.keywords.map((k: string) => k.toLowerCase()).includes(kw.toLowerCase())) return r;
        return { ...r, keywords: [...r.keywords, kw], updatedAt: Date.now() };
      }
      return r;
    });
    setPolicyRules(updated);
    await savePolicyRules(updated);
    setNewKeywordInput((prev) => ({ ...prev, [ruleId]: '' }));
  };

  const handleRemoveKeywordFromRule = async (ruleId: string, kwToRemove: string) => {
    const updated = policyRules.map((r) =>
      r.id === ruleId
        ? { ...r, keywords: r.keywords.filter((k: string) => k !== kwToRemove), updatedAt: Date.now() }
        : r
    );
    setPolicyRules(updated);
    await savePolicyRules(updated);
  };

  const handleUpdateRuleTemplate = async (ruleId: string, warningTemplate: string) => {
    const updated = policyRules.map((r) =>
      r.id === ruleId ? { ...r, warningTemplate, updatedAt: Date.now() } : r
    );
    setPolicyRules(updated);
    await savePolicyRules(updated);
  };

  const handleResetDefaultRules = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Reset Policy Rules to Defaults?",
      description: "This will restore standard filters for abusive language, adult media, and zero-tolerance child safety.",
      variant: "warning",
      confirmText: "Reset Defaults",
      cancelText: "Cancel",
      onConfirm: async () => {
        setConfirmConfig(null);
        setPolicyRules(DEFAULT_POLICY_RULES);
        await savePolicyRules(DEFAULT_POLICY_RULES);
      },
    });
  };

  const handleApproveIncident = async (
    incident: PolicyIncident,
    chosenAction?: PolicyRuleAction,
    chosenMinutes?: number
  ) => {
    try {
      setProcessingIncidentId(incident.id);
      await approvePolicyIncident(incident, currentUser?.email || 'admin@limochat.app', chosenAction, chosenMinutes);
      setPendingIncidents((prev) => prev.filter((i) => i.id !== incident.id));

      const isPerm = chosenAction === 'permanent_ban';
      const isTemp = chosenAction === 'temporary_ban';
      const isRestrict = chosenAction === 'restrict_messaging';

      if (isTemp || isPerm) {
        setUsersList((prev) =>
          prev.map((u) =>
            u.uid === incident.userId
              ? {
                  ...u,
                  isBanned: true,
                  punishment: {
                    isSuspended: true,
                    suspensionType: isPerm ? 'permanent' : 'temporary',
                    suspendedUntil: isPerm ? undefined : Date.now() + (chosenMinutes || 60) * 60 * 1000,
                    reason: `Approved violation: ${incident.ruleName} ("${incident.matchedTerm}")`,
                    appliedAt: Date.now(),
                    appliedBy: currentUser?.email || 'admin',
                    restrictions: {
                      disableSendingMessages: true,
                      disableAddingContacts: true,
                      disableCalls: true,
                    },
                  },
                }
              : u
          )
        );
      } else if (isRestrict) {
        setUsersList((prev) =>
          prev.map((u) =>
            u.uid === incident.userId
              ? {
                  ...u,
                  punishment: {
                    isSuspended: false,
                    reason: `Approved restriction: ${incident.ruleName} ("${incident.matchedTerm}")`,
                    appliedAt: Date.now(),
                    appliedBy: currentUser?.email || 'admin',
                    restrictions: {
                      disableSendingMessages: true,
                    },
                  },
                }
              : u
          )
        );
      }

      const actionLabel = isPerm
        ? 'Permanent Ban'
        : isTemp
        ? `Temporary Suspension (${chosenMinutes || 60}m)`
        : isRestrict
        ? 'Message Restriction'
        : 'Official Warning';

      setConfirmConfig({
        isOpen: true,
        title: "Selected Action Enforced",
        description: `Sanction (${actionLabel}) successfully enforced against "${incident.userName}". User profile updated in real-time and official notice dispatched to Support desk.`,
        variant: "primary",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Approval Error",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } finally {
      setProcessingIncidentId(null);
    }
  };

  const handleDismissIncident = async (incident: PolicyIncident) => {
    try {
      setProcessingIncidentId(incident.id);
      await dismissPolicyIncident(incident.id, currentUser?.email || 'admin@limochat.app');
      setPendingIncidents((prev) => prev.filter((i) => i.id !== incident.id));
      setConfirmConfig({
        isOpen: true,
        title: "Incident Dismissed",
        description: `Flagged incident for "${incident.userName}" has been dismissed as a false positive. No punishment applied.`,
        variant: "primary",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Error Dismissing Incident",
        description: err.message,
        variant: "danger",
        singleAction: true,
        onConfirm: () => setConfirmConfig(null),
      });
    } finally {
      setProcessingIncidentId(null);
    }
  };

  const handleToggleModerationActive = async () => {
    const updated = {
      ...moderationSettings,
      enabled: !moderationSettings.enabled,
    };
    setModerationSettings(updated);
    await saveModerationSettings(updated, currentUser?.email);
  };

  const handleUpdateModerationMode = async (mode: any) => {
    const updated = {
      ...moderationSettings,
      mode,
    };
    setModerationSettings(updated);
    await saveModerationSettings(updated, currentUser?.email);
  };

  // Filter users
  const filteredUsers = usersList.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.phoneNumber?.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Filter support chats (covers support_ prefix, participant limochat_official_support or support)
  const supportChats = chatsList.filter(
    (c) =>
      c.id.startsWith('support_') ||
      c.name === 'LimoChat Support' ||
      (c.participants && (c.participants.includes('limochat_official_support') || c.participants.includes('support')))
  );

  // Check if a support ticket has unread messages or is waiting for support to reply
  const isTicketUnresponsiveOrUnread = (c: typeof chatsList[0]) => {
    const unread = c.unreadCount?.['limochat_official_support'] || 0;
    if (unread > 0) return true;
    if (c.lastMessage && c.lastMessage.senderId !== 'limochat_official_support') {
      return true;
    }
    return false;
  };

  const pendingSupportChats = supportChats.filter(isTicketUnresponsiveOrUnread);
  const supportBadgeCount = pendingSupportChats.length;

  const displayedSupportChats = supportChats.filter((c) => {
    if (supportFilter === 'pending') {
      return isTicketUnresponsiveOrUnread(c);
    }
    return true;
  });

  // Filter rooms for Rooms & Chat Moderation view
  const filteredChats = chatsList.filter((c) => {
    const nameMatch = (c.name || '').toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
                      c.id.toLowerCase().includes(chatSearchQuery.toLowerCase());
    if (!nameMatch) return false;
    if (chatTypeFilter === 'all') return true;
    if (chatTypeFilter === 'support') return c.id.startsWith('support_');
    return (c.type || 'direct') === chatTypeFilter;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 pt-safe pb-safe">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-default" onClick={onClose} />

      {/* Main Modal Container */}
      <div className="relative z-50 w-full max-w-5xl h-[90vh] max-h-[96dvh] bg-[#202c33] border border-[#2e3b44] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-[#111b21] border-b border-[#2e3b44] flex items-center justify-between pt-safe">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-base">LimoChat Master Administration</h3>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                  LIVE SECURE
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>DUAL-DATABASE SYNC (FIREBASE + SUPABASE)</span>
                </span>
              </div>
              <p className="text-xs text-[#8696a0]">
                Control center for users, virtual lines, policy sanctions, support desk, and network broadcasts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSystemData}
              disabled={loadingData}
              className="p-2 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#202c33] transition cursor-pointer"
              title="Refresh all data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-[#00a884]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#202c33] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-[#182229] border-b border-[#2e3b44] flex items-center gap-2 overflow-x-auto select-none py-2">
          {[
            { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
            { 
              id: 'support', 
              label: 'Support Desk & Inquiries', 
              icon: <Headphones className="w-4 h-4" />, 
              badge: supportBadgeCount > 0 ? supportBadgeCount : undefined 
            },
            { id: 'users', label: 'Users & Sanctions', icon: <Users className="w-4 h-4" />, count: usersList.length },
            { 
              id: 'policies', 
              label: 'Safety Rules & Flagged Incidents', 
              icon: <AlertTriangle className="w-4 h-4" />, 
              badge: pendingIncidents.length > 0 ? pendingIncidents.length : undefined 
            },
            { id: 'chats', label: 'Rooms & Chat Moderation', icon: <MessageSquare className="w-4 h-4" />, count: chatsList.length },
            { id: 'admins', label: 'Administrators', icon: <ShieldCheck className="w-4 h-4" />, count: adminEmails.length },
            { id: 'version', label: 'App Version & Updates', icon: <Sparkles className="w-4 h-4 text-emerald-400" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#00a884] text-white shadow-md'
                  : 'text-[#8696a0] hover:text-white hover:bg-[#202c33]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && (
                <span className="text-[10px] bg-black/20 text-[#d1d7db] px-1.5 py-0.2 rounded font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* VIEW 1: OVERVIEW & BROADCAST */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44]">
                  <div className="text-xs text-[#8696a0] font-medium">Registered Accounts</div>
                  <div className="text-2xl font-bold text-white mt-1">{usersList.length}</div>
                  <div className="text-[10px] text-emerald-400 mt-1">
                    {usersList.filter((u) => u.isOnline).length} Active Online
                  </div>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44]">
                  <div className="text-xs text-[#8696a0] font-medium">Unresponsive Tickets</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1">{supportBadgeCount}</div>
                  <div className="text-[10px] text-[#8696a0] mt-1">{supportChats.length} Total Inquiries</div>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44]">
                  <div className="text-xs text-[#8696a0] font-medium">Active Conversations</div>
                  <div className="text-2xl font-bold text-white mt-1">{chatsList.length}</div>
                  <div className="text-[10px] text-[#8696a0] mt-1">{communitiesList.length} Communities</div>
                </div>

                <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2e3b44]">
                  <div className="text-xs text-[#8696a0] font-medium">Sanctions Enforced</div>
                  <div className="text-2xl font-bold text-red-400 mt-1">
                    {usersList.filter((u) => u.isBanned || u.punishment?.isSuspended).length}
                  </div>
                  <div className="text-[10px] text-[#8696a0] mt-1">Suspended accounts</div>
                </div>
              </div>

              {/* Official Broadcast Section */}
              <div className="p-5 bg-[#111b21] rounded-2xl border border-[#2e3b44]">
                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1.5">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>Send Broadcast Announcement via Support Chat</span>
                </div>
                <p className="text-xs text-[#8696a0] mb-4">
                  Dispatches an official notification to every user account through their personal Support Chat.
                </p>

                <textarea
                  rows={3}
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Type an announcement to broadcast to all registered accounts..."
                  className="w-full bg-[#182229] border border-[#2e3b44] rounded-xl p-3 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] resize-none"
                />

                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={handleBroadcastAnnouncement}
                    disabled={isBroadcasting || !broadcastText.trim()}
                    className="px-5 py-2.5 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isBroadcasting ? 'Broadcasting...' : 'Broadcast to All Accounts'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: SUPPORT DESK & INQUIRIES */}
          {activeTab === 'support' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {/* Tickets Header with Unread/Unresponsive Filter */}
                <div className="flex items-center justify-between gap-2 mb-2 bg-[#111b21] p-2.5 rounded-xl border border-[#2e3b44]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#8696a0] flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tickets ({displayedSupportChats.length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSupportFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                        supportFilter === 'all'
                          ? 'bg-[#00a884] text-white shadow-sm'
                          : 'bg-[#182229] text-[#8696a0] hover:text-white'
                      }`}
                    >
                      All ({supportChats.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupportFilter('pending')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        supportFilter === 'pending'
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'bg-[#182229] text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <span>Awaiting Reply</span>
                      {supportBadgeCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-bold">
                          {supportBadgeCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {displayedSupportChats.length > 0 ? (
                  displayedSupportChats.map((c) => {
                    const isSelected = selectedSupportChat?.id === c.id;
                    const isUnresponsive = isTicketUnresponsiveOrUnread(c);
                    const supportUnread = c.unreadCount?.['limochat_official_support'] || 0;

                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectSupportTicket(c)}
                        className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#202c33] border-[#00a884]'
                            : 'bg-[#111b21] border-[#2e3b44] hover:bg-[#182229]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-xs truncate">
                              {c.name || 'User Inquiry'}
                            </span>
                            {isUnresponsive ? (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold animate-pulse">
                                AWAITING REPLY
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#202c33] text-[#8696a0] font-mono">
                                REPLIED
                              </span>
                            )}
                            {supportUnread > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/25 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                                {supportUnread} NEW
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#8696a0] truncate mt-0.5">
                            {c.lastMessage?.text || 'User started a support inquiry'}
                          </p>
                          <div className="text-[10px] text-[#8696a0] font-mono mt-0.5">
                            {new Date(c.updatedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-[#8696a0] bg-[#111b21] rounded-2xl border border-[#2e3b44]">
                    {supportFilter === 'pending'
                      ? 'No unresponsive support tickets! All customer inquiries have been answered.'
                      : 'No active support tickets yet. When users message LimoChat Support, their conversations appear here for you to reply in real time.'}
                  </div>
                )}
              </div>

              {/* Support Stream & Reply */}
              <div className="bg-[#111b21] p-4 rounded-2xl border border-[#2e3b44] flex flex-col h-[50vh]">
                <div className="pb-2 border-b border-[#2e3b44] flex items-center justify-between">
                  <h4 className="font-semibold text-white text-xs flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-[#00a884]" />
                    <span>{selectedSupportChat ? `Chat with ${selectedSupportChat.name}` : 'Select a ticket'}</span>
                  </h4>
                  {selectedSupportChat && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSupportCalls(selectedSupportChat)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          selectedSupportChat.supportCallsAllowed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-[#202c33] text-[#8696a0] hover:text-white border border-[#2e3b44]'
                        }`}
                      >
                        <Phone className="w-3 h-3" />
                        <span>{selectedSupportChat.supportCallsAllowed ? 'Calls Allowed' : 'Calls Restricted'}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
                  {loadingSupportMessages ? (
                    <div className="text-center text-xs text-[#8696a0] py-8 flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#00a884]" />
                      <span>Loading ticket messages...</span>
                    </div>
                  ) : supportMessages.length > 0 ? (
                    supportMessages.map((m) => {
                      const isSupportStaff = m.senderId === 'limochat_official_support';
                      return (
                        <AdminMessageItem
                          key={m.id}
                          message={m}
                          isSupportStaff={isSupportStaff}
                          onPreviewImage={(url) => setPreviewMediaUrl(url)}
                        />
                      );
                    })
                  ) : (
                    <div className="text-center text-xs text-[#8696a0] py-12 flex flex-col items-center gap-2">
                      <Headphones className="w-8 h-8 opacity-25" />
                      <span>{selectedSupportChat ? 'No messages yet in this ticket.' : 'Select a ticket on the left to start replying.'}</span>
                    </div>
                  )}
                  <div ref={supportMessagesEndRef} />
                </div>

                {selectedSupportChat && (
                  <div className="pt-2 border-t border-[#2e3b44] flex flex-col gap-2">
                    {/* Attachment preview bar */}
                    {supportAttachment && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-[#182229] border border-[#00a884]/40 animate-fade-in">
                        <div className="flex items-center gap-2 min-w-0">
                          {supportAttachment.type === 'image' && (
                            <img src={supportAttachment.dataUrl} alt="preview" className="w-8 h-8 rounded-lg object-cover" />
                          )}
                          {supportAttachment.type === 'video' && (
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                              <VideoIcon className="w-4 h-4" />
                            </div>
                          )}
                          {supportAttachment.type === 'voice' && (
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                              <Mic className="w-4 h-4" />
                            </div>
                          )}
                          {supportAttachment.type === 'file' && (
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate max-w-[200px]">{supportAttachment.name}</div>
                            <div className="text-[10px] text-[#8696a0]">{supportAttachment.size}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSupportAttachment(null)}
                          className="p-1 text-[#8696a0] hover:text-red-400 rounded-lg hover:bg-white/5 transition cursor-pointer"
                          title="Remove attachment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Quick Response Templates */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] select-none">
                      <button
                        type="button"
                        onClick={() => setSupportReplyText("Hello! Thank you for contacting LimoChat Support. How may we help you today?")}
                        className="px-2.5 py-1 rounded-lg bg-[#182229] hover:bg-[#202c33] text-[#8696a0] hover:text-[#00a884] border border-white/5 transition whitespace-nowrap cursor-pointer"
                      >
                        👋 Welcome greeting
                      </button>
                      <button
                        type="button"
                        onClick={() => setSupportReplyText("Your inquiry has been resolved. Please let us know if you need any further assistance!")}
                        className="px-2.5 py-1 rounded-lg bg-[#182229] hover:bg-[#202c33] text-[#8696a0] hover:text-emerald-400 border border-white/5 transition whitespace-nowrap cursor-pointer"
                      >
                        ✅ Resolved notice
                      </button>
                      <button
                        type="button"
                        onClick={() => setSupportReplyText("Live voice and video calling has been authorized for your support chat.")}
                        className="px-2.5 py-1 rounded-lg bg-[#182229] hover:bg-[#202c33] text-[#8696a0] hover:text-blue-400 border border-white/5 transition whitespace-nowrap cursor-pointer"
                      >
                        📞 Calls authorized
                      </button>
                    </div>

                    <form onSubmit={handleSendSupportReply} className="flex items-center gap-2">
                      {/* Hidden file input */}
                      <input
                        type="file"
                        ref={supportFileInputRef}
                        onChange={handleSupportFileSelect}
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                        className="hidden"
                      />

                      {/* Attach button */}
                      <button
                        type="button"
                        onClick={() => supportFileInputRef.current?.click()}
                        className="p-2 text-[#8696a0] hover:text-[#00a884] hover:bg-[#182229] rounded-xl border border-transparent hover:border-[#2e3b44] transition flex-shrink-0 cursor-pointer"
                        title="Attach photo, video, audio, or document"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      <input
                        type="text"
                        value={supportReplyText}
                        onChange={(e) => setSupportReplyText(e.target.value)}
                        placeholder="Reply as LimoChat Support..."
                        className="flex-1 bg-[#182229] border border-[#2e3b44] rounded-xl px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                      />

                      <button
                        type="submit"
                        disabled={sendingSupportReply || (!supportReplyText.trim() && !supportAttachment)}
                        className="px-3.5 py-2 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 flex-shrink-0 cursor-pointer shadow-md"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendingSupportReply ? 'Sending...' : 'Send as Support'}</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: USERS & SANCTIONS */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-fade-in">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-[#8696a0] absolute left-3.5" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Filter users by name, email, or +991 lifetime number..."
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                />
              </div>

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                {filteredUsers.map((u) => {
                  const isUserAdmin = adminEmails.includes(u.email?.toLowerCase());
                  const isSuspended = u.punishment?.isSuspended || u.isBanned;
                  const isTemporary = u.punishment?.suspensionType === 'temporary';
                  const remainingSec = isTemporary && u.punishment?.suspendedUntil
                    ? Math.max(0, Math.floor((u.punishment.suspendedUntil - Date.now()) / 1000))
                    : 0;

                  return (
                    <div
                      key={u.uid}
                      className="p-3.5 bg-[#111b21] rounded-2xl border border-[#2e3b44] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#00a884]/40 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={u.photoURL} name={u.displayName} size="md" isOnline={u.isOnline} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-white text-sm truncate">{u.displayName}</h4>
                            
                            {isUserAdmin && (
                              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.2 rounded font-mono">
                                ADMIN
                              </span>
                            )}

                            {isSuspended ? (
                              isTemporary ? (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>TEMP SUSPENDED ({Math.ceil(remainingSec / 60)}m left)</span>
                                </span>
                              ) : (
                                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-mono font-bold">
                                  PERM SUSPENDED
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
                                GOOD STANDING
                              </span>
                            )}

                            {u.punishment?.restrictions?.disableSendingMessages && (
                              <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono">
                                NO MSGS
                              </span>
                            )}
                            {u.punishment?.restrictions?.disableCalls && (
                              <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono">
                                NO CALLS
                              </span>
                            )}
                            {(u.violationsCount || 0) > 0 && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                                {u.violationsCount} WARN
                              </span>
                            )}
                          </div>

                          {/* Virtual Number with quick edit button */}
                          <div className="flex items-center gap-2 text-xs text-[#8696a0] font-mono mt-1">
                            <span className="text-[#00a884] font-semibold">{u.phoneNumber}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPhoneUser(u);
                                setNewPhoneInput(u.phoneNumber);
                              }}
                              className="p-1 hover:text-white hover:bg-black/20 rounded transition cursor-pointer"
                              title="Edit lifetime virtual number"
                            >
                              <Edit3 className="w-3 h-3 text-[#8696a0] hover:text-[#00a884]" />
                            </button>
                            <span>•</span>
                            <span className="truncate">{u.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Administrative Action Buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 self-end md:self-center flex-wrap">
                        {u.isAdmin || adminEmails.includes(u.email?.toLowerCase().trim()) || u.email?.toLowerCase().trim() === 'saeed.samadelivery@gmail.com' ? (
                          <span className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Administrator (Protected)</span>
                          </span>
                        ) : (
                          <>
                            {/* Manage Punishments & Suspension */}
                            <button
                              type="button"
                              onClick={() => openPunishmentModal(u)}
                              className="px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-amber-400 hover:text-amber-300 border border-[#2e3b44] rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                              title="Configure suspensions and restrictions"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Sanctions</span>
                            </button>

                            {/* Issue Policy Warning */}
                            <button
                              type="button"
                              onClick={() => {
                                setWarningUser(u);
                                setCustomWarningText('');
                                setAutoSendSupportNotice(true);
                              }}
                              className="px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-cyan-400 hover:text-cyan-300 border border-[#2e3b44] rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                              title="Issue policy violation warning"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Warn User</span>
                            </button>

                            {/* Delete User */}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.uid, u.displayName)}
                              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer"
                              title="Permanently Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 4: ROOMS & CHAT MODERATION */}
          {activeTab === 'chats' && (
            <div className="space-y-4 animate-fade-in">
              {/* Rooms Header with Search & Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#111b21] p-3 rounded-2xl border border-[#2e3b44]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#8696a0] px-1 uppercase tracking-wider">
                    Rooms ({chatsList.length}):
                  </span>
                  {(['all', 'direct', 'group', 'support'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setChatTypeFilter(t)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium transition cursor-pointer ${
                        chatTypeFilter === t
                          ? 'bg-[#00a884] text-white'
                          : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                      }`}
                    >
                      {t === 'all' ? `All (${chatsList.length})` : t.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Search rooms..."
                    className="w-full bg-[#202c33] border border-[#2e3b44] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rooms List */}
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {filteredChats.length > 0 ? (
                    filteredChats.map((c) => {
                      const isSupport = c.id.startsWith('support_');
                      const roomType = (c.type || (isSupport ? 'support' : 'direct')).toUpperCase();
                      const isSelected = selectedChat?.id === c.id;

                      return (
                        <div
                          key={c.id}
                          onClick={() => handleInspectChat(c)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#202c33] border-[#00a884] shadow-md shadow-[#00a884]/10'
                              : 'bg-[#111b21] border-[#2e3b44] hover:bg-[#182229]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-xs truncate">
                                {c.name || (c.type === 'direct' ? 'Direct Conversation' : 'Group Room')}
                              </span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                isSupport 
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : c.type === 'group'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}>
                                {roomType}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#8696a0] font-mono mt-1 flex items-center gap-2">
                              <span>ID: {c.id.slice(0, 16)}...</span>
                              <span>•</span>
                              <span>{c.participants?.length || 0} participants</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChat(c.id);
                            }}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer ml-2 flex-shrink-0"
                            title="Delete Chat Room"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-[#8696a0] bg-[#111b21] rounded-2xl border border-[#2e3b44]">
                      No chat rooms match your search query.
                    </div>
                  )}
                </div>

                {/* Message Inspector Pane */}
                <div className="bg-[#111b21] p-4 rounded-2xl border border-[#2e3b44] flex flex-col h-[55vh]">
                  <div className="pb-3 border-b border-[#2e3b44] flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-white text-xs truncate">
                        {selectedChat 
                          ? (selectedChat.name || (selectedChat.type === 'direct' ? 'Direct Chat' : selectedChat.id))
                          : 'Select a Chat Room'}
                      </h4>
                      {selectedChat && (
                        <span className="text-[10px] text-[#00a884] font-mono">
                          Live Inspection • {chatMessages.length} messages
                        </span>
                      )}
                    </div>

                    {selectedChat && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {onSelectChat && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectChat(selectedChat);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-sm"
                            title="Open room in main chat window"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePurgeAllMessages(selectedChat.id)}
                          className="px-2.5 py-1.5 bg-[#202c33] hover:bg-red-500/20 text-[#8696a0] hover:text-red-300 rounded-xl text-[11px] font-medium flex items-center gap-1 transition cursor-pointer border border-[#2e3b44]"
                          title="Purge all messages in this room"
                        >
                          <Eraser className="w-3 h-3" />
                          <span>Purge</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
                    {loadingMessages ? (
                      <div className="text-center text-xs text-[#8696a0] py-12 flex flex-col items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#00a884]" />
                        <span>Streaming messages...</span>
                      </div>
                    ) : chatMessages.length > 0 ? (
                      chatMessages.map((m) => (
                        <AdminMessageItem
                          key={m.id}
                          message={m}
                          isSupportStaff={m.senderId === 'limochat_official_support'}
                          onPreviewImage={(url) => setPreviewMediaUrl(url)}
                          onDelete={selectedChat ? () => handleDeleteMessage(selectedChat.id, m.id) : undefined}
                        />
                      ))
                    ) : (
                      <div className="text-center text-xs text-[#8696a0] py-16 flex flex-col items-center gap-2">
                        <MessageSquare className="w-8 h-8 opacity-30" />
                        <span>{selectedChat ? 'No messages found in this room.' : 'Select a room on the left to inspect.'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 5: SAFETY RULES & AUTOMATED PUNISHMENTS */}
          {activeTab === 'policies' && (
            <div className="space-y-6 animate-fade-in">
              {/* Top Banner Card */}
              <div className="p-5 bg-[#111b21] rounded-2xl border border-[#2e3b44] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <h3 className="font-bold text-white text-base">
                      Automated Policy Rules & Punishment Engine
                    </h3>
                  </div>
                  <p className="text-xs text-[#8696a0] max-w-2xl">
                    Configure real-time screening for abusive words (e.g., sex, porn, child nudity), detect explicit media, and set automatic punishments (warnings, temporary suspensions, or permanent bans) that apply immediately when breached.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetDefaultRules}
                  className="px-3.5 py-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-xs font-semibold text-[#8696a0] hover:text-white transition flex items-center gap-1.5 flex-shrink-0 border border-white/10 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              {/* Master Moderation Settings Card */}
              <div className="p-5 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <span>Prohibited Words Moderation Setting</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        moderationSettings.enabled
                          ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {moderationSettings.enabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </h4>
                    <p className="text-xs text-[#8696a0] mt-0.5">
                      Enable or disable automated screening of prohibited words (sex, porn, child nudity) across the entire platform.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleModerationActive}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      moderationSettings.enabled
                        ? 'bg-[#00a884] text-white hover:bg-[#02906f]'
                        : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                    }`}
                  >
                    {moderationSettings.enabled ? 'Disable Screening' : 'Enable Screening'}
                  </button>
                </div>

                {moderationSettings.enabled && (
                  <div className="pt-3 border-t border-[#202c33] grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-white block mb-1">
                        Violation Action Mode:
                      </label>
                      <select
                        value={moderationSettings.mode}
                        onChange={(e) => handleUpdateModerationMode(e.target.value)}
                        className="w-full bg-[#182229] border border-[#2e3b44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00a884]"
                      >
                        <option value="approval_required">
                          🛡️ Admin Approval Required (Highlight term & flag for Admin Review)
                        </option>
                        <option value="instant_autoban">
                          ⚡ Instant Auto-Ban on Detection (Immediate suspension & warning)
                        </option>
                        <option value="disabled">
                          Off (Bypass all enforcement)
                        </option>
                      </select>
                    </div>

                    <div className="text-xs text-[#8696a0] flex flex-col justify-center">
                      <span className="font-semibold text-white">How it works:</span>
                      <span>
                        {moderationSettings.mode === 'approval_required'
                          ? 'Flagged messages with abusive words are intercepted and highlighted below for Admin approval before any ban occurs.'
                          : 'Users transmitting prohibited words are immediately suspended without manual review.'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* PENDING POLICY INCIDENTS REQUIRING ADMIN APPROVAL */}
              <div className="p-5 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                      <AlertCircle className="w-4 h-4" />
                    </span>
                    <h4 className="font-bold text-white text-sm">
                      Flagged Messages Requiring Admin Review ({pendingIncidents.length})
                    </h4>
                  </div>
                  <span className="text-[11px] text-[#8696a0]">
                    Real-time moderation queue
                  </span>
                </div>

                {pendingIncidents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#8696a0] bg-[#182229] rounded-xl border border-[#202c33] space-y-1">
                    <CheckCircle className="w-5 h-5 text-[#00a884] mx-auto opacity-70" />
                    <p className="font-medium text-white">No Flagged Messages Pending Review</p>
                    <p className="text-[11px]">When a user writes a prohibited word like sex, porn, or child nudity, it will be highlighted here for your approval.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingIncidents.map((inc) => (
                      <div
                        key={inc.id}
                        className={`p-4 bg-[#182229] rounded-xl border ${
                          inc.isUserReport ? 'border-amber-500/40' : 'border-red-500/30'
                        } space-y-3 shadow-lg`}
                      >
                        {/* Incident Header */}
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <Avatar src={inc.userPhoto} name={inc.userName} size="sm" />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-xs">{inc.userName}</span>
                                {inc.userPhone && (
                                  <span className="text-[10px] font-mono text-[#00a884] bg-[#00a884]/15 px-1.5 py-0.2 rounded">
                                    {inc.userPhone}
                                  </span>
                                )}
                                <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                                  inc.isUserReport 
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                    : 'bg-red-500/20 text-red-400 border-red-500/40'
                                }`}>
                                  {inc.isUserReport ? `🚩 USER REPORT: ${inc.reportReason || inc.matchedTerm}` : inc.ruleName}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#8696a0]">
                                {inc.userEmail ? `${inc.userEmail} • ` : ''}{new Date(inc.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className={`px-2 py-0.5 rounded-lg font-mono text-xs border ${
                            inc.isUserReport 
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                              : 'bg-red-500/20 text-amber-300 border-red-500/40'
                          }`}>
                            {inc.isUserReport ? (
                              <span>Reported by: <strong>@{inc.reportedByName || 'User'}</strong></span>
                            ) : (
                              <span>Flagged Word: <strong>"{inc.matchedTerm}"</strong></span>
                            )}
                          </div>
                        </div>

                        {/* Optional Reporter Notes */}
                        {inc.isUserReport && inc.reportDetails && (
                          <div className="text-[11px] bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-amber-200 leading-relaxed">
                            <span className="font-bold text-amber-400">Reporter's Context: </span>
                            {inc.reportDetails}
                          </div>
                        )}

                        {/* HIGHLIGHTED MESSAGE SNIPPET */}
                        <div className="p-3 bg-[#0b141a] rounded-xl border border-[#2e3b44] space-y-1">
                          <div className="text-[10px] text-[#8696a0] uppercase tracking-wider font-semibold">
                            {inc.isUserReport ? 'Reported Message Content:' : 'Exact Flagged Content (Term Highlighted):'}
                          </div>
                          <div
                            className="text-xs text-[#e9edef] leading-relaxed break-words"
                            dangerouslySetInnerHTML={{
                              __html: inc.isUserReport 
                                ? (inc.messageText || '[Attachment / Media Message]')
                                : highlightBannedWord(inc.messageText, inc.matchedTerm),
                            }}
                          />
                        </div>

                        {/* Interactive Action Selector & Approval Buttons */}
                        <div className="p-3 bg-[#111b21] rounded-xl border border-[#2e3b44] flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-[#8696a0] font-semibold uppercase tracking-wider">
                              Action to Apply:
                            </span>
                            <select
                              value={getActionForIncident(inc).action}
                              onChange={(e) => updateActionForIncident(inc.id, e.target.value as PolicyRuleAction)}
                              className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-[#00a884] cursor-pointer"
                            >
                              <option value="temporary_ban">⏱️ Temporary Suspension</option>
                              <option value="permanent_ban">🚫 Permanent Account Ban</option>
                              <option value="restrict_messaging">🔇 Restrict Sending Messages</option>
                              <option value="warn">⚠️ Official Warning (Strike)</option>
                            </select>

                            {getActionForIncident(inc).action === 'temporary_ban' && (
                              <select
                                value={getActionForIncident(inc).minutes}
                                onChange={(e) => updateActionForIncident(inc.id, getActionForIncident(inc).action, Number(e.target.value))}
                                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-[#00a884] cursor-pointer"
                              >
                                <option value={15}>15 Minutes</option>
                                <option value={30}>30 Minutes</option>
                                <option value={60}>1 Hour (Standard)</option>
                                <option value={360}>6 Hours</option>
                                <option value={1440}>24 Hours (1 Day)</option>
                                <option value={10080}>7 Days (1 Week)</option>
                              </select>
                            )}

                            {getActionForIncident(inc).action === 'restrict_messaging' && (
                              <select
                                value={getActionForIncident(inc).minutes}
                                onChange={(e) => updateActionForIncident(inc.id, getActionForIncident(inc).action, Number(e.target.value))}
                                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-[#00a884] cursor-pointer"
                              >
                                <option value={60}>1 Hour</option>
                                <option value={1440}>24 Hours</option>
                                <option value={0}>Indefinite</option>
                              </select>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={processingIncidentId === inc.id}
                              onClick={() => handleDismissIncident(inc)}
                              className="px-3.5 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-white rounded-xl text-xs font-medium transition cursor-pointer border border-white/10"
                            >
                              Dismiss (False Positive)
                            </button>

                            <button
                              type="button"
                              disabled={processingIncidentId === inc.id}
                              onClick={() => {
                                const current = getActionForIncident(inc);
                                handleApproveIncident(inc, current.action, current.minutes);
                              }}
                              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-red-600/20"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{processingIncidentId === inc.id ? 'Enforcing...' : 'Enforce Selected Action'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Policy Rules Grid */}
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#8696a0] px-1 flex items-center justify-between">
                  <span>Active Automated Rules ({policyRules.length})</span>
                  <span className="text-[11px] text-[#00a884]">Real-time automatic enforcement active</span>
                </div>

                <div className="space-y-4">
                  {policyRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-5 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-4 transition hover:border-[#3e4f5b]"
                    >
                      {/* Rule Header & Toggle */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{rule.name}</span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                rule.enabled
                                  ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {rule.enabled ? 'Active / Enforcing' : 'Disabled'}
                            </span>
                          </div>
                          <p className="text-xs text-[#8696a0]">{rule.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex-shrink-0 ${
                            rule.enabled
                              ? 'bg-[#00a884] text-white hover:bg-[#02906f]'
                              : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                          }`}
                        >
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      {/* Banned Keywords Tags */}
                      <div className="space-y-2 pt-2 border-t border-[#202c33]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white text-xs">
                            Prohibited Keywords & Terms ({rule.keywords.length})
                          </span>
                          <span className="text-[11px] text-[#8696a0]">
                            Matches text in messages, captions & attachment names
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-[#182229] rounded-xl border border-[#202c33]">
                          {rule.keywords.map((kw: string) => (
                            <span
                              key={kw}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#202c33] text-white text-xs border border-white/10 group"
                            >
                              <span className="font-mono text-amber-300 font-medium">"{kw}"</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveKeywordFromRule(rule.id, kw)}
                                className="text-[#8696a0] hover:text-red-400 transition cursor-pointer"
                                title="Remove term"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>

                        {/* Add Keyword Input */}
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={newKeywordInput[rule.id] || ''}
                            onChange={(e) =>
                              setNewKeywordInput((prev) => ({ ...prev, [rule.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddKeywordToRule(rule.id);
                              }
                            }}
                            placeholder="Add prohibited word (e.g. sex, porn, child nudity)..."
                            className="flex-1 bg-[#182229] border border-[#2e3b44] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddKeywordToRule(rule.id)}
                            className="px-3.5 py-2 bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-white/10"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Term</span>
                          </button>
                        </div>
                      </div>

                      {/* Automated Enforcement Configuration */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#202c33]">
                        <div>
                          <label className="text-xs font-semibold text-white block mb-1.5">
                            Automated Punishment on Breach:
                          </label>
                          <select
                            value={rule.defaultAction}
                            onChange={(e) =>
                              handleUpdateRuleAction(rule.id, e.target.value as PolicyRuleAction)
                            }
                            className="w-full bg-[#182229] border border-[#2e3b44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00a884]"
                          >
                            <option value="warn">⚠️ Warning Only (Auto-dispatched via Support)</option>
                            <option value="temporary_ban">⏱️ Warning + Temporary Suspension</option>
                            <option value="restrict_messaging">🚫 Warning + Restrict Sending Messages</option>
                            <option value="permanent_ban">🛑 Immediate Permanent Ban (Zero Tolerance)</option>
                          </select>
                        </div>

                        {rule.defaultAction === 'temporary_ban' && (
                          <div>
                            <label className="text-xs font-semibold text-white block mb-1.5">
                              Temporary Suspension Duration:
                            </label>
                            <select
                              value={rule.tempSuspensionMinutes || 60}
                              onChange={(e) =>
                                handleUpdateRuleAction(
                                  rule.id,
                                  rule.defaultAction || 'temporary_ban',
                                  Number(e.target.value)
                                )
                              }
                              className="w-full bg-[#182229] border border-[#2e3b44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00a884]"
                            >
                              {DURATION_PRESETS.map((d) => (
                                <option key={d.minutes} value={d.minutes}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Media Check & Warning Template */}
                      <div className="space-y-2 pt-2 border-t border-[#202c33]">
                        <label
                          onClick={() => handleToggleCheckMedia(rule.id)}
                          className="flex items-center gap-2 cursor-pointer text-xs text-[#d1d7db]"
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                              rule.checkMedia
                                ? 'bg-[#00a884] border-[#00a884] text-white'
                                : 'border-[#4f5f69] bg-[#182229]'
                            }`}
                          >
                            {rule.checkMedia && <Check className="w-3 h-3" />}
                          </div>
                          <span>
                            Screen media attachments, video/photo captions & file names for adult/pornographic content
                          </span>
                        </label>

                        <div>
                          <label className="text-xs text-[#8696a0] font-medium block mb-1">
                            Warning Message Template dispatched to user ({'{userName}'} and {'{term}'} are auto-replaced):
                          </label>
                          <textarea
                            rows={3}
                            value={rule.warningTemplate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPolicyRules((prev) =>
                                prev.map((r) => (r.id === rule.id ? { ...r, warningTemplate: val } : r))
                              );
                            }}
                            onBlur={(e) => handleUpdateRuleTemplate(rule.id, e.target.value)}
                            className="w-full bg-[#182229] border border-[#2e3b44] rounded-xl p-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LIVE VIOLATION AUDIT LOGS */}
              <div className="space-y-4 pt-4 border-t border-[#2e3b44]">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      Automated Policy Violation Audit Logs ({violationLogs.length})
                    </h4>
                    <p className="text-[11px] text-[#8696a0]">
                      Live log of all users caught by the automated policy and keyword screening engine.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => getViolationAuditLogs().then(setViolationLogs)}
                    className="p-1.5 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-white transition cursor-pointer"
                    title="Refresh logs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {violationLogs.length === 0 ? (
                  <div className="p-8 text-center bg-[#111b21] rounded-2xl border border-[#2e3b44] text-xs text-[#8696a0] space-y-1">
                    <CheckCircle className="w-6 h-6 text-[#00a884] mx-auto opacity-60" />
                    <p>No automated violations recorded yet.</p>
                    <p className="text-[11px] opacity-75">All users are currently operating in full compliance.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {violationLogs.map((log, idx) => (
                      <div
                        key={log.id || idx}
                        className="p-3.5 bg-[#111b21] rounded-2xl border border-[#2e3b44] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{log.userName}</span>
                            {log.userPhone && (
                              <span className="text-[11px] font-mono text-[#00a884] bg-[#00a884]/10 px-1.5 py-0.2 rounded">
                                {log.userPhone}
                              </span>
                            )}
                            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.2 rounded-full border border-red-500/30 font-medium">
                              {log.ruleName}
                            </span>
                            <span className="text-[10px] text-amber-300 font-mono">
                              Keyword: "{log.matchedTerm}"
                            </span>
                          </div>

                          <div className="text-[11px] text-[#8696a0] truncate max-w-lg">
                            <span className="text-white/60">Snippet:</span> "{log.snippet}"
                          </div>

                          <div className="text-[10px] text-[#00a884] font-medium">
                            Enforced: {log.actionTaken}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                          <div className="text-[10px] text-[#8696a0] font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const target = usersList.find((u) => u.uid === log.userId);
                              if (target) openPunishmentModal(target);
                            }}
                            className="px-2.5 py-1 bg-[#202c33] hover:bg-[#2a3942] text-xs text-amber-400 rounded-lg transition cursor-pointer"
                          >
                            Manage Sanctions
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 6: ADMINISTRATORS */}
          {activeTab === 'admins' && (
            <div className="space-y-6 animate-fade-in max-w-2xl">
              <form onSubmit={handleAddAdmin} className="p-5 bg-[#111b21] rounded-2xl border border-[#2e3b44]">
                <h4 className="font-semibold text-white text-sm mb-1">Grant Administrative Access</h4>
                <p className="text-xs text-[#8696a0] mb-4">
                  Add an email address to allow access to this Admin Portal via Settings.
                </p>

                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newAdminInput}
                    onChange={(e) => setNewAdminInput(e.target.value)}
                    placeholder="e.g. colleague@example.com"
                    className="flex-1 bg-[#182229] border border-[#2e3b44] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                  />
                  <button
                    type="submit"
                    disabled={isAddingAdmin || !newAdminInput.trim()}
                    className="px-5 py-2.5 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isAddingAdmin ? 'Adding...' : 'Grant Admin'}</span>
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#8696a0] px-1">
                  Active Admin Accounts ({adminEmails.length})
                </div>

                <div className="space-y-2">
                  {adminEmails.map((email) => {
                    const isOwner = email.toLowerCase() === 'saeed.samadelivery@gmail.com';
                    return (
                      <div
                        key={email}
                        className="p-3.5 bg-[#111b21] rounded-2xl border border-[#2e3b44] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-white text-xs">{email}</div>
                            <div className="text-[10px] text-[#8696a0] font-mono">
                              {isOwner ? 'Primary System Owner (Protected)' : 'Authorized Administrator'}
                            </div>
                          </div>
                        </div>

                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => removeAdminEmail(email)}
                            className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition font-medium cursor-pointer"
                          >
                            Remove Access
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

          {/* TAB: APP VERSION & OTA RELEASES */}
          {activeTab === 'version' && (
            <AppVersionAdminTab adminEmail={currentUser?.email || ''} />
          )}
        {/* Footer */}
        <div className="px-6 py-4 bg-[#111b21] border-t border-[#2e3b44] flex items-center justify-between text-xs text-[#8696a0]">
          <span>LimoChat Administrative Layer • All records synchronized with Firebase</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#202c33] hover:bg-[#2a3942] text-white rounded-xl font-medium transition cursor-pointer"
          >
            Exit Portal
          </button>
        </div>
      </div>

      {/* MODAL 1: EDIT LIFETIME VIRTUAL NUMBER */}
      {editingPhoneUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-default" onClick={() => setEditingPhoneUser(null)} />
          <div className="relative z-50 w-full max-w-sm bg-[#202c33] border border-[#2e3b44] rounded-2xl p-5 shadow-2xl animate-scale-in">
            <h3 className="text-sm font-semibold text-white mb-1">
              Edit Lifetime Virtual Number
            </h3>
            <p className="text-xs text-[#8696a0] mb-4">
              Update assigned number for <span className="text-white font-medium">{editingPhoneUser.displayName}</span>. Once updated, this number persists indefinitely for the user.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-[#8696a0] uppercase tracking-wider block mb-1">
                  Virtual Line (Must start with +991)
                </label>
                <input
                  type="text"
                  value={newPhoneInput}
                  onChange={(e) => setNewPhoneInput(e.target.value)}
                  placeholder="+991 555 1234"
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPhoneUser(null)}
                  className="px-3.5 py-2 rounded-xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePhoneNumber}
                  className="px-4 py-2 bg-[#00a884] hover:bg-[#02906f] text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-md"
                >
                  Save Lifetime Number
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: POLICY VIOLATION WARNING */}
      {warningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-default" onClick={() => setWarningUser(null)} />
          <div className="relative z-50 w-full max-w-md bg-[#202c33] border border-[#2e3b44] rounded-2xl p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span>Issue Privacy Policy Warning</span>
            </div>
            <p className="text-xs text-[#8696a0] mb-4">
              Flag user <span className="text-white font-medium">{warningUser.displayName}</span> for policy non-compliance.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-[#8696a0] uppercase tracking-wider block mb-1">
                  Select Policy Violation
                </label>
                <select
                  value={selectedRuleName}
                  onChange={(e) => setSelectedRuleName(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00a884]"
                >
                  {POLICY_VIOLATIONS.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#8696a0] uppercase tracking-wider block mb-1">
                  Specific Details / Incident Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customWarningText}
                  onChange={(e) => setCustomWarningText(e.target.value)}
                  placeholder="Additional context about this incident..."
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl p-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#d1d7db] pt-1">
                <input
                  type="checkbox"
                  checked={autoSendSupportNotice}
                  onChange={(e) => setAutoSendSupportNotice(e.target.checked)}
                  className="rounded text-[#00a884] focus:ring-0"
                />
                <span>Automatically dispatch official warning to user via Support Chat</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setWarningUser(null)}
                  className="px-3.5 py-2 rounded-xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleIssuePolicyWarning}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-xs transition cursor-pointer shadow-md"
                >
                  Issue Warning Notice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: GRANULAR PUNISHMENTS & SANCTIONS */}
      {punishingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-default" onClick={() => setPunishingUser(null)} />
          <div className="relative z-50 w-full max-w-md bg-[#202c33] border border-[#2e3b44] rounded-2xl p-5 shadow-2xl animate-scale-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-400 mb-1">
              <Ban className="w-4 h-4" />
              <span>Configure Sanctions & Restrictions</span>
            </div>
            <p className="text-xs text-[#8696a0] mb-4">
              Apply or lift punishments for <span className="text-white font-medium">{punishingUser.displayName}</span>.
            </p>

            <div className="space-y-4">
              {/* Suspension Tier */}
              <div>
                <label className="text-[10px] font-semibold text-[#8696a0] uppercase tracking-wider block mb-2">
                  Account Lockout Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'none', label: 'Good Standing' },
                    { id: 'temporary', label: 'Temporary Ban' },
                    { id: 'permanent', label: 'Permanent Ban' },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSuspensionType(tier.id as any)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-center border ${
                        suspensionType === tier.id
                          ? tier.id === 'none'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                            : 'bg-red-500/20 text-red-400 border-red-500/50'
                          : 'bg-[#111b21] text-[#8696a0] border-[#2e3b44] hover:text-white'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Temporary Duration Selector */}
              {suspensionType === 'temporary' && (
                <div className="bg-[#111b21] p-3 rounded-xl border border-[#2e3b44] animate-fade-in">
                  <label className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>Select Temporary Ban Duration</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {DURATION_PRESETS.map((d) => (
                      <button
                        key={d.minutes}
                        type="button"
                        onClick={() => setTempDurationMinutes(d.minutes)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          tempDurationMinutes === d.minutes
                            ? 'bg-amber-500 text-black'
                            : 'bg-[#182229] text-[#8696a0] hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feature Specific Restrictions */}
              <div>
                <label className="text-[10px] font-semibold text-[#8696a0] uppercase tracking-wider block mb-2">
                  Feature-Level Restrictions
                </label>
                <div className="space-y-2 bg-[#111b21] p-3 rounded-xl border border-[#2e3b44]">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#d1d7db]">
                    <input
                      type="checkbox"
                      checked={restrictSendingMessages}
                      onChange={(e) => setRestrictSendingMessages(e.target.checked)}
                      className="rounded text-red-500 focus:ring-0"
                    />
                    <span>Suspend Sending Messages</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#d1d7db]">
                    <input
                      type="checkbox"
                      checked={restrictAddingContacts}
                      onChange={(e) => setRestrictAddingContacts(e.target.checked)}
                      className="rounded text-red-500 focus:ring-0"
                    />
                    <span>Suspend Adding New Contacts</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#d1d7db]">
                    <input
                      type="checkbox"
                      checked={restrictCalls}
                      onChange={(e) => setRestrictCalls(e.target.checked)}
                      className="rounded text-red-500 focus:ring-0"
                    />
                    <span>Suspend Voice & Video Calls</span>
                  </label>
                </div>
              </div>

              {/* Reason Input */}
              {(suspensionType !== 'none' || restrictSendingMessages || restrictAddingContacts || restrictCalls) && (
                <div>
                  <label className="text-[10px] font-semibold text-[#8696a0] uppercase tracking-wider block mb-1">
                    Enforcement Reason (Shown to User)
                  </label>
                  <textarea
                    rows={2}
                    value={punishmentReason}
                    onChange={(e) => setPunishmentReason(e.target.value)}
                    placeholder="Specify reason for sanction..."
                    className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl p-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] resize-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPunishingUser(null)}
                  className="px-3.5 py-2 rounded-xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyPunishment}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-md"
                >
                  Save Sanctions & Notify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {previewMediaUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewMediaUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img src={previewMediaUrl} alt="Preview" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/10" />
            <button
              onClick={() => setPreviewMediaUrl(null)}
              className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-black text-white rounded-full transition cursor-pointer border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* GENERIC CONFIRM / ALERT MODAL */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmText={confirmConfig.confirmText}
          cancelText={confirmConfig.cancelText}
          variant={confirmConfig.variant}
          singleAction={confirmConfig.singleAction}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
};
