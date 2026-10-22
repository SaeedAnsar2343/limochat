import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  arrayUnion, 
  setDoc, 
  deleteDoc,
  increment 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { 
  Chat, 
  Message, 
  MessageType, 
  QuotedMessage, 
  UserProfile, 
  Community, 
  AppTheme, 
  ChatWallpaper,
  GroupPermissions 
} from '../types';
import { soundEngine } from '../utils/sound';
import { NativeNotificationService } from '../utils/nativeNotifications';
import { generateTemporaryNumber } from '../utils/formatters';
import { 
  getPolicyRules, 
  checkContentViolation, 
  handleViolationIncident, 
  maskProhibitedContent, 
  PolicyCheckResult 
} from '../utils/policyEngine';
import { ConfirmModal } from '../components/common/ConfirmModal';

interface ChatContextType {
  chats: Chat[];
  activeChat: Chat | null;
  messages: Message[];
  communities: Community[];
  replyingTo: QuotedMessage | null;
  theme: AppTheme;
  wallpaper: ChatWallpaper;
  enterIsSend: boolean;
  fontSize: 'sm' | 'base' | 'lg';
  setActiveChat: (chat: Chat | null) => void;
  setReplyingTo: (quote: QuotedMessage | null) => void;
  setTheme: (t: AppTheme) => void;
  setWallpaper: (w: ChatWallpaper) => void;
  setEnterIsSend: (enabled: boolean) => void;
  setFontSize: (size: 'sm' | 'base' | 'lg') => void;
  sendMessage: (text: string, type?: MessageType, mediaUrl?: string, extra?: Partial<Message>) => Promise<void>;
  sendSupportReply: (chatId: string, text: string) => Promise<void>;
  deleteMessageForEveryone: (messageId: string) => Promise<void>;
  deleteMessageForMe: (messageId: string) => Promise<void>;
  deleteMessagesBulk: (messageIds: string[], deleteForEveryone: boolean) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  toggleStarMessage: (messageId: string) => Promise<void>;
  createDirectChat: (targetUser: UserProfile) => Promise<Chat>;
  startDirectChatWithContact: (nameOrPhone: string) => Promise<Chat>;
  createGroup: (name: string, description: string, memberUids: string[], avatar?: string, allowPastMessages?: boolean) => Promise<Chat>;
  createCommunity: (name: string, description: string, groupIds: string[], icon?: string) => Promise<Community>;
  searchUsers: (queryStr: string) => Promise<UserProfile[]>;
  getAllContacts: () => Promise<UserProfile[]>;
  clearChatHistory: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  deleteContact: (targetUid: string) => Promise<void>;
  togglePinChat: (chatId: string) => Promise<void>;
  markChatAsRead: (chatId: string) => Promise<void>;
  markChatAsUnread: (chatId: string) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  updateGroupPermissions: (chatId: string, permissions: GroupPermissions) => Promise<void>;
  showAlertNotice: (title: string, description: string, variant?: 'danger' | 'warning' | 'primary', confirmText?: string) => void;
  exportChat: (chatId: string, format?: 'txt' | 'json') => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const SYSTEM_SUPPORT_USER: UserProfile = {
  uid: 'limochat_official_support',
  displayName: 'LimoChat Support',
  email: 'support@limochat.app',
  photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=LimoSupport',
  phoneNumber: '+991 100 0001',
  about: 'Official LimoChat Assistant & Support Desk',
  isOnline: true,
  lastSeen: Date.now(),
  privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', readReceipts: true },
  blockedUsers: [],
  createdAt: 1700000000000,
};

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

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const saved = localStorage.getItem('limochat_cached_chats');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [replyingTo, setReplyingTo] = useState<QuotedMessage | null>(null);

