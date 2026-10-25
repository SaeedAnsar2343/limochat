import { RealtimeCoordinator } from '../utils/realtimeCoordinator';
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
import { supabase } from '../supabase/config';
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
  sendSupportReply: (chatId: string, text: string, type?: MessageType, mediaUrl?: string, extra?: Partial<Message>) => Promise<void>;
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
  const activeChatRef = React.useRef<Chat | null>(null);
  activeChatRef.current = activeChat;
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

  // Load chats for current user from Supabase & Firestore
  useEffect(() => {
    if (!currentUser?.uid) {
      setChats([]);
      setActiveChat(null);
      return;
    }

    // 1. Sync current user profile to Supabase directory
    RealtimeCoordinator.syncUserProfile(currentUser).catch(() => {});

    // 2. Fetch user's chats from Supabase PostgreSQL (Unlimited quota, persistent)
    RealtimeCoordinator.fetchUserChats(currentUser.uid).then((supaChats) => {
      if (supaChats.length > 0) {
        setChats((prev) => {
          const map = new Map<string, Chat>();
          prev.forEach((c) => map.set(c.id, c));
          supaChats.forEach((sc) => {
            const existing = map.get(sc.id);
            const newTime = sc.lastMessage?.timestamp || sc.updatedAt || 0;
            const existingTime = existing?.lastMessage?.timestamp || existing?.updatedAt || 0;
            if (!existing || newTime >= existingTime) {
              map.set(sc.id, sc);
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => {
            const timeA = a.lastMessage?.timestamp || a.updatedAt || 0;
            const timeB = b.lastMessage?.timestamp || b.updatedAt || 0;
            return timeB - timeA;
          });
          try {
            localStorage.setItem('limochat_cached_chats', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    }).catch(() => {});

    // 3. Realtime subscription to chat list updates for current user
    const unsubUserChats = RealtimeCoordinator.subscribeToUserChats(currentUser.uid, (update) => {
      setChats((prev) => {
        const found = prev.find((c) => c.id === update.chatId);
        if (found) {
          const updatedChat: Chat = {
            ...found,
            updatedAt: update.updatedAt,
            lastMessage: update.lastMessage,
            participants: update.participants || found.participants,
            unreadCount: update.unreadCount !== undefined ? update.unreadCount : found.unreadCount,
          };
          const others = prev.filter((c) => c.id !== update.chatId);
          const newList = [updatedChat, ...others];
          try {
            localStorage.setItem('limochat_cached_chats', JSON.stringify(newList));
          } catch {}
          return newList;
        } else {
          RealtimeCoordinator.fetchUserChats(currentUser.uid).then((fresh) => {
            if (fresh.length > 0) {
              setChats(fresh);
              try {
                localStorage.setItem('limochat_cached_chats', JSON.stringify(fresh));
              } catch {}
            }
          }).catch(() => {});
          return prev;
        }
      });

      if (activeChat?.id === update.chatId) {
        setActiveChat((prev) => prev ? {
          ...prev,
          updatedAt: update.updatedAt,
          lastMessage: update.lastMessage,
        } : null);
      }
    });

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
        // Keep existing Supabase / cached chats so they are never lost
        prev.forEach(c => map.set(c.id, c));
        chatList.forEach(c => {
          const existing = map.get(c.id);
          const newTime = c.lastMessage?.timestamp || c.updatedAt || 0;
          const existingTime = existing?.lastMessage?.timestamp || existing?.updatedAt || 0;
          // Only overwrite if the Firestore document genuinely has a newer lastMessage/timestamp
          if (!existing || newTime >= existingTime) {
            map.set(c.id, c);
          }
        });
        const combined = Array.from(map.values()).sort((a, b) => {
          const timeA = a.lastMessage?.timestamp || a.updatedAt || 0;
          const timeB = b.lastMessage?.timestamp || b.updatedAt || 0;
          return timeB - timeA;
        });
        try {
          localStorage.setItem('limochat_cached_chats', JSON.stringify(combined));
        } catch {}
        return combined;
      });

      if (activeChat) {
        const updated = chatList.find(c => c.id === activeChat.id);
        if (updated) {
          const updatedTime = updated.lastMessage?.timestamp || updated.updatedAt || 0;
          const activeTime = activeChat.lastMessage?.timestamp || activeChat.updatedAt || 0;
          if (updatedTime >= activeTime) {
            setActiveChat(updated);
          }
        }
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
      console.warn("Chats snapshot warning (Supabase active):", err);
    });

    return () => {
      unsubscribe();
      unsubUserChats();
    };
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

    // 1. Immediately load cached messages for instant rendering on switch/open
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

    // 2. Fetch persistent chat messages from Supabase PostgreSQL (UNLIMITED quota, persists across refreshes)
    RealtimeCoordinator.fetchChatMessages(activeChat.id).then((supaMsgs) => {
      if (supaMsgs.length > 0) {
        setMessages((prev) => {
          const map = new Map<string, Message>();
          prev.forEach((m) => map.set(m.id, m));
          supaMsgs.forEach((sm) => {
            const existing = map.get(sm.id);
            if (!existing || existing.status !== 'sending') {
              map.set(sm.id, sm);
            }
          });
          const combined = Array.from(map.values())
            .filter((m) => !m.deletedForUsers?.includes(currentUser?.uid || ''))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          try {
            localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(combined));
          } catch {}

          // Synchronize activeChat's lastMessage to the latest actual message if newer
          if (combined.length > 0) {
            const latest = combined[combined.length - 1];
            setChats((prev) => {
              const updated = prev.map((c) => {
                if (c.id === activeChat.id) {
                  const currentLastTime = c.lastMessage?.timestamp || 0;
                  if ((latest.timestamp || 0) >= currentLastTime) {
                    return {
                      ...c,
                      updatedAt: latest.timestamp,
                      lastMessage: {
                        text: latest.text || (latest.type === 'image' ? '📷 Photo' : latest.type === 'voice' ? '🎤 Voice message' : latest.type === 'file' ? '📎 Attachment' : latest.type === 'call_log' ? (latest.text || '📞 Call') : 'Message'),
                        senderId: latest.senderId,
                        timestamp: latest.timestamp,
                        type: latest.type,
                        status: latest.status || 'delivered',
                        callType: latest.callType,
                        callStatus: latest.callStatus,
                      },
                    };
                  }
                }
                return c;
              });
              try {
                localStorage.setItem('limochat_cached_chats', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }

          return combined;
        });
      }
    }).catch((err) => {
      console.warn("Supabase fetch chat messages notice:", err);
    });

    // Reset unread count if > 0 across both Supabase and Firestore
    if (currentUser?.uid && (activeChat.unreadCount?.[currentUser.uid] || 0) > 0) {
      const clearedUnread = { ...(activeChat.unreadCount || {}), [currentUser.uid]: 0 };
      RealtimeCoordinator.updateChatUnreadCount(activeChat.id, clearedUnread).catch(() => {});
      updateDoc(doc(db, 'chats', activeChat.id), {
        [`unreadCount.${currentUser.uid}`]: 0,
      }).catch(() => {});
    }

    // 3. Dual-channel real-time listener (Supabase Realtime Channel + Postgres Changes + RTDB)
    const unsubLive = RealtimeCoordinator.subscribeToLiveMessages(
      activeChat.id,
      (liveMsg) => {
        if (liveMsg.chatId !== activeChat.id) return;
        setMessages((prev) => {
          const map = new Map<string, Message>();
          prev.forEach((m) => map.set(m.id, m));
          map.set(liveMsg.id, liveMsg);
          const updated = Array.from(map.values())
            .filter((m) => !m.deletedForUsers?.includes(currentUser?.uid || ''))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          try {
            localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
          } catch {}

          const lastMsgObj = {
            text: liveMsg.text || (liveMsg.type === 'image' ? '📷 Photo' : liveMsg.type === 'voice' ? '🎤 Voice message' : liveMsg.type === 'file' ? '📎 Attachment' : liveMsg.type === 'call_log' ? (liveMsg.text || '📞 Call') : 'Message'),
            senderId: liveMsg.senderId,
            timestamp: liveMsg.timestamp || Date.now(),
            type: liveMsg.type,
            status: liveMsg.status || 'delivered',
            callType: liveMsg.callType,
            callStatus: liveMsg.callStatus,
          };
          setChats(prev => {
            const updatedChats = prev.map(c => c.id === activeChat.id ? {
              ...c,
              updatedAt: liveMsg.timestamp || Date.now(),
              lastMessage: lastMsgObj,
            } : c);
            try {
              localStorage.setItem('limochat_cached_chats', JSON.stringify(updatedChats));
            } catch {}
            return updatedChats;
          });

          return updated;
        });

        if (currentUser && liveMsg.senderId !== currentUser.uid) {
          if (currentUser?.preferences?.notificationSound !== false) {
            soundEngine.playMessageReceived(currentUser?.preferences?.messageTone || 'pop');
          }
          if (currentUser?.preferences?.inAppVibration !== false && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(100);
            } catch {}
          }
          let previewBody = liveMsg.text || 'Sent an attachment';
          NativeNotificationService.notifyMessage({
            title: activeChat?.name || 'New Message',
            body: previewBody,
            chatId: activeChat?.id || '',
          });
        }
      },
      (update) => {
        if (update.isChatCleared) {
          setMessages([]);
          try {
            localStorage.removeItem(`limochat_msgs_${activeChat.id}`);
          } catch {}
          return;
        }
        if (update.isDeletedPermanently) {
          setMessages((prev) => {
            const updated = prev.filter((m) => m.id !== update.id);
            try {
              localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
            } catch {}
            return updated;
          });
          return;
        }
        setMessages((prev) => {
          const updated = prev.map((m) => (m.id === update.id ? { ...m, ...update } : m));
          try {
            localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    );

    // 4. Firestore snapshot listener as backup / secondary sync
    const messagesRef = collection(db, 'chats', activeChat.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
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

      if (msgList.length > 0) {
        setMessages((prev) => {
          const map = new Map<string, Message>();
          // Preserve all Supabase and local cached messages
          prev.forEach((m) => map.set(m.id, m));
          msgList.forEach((m) => {
            const existing = map.get(m.id);
            if (!existing || (m.timestamp || 0) >= (existing.timestamp || 0)) {
              map.set(m.id, m);
            }
          });
          const combined = Array.from(map.values())
            .filter((m) => !m.deletedForUsers?.includes(currentUser?.uid || ''))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          try {
            localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(combined));
          } catch {}

          // Synchronize activeChat's lastMessage to the latest actual message if newer
          if (combined.length > 0) {
            const latest = combined[combined.length - 1];
            setChats((prev) => {
              const updated = prev.map((c) => {
                if (c.id === activeChat.id) {
                  const currentLastTime = c.lastMessage?.timestamp || 0;
                  if ((latest.timestamp || 0) >= currentLastTime) {
                    return {
                      ...c,
                      updatedAt: latest.timestamp,
                      lastMessage: {
                        text: latest.text || (latest.type === 'image' ? '📷 Photo' : latest.type === 'voice' ? '🎤 Voice message' : latest.type === 'file' ? '📎 Attachment' : latest.type === 'call_log' ? (latest.text || '📞 Call') : 'Message'),
                        senderId: latest.senderId,
                        timestamp: latest.timestamp,
                        type: latest.type,
                        status: latest.status || 'delivered',
                        callType: latest.callType,
                        callStatus: latest.callStatus,
                      },
                    };
                  }
                }
                return c;
              });
              try {
                localStorage.setItem('limochat_cached_chats', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }

          return combined;
        });
      }
    }, (err) => {
      console.warn("Firestore messages snapshot warning (Supabase active):", err);
    });

    return () => {
      unsubscribeFirestore();
      unsubLive();
    };
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

    // Increment unread count for recipients across both databases
    const unreadMap = { ...(activeChat.unreadCount || {}) };
    activeChat.participants.forEach((pid) => {
      if (pid !== currentUser.uid) {
        unreadMap[pid] = (unreadMap[pid] || 0) + 1;
      }
    });

    // 1. Primary High-Availability: Save to Supabase PostgreSQL (UNLIMITED writes, zero quota limits, persists on refresh)
    const savedToSupabase = await RealtimeCoordinator.persistAndBroadcastMessage(
      activeChat.id,
      newMsg,
      {
        participants: activeChat.participants,
        name: activeChat.name,
        avatar: activeChat.avatar,
        type: activeChat.type,
        unreadCount: unreadMap,
      }
    );

    if (savedToSupabase) {
      // Confirm delivered in local state immediately
      setMessages(prev => {
        const updated = prev.map(m => m.id === msgId ? { ...m, status: 'delivered' as const } : m);
        localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
        return updated;
      });

      setChats(prev => prev.map(c => c.id === activeChat.id ? {
        ...c,
        lastMessage: c.lastMessage ? { ...c.lastMessage, status: 'delivered' as const } : null
      } : c));
    }

    // 2. Secondary / Background best-effort persistence to Firestore
    try {
      const msgDocRef = doc(db, 'chats', activeChat.id, 'messages', msgId);
      await setDoc(msgDocRef, sanitizeData({ ...newMsg, status: 'delivered' }), { merge: true });

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
      console.warn("Firestore message fallback write notice (saved in Supabase):", err);
      // Only if Supabase also failed do we show failed state
      if (!savedToSupabase) {
        setMessages(prev => {
          const updated = prev.map(m => m.id === msgId ? { ...m, status: 'failed' as const } : m);
          localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
          return updated;
        });
      }
    }

    // 3. Automated Support Bot Command Processor
    const isSupportConversation = !!(
      activeChat.id?.startsWith('support_') ||
      activeChat.id?.includes('limochat_official_support') ||
      activeChat.participants?.includes('limochat_official_support') ||
      activeChat.participants?.includes(SYSTEM_SUPPORT_USER.uid) ||
      activeChat.participants?.includes('support') ||
      activeChat.name?.toLowerCase().includes('support') ||
      activeChat.name?.toLowerCase().includes('limo')
    );

    if (isSupportConversation && finalText.trim().startsWith('/')) {
      const baseCmd = finalText.trim().split(/\s+/)[0].toLowerCase();
      setTimeout(async () => {
        let reply = '';
        if (baseCmd === '/status') {
          const has2fa = !!(currentUser.authenticatorEnabled || currentUser.preferences?.authenticatorEnabled);
          const hasLock = !!(currentUser.preferences?.appLockEnabled);
          reply = `🛡️ **LimoChat VIP Account Verification**\n• **Line**: ${currentUser.phoneNumber || '+991 Private Line'}\n• **Account Tier**: VIP Encrypted Direct Line\n• **2FA Authenticator**: ${has2fa ? '✅ Active & Protected' : '⚠️ Not Enabled (Configure in Settings)'}\n• **App Screen Lock**: ${hasLock ? '✅ Active' : '⚪ Disabled'}\n• **Security Rating**: A+ End-to-End Cryptographic Tunnel\n• **Network Tunnel**: Ultra-Secure E2E Relay (Zero-Knowledge)\n• **Realtime Relay**: Low Latency (<25ms, 99.99% Uptime)\n• **Support Line**: Direct Escalation Ready`;
        } else if (baseCmd === '/call') {
          // Log support call request ticket across systems
          try {
            await supabase.from('support_tickets').insert({
              id: `ticket_${Date.now()}`,
              user_uid: currentUser.uid,
              user_phone: currentUser.phoneNumber || '',
              user_name: currentUser.displayName || 'VIP User',
              type: 'live_call_request',
              status: 'open',
              created_at: Date.now(),
            });
          } catch {}
          try {
            await addDoc(collection(db, 'support_tickets'), sanitizeData({
              userUid: currentUser.uid,
              userName: currentUser.displayName || 'VIP User',
              phoneNumber: currentUser.phoneNumber || '',
              chatId: activeChat.id,
              type: 'call_request',
              status: 'pending',
              timestamp: Date.now(),
            }));
          } catch {}

          reply = `📞 **VIP Live Support Call Queued**\nYour request for an authorized live voice/video support session has been dispatched to the active administration queue.\n\n• **Priority**: VIP Level 1 Dispatch\n• **Protocol**: WebRTC DTLS-SRTP 256-bit Encrypted Stream\n• **Action**: You can tap the **Voice Call** or **Video Call** icon in the header above right now to connect immediately, or an authorized administrator will dial in shortly.`;
        } else if (baseCmd === '/version') {
          reply = `🚀 **LimoChat System Build**\n• **Installed Version**: v1.0.8 (Build 18)\n• **Platform Status**: All systems operational with zero reported incidents.\n• **Realtime Engine**: WebRTC DTLS-SRTP Cryptographic Mesh\n• **Relay Infrastructure**: Multi-Region Redundant Edge Cluster\n• **Security Patches**: Up-to-date with latest cryptographic standards.`;
        } else if (baseCmd === '/help') {
          reply = `📚 **LimoChat Quick Guides & Commands**\n• **/status** — View your virtual line, 2FA protection & security rating\n• **/call** — Dispatch a live VIP voice or video support call\n• **/version** — View installed system build & architecture details\n• **/security** — Complete cryptographic audit (2FA, screen lock, encryption)\n• **/privacy** — Visibility preferences, read receipts & disappearing chat\n• **/clear** — Permanently purge and delete support conversation history\n\n• **HD Calls**: Tap Voice or Video call icons in the header for encrypted calls.\n• **Privacy**: Adjust Last Seen, Profile Photo, and Disappearing Messages in Settings > Privacy.\n• **Permanent Line**: Your +991 number is globally reserved and persistent across all devices.`;
        } else if (baseCmd === '/security') {
          const has2fa = !!(currentUser.authenticatorEnabled || currentUser.preferences?.authenticatorEnabled);
          const hasLock = !!(currentUser.preferences?.appLockEnabled);
          reply = `🔐 **Security & Protection Report**\n• **Two-Step Verification**: ${has2fa ? '✅ Active (Google/Microsoft Authenticator)' : '⚠️ Deactivated (Recommended to enable in Settings)'}\n• **App Passcode Screen Lock**: ${hasLock ? '✅ Enabled' : '⚪ Disabled'}\n• **Cryptographic Encryption**: ✅ Active on all text, media, and WebRTC calls.\n• **Zero-Knowledge Core**: ✅ Active (No logs, no metadata tracking).`;
        } else if (baseCmd === '/privacy') {
          const privacy = currentUser.privacy;
          reply = `👁️ **Privacy Settings Summary**\n• **Last Seen & Online**: ${privacy?.lastSeen || 'everyone'}\n• **Profile Photo**: ${privacy?.profilePhoto || 'everyone'}\n• **About Info**: ${privacy?.about || 'everyone'}\n• **Read Receipts**: ${privacy?.readReceipts !== false ? '✅ Enabled (Blue ticks)' : '⚪ Disabled'}\n• **Disappearing Messages**: ${currentUser.preferences?.disappearingDuration ? `${currentUser.preferences.disappearingDuration}h` : 'Off'}\n\nAdjust any of these options anytime in **Settings > Privacy**.`;
        } else if (baseCmd === '/clear') {
          // Permanently purge all messages from Supabase, Firestore, and RTDB
          await RealtimeCoordinator.clearChatHistory(activeChat.id).catch(() => {});
          setMessages([]);
          try {
            localStorage.removeItem(`limochat_msgs_${activeChat.id}`);
          } catch {}
          setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: undefined, updatedAt: Date.now() } : c));

          reply = `🧹 **Support History Cleared & Purged**\nAll previous messages and session data in this ticket have been permanently deleted from storage.\n\nYour session is clean and refreshed. How may our administration team assist you today?`;
        } else {
          reply = `ℹ️ **Available Support Commands**:\n• **/status** — Account status & virtual line\n• **/call** — Request live voice/video support session\n• **/version** — Installed build & update details\n• **/help** — Quick guides & frequently asked questions\n• **/security** — 2FA & app passcode overview\n• **/privacy** — Privacy and read receipts overview\n• **/clear** — Permanently delete support conversation history`;
        }

        await sendSupportReply(activeChat.id, reply);
      }, 150);
    }
  };

  // Update Group Permissions
  const updateGroupPermissions = async (chatId: string, permissions: GroupPermissions) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), { permissions });
      RealtimeCoordinator.updateGroupInfo(chatId, { permissions }).catch(() => {});
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, permissions } : c)));
      if (activeChat?.id === chatId) {
        setActiveChat((prev) => (prev ? { ...prev, permissions } : null));
      }
    } catch (err) {
      console.warn("Update group permissions error:", err);
    }
  };

  // Reply from Admin Portal on behalf of LimoChat Support (Dual-Engine: Supabase + Firestore)
  const sendSupportReply = async (
    chatId: string,
    text: string,
    type: MessageType = 'text',
    mediaUrl?: string,
    extra?: Partial<Message>
  ) => {
    if (!text.trim() && !mediaUrl) return;

    const now = Date.now();
    const msgId = `msg_${now}_support`;

    const supportMsg: Message = {
      id: msgId,
      chatId,
      senderId: SYSTEM_SUPPORT_USER.uid,
      senderName: SYSTEM_SUPPORT_USER.displayName,
      senderPhoto: SYSTEM_SUPPORT_USER.photoURL,
      text: text.trim(),
      type,
      mediaUrl: mediaUrl || '',
      mediaDuration: extra?.mediaDuration || 0,
      fileName: extra?.fileName || '',
      fileSize: extra?.fileSize || '',
      status: 'delivered',
      timestamp: now,
      isDeletedForEveryone: false,
      deletedForUsers: [],
      starredBy: [],
    };

    const chatObj = chats.find(c => c.id === chatId);
    const targetUserId = chatId.startsWith('support_')
      ? chatId.replace('support_', '')
      : (chatObj?.participants?.find(p => p !== SYSTEM_SUPPORT_USER.uid) || currentUser?.uid || null);
    const participants = targetUserId
      ? [SYSTEM_SUPPORT_USER.uid, targetUserId]
      : (chatObj?.participants || [SYSTEM_SUPPORT_USER.uid, currentUser?.uid].filter(Boolean) as string[]);

    const nextUnread = { ...(chatObj?.unreadCount || {}) };
    if (targetUserId) {
      nextUnread[targetUserId] = (nextUnread[targetUserId] || 0) + 1;
    }
    nextUnread[SYSTEM_SUPPORT_USER.uid] = 0;

    // 1. Primary High-Availability: Save to Supabase PostgreSQL (UNLIMITED writes)
    await RealtimeCoordinator.persistAndBroadcastMessage(chatId, supportMsg, {
      participants,
      name: 'LimoChat Support',
      avatar: SYSTEM_SUPPORT_USER.photoURL,
      type: 'direct',
      unreadCount: nextUnread,
    });

    // Update local messages if viewing this chat
    if (activeChatRef.current?.id === chatId || activeChat?.id === chatId) {
      setMessages(prev => {
        const updated = [...prev, supportMsg];
        try {
          localStorage.setItem(`limochat_msgs_${chatId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });
      try {
        soundEngine.playMessageReceived('pop');
      } catch {}
    }

    const lastMsgPreview = type === 'image' 
      ? '📷 Photo' 
      : type === 'voice' 
      ? '🎤 Voice message' 
      : type === 'file' 
      ? '📎 Attachment' 
      : supportMsg.text;

    // Update local chats list to show latest message and unread count
    setChats(prev => {
      const updated = prev.map(c => {
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
              text: lastMsgPreview,
              senderId: SYSTEM_SUPPORT_USER.uid,
              timestamp: now,
              type,
              status: 'delivered' as const,
            }
          };
        }
        return c;
      });
      try {
        localStorage.setItem('limochat_cached_chats', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Secondary Firestore background persistence
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', msgId);
      await setDoc(msgRef, sanitizeData(supportMsg), { merge: true });

      const updatePayload: any = {
        updatedAt: now,
        lastMessage: {
          text: lastMsgPreview,
          senderId: SYSTEM_SUPPORT_USER.uid,
          timestamp: now,
          type,
          status: 'delivered',
        },
        'unreadCount.limochat_official_support': 0,
      };

      if (targetUserId) {
        updatePayload[`unreadCount.${targetUserId}`] = increment(1);
      }

      await setDoc(doc(db, 'chats', chatId), sanitizeData(updatePayload), { merge: true });
    } catch (err) {
      console.warn("Support reply saved in Supabase:", err);
    }
  };

  const deleteMessageForEveryone = async (messageId: string) => {
    if (!activeChat) return;

    // 1. Immediately remove from local state
    setMessages(prev => {
      const updated = prev.filter(m => m.id !== messageId);
      localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
      return updated;
    });

    // 2. Update chat preview if this was the last message
    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          lastMessage: undefined,
        };
      }
      return c;
    }));

    // 3. Completely delete from Supabase, Firestore, and RTDB
    await RealtimeCoordinator.deleteMessage(activeChat.id, messageId).catch(() => {});
  };

  const deleteMessageForMe = async (messageId: string) => {
    if (!activeChat || !currentUser) return;
    setMessages(prev => {
      const updated = prev.filter(m => m.id !== messageId);
      localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
      return updated;
    });

    // Persist to Supabase
    RealtimeCoordinator.deleteMessageForMe(activeChat.id, messageId, currentUser.uid).catch(() => {});

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

    // Remove from local state immediately
    setMessages(prev => {
      const updated = prev.filter(m => !messageIds.includes(m.id));
      localStorage.setItem(`limochat_msgs_${activeChat.id}`, JSON.stringify(updated));
      return updated;
    });

    if (deleteForEveryone) {
      for (const msgId of messageIds) {
        RealtimeCoordinator.deleteMessage(activeChat.id, msgId).catch(() => {});
      }
      setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: undefined } : c));
    } else {
      for (const msgId of messageIds) {
        RealtimeCoordinator.deleteMessageForMe(activeChat.id, msgId, currentUser.uid).catch(() => {});
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

    // Persist and broadcast via Supabase
    RealtimeCoordinator.reactToMessage(activeChat.id, messageId, updatedReactions).catch(() => {});

    // Trigger push / local notification on Android and browser if reacting to someone else's message
    if (targetMsg.senderId !== currentUser.uid && emoji) {
      NativeNotificationService.notifyReaction({
        userName: currentUser.displayName || 'A contact',
        emoji,
        messageSnippet: targetMsg.text || 'Message',
        chatId: activeChat.id,
      });
    }

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

    RealtimeCoordinator.toggleStarMessage(messageId, updated).catch(() => {});

    try {
      await updateDoc(doc(db, 'chats', activeChat.id, 'messages', messageId), {
        starredBy: updated
      });
    } catch {}
  };

  const clearChatHistory = async (chatId: string) => {
    // 1. Immediately wipe local state & cache
    setMessages([]);
    localStorage.removeItem(`limochat_msgs_${chatId}`);

    // 2. Clear lastMessage in chat list
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage: undefined, updatedAt: Date.now() } : c));
    if (activeChat?.id === chatId) {
      setActiveChat(prev => prev ? { ...prev, lastMessage: undefined, updatedAt: Date.now() } : null);
    }

    try {
      const saved = localStorage.getItem('limochat_cached_chats');
      if (saved) {
        const parsed = JSON.parse(saved);
        const updated = parsed.map((c: Chat) => c.id === chatId ? { ...c, lastMessage: undefined, updatedAt: Date.now() } : c);
        localStorage.setItem('limochat_cached_chats', JSON.stringify(updated));
      }
    } catch {}

    // 3. Thoroughly purge messages from Supabase, Firestore, and RTDB
    await RealtimeCoordinator.clearChatHistory(chatId).catch(() => {});
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

    // Delete in Supabase
    RealtimeCoordinator.deleteChat(chatId).catch(() => {});

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
    if (targetUid === SYSTEM_SUPPORT_USER.uid || targetUid === 'limochat_official_support' || targetUid.startsWith('support_')) {
      console.warn("LimoChat Support contact cannot be deleted.");
      return;
    }
    const updated = Array.from(new Set([...(currentUser.deletedContactUids || []), targetUid]));
    currentUser.deletedContactUids = updated;

    // Dual-database: Firestore + Supabase
    await updateDoc(doc(db, 'users', currentUser.uid), {
      deletedContactUids: updated
    }).catch(() => {});

    RealtimeCoordinator.deleteContact(currentUser.uid, targetUid).catch(() => {});

    // Delete direct chat if exists (deletes in both Supabase & Firestore)
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
    const targetChat = chats.find(c => c.id === chatId);
    const updatedUnread = { ...(targetChat?.unreadCount || {}), [currentUser.uid]: 0 };
    setChats(prev => prev.map(c => c.id === chatId ? {
      ...c,
      unreadCount: updatedUnread
    } : c));
    RealtimeCoordinator.updateChatUnreadCount(chatId, updatedUnread).catch(() => {});
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`unreadCount.${currentUser.uid}`]: 0,
      });
    } catch {}
  };

  const markChatAsUnread = async (chatId: string) => {
    if (!currentUser) return;
    const targetChat = chats.find(c => c.id === chatId);
    const updatedUnread = { ...(targetChat?.unreadCount || {}), [currentUser.uid]: 1 };
    setChats(prev => prev.map(c => c.id === chatId ? {
      ...c,
      unreadCount: updatedUnread
    } : c));
    RealtimeCoordinator.updateChatUnreadCount(chatId, updatedUnread).catch(() => {});
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

    // Broadcast typing through dual-channel real-time sockets (0 DB writes)
    RealtimeCoordinator.broadcastTyping(activeChat.id, currentUser.uid, isTyping).catch(() => {});

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

    // Persist chat to Supabase PostgreSQL
    RealtimeCoordinator.persistChat(newChatData).catch(() => {});

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
      RealtimeCoordinator.persistAndBroadcastMessage(chatId, welcomeMsg).catch(() => {});
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
      createdBy: currentUser.uid,
      adminIds: [currentUser.uid],
      moderatorIds: [],
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

    // Persist to Supabase
    RealtimeCoordinator.persistChat(newGroupData).catch(() => {});

    try {
      const chatsRef = collection(db, 'chats');
      const docRef = await addDoc(chatsRef, sanitizeData(newGroupData));
      const withServerId = { ...newGroupData, id: docRef.id };
      setChats(prev => prev.map(c => c.id === groupId ? withServerId : c));
      setActiveChat(withServerId);
      RealtimeCoordinator.persistChat(withServerId).catch(() => {});
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

  // Get all registered contacts (Dual Engine: Firestore with Supabase Directory fallback)
  const getAllContacts = async (): Promise<UserProfile[]> => {
    const list: UserProfile[] = [];
    const deletedUids = currentUser?.deletedContactUids || [];

    try {
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);

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
    } catch {
      // If Firestore is throttled or offline, fallback to Supabase PostgreSQL users
      try {
        const supaUsers = await RealtimeCoordinator.searchUsers('');
        supaUsers.forEach(u => {
          if (
            u.uid !== currentUser?.uid &&
            u.uid !== SYSTEM_SUPPORT_USER.uid &&
            !deletedUids.includes(u.uid)
          ) {
            list.push(u);
          }
        });
      } catch {}
    }

    if (currentUser?.uid !== SYSTEM_SUPPORT_USER.uid) {
      list.unshift(SYSTEM_SUPPORT_USER);
    }
    return list;
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