  // In-App Modern Notice Popup Modal (Replaces browser alert)
  const [appNotice, setAppNotice] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    variant?: 'danger' | 'warning' | 'primary';
    confirmText?: string;
  } | null>(null);

  const showAlertNotice = (
    title: string, 
    description: string, 
    variant: 'danger' | 'warning' | 'primary' = 'warning', 
    confirmText = 'OK'
  ) => {
    setAppNotice({
      isOpen: true,
      title,
      description,
      variant,
      confirmText,
    });
  };
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('limochat_theme') as AppTheme;
      if (saved === 'light') {
        document.documentElement.classList.add('light-theme');
        return 'light';
      }
      return saved || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [wallpaper, setWallpaperState] = useState<ChatWallpaper>('default');
  const [enterIsSend, setEnterIsSendState] = useState<boolean>(true);
  const [fontSize, setFontSizeState] = useState<'sm' | 'base' | 'lg'>('sm');

  // Sync user preferences from Firestore across all devices
  useEffect(() => {
    if (currentUser?.preferences) {
      const p = currentUser.preferences;
      if (p.appTheme) {
        setThemeState(p.appTheme);
        localStorage.setItem('limochat_theme', p.appTheme);
        if (p.appTheme === 'light') {
          document.documentElement.classList.add('light-theme');
        } else {
          document.documentElement.classList.remove('light-theme');
        }
      }
      if (p.wallpaper) {
        setWallpaperState(p.wallpaper);
      }
      if (typeof p.enterIsSend === 'boolean') {
        setEnterIsSendState(p.enterIsSend);
      }
      if (p.fontSize) {
        setFontSizeState(p.fontSize);
      }
    }
  }, [currentUser?.preferences]);

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem('limochat_theme', t);
    } catch {}
    if (t === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
    if (currentUser?.uid) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        'preferences.appTheme': t,
      }).catch(() => {});
    }
  };

  const setWallpaper = (w: ChatWallpaper) => {
    setWallpaperState(w);
    if (currentUser?.uid) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        'preferences.wallpaper': w,
      }).catch(() => {});
    }
  };

  const setEnterIsSend = (enabled: boolean) => {
    setEnterIsSendState(enabled);
    if (currentUser?.uid) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        'preferences.enterIsSend': enabled,
      }).catch(() => {});
    }
  };

  const setFontSize = (size: 'sm' | 'base' | 'lg') => {
    setFontSizeState(size);
    if (currentUser?.uid) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        'preferences.fontSize': size,
      }).catch(() => {});
    }
  };

  // Save chats to local cache
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('limochat_cached_chats', JSON.stringify(chats));
    }
  }, [chats]);

  // Load chats for current user from Firestore
  useEffect(() => {
    if (!currentUser?.uid) {
      setChats([]);
      setActiveChat(null);
      return;
    }

    const chatsRef = collection(db, 'chats');
    // Using single-field query to guarantee 0 composite index errors in Firestore
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach((docSnap) => {
        chatList.push({ id: docSnap.id, ...docSnap.data() } as Chat);
      });
      // Sort client-side by updatedAt descending
      chatList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      setChats(prev => {
        const map = new Map<string, Chat>();
        chatList.forEach(c => map.set(c.id, c));
        prev.forEach(c => {
          if (!map.has(c.id)) map.set(c.id, c);
        });
        return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      });

      if (activeChat) {
        const updated = chatList.find(c => c.id === activeChat.id);
        if (updated) setActiveChat(updated);
      }

      // Background notification for inactive chats
      if (currentUser?.uid && chatList.length > 0) {
        chatList.forEach((c) => {
          if (c.id !== activeChat?.id && c.lastMessage && c.lastMessage.senderId !== currentUser.uid) {
            const ageMs = Date.now() - (c.lastMessage.timestamp || 0);
            if (ageMs < 15000) {
              const notifKey = `limochat_seen_${c.id}_${c.lastMessage.timestamp}`;
              if (!sessionStorage.getItem(notifKey)) {
                sessionStorage.setItem(notifKey, '1');
                NativeNotificationService.notifyMessage({
                  title: c.name || 'New Message',
                  body: c.lastMessage.text || 'Sent an attachment',
                  chatId: c.id,
                });
              }
            }
          }
        });
      }
    }, (err) => {
      console.warn("Chats snapshot warning:", err);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Load communities for current user
  useEffect(() => {
    if (!currentUser?.uid) {
      setCommunities([]);
      return;
    }
    const commRef = collection(db, 'communities');
    const q = query(commRef, where('members', 'array-contains', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Community[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Community));
      setCommunities(list);
    }, () => {});
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Load messages for active chat
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    // Immediately clear/initialize messages to guarantee clean chat switching
    let initialList: Message[] = [];
    try {
      const cached = localStorage.getItem(`limochat_msgs_${activeChat.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          initialList = parsed.filter((m: Message) => m.chatId === activeChat.id);
        }
      }
    } catch {}
    setMessages(initialList);

    const messagesRef = collection(db, 'chats', activeChat.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    // Only reset unread count if it is actually greater than 0 (saves writes)
    if (currentUser?.uid && (activeChat.unreadCount?.[currentUser.uid] || 0) > 0) {
      updateDoc(doc(db, 'chats', activeChat.id), {
        [`unreadCount.${currentUser.uid}`]: 0,
      }).catch(() => {});
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList: Message[] = [];

      snapshot.forEach((docSnap) => {
        const msg = { id: docSnap.id, ...docSnap.data() } as Message;
        if (!msg.deletedForUsers?.includes(currentUser?.uid || '')) {
          msgList.push(msg);
        }

        // Live Read Receipt: mark incoming messages as read in Firestore
        if (currentUser && msg.senderId !== currentUser.uid && msg.status !== 'read') {
          if (currentUser.privacy?.readReceipts !== false) {
            updateDoc(doc(db, 'chats', activeChat.id, 'messages', msg.id), {
              status: 'read'
            }).catch(() => {});
          }
        }
      });

      // 1. Detect and notify incoming messages for all media & text types
      if (msgList.length > messages.length && messages.length > 0) {
        const last = msgList[msgList.length - 1];
        if (last && last.senderId !== currentUser?.uid) {
          if (currentUser?.preferences?.notificationSound !== false) {
            soundEngine.playMessageReceived(currentUser?.preferences?.messageTone || 'pop');
          }
          if (currentUser?.preferences?.inAppVibration !== false && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(100);
            } catch {}
          }

          let previewBody = last.text || '';
          if (last.type === 'image') previewBody = last.text ? `📷 Photo: ${last.text}` : '📷 Photo';
          else if (last.type === 'video') previewBody = last.text ? `🎥 Video: ${last.text}` : '🎥 Video';
          else if (last.type === 'voice') previewBody = '🎤 Voice message';
          else if (last.type === 'file') previewBody = last.text ? `📄 Document: ${last.text}` : '📄 Document';
          else if (last.type === 'location') previewBody = '📍 Shared location';
          else if (last.type === 'contact') previewBody = '👤 Shared contact';
          else if (!previewBody) previewBody = '✨ Sent an attachment';

          NativeNotificationService.notifyMessage({
            title: activeChat?.name || 'New Message',
            body: previewBody,
            chatId: activeChat?.id || '',
          });
        }
      }

      // 2. Detect and notify message reactions on my messages
      if (messages.length > 0 && currentUser?.uid) {
        msgList.forEach(newMsg => {
          if (newMsg.senderId === currentUser.uid && newMsg.reactions && newMsg.reactions.length > 0) {
            const oldMsg = messages.find(m => m.id === newMsg.id);
            const oldReactionsCount = oldMsg?.reactions?.length || 0;
            if (newMsg.reactions.length > oldReactionsCount) {
              const latestReaction = newMsg.reactions[newMsg.reactions.length - 1];
              if (latestReaction && latestReaction.userId !== currentUser.uid) {
                NativeNotificationService.notifyReaction({
                  userName: latestReaction.userName || 'Contact',
                  emoji: latestReaction.emoji,
                  messageSnippet: newMsg.text || 'Message',
                  chatId: activeChat?.id || '',
                });
              }
            }
          }
        });
      }

      setMessages((prev) => {
        const serverIds = new Set(msgList.map(m => m.id));
        // Preserve local pending or failed messages so they NEVER disappear on refresh
        const pendingLocal = prev.filter(m => m.chatId === activeChat.id && !serverIds.has(m.id) && (m.status === 'sending' || m.status === 'failed'));
        const combined = [...msgList, ...pendingLocal].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        try {
          localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(combined));
        } catch {}
        return combined;
      });
    }, () => {});

    return () => unsubscribe();
  }, [activeChat?.id, currentUser?.uid]);

  const sendMessage = async (
    text: string, 
    type: MessageType = 'text', 
    mediaUrl?: string, 
    extra?: Partial<Message>
  ) => {
    if (!currentUser || !activeChat) return;

    // Check account punishment status (Administrators are immune)
    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const isUserAdmin = currentUser.isAdmin === true || userEmail === 'saeed.samadelivery@gmail.com';

    if (!isUserAdmin && (currentUser.isBanned || currentUser.punishment?.isSuspended)) {
      const isTemp = currentUser.punishment?.suspensionType === 'temporary';
      const remainingMin = currentUser.punishment?.suspendedUntil
        ? Math.max(0, Math.ceil((currentUser.punishment.suspendedUntil - Date.now()) / (60 * 1000)))
        : 0;
      const noticeDesc = isTemp
        ? `Your account is temporarily suspended (${remainingMin}m remaining).\nReason: ${currentUser.punishment?.reason || 'Policy violation'}.`
        : `Your account is permanently suspended.\nReason: ${currentUser.punishment?.reason || 'Terms violation'}.`;
      showAlertNotice(
        isTemp ? "Account Temporarily Suspended" : "Account Permanently Suspended",
        noticeDesc,
        "danger",
        "Understood"
      );
      return;
    }

    if (!isUserAdmin && currentUser.punishment?.restrictions?.disableSendingMessages) {
      showAlertNotice(
        "Messaging Restricted",
        `Sending messages is currently restricted on your account.\nReason: ${currentUser.punishment?.reason || 'Policy violation'}.`,
        "warning",
        "OK"
      );
      return;
    }

    // Restriction: Cannot send message to blocked contact
    if (activeChat.type === 'direct') {
      const otherUid = activeChat.participants.find(p => p !== currentUser.uid);
      if (otherUid && currentUser.blockedUsers?.includes(otherUid)) {
        showAlertNotice(
          "Blocked Contact",
          "You cannot send messages to a blocked contact. Please unblock first to resume chat.",
          "warning",
          "OK"
        );
        return;
      }
    }

    // Automated Policy Violation Screening & Word Masking (e.g. "sex" -> "**x", "porn" -> "***n")
    // Note: Admins are exempt. When prohibited words are detected, mask the message text and alert admin, without interrupting the user!
    let finalText = text;
    if (type !== 'call_log' && !isUserAdmin) {
      try {
        const policyRules = await getPolicyRules();
        const maskResult = maskProhibitedContent(text, policyRules);

        if (maskResult.hasViolation && maskResult.matchedRule) {
          // Replace text with masked terms (e.g. "sex" -> "**x", "porn" -> "***n")
          finalText = maskResult.maskedText;

          const violationResult: PolicyCheckResult = {
            violated: true,
            rule: maskResult.matchedRule,
            matchedTerm: maskResult.detectedTerms.join(', '),
            actionDescription: maskResult.matchedRule.defaultAction || 'warn',
          };

          const result = await handleViolationIncident(
            violationResult,
            currentUser,
            text, // Store original raw text for admin inspection
            activeChat.id,
            maskResult.maskedText
          );

          if (result.blocked) {
            showAlertNotice(
              "Message Blocked by Policy",
              result.actionMessage || "This message contains prohibited content and was blocked by community safety filters.",
              "danger",
              "OK"
            );
            return;
          }
        }
      } catch (err) {
        console.warn("Policy engine screening notice:", err);
      }
    }

    const now = Date.now();
    const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 6)}`;

    const lastMsgText = type === 'image' 
      ? '📷 Photo' 
      : type === 'voice' 
      ? '🎤 Voice message' 
      : type === 'file' 
      ? '📎 Attachment' 
      : type === 'call_log'
      ? (finalText || '📞 Call')
      : finalText;

    const newMsg: Message = {
      id: msgId,
      chatId: activeChat.id,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'User',
      senderPhoto: currentUser.photoURL || '',
      text: finalText,
      type,
      mediaUrl: mediaUrl || '',
      mediaDuration: extra?.mediaDuration || 0,
      fileName: extra?.fileName || '',
      fileSize: extra?.fileSize || '',
      status: 'sending',
      timestamp: now,
      quotedMessage: replyingTo || null,
      isDeletedForEveryone: false,
      deletedForUsers: [],
      starredBy: [],
      callType: extra?.callType,
      callStatus: extra?.callStatus,
    };

    // Update local state and sound immediately
    setMessages(prev => {
      const updated = [...prev, newMsg];
      localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
      return updated;
    });

    setChats(prev => prev.map(c => c.id === activeChat.id ? {
      ...c,
      updatedAt: now,
      lastMessage: {
        text: lastMsgText,
        senderId: currentUser.uid,
        timestamp: now,
        type,
        status: 'sending',
        callType: extra?.callType,
        callStatus: extra?.callStatus,
      }
    } : c));

    if (type !== 'call_log') {
      soundEngine.playMessageSent();
    }
    setReplyingTo(null);

    // Try saving to Firestore
    try {
      const msgDocRef = doc(db, 'chats', activeChat.id, 'messages', msgId);
      await setDoc(msgDocRef, sanitizeData({ ...newMsg, status: 'delivered' }), { merge: true });

      // Confirm delivered in local state
      setMessages(prev => {
        const updated = prev.map(m => m.id === msgId ? { ...m, status: 'delivered' as const } : m);
        localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
        return updated;
      });

      const chatRef = doc(db, 'chats', activeChat.id);
      
      // Increment unread count for recipients
      const unreadMap = { ...(activeChat.unreadCount || {}) };
      activeChat.participants.forEach((pid) => {
        if (pid !== currentUser.uid) {
          unreadMap[pid] = (unreadMap[pid] || 0) + 1;
        }
      });

      await setDoc(chatRef, sanitizeData({
        updatedAt: now,
        unreadCount: unreadMap,
        lastMessage: {
          text: lastMsgText,
          senderId: currentUser.uid,
          timestamp: now,
          type,
          status: 'delivered',
          callType: extra?.callType,
          callStatus: extra?.callStatus,
        }
      }), { merge: true });
    } catch (err: any) {
      console.warn("Firestore message write error:", err);
      const isQuota = err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded') || err?.message?.includes('RESOURCE_EXHAUSTED');

      // Update message status to 'failed' locally so user sees retry button
      setMessages(prev => {
        const updated = prev.map(m => m.id === msgId ? { ...m, status: 'failed' as const } : m);
        localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
        return updated;
      });

      if (isQuota) {
        showAlertNotice(
          "Database Daily Quota Reached",
          "Firebase Spark (Free) plan daily write limit of 20,000 writes has been reached on project 'woki-toki-69a0d'. To enable unlimited messaging and calling, please upgrade to the Blaze plan in Firebase Console.",
          "danger",
          "Understood"
        );
      }
    }
  };

  // Update Group Permissions
  const updateGroupPermissions = async (chatId: string, permissions: GroupPermissions) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), { permissions });
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, permissions } : c)));
      if (activeChat?.id === chatId) {
        setActiveChat((prev) => (prev ? { ...prev, permissions } : null));
      }
    } catch (err) {
      console.warn("Update group permissions error:", err);
    }
  };

  // Reply from Admin Portal on behalf of LimoChat Support
  const sendSupportReply = async (chatId: string, text: string) => {
    if (!text.trim()) return;

    const now = Date.now();
    const msgId = `msg_${now}_support`;

    const supportMsg: Message = {
      id: msgId,
      chatId,
      senderId: SYSTEM_SUPPORT_USER.uid,
      senderName: SYSTEM_SUPPORT_USER.displayName,
      senderPhoto: SYSTEM_SUPPORT_USER.photoURL,
      text: text.trim(),
      type: 'text',
      status: 'read',
      timestamp: now,
      isDeletedForEveryone: false,
      deletedForUsers: [],
      starredBy: [],
    };

    const targetUserId = chatId.startsWith('support_') ? chatId.replace('support_', '') : null;

    // Update local messages if viewing this chat
    if (activeChat?.id === chatId) {
      setMessages(prev => {
        const updated = [...prev, supportMsg];
        localStorage.setItem(`limochat_msgs_${chatId}`, JSON.stringify(updated));
        return updated;
      });
    }

    // Update local chats list to show latest message and unread count
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        const nextUnread = { ...(c.unreadCount || {}) };
        if (targetUserId) {
          nextUnread[targetUserId] = (nextUnread[targetUserId] || 0) + 1;
        }
        nextUnread['limochat_official_support'] = 0;
        return {
          ...c,
          updatedAt: now,
          unreadCount: nextUnread,
          lastMessage: {
            text: supportMsg.text,
            senderId: SYSTEM_SUPPORT_USER.uid,
            timestamp: now,
            type: 'text',
            status: 'read'
          }
        };
      }
      return c;
    }));

    // Try Firestore update
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, supportMsg);
      
      const updatePayload: any = {
        updatedAt: now,
        lastMessage: {
          text: supportMsg.text,
          senderId: SYSTEM_SUPPORT_USER.uid,
          timestamp: now,
          type: 'text',
          status: 'read'
        },
        'unreadCount.limochat_official_support': 0,
      };

      if (targetUserId) {
        updatePayload[`unreadCount.${targetUserId}`] = increment(1);
      }

      await setDoc(doc(db, 'chats', chatId), updatePayload, { merge: true });
    } catch (err) {
      console.warn("Support reply saved locally:", err);
    }
  };

  const deleteMessageForEveryone = async (messageId: string) => {
    if (!activeChat) return;

    // 1. Immediately update local state
    setMessages(prev => {
      const updated = prev.map(m => m.id === messageId ? {
        ...m,
        isDeletedForEveryone: true,
        text: '🚫 This message was deleted',
        mediaUrl: '',
      } : m);
      localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
      return updated;
    });

    // 2. Update chat preview if this was the last message
    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id && c.lastMessage) {
        return {
          ...c,
          lastMessage: {
            ...c.lastMessage,
            text: '🚫 This message was deleted',
          }
        };
      }
      return c;
    }));

    // 3. Persist to Firestore
    try {
      const msgRef = doc(db, 'chats', activeChat.id, 'messages', messageId);
      await updateDoc(msgRef, {
        isDeletedForEveryone: true,
        text: '🚫 This message was deleted',
        mediaUrl: '',
      });

      // Update chat lastMessage in Firestore
      await updateDoc(doc(db, 'chats', activeChat.id), {
        'lastMessage.text': '🚫 This message was deleted',
      }).catch(() => {});
    } catch (err) {
      console.warn("Delete for everyone fallback sync:", err);
      try {
        const q = query(collection(db, 'chats', activeChat.id, 'messages'), where('id', '==', messageId));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await updateDoc(docSnap.ref, {
            isDeletedForEveryone: true,
            text: '🚫 This message was deleted',
            mediaUrl: '',
          });
        }
      } catch {}
    }
  };

  const deleteMessageForMe = async (messageId: string) => {
    if (!activeChat || !currentUser) return;
    setMessages(prev => {
      const updated = prev.filter(m => m.id !== messageId);
      localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
      return updated;
    });

    try {
      const msgRef = doc(db, 'chats', activeChat.id, 'messages', messageId);
      await updateDoc(msgRef, {
        deletedForUsers: arrayUnion(currentUser.uid)
      });
    } catch {
      try {
        const q = query(collection(db, 'chats', activeChat.id, 'messages'), where('id', '==', messageId));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await updateDoc(docSnap.ref, {
            deletedForUsers: arrayUnion(currentUser.uid)
          });
        }
      } catch {}
    }
  };

  const deleteMessagesBulk = async (messageIds: string[], deleteForEveryone: boolean) => {
    if (!activeChat || !currentUser || messageIds.length === 0) return;

    if (deleteForEveryone) {
      setMessages(prev => {
        const updated = prev.map(m => messageIds.includes(m.id) ? {
          ...m,
          isDeletedForEveryone: true,
          text: '🚫 This message was deleted',
          mediaUrl: '',
        } : m);
        localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
        return updated;
      });

      for (const msgId of messageIds) {
        try {
          const msgRef = doc(db, 'chats', activeChat.id, 'messages', msgId);
          await updateDoc(msgRef, {
            isDeletedForEveryone: true,
            text: '🚫 This message was deleted',
            mediaUrl: '',
          });
        } catch {}
      }
    } else {
      setMessages(prev => {
        const updated = prev.filter(m => !messageIds.includes(m.id));
        localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
        return updated;
      });

      for (const msgId of messageIds) {
        try {
          const msgRef = doc(db, 'chats', activeChat.id, 'messages', msgId);
          await updateDoc(msgRef, {
            deletedForUsers: arrayUnion(currentUser.uid),
          });
        } catch {}
      }
    }
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    if (!activeChat || !currentUser) return;

    const targetMsg = messages.find(m => m.id === messageId);
    if (!targetMsg) return;

    const existingReactions = targetMsg.reactions || [];
    const myExisting = existingReactions.find(r => r.userId === currentUser.uid);

    let updatedReactions: { emoji: string; userId: string; userName: string }[];
    if (myExisting && myExisting.emoji === emoji) {
      // Toggle off if clicking same emoji
      updatedReactions = existingReactions.filter(r => r.userId !== currentUser.uid);
    } else {
      // Replace or add
      updatedReactions = [
        ...existingReactions.filter(r => r.userId !== currentUser.uid),
        {
          emoji,
          userId: currentUser.uid,
          userName: currentUser.displayName || 'User',
        }
      ];
    }

    setMessages(prev => {
      const updated = prev.map(m => m.id === messageId ? { ...m, reactions: updatedReactions } : m);
      localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
      return updated;
    });

    try {
      const msgRef = doc(db, 'chats', activeChat.id, 'messages', messageId);
      await updateDoc(msgRef, { reactions: updatedReactions });
    } catch {
      try {
        const q = query(collection(db, 'chats', activeChat.id, 'messages'), where('id', '==', messageId));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await updateDoc(docSnap.ref, { reactions: updatedReactions });
        }
      } catch {}
    }
  };

  const toggleStarMessage = async (messageId: string) => {
    if (!activeChat || !currentUser) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const starred = msg.starredBy || [];
    const isStarred = starred.includes(currentUser.uid);
    const updated = isStarred ? starred.filter(id => id !== currentUser.uid) : [...starred, currentUser.uid];
    
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, starredBy: updated } : m));

    try {
      await updateDoc(doc(db, 'chats', activeChat.id, 'messages', messageId), {
        starredBy: updated
      });
    } catch {}
  };

  const clearChatHistory = async (chatId: string) => {
    setMessages([]);
    localStorage.removeItem(`limochat_msgs_${chatId}`);

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const snap = await getDocs(messagesRef);
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: null,
        updatedAt: Date.now()
      }).catch(() => {});
    } catch {}
  };

  const deleteChat = async (chatId: string) => {
    // Official LimoChat Support desk cannot be deleted
    if (chatId.startsWith('support_')) {
      console.warn("LimoChat Support chat cannot be deleted.");
      return;
    }
    const targetChat = chats.find(c => c.id === chatId);
    if (targetChat?.participants?.includes(SYSTEM_SUPPORT_USER.uid)) {
      console.warn("LimoChat Support chat cannot be deleted.");
      return;
    }

    // Remove from local state immediately
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChat?.id === chatId) {
      setActiveChat(null);
    }
    localStorage.removeItem(`limochat_msgs_${chatId}`);
    try {
      const saved = localStorage.getItem('limochat_cached_chats');
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.setItem(
          'limochat_cached_chats',
          JSON.stringify(parsed.filter((c: Chat) => c.id !== chatId))
        );
      }
    } catch {}

    // Delete in Firestore
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const snap = await getDocs(messagesRef).catch(() => null);
      if (snap) {
        for (const d of snap.docs) {
          await deleteDoc(d.ref).catch(() => {});
        }
      }
      await deleteDoc(doc(db, 'chats', chatId)).catch(() => {});
    } catch (err) {
      console.warn("Delete chat warning:", err);
    }
  };

  const deleteContact = async (targetUid: string) => {
    if (!currentUser) return;
    if (targetUid === SYSTEM_SUPPORT_USER.uid || targetUid === 'limochat_official_support') {
      console.warn("LimoChat Support contact cannot be deleted.");
      return;
    }
    const updated = Array.from(new Set([...(currentUser.deletedContactUids || []), targetUid]));
    await updateDoc(doc(db, 'users', currentUser.uid), {
      deletedContactUids: updated
    }).catch(() => {});

    // Delete direct chat if exists
    const directChat = chats.find(c => c.type === 'direct' && c.participants.includes(targetUid));
    if (directChat) {
      await deleteChat(directChat.id);
    }
  };

  const togglePinChat = async (chatId: string) => {
    if (!currentUser) return;
    const targetChat = chats.find(c => c.id === chatId);
    if (!targetChat) return;

    const isCurrentlyPinned = targetChat.pinnedBy?.includes(currentUser.uid) || targetChat.isPinned;
    const newPinned = !isCurrentlyPinned;

    const updatedPinnedBy = newPinned
      ? Array.from(new Set([...(targetChat.pinnedBy || []), currentUser.uid]))
      : (targetChat.pinnedBy || []).filter(id => id !== currentUser.uid);

    // Update local state
    setChats(prev => prev.map(c => c.id === chatId ? {
      ...c,
      isPinned: newPinned,
      pinnedBy: updatedPinnedBy
    } : c));

    // Update in Firestore
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        isPinned: newPinned,
        pinnedBy: updatedPinnedBy
      });
    } catch {}
  };

  const markChatAsRead = async (chatId: string) => {
    if (!currentUser) return;
    setChats(prev => prev.map(c => c.id === chatId ? {
      ...c,
      unreadCount: { ...(c.unreadCount || {}), [currentUser.uid]: 0 }
    } : c));
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`unreadCount.${currentUser.uid}`]: 0,
      });
    } catch {}
  };

  const markChatAsUnread = async (chatId: string) => {
    if (!currentUser) return;
    setChats(prev => prev.map(c => c.id === chatId ? {
      ...c,
      unreadCount: { ...(c.unreadCount || {}), [currentUser.uid]: 1 }
    } : c));
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`unreadCount.${currentUser.uid}`]: 1,
      });
    } catch {}
  };

  const typingStateRef = React.useRef<boolean>(false);
  const typingTimerRef = React.useRef<any>(null);

  const setTyping = async (isTyping: boolean) => {
    if (!activeChat || !currentUser) return;
    if (typingStateRef.current === isTyping) return;
    typingStateRef.current = isTyping;

    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      await updateDoc(chatRef, {
        [`typingUsers.${currentUser.uid}`]: isTyping
      });
    } catch {}

    if (isTyping) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setTyping(false);
      }, 3500);
    }
  };

  // Find or create direct 1-on-1 chat
  const createDirectChat = async (targetUser: UserProfile): Promise<Chat> => {
    if (!currentUser) throw new Error("Not logged in");

    const sortedUids = [currentUser.uid, targetUser.uid].sort();
    // Deterministic unified ID so both users always connect to the EXACT SAME chat document
    const chatId = targetUser.uid === SYSTEM_SUPPORT_USER.uid 
      ? `support_${currentUser.uid}` 
      : `chat_${sortedUids[0]}_${sortedUids[1]}`;

    // Check existing either by unified chatId or by participants
    const existing = chats.find(c => 
      c.id === chatId || (
        c.type === 'direct' && 
        c.participants.includes(targetUser.uid) && 
        c.participants.length === 2
      )
    );
    if (existing) {
      setActiveChat(existing);
      return existing;
    }

    const now = Date.now();

    const newChatData: Chat = {
      id: chatId,
      type: 'direct',
      participants: [currentUser.uid, targetUser.uid],
      name: targetUser.displayName,
      avatar: targetUser.photoURL,
      lastMessage: targetUser.uid === SYSTEM_SUPPORT_USER.uid ? {
        text: 'Welcome to LimoChat Support! How can we assist you?',
        senderId: SYSTEM_SUPPORT_USER.uid,
        timestamp: now,
        type: 'text',
        status: 'read'
      } : null,
      createdAt: now,
      updatedAt: now,
    };

    // Update local state immediately
    setChats(prev => [newChatData, ...prev.filter(c => c.id !== newChatData.id)]);
    setActiveChat(newChatData);

    // If support chat, initialize welcome message in messages state
    if (targetUser.uid === SYSTEM_SUPPORT_USER.uid) {
      const welcomeMsg: Message = {
        id: `welcome_${now}`,
        chatId,
        senderId: SYSTEM_SUPPORT_USER.uid,
        senderName: SYSTEM_SUPPORT_USER.displayName,
        senderPhoto: SYSTEM_SUPPORT_USER.photoURL,
        text: '👋 Welcome to LimoChat Support! Your private +991 virtual number is active. If you have any questions, feel free to send a message here and our administration team will answer right away.',
        type: 'text',
        status: 'read',
        timestamp: now,
        isDeletedForEveryone: false,
        deletedForUsers: [],
        starredBy: [],
      };
      setMessages([welcomeMsg]);
      localStorage.setItem(`limochat_msgs_${chatId}`, JSON.stringify([welcomeMsg]));
    }

    // Try saving to Firestore
    try {
      const chatDocRef = doc(db, 'chats', chatId);
      await setDoc(chatDocRef, sanitizeData(newChatData), { merge: true });
      if (targetUser.uid === SYSTEM_SUPPORT_USER.uid) {
        await addDoc(collection(db, 'chats', chatId, 'messages'), sanitizeData({
          chatId,
          senderId: SYSTEM_SUPPORT_USER.uid,
          senderName: SYSTEM_SUPPORT_USER.displayName,
          senderPhoto: SYSTEM_SUPPORT_USER.photoURL,
          text: '👋 Welcome to LimoChat Support! Your private +991 virtual number is active. If you have any questions, feel free to send a message here and our administration team will answer right away.',
          type: 'text',
          status: 'read',
          timestamp: now,
          isDeletedForEveryone: false,
          deletedForUsers: [],
          starredBy: [],
        }));
      }
    } catch (err) {
      console.warn("Direct chat active in local session:", err);
    }

    return newChatData;
  };

  // Start chat with any contact by entering their +991 number or display name
  const startDirectChatWithContact = async (nameOrPhone: string): Promise<Chat> => {
    if (!currentUser) throw new Error("Not logged in");
    const cleanInput = nameOrPhone.trim();
    if (!cleanInput) throw new Error("Please enter a name or phone number");

    const contacts = await searchUsers(cleanInput);
    if (contacts.length > 0) {
      return createDirectChat(contacts[0]);
    }

    const isPhoneNumber = cleanInput.includes('991') || cleanInput.startsWith('+');
    const newUid = `user_contact_${Date.now()}`;
    const newContact: UserProfile = {
      uid: newUid,
      displayName: isPhoneNumber ? `Contact (${cleanInput})` : cleanInput,
      email: `${newUid}@limochat.app`,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanInput)}`,
      phoneNumber: isPhoneNumber ? cleanInput : generateTemporaryNumber(),
      about: 'LimoChat Contact',
      isOnline: true,
      lastSeen: Date.now(),
      privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', readReceipts: true },
      blockedUsers: [],
      createdAt: Date.now(),
    };

    setDoc(doc(db, 'users', newUid), newContact).catch(() => {});
    return createDirectChat(newContact);
  };

  // Create Group Chat
  const createGroup = async (
    name: string, 
    description: string, 
    memberUids: string[], 
    avatar?: string,
    allowPastMessages: boolean = true
  ): Promise<Chat> => {
    if (!currentUser) throw new Error("Not logged in");

    // Strictly exclude Support user and any blocked contacts
    const filteredMemberUids = memberUids.filter(
      (uid) => uid !== 'limochat_official_support' && !(currentUser.blockedUsers || []).includes(uid)
    );
    const participants = Array.from(new Set([currentUser.uid, ...filteredMemberUids]));
    const now = Date.now();
    const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const memberJoinedAt: Record<string, number> = {};
    const memberHistoryRestricted: Record<string, boolean> = {};
    filteredMemberUids.forEach((uid) => {
      memberJoinedAt[uid] = now;
      memberHistoryRestricted[uid] = !allowPastMessages;
    });
    memberJoinedAt[currentUser.uid] = 0;
    memberHistoryRestricted[currentUser.uid] = false;

    const newGroupData: Chat = {
      id: groupId,
      type: 'group',
      name,
      description,
      avatar: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      participants,
      adminIds: [currentUser.uid],
      permissions: {
        whoCanSendMessage: 'all',
        whoCanAddMembers: 'all',
        whoCanEditInfo: 'all',
        whoCanViewMembers: 'all',
      },
      memberJoinedAt,
      memberHistoryRestricted,
      lastMessage: {
        text: `Group "${name}" was created`,
        senderId: currentUser.uid,
        timestamp: now,
        type: 'text',
        status: 'delivered'
      },
      createdAt: now,
      updatedAt: now,
    };

    // Update local state immediately
    setChats(prev => [newGroupData, ...prev]);
    setActiveChat(newGroupData);

    try {
      const chatsRef = collection(db, 'chats');
      const docRef = await addDoc(chatsRef, sanitizeData(newGroupData));
      const withServerId = { ...newGroupData, id: docRef.id };
      setChats(prev => prev.map(c => c.id === groupId ? withServerId : c));
      setActiveChat(withServerId);
      return withServerId;
    } catch (err) {
      console.warn("Group created in local session:", err);
      return newGroupData;
    }
  };

  // Create WhatsApp-style Community
  const createCommunity = async (
    name: string,
    description: string,
    groupIds: string[],
    icon?: string
  ): Promise<Community> => {
    if (!currentUser) throw new Error("Not logged in");

    const now = Date.now();
    const announcementChatId = `announcement_${Date.now()}`;
    const commId = `comm_${Date.now()}`;

    const announcementChat: Chat = {
      id: announcementChatId,
      type: 'announcement',
      name: `${name} Announcements`,
      description: `Official announcements for ${name}`,
      avatar: icon || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name)}`,
      participants: [currentUser.uid],
      adminIds: [currentUser.uid],
      communityId: commId,
      lastMessage: {
        text: `Welcome to the community!`,
        senderId: currentUser.uid,
        timestamp: now,
        type: 'text',
        status: 'delivered'
      },
      createdAt: now,
      updatedAt: now,
    };

    const commData: Community = {
      id: commId,
      name,
      description,
      icon: icon || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name)}`,
      creatorId: currentUser.uid,
      members: [currentUser.uid],
      announcementChatId,
      groupIds: groupIds || [],
      createdAt: now,
    };

    // Update state immediately
    setChats(prev => [announcementChat, ...prev]);
    setCommunities(prev => [commData, ...prev]);
    setActiveChat(announcementChat);

    try {
      const chatsRef = collection(db, 'chats');
      const announcementDoc = await addDoc(chatsRef, sanitizeData(announcementChat));
      const commDocRef = await addDoc(collection(db, 'communities'), sanitizeData({
        ...commData,
        announcementChatId: announcementDoc.id
      }));
      await updateDoc(doc(db, 'chats', announcementDoc.id), {
        communityId: commDocRef.id
      });
    } catch (err) {
      console.warn("Community created in local session:", err);
    }

    return commData;
  };

  // Get all registered contacts
  const getAllContacts = async (): Promise<UserProfile[]> => {
    try {
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);
      const list: UserProfile[] = [];
      const deletedUids = currentUser?.deletedContactUids || [];

      snap.forEach(d => {
        const u = d.data() as UserProfile;
        if (
          u.uid !== currentUser?.uid && 
          u.uid !== SYSTEM_SUPPORT_USER.uid &&
          !deletedUids.includes(u.uid)
        ) {
          list.push(u);
        }
      });

      if (currentUser?.uid !== SYSTEM_SUPPORT_USER.uid) {
        list.unshift(SYSTEM_SUPPORT_USER);
      }
      return list;
    } catch {
      return [SYSTEM_SUPPORT_USER];
    }
  };

  // Search users by +991 virtual number, displayName, or email
  const searchUsers = async (queryStr: string): Promise<UserProfile[]> => {
    const qTrimmed = queryStr.trim().toLowerCase();
    const all = await getAllContacts();

    if (!qTrimmed) {
      return all;
    }

    const cleanDigits = qTrimmed.replace(/[^0-9]/g, '');

    return all.filter((u) => {
      const nameMatch = u.displayName?.toLowerCase().includes(qTrimmed);
      const emailMatch = u.email?.toLowerCase().includes(qTrimmed);
      const phoneDigits = u.phoneNumber?.replace(/[^0-9]/g, '') || '';
      const phoneMatch = cleanDigits.length > 0 && phoneDigits.includes(cleanDigits);
      const fullPhoneMatch = u.phoneNumber?.toLowerCase().includes(qTrimmed);

      return nameMatch || emailMatch || phoneMatch || fullPhoneMatch;
    });
  };

  const exportChat = async (chatId: string, format: 'txt' | 'json' = 'txt') => {
    const targetChat = chats.find((c) => c.id === chatId) || activeChat;
    if (!targetChat) return;

    let chatMsgs: Message[] = [];
    if (activeChat?.id === chatId && messages.length > 0) {
      chatMsgs = [...messages];
    } else {
      try {
        const cached = localStorage.getItem(`limochat_msgs_${chatId}`);
        if (cached) chatMsgs = JSON.parse(cached);
      } catch {}
      if (chatMsgs.length === 0) {
        try {
          const snap = await getDocs(
            query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'))
          );
          snap.forEach((d) => chatMsgs.push({ id: d.id, ...d.data() } as Message));
        } catch {}
      }
    }

    const safeTitle = (targetChat.name || 'Conversation')
      .replace(/[^\w\s-]/g, '')
      .trim() || 'Conversation';
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      const exportBundle = {
        app: 'LimoChat',
        version: '2.5.0',
        chat: {
          id: targetChat.id,
          name: targetChat.name,
          type: targetChat.type,
          participants: targetChat.participants,
        },
        exportedAt: new Date().toISOString(),
        totalMessages: chatMsgs.length,
        messages: chatMsgs,
      };
      const blob = new Blob([JSON.stringify(exportBundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `limochat-${safeTitle}-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      let txt = `=====================================================\n`;
      txt += `LimoChat Encrypted Chat Export\n`;
      txt += `Chat: ${targetChat.name || 'Direct Conversation'}\n`;
      txt += `Date of Export: ${new Date().toLocaleString()}\n`;
      txt += `Total Messages: ${chatMsgs.length}\n`;
      txt += `=====================================================\n\n`;

      chatMsgs.forEach((m) => {
        const time = new Date(m.timestamp).toLocaleString();
        const sender = m.senderName || (m.senderId === currentUser?.uid ? 'You' : 'Participant');
        let body = m.text || '';
        if (m.type === 'image') body = `[Photo: ${m.text || m.mediaUrl || ''}]`;
        else if (m.type === 'video') body = `[Video: ${m.text || m.mediaUrl || ''}]`;
        else if (m.type === 'voice') body = `[Voice Note]`;
        else if (m.type === 'file') body = `[Document: ${m.text || m.mediaUrl || ''}]`;
        else if (m.type === 'location') body = `[Location: ${m.text || ''}]`;

        const rx = (m.reactions || []).map((r) => `${r.emoji} (${r.userName})`).join(', ');
        const rxStr = rx ? `  [Reactions: ${rx}]` : '';

        txt += `[${time}] ${sender}: ${body}${rxStr}\n`;
      });

      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `limochat-${safeTitle}-${dateStr}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
    showAlertNotice('Chat Exported', `Successfully exported ${chatMsgs.length} messages for "${targetChat.name || 'Chat'}"`, 'primary');
  };

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChat,
        messages,
        communities,
        replyingTo,
        theme,
        wallpaper,
        enterIsSend,
        fontSize,
        setActiveChat,
        setReplyingTo,
        setTheme,
        setWallpaper,
        setEnterIsSend,
        setFontSize,
        sendMessage,
        sendSupportReply,
        deleteMessageForEveryone,
        deleteMessageForMe,
        deleteMessagesBulk,
        reactToMessage,
        toggleStarMessage,
        createDirectChat,
        startDirectChatWithContact,
        createGroup,
        createCommunity,
        searchUsers,
        getAllContacts,
        clearChatHistory,
        deleteChat,
        deleteContact,
        togglePinChat,
        markChatAsRead,
        markChatAsUnread,
        setTyping,
        updateGroupPermissions,
        showAlertNotice,
        exportChat,
      }}
    >
      {children}
      {appNotice && (
        <ConfirmModal
          isOpen={appNotice.isOpen}
          title={appNotice.title}
          description={appNotice.description}
          variant={appNotice.variant}
          confirmText={appNotice.confirmText || 'OK'}
          singleAction={true}
          onConfirm={() => setAppNotice(null)}
          onCancel={() => setAppNotice(null)}
        />
      )}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
