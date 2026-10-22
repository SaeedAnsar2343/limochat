import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ArrowLeft,
  ShieldCheck, 
  Copy, 
  Check, 
  UserPlus, 
  LogOut, 
  Ban, 
  Users, 
  Image as ImageIcon, 
  FileText,
  Lock,
  Trash2,
  Search,
  AlertTriangle,
  Phone,
  Video,
  Calendar,
  Star,
  MessageSquare,
  ExternalLink,
  Play,
  Pause,
  Mic,
  Download,
  Maximize2,
  ChevronRight,
  Shield,
  Crown,
  Camera,
  Edit2,
  MoreVertical,
  UserMinus,
  History
} from 'lucide-react';
import { Chat, UserProfile, Message, GroupPermissions } from '../../types';
import { Avatar } from '../common/Avatar';
import { ConfirmModal } from '../common/ConfirmModal';
import { formatTime, formatLastSeen } from '../../utils/formatters';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useChat } from '../../context/ChatContext';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';

interface ChatInfoDrawerProps {
  chat: Chat;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onBlockUser: (uid: string) => void;
  onUnblockUser: (uid: string) => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onOpenSearch: () => void;
  onOpenJumpToDate: () => void;
  onJumpToMessage: (messageId: string) => void;
  onViewMedia: (media: {
    url: string;
    type: 'image' | 'video' | 'file';
    senderName?: string;
    timestamp?: number;
    caption?: string;
    fileName?: string;
  }) => void;
  onToggleStarredFilter?: () => void;
  isFilteringStarred?: boolean;
}

type MediaFilterTab = 'media' | 'docs' | 'voice' | 'links';

export const ChatInfoDrawer: React.FC<ChatInfoDrawerProps> = ({
  chat,
  currentUser,
  isOpen,
  onClose,
  messages,
  onBlockUser,
  onUnblockUser,
  onStartAudioCall,
  onStartVideoCall,
  onOpenSearch,
  onOpenJumpToDate,
  onJumpToMessage,
  onViewMedia,
  onToggleStarredFilter,
  isFilteringStarred = false,
}) => {
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [copied, setCopied] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [availableContacts, setAvailableContacts] = useState<UserProfile[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState<UserProfile[]>([]);
  const [allowPastMessages, setAllowPastMessages] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [mediaTab, setMediaTab] = useState<MediaFilterTab>('media');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Editable Group Fields
  const [chatName, setChatName] = useState(chat.name || '');
  const [chatDescription, setChatDescription] = useState(chat.description || '');
  const [chatAvatar, setChatAvatar] = useState(chat.avatar || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescVal, setEditDescVal] = useState('');
  const [activeMemberMenuUid, setActiveMemberMenuUid] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChatName(chat.name || '');
    setChatDescription(chat.description || '');
    setChatAvatar(chat.avatar || '');
  }, [chat.id, chat.name, chat.description, chat.avatar]);

  const { updateGroupPermissions, deleteChat, deleteContact, getAllContacts, chats, exportChat } = useChat();

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

  const isGroupOwner = chat.createdBy === currentUser.uid;
  const isGroupAdmin = (chat.adminIds || []).includes(currentUser.uid) || isGroupOwner;
  const groupPerms: GroupPermissions = chat.permissions || {
    whoCanSendMessage: 'all',
    whoCanAddMembers: 'all',
    whoCanEditInfo: 'all',
    whoCanViewMembers: 'all',
  };

  const canEditGroup = chat.type !== 'direct' && (isGroupAdmin || groupPerms.whoCanEditInfo === 'all');
  const canAddMembers = chat.type !== 'direct' && (isGroupAdmin || groupPerms.whoCanAddMembers === 'all');

  const handleUpdatePerm = async (key: keyof GroupPermissions, val: 'all' | 'admins') => {
    const updated = { ...groupPerms, [key]: val };
    await updateGroupPermissions(chat.id, updated);
    RealtimeCoordinator.updateGroupInfo(chat.id, { permissions: updated }).catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;

    if (chat.type === 'direct') {
      const otherUid = chat.participants.find((p) => p !== currentUser.uid);
      if (otherUid) {
        getDoc(doc(db, 'users', otherUid)).then((snap) => {
          if (snap.exists()) setTargetUser(snap.data() as UserProfile);
        });
      }
    } else {
      // Load group participants
      Promise.all(
        chat.participants.map((pid) =>
          getDoc(doc(db, 'users', pid)).then((s) => (s.exists() ? (s.data() as UserProfile) : null))
        )
      ).then((list) => {
        setParticipants(list.filter((u): u is UserProfile => u !== null));
      });
    }
  }, [isOpen, chat.id, chat.type, currentUser.uid, chat.participants]);

  // Load available contacts when Add Member is opened
  useEffect(() => {
    if (showAddMember) {
      getAllContacts().then((contacts) => {
        setAvailableContacts(
          contacts.filter(
            (c) =>
              !chat.participants.includes(c.uid) &&
              c.uid !== currentUser.uid &&
              c.uid !== 'limochat_official_support' &&
              !(currentUser.blockedUsers || []).includes(c.uid) &&
              !(c.blockedUsers || []).includes(currentUser.uid)
          )
        );
      });
    }
  }, [showAddMember, chat.participants, currentUser.uid, currentUser.blockedUsers]);

  if (!isOpen) return null;

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveName = async () => {
    if (!editNameVal.trim()) return;
    const trimmed = editNameVal.trim();
    setChatName(trimmed);
    setIsEditingName(false);
    try {
      await updateDoc(doc(db, 'chats', chat.id), { name: trimmed });
      RealtimeCoordinator.updateGroupInfo(chat.id, { name: trimmed }).catch(() => {});
    } catch (err) {
      console.warn("Update group name error:", err);
    }
  };

  const handleSaveDescription = async () => {
    const trimmed = editDescVal.trim();
    setChatDescription(trimmed);
    setIsEditingDesc(false);
    try {
      await updateDoc(doc(db, 'chats', chat.id), { description: trimmed });
      RealtimeCoordinator.updateGroupInfo(chat.id, { description: trimmed }).catch(() => {});
    } catch (err) {
      console.warn("Update group description error:", err);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setChatAvatar(dataUrl);
      try {
        await updateDoc(doc(db, 'chats', chat.id), { avatar: dataUrl });
        RealtimeCoordinator.updateGroupInfo(chat.id, { avatar: dataUrl }).catch(() => {});
      } catch (err) {
        console.warn("Update group avatar error:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleSelectMemberToAdd = (user: UserProfile) => {
    if (selectedMembersToAdd.some((u) => u.uid === user.uid)) {
      setSelectedMembersToAdd((prev) => prev.filter((u) => u.uid !== user.uid));
    } else {
      setSelectedMembersToAdd((prev) => [...prev, user]);
    }
  };

  const handleConfirmAddMultipleMembers = async () => {
    if (selectedMembersToAdd.length === 0) return;
    try {
      setIsAddingMember(true);
      const newUids = selectedMembersToAdd.map((u) => u.uid);
      const newParticipants = Array.from(new Set([...chat.participants, ...newUids]));
      const now = Date.now();
      const updates: any = {
        participants: newParticipants,
      };

      const memberJoinedAtUpdates: Record<string, number> = { ...(chat.memberJoinedAt || {}) };
      const memberHistoryRestrictedUpdates: Record<string, boolean> = { ...(chat.memberHistoryRestricted || {}) };

      newUids.forEach((uid) => {
        const joinedTime = allowPastMessages ? 0 : now;
        updates[`memberJoinedAt.${uid}`] = joinedTime;
        updates[`memberHistoryRestricted.${uid}`] = !allowPastMessages;
        memberJoinedAtUpdates[uid] = joinedTime;
        memberHistoryRestrictedUpdates[uid] = !allowPastMessages;
      });

      await updateDoc(doc(db, 'chats', chat.id), updates);
      RealtimeCoordinator.updateGroupInfo(chat.id, {
        participants: newParticipants,
        memberJoinedAt: memberJoinedAtUpdates,
        memberHistoryRestricted: memberHistoryRestrictedUpdates,
      }).catch(() => {});

      setParticipants((prev) => [...prev, ...selectedMembersToAdd]);
      setAvailableContacts((prev) => prev.filter((c) => !newUids.includes(c.uid)));
      setSelectedMembersToAdd([]);
      setShowAddMember(false);
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Could Not Add Members",
        description: err.message || "Failed to add selected members to group.",
        variant: "warning",
        singleAction: true,
        confirmText: "OK",
        onConfirm: () => setConfirmConfig(null),
      });
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleMakeAdmin = async (targetUid: string) => {
    const newAdmins = Array.from(new Set([...(chat.adminIds || []), targetUid]));
    chat.adminIds = newAdmins;
    await updateDoc(doc(db, 'chats', chat.id), { adminIds: newAdmins }).catch(() => {});
    RealtimeCoordinator.updateGroupInfo(chat.id, { adminIds: newAdmins }).catch(() => {});
    setActiveMemberMenuUid(null);
  };

  const handleDismissAdmin = async (targetUid: string) => {
    const newAdmins = (chat.adminIds || []).filter((id) => id !== targetUid);
    chat.adminIds = newAdmins;
    await updateDoc(doc(db, 'chats', chat.id), { adminIds: newAdmins }).catch(() => {});
    RealtimeCoordinator.updateGroupInfo(chat.id, { adminIds: newAdmins }).catch(() => {});
    setActiveMemberMenuUid(null);
  };

  const handleMakeModerator = async (targetUid: string) => {
    const newMods = Array.from(new Set([...(chat.moderatorIds || []), targetUid]));
    chat.moderatorIds = newMods;
    await updateDoc(doc(db, 'chats', chat.id), { moderatorIds: newMods }).catch(() => {});
    RealtimeCoordinator.updateGroupInfo(chat.id, { moderatorIds: newMods }).catch(() => {});
    setActiveMemberMenuUid(null);
  };

  const handleDismissModerator = async (targetUid: string) => {
    const newMods = (chat.moderatorIds || []).filter((id) => id !== targetUid);
    chat.moderatorIds = newMods;
    await updateDoc(doc(db, 'chats', chat.id), { moderatorIds: newMods }).catch(() => {});
    RealtimeCoordinator.updateGroupInfo(chat.id, { moderatorIds: newMods }).catch(() => {});
    setActiveMemberMenuUid(null);
  };

  const handleRemoveMember = (targetUser: UserProfile) => {
    setActiveMemberMenuUid(null);
    setConfirmConfig({
      isOpen: true,
      title: `Remove "${targetUser.displayName}"?`,
      description: `They will no longer be part of this group and cannot send or receive messages.`,
      confirmText: "Remove Member",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        const newParticipants = chat.participants.filter((id) => id !== targetUser.uid);
        const newAdmins = (chat.adminIds || []).filter((id) => id !== targetUser.uid);
        const newMods = (chat.moderatorIds || []).filter((id) => id !== targetUser.uid);
        chat.participants = newParticipants;
        chat.adminIds = newAdmins;
        chat.moderatorIds = newMods;

        await updateDoc(doc(db, 'chats', chat.id), {
          participants: newParticipants,
          adminIds: newAdmins,
          moderatorIds: newMods,
        }).catch(() => {});

        RealtimeCoordinator.updateGroupInfo(chat.id, {
          participants: newParticipants,
          adminIds: newAdmins,
          moderatorIds: newMods,
        }).catch(() => {});

        setParticipants((prev) => prev.filter((p) => p.uid !== targetUser.uid));
        setAvailableContacts((prev) => [...prev, targetUser]);
      },
    });
  };

  const handleLeaveGroup = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Exit this group?",
      description: "You will no longer receive messages or calls from this group.",
      confirmText: "Exit Group",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        const chatRef = doc(db, 'chats', chat.id);
        await updateDoc(chatRef, {
          participants: arrayRemove(currentUser.uid),
        });
        onClose();
      },
    });
  };

  const isSupportChat =
    chat.id.startsWith('support_') ||
    targetUser?.uid === 'limochat_official_support' ||
    chat.participants?.includes('limochat_official_support');

  const handleDeleteContact = () => {
    if (!targetUser || isSupportChat) return;
    setConfirmConfig({
      isOpen: true,
      title: `Delete "${targetUser.displayName}"?`,
      description: "This will delete the conversation and permanently remove them from your contacts.",
      confirmText: "Delete Contact",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteContact(targetUser.uid);
        onClose();
      },
    });
  };

  const handleDeleteChat = () => {
    if (isSupportChat) return;
    setConfirmConfig({
      isOpen: true,
      title: "Delete this chat?",
      description: "All messages in this chat will be permanently deleted from your chats list.",
      confirmText: "Delete Chat",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteChat(chat.id);
        onClose();
      },
    });
  };

  // Extract shared media collections
  const imageVideoMessages = messages.filter(
    (m) => (m.type === 'image' || m.type === 'video') && m.mediaUrl
  );
  const docMessages = messages.filter((m) => m.type === 'file' && m.mediaUrl);
  const voiceMessages = messages.filter((m) => m.type === 'voice' && m.mediaUrl);
  const linkMessages = messages.filter(
    (m) => m.text && /(https?:\/\/[^\s]+)/gi.test(m.text)
  );

  const isTargetBlocked = targetUser ? (currentUser.blockedUsers || []).includes(targetUser.uid) : false;

  const filteredAvailableContacts = availableContacts.filter((c) => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase();
    return (
      c.displayName?.toLowerCase().includes(q) ||
      c.phoneNumber?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  // Calculate common groups for direct contact
  const commonGroups = chat.type === 'direct' && targetUser
    ? chats.filter((c) => c.type === 'group' && c.participants.includes(targetUser.uid))
    : [];

  const displayName = chat.type === 'direct' ? targetUser?.displayName || chat.name : chat.name;
  const avatarUrl = chat.type === 'direct' ? targetUser?.photoURL || chat.avatar : chat.avatar;

  const handleVoicePlayPause = (msgId: string, audioUrl: string) => {
    const existing = document.getElementById(`audio-elem-${msgId}`) as HTMLAudioElement;
    if (existing) {
      if (playingVoiceId === msgId) {
        existing.pause();
        setPlayingVoiceId(null);
      } else {
        existing.play();
        setPlayingVoiceId(msgId);
      }
    } else {
      const audio = new Audio(audioUrl);
      audio.id = `audio-elem-${msgId}`;
      audio.onended = () => setPlayingVoiceId(null);
      audio.play();
      setPlayingVoiceId(msgId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 md:static md:w-96 md:h-full w-full h-full bg-[#111b21] md:border-l border-[#2e3b44] flex flex-col flex-shrink-0 animate-slide-left overflow-y-auto contact-info-drawer select-none shadow-2xl">
      {/* Top Header */}
      <div className="pt-safe mobile-header-safe min-h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2e3b44] drawer-header flex-shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition cursor-pointer"
            title="Close Details"
          >
            <ArrowLeft className="w-5 h-5 md:hidden" />
            <X className="w-5 h-5 hidden md:block" />
          </button>
          <h3 className="font-bold text-white text-base">
            {chat.type === 'direct' ? 'Contact Details' : 'Group Information'}
          </h3>
        </div>

        {chat.type === 'direct' && targetUser && (
          <span className="text-[11px] font-mono text-[#00a884] bg-[#00a884]/15 px-2.5 py-1 rounded-full border border-[#00a884]/30 font-semibold">
            +991 Verified
          </span>
        )}
      </div>

      {/* Main Hero Card */}
      <div className="p-6 flex flex-col items-center border-b border-[#222e35] bg-[#111b21] text-center">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />

        <div className="relative mb-3">
          <div 
            className="relative group cursor-pointer"
            onClick={() => {
              if (avatarUrl) {
                onViewMedia({
                  url: avatarUrl,
                  type: 'image',
                  senderName: displayName,
                  caption: chat.type === 'direct' ? `${displayName}'s Profile Avatar` : `${displayName} Group Icon`,
                });
              }
            }}
            title="Click to view full photo"
          >
            <Avatar
              src={avatarUrl}
              name={displayName}
              size="xl"
              isOnline={chat.type === 'direct' ? targetUser?.isOnline : undefined}
            />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md">
              <Maximize2 className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Group Photo Edit Overlay */}
          {canEditGroup && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                avatarInputRef.current?.click();
              }}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white shadow-lg border-2 border-[#111b21] transition cursor-pointer active:scale-95"
              title="Change group photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Group or Direct Subject */}
        {isEditingName ? (
          <div className="flex items-center gap-1.5 w-full max-w-xs mt-1">
            <input
              type="text"
              value={editNameVal}
              onChange={(e) => setEditNameVal(e.target.value)}
              autoFocus
              placeholder="Group name..."
              className="bg-[#202c33] border border-[#00a884] rounded-xl px-2.5 py-1 text-sm text-white w-full focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveName}
              className="p-1.5 rounded-lg bg-[#00a884] text-white hover:bg-[#02906f] cursor-pointer"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingName(false)}
              className="p-1.5 rounded-lg bg-[#202c33] text-[#8696a0] hover:text-white cursor-pointer"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 max-w-full">
            <h2 className="text-lg sm:text-xl font-bold text-white truncate max-w-[280px]">
              {displayName}
            </h2>
            {canEditGroup && (
              <button
                type="button"
                onClick={() => {
                  setEditNameVal(displayName || '');
                  setIsEditingName(true);
                }}
                className="p-1 rounded-lg text-[#8696a0] hover:text-[#00a884] hover:bg-[#202c33] transition cursor-pointer"
                title="Edit group name"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Online / Last Seen status */}
        {chat.type === 'direct' && targetUser && (
          <div className="text-xs mt-1 flex items-center gap-1.5 font-medium">
            {targetUser.isOnline ? (
              <span className="text-[#00a884] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse" />
                Online
              </span>
            ) : (
              <span className="text-[#8696a0]">
                {formatLastSeen(false, targetUser.lastSeen, targetUser.privacy?.lastSeen) || 'Offline'}
              </span>
            )}
          </div>
        )}

        {/* Lifetime Virtual Telephone Line */}
        {chat.type === 'direct' && targetUser && (
          <div className="flex items-center gap-2 mt-2.5 text-xs text-[#00a884] bg-[#202c33] px-3.5 py-1.5 rounded-xl font-mono border border-[#2e3b44] shadow-inner">
            <ShieldCheck className="w-4 h-4 text-[#00a884]" />
            <span className="font-bold tracking-wide">{targetUser.phoneNumber}</span>
            <button
              onClick={() => handleCopyPhone(targetUser.phoneNumber)}
              className="ml-1.5 p-1 rounded hover:bg-[#111b21] text-[#8696a0] hover:text-white transition cursor-pointer"
              title="Copy virtual number"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Group Description */}
        {chat.type !== 'direct' && (
          isEditingDesc ? (
            <div className="w-full max-w-xs mt-2.5 space-y-1.5">
              <textarea
                value={editDescVal}
                onChange={(e) => setEditDescVal(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Group description..."
                className="w-full bg-[#202c33] border border-[#00a884] rounded-xl p-2 text-xs text-white focus:outline-none resize-none"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(false)}
                  className="px-2.5 py-1 rounded-lg text-xs text-[#8696a0] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDescription}
                  className="px-3 py-1 rounded-lg bg-[#00a884] text-white text-xs font-semibold hover:bg-[#02906f] cursor-pointer shadow"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 mt-2 max-w-xs">
              <p className="text-xs text-[#8696a0] leading-relaxed">
                {chatDescription || 'No description added yet.'}
              </p>
              {canEditGroup && (
                <button
                  type="button"
                  onClick={() => {
                    setEditDescVal(chatDescription);
                    setIsEditingDesc(true);
                  }}
                  className="p-1 rounded-lg text-[#8696a0] hover:text-[#00a884] hover:bg-[#202c33] transition flex-shrink-0 cursor-pointer"
                  title="Edit description"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        )}
      </div>

      {/* Modern iOS/WhatsApp Quick Action Ribbon */}
      <div className="px-4 py-3 border-b border-[#222e35] bg-[#182229] flex items-center justify-around text-xs">
        {chat.type === 'direct' && !isSupportChat && (
          <>
            <button
              onClick={() => {
                onClose();
                onStartAudioCall();
              }}
              disabled={isTargetBlocked}
              className="flex flex-col items-center gap-1 text-[#8696a0] hover:text-[#00a884] transition cursor-pointer disabled:opacity-40"
              title="Voice Call"
            >
              <div className="p-2.5 rounded-full bg-[#202c33] hover:bg-[#00a884]/20 border border-[#2e3b44] transition">
                <Phone className="w-4 h-4 text-[#00a884]" />
              </div>
              <span className="text-[11px] font-medium text-white">Audio</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onStartVideoCall();
              }}
              disabled={isTargetBlocked}
              className="flex flex-col items-center gap-1 text-[#8696a0] hover:text-[#00a884] transition cursor-pointer disabled:opacity-40"
              title="Video Call"
            >
              <div className="p-2.5 rounded-full bg-[#202c33] hover:bg-[#00a884]/20 border border-[#2e3b44] transition">
                <Video className="w-4 h-4 text-[#00a884]" />
              </div>
              <span className="text-[11px] font-medium text-white">Video</span>
            </button>
          </>
        )}

        <button
          onClick={() => {
            onClose();
            onOpenSearch();
          }}
          className="flex flex-col items-center gap-1 text-[#8696a0] hover:text-emerald-400 transition cursor-pointer"
          title="Search conversation"
        >
          <div className="p-2.5 rounded-full bg-[#202c33] hover:bg-emerald-500/20 border border-[#2e3b44] transition">
            <Search className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[11px] font-medium text-white">Search</span>
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenJumpToDate();
          }}
          className="flex flex-col items-center gap-1 text-[#8696a0] hover:text-blue-400 transition cursor-pointer"
          title="Jump to date"
        >
          <div className="p-2.5 rounded-full bg-[#202c33] hover:bg-blue-500/20 border border-[#2e3b44] transition">
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-[11px] font-medium text-white">Calendar</span>
        </button>

        {onToggleStarredFilter && (
          <button
            onClick={() => {
              onClose();
              onToggleStarredFilter();
            }}
            className="flex flex-col items-center gap-1 text-[#8696a0] hover:text-amber-400 transition cursor-pointer"
            title="Starred Messages"
          >
            <div className="p-2.5 rounded-full bg-[#202c33] hover:bg-amber-500/20 border border-[#2e3b44] transition">
              <Star className={`w-4 h-4 ${isFilteringStarred ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}`} />
            </div>
            <span className="text-[11px] font-medium text-white">Starred</span>
          </button>
        )}
      </div>

      {/* About Section for Direct Chat */}
      {chat.type === 'direct' && targetUser && (
        <div className="p-4 border-b border-[#222e35] bg-[#111b21] space-y-1">
          <div className="text-xs text-[#8696a0] font-semibold uppercase tracking-wider">About Bio</div>
          <p className="text-sm text-white leading-relaxed">{targetUser.about || 'Hey there! I am using LimoChat.'}</p>
        </div>
      )}

      {/* Shared Media, Links & Docs Hub with "View" and "Go to Message" */}
      <div className="p-4 border-b border-[#222e35] bg-[#111b21] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            Media, Files & Links
          </span>
          <span className="text-xs text-[#8696a0]">
            {imageVideoMessages.length + docMessages.length + voiceMessages.length + linkMessages.length} total
          </span>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-[#202c33] p-1 rounded-xl border border-[#2e3b44] text-xs">
          <button
            type="button"
            onClick={() => setMediaTab('media')}
            className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer ${
              mediaTab === 'media' ? 'bg-[#00a884] text-white shadow-sm' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            Media ({imageVideoMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setMediaTab('docs')}
            className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer ${
              mediaTab === 'docs' ? 'bg-[#00a884] text-white shadow-sm' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            Docs ({docMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setMediaTab('voice')}
            className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer ${
              mediaTab === 'voice' ? 'bg-[#00a884] text-white shadow-sm' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            Audio ({voiceMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setMediaTab('links')}
            className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer ${
              mediaTab === 'links' ? 'bg-[#00a884] text-white shadow-sm' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            Links ({linkMessages.length})
          </button>
        </div>

        {/* Media Grid (Photos & Videos) */}
        {mediaTab === 'media' && (
          imageVideoMessages.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {imageVideoMessages.map((m) => (
                <div key={m.id} className="relative group rounded-xl overflow-hidden aspect-square border border-[#2e3b44] bg-[#202c33]">
                  {m.type === 'video' ? (
                    <video src={m.mediaUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={m.mediaUrl} alt="Media" className="w-full h-full object-cover" />
                  )}

                  {/* Overlay on hover/touch */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                    <span className="text-[9px] text-[#8696a0] font-mono truncate">
                      {formatTime(m.timestamp)}
                    </span>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          onViewMedia({
                            url: m.mediaUrl!,
                            type: m.type as any,
                            senderName: m.senderName,
                            timestamp: m.timestamp,
                            caption: m.text,
                          });
                        }}
                        className="p-1 rounded bg-[#111b21]/80 hover:bg-[#00a884] text-white transition cursor-pointer"
                        title="View Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onJumpToMessage(m.id);
                        }}
                        className="p-1 rounded bg-[#00a884] hover:bg-[#02906f] text-white transition cursor-pointer flex items-center gap-0.5 text-[9px] font-medium"
                        title="Go to Message in Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#8696a0] italic">No photos or videos shared yet</div>
          )
        )}

        {/* Documents Tab */}
        {mediaTab === 'docs' && (
          docMessages.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {docMessages.map((m) => (
                <div key={m.id} className="p-2.5 bg-[#202c33] border border-[#2e3b44] rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{m.fileName || 'Attachment Document'}</div>
                      <div className="text-[10px] text-[#8696a0]">
                        {m.fileSize || 'Document'} • {formatTime(m.timestamp)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a
                      href={m.mediaUrl}
                      download={m.fileName || 'document'}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-[#111b21] hover:bg-[#2a3942] text-[#8696a0] hover:text-white transition"
                      title="Download document"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onJumpToMessage(m.id);
                      }}
                      className="p-1.5 rounded-lg bg-[#00a884]/20 hover:bg-[#00a884] text-[#00a884] hover:text-white transition cursor-pointer"
                      title="Go to message"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#8696a0] italic">No document files shared yet</div>
          )
        )}

        {/* Voice Notes Tab */}
        {mediaTab === 'voice' && (
          voiceMessages.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {voiceMessages.map((m) => (
                <div key={m.id} className="p-2.5 bg-[#202c33] border border-[#2e3b44] rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleVoicePlayPause(m.id, m.mediaUrl!)}
                      className="p-2 bg-[#00a884]/20 text-[#00a884] hover:bg-[#00a884] hover:text-white rounded-lg flex-shrink-0 transition cursor-pointer"
                    >
                      {playingVoiceId === m.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0">
                      <div className="text-white font-medium flex items-center gap-1">
                        <Mic className="w-3.5 h-3.5 text-[#00a884]" />
                        <span>Voice Note</span>
                      </div>
                      <div className="text-[10px] text-[#8696a0]">
                        {m.mediaDuration ? `${Math.round(m.mediaDuration)}s` : 'Audio'} • {formatTime(m.timestamp)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onJumpToMessage(m.id);
                    }}
                    className="p-1.5 rounded-lg bg-[#00a884]/20 hover:bg-[#00a884] text-[#00a884] hover:text-white transition cursor-pointer flex-shrink-0"
                    title="Go to message"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#8696a0] italic">No audio notes shared yet</div>
          )
        )}

        {/* Links Tab */}
        {mediaTab === 'links' && (
          linkMessages.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {linkMessages.map((m) => {
                const match = m.text?.match(/(https?:\/\/[^\s]+)/i);
                const url = match ? match[0] : '';
                return (
                  <div key={m.id} className="p-2.5 bg-[#202c33] border border-[#2e3b44] rounded-xl flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="text-emerald-400 font-medium truncate underline">{url}</div>
                      <div className="text-[10px] text-[#8696a0] truncate mt-0.5">{m.senderName} • {formatTime(m.timestamp)}</div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[#111b21] hover:bg-[#2a3942] text-[#8696a0] hover:text-white transition"
                        title="Open external link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onJumpToMessage(m.id);
                        }}
                        className="p-1.5 rounded-lg bg-[#00a884]/20 hover:bg-[#00a884] text-[#00a884] hover:text-white transition cursor-pointer"
                        title="Go to message"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#8696a0] italic">No web links shared yet</div>
          )
        )}
      </div>

      {/* End-to-End Cryptographic Security Indicator */}
      <div className="p-4 border-b border-[#222e35] bg-[#111b21]">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
          <div className="p-2 bg-emerald-500/20 text-[#00a884] rounded-xl flex-shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-white">End-to-End Encryption</h4>
            <p className="text-[11px] text-[#8696a0] mt-0.5 leading-relaxed">
              Messages and calls are encrypted peer-to-peer. Neither LimoChat nor third parties can read or listen.
            </p>
          </div>
        </div>
      </div>

      {/* Common Shared Groups (Direct Chat Only) */}
      {chat.type === 'direct' && targetUser && commonGroups.length > 0 && (
        <div className="p-4 border-b border-[#222e35] bg-[#111b21] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-white uppercase tracking-wider">
            <span>Groups in Common ({commonGroups.length})</span>
            <Users className="w-3.5 h-3.5 text-[#00a884]" />
          </div>
          <div className="space-y-1.5">
            {commonGroups.map((g) => (
              <div key={g.id} className="p-2 bg-[#202c33] rounded-xl border border-[#2e3b44] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar src={g.avatar} name={g.name} size="sm" />
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">{g.name}</div>
                    <div className="text-[10px] text-[#8696a0]">{g.participants.length} members</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Permissions & Admin Rules (For Group Admins) */}
      {chat.type !== 'direct' && isGroupAdmin && (
        <div className="p-4 border-b border-[#222e35] bg-[#111b21] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Shield className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Group Permissions & Admin Rules</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#8696a0]">Send Messages</span>
              <select
                value={groupPerms.whoCanSendMessage}
                onChange={(e) => handleUpdatePerm('whoCanSendMessage', e.target.value as any)}
                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00a884] cursor-pointer"
              >
                <option value="all">All Members</option>
                <option value="admins">Only Admins</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8696a0]">Edit Group Info (Name, Photo, Bio)</span>
              <select
                value={groupPerms.whoCanEditInfo || 'all'}
                onChange={(e) => handleUpdatePerm('whoCanEditInfo', e.target.value as any)}
                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00a884] cursor-pointer"
              >
                <option value="all">All Members</option>
                <option value="admins">Only Admins</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8696a0]">Add New Members</span>
              <select
                value={groupPerms.whoCanAddMembers}
                onChange={(e) => handleUpdatePerm('whoCanAddMembers', e.target.value as any)}
                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00a884] cursor-pointer"
              >
                <option value="all">All Members</option>
                <option value="admins">Only Admins</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8696a0]">View Member List</span>
              <select
                value={groupPerms.whoCanViewMembers}
                onChange={(e) => handleUpdatePerm('whoCanViewMembers', e.target.value as any)}
                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00a884] cursor-pointer"
              >
                <option value="all">All Members</option>
                <option value="admins">Only Admins</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Group Members Section */}
      {chat.type !== 'direct' && (
        <div className="p-4 border-b border-[#222e35] bg-[#111b21] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white font-semibold">
              {participants.length} Participants
            </span>
            {canAddMembers && (
              <button
                type="button"
                onClick={() => setShowAddMember(!showAddMember)}
                className="flex items-center gap-1 text-[#00a884] hover:underline cursor-pointer font-medium"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{showAddMember ? 'Cancel' : 'Add Members'}</span>
              </button>
            )}
          </div>

          {/* Multi-Select Add Members Box */}
          {showAddMember && (
            <div className="p-3.5 bg-[#202c33] rounded-2xl space-y-3 border border-[#2e3b44] animate-scale-in shadow-xl">
              <div className="text-xs font-semibold text-white flex items-center justify-between">
                <span>Add Members</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    setSelectedMembersToAdd([]);
                  }}
                  className="text-[#8696a0] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selected Contacts Chips */}
              {selectedMembersToAdd.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {selectedMembersToAdd.map((u) => (
                    <span
                      key={u.uid}
                      onClick={() => toggleSelectMemberToAdd(u)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-xs cursor-pointer hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 transition"
                      title="Click to remove"
                    >
                      <span className="truncate max-w-[120px]">{u.displayName}</span>
                      <X className="w-3 h-3 flex-shrink-0" />
                    </span>
                  ))}
                </div>
              )}

              {/* Past History Visibility Toggle */}
              <div className="p-2.5 bg-[#111b21] rounded-xl border border-[#2e3b44] space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-[#00a884]" />
                    <span className="text-xs font-semibold text-white">View Past Messages</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowPastMessages(!allowPastMessages)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                      allowPastMessages ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        allowPastMessages ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[10px] text-[#8696a0] leading-snug">
                  {allowPastMessages
                    ? "✓ New members can read previous group messages."
                    : "✗ Restricted: Members only see messages after joining."}
                </p>
              </div>

              {/* Search contacts input */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-2.5" />
                <input
                  type="text"
                  placeholder="Search contacts to add..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full bg-[#111b21] pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#2e3b44] text-white focus:outline-none focus:border-[#00a884]"
                />
              </div>

              {/* Contact list multi-select dropdown */}
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {filteredAvailableContacts.length > 0 ? (
                  filteredAvailableContacts.map((c) => {
                    const isSelected = selectedMembersToAdd.some((u) => u.uid === c.uid);
                    return (
                      <div
                        key={c.uid}
                        onClick={() => toggleSelectMemberToAdd(c)}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#00a884]/20 border border-[#00a884]/40'
                            : 'hover:bg-[#111b21] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar src={c.photoURL} name={c.displayName} size="sm" isOnline={c.isOnline} />
                          <div className="min-w-0">
                            <div className="text-xs text-white truncate font-medium">{c.displayName}</div>
                            <div className="text-[10px] text-[#8696a0] font-mono">{c.phoneNumber}</div>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition flex-shrink-0 ${
                            isSelected ? 'bg-[#00a884] border-[#00a884] text-white' : 'border-[#3b4a54]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-xs text-[#8696a0] italic">
                    {availableContacts.length === 0 ? "No more contacts to add" : "No matching contacts found"}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleConfirmAddMultipleMembers}
                disabled={selectedMembersToAdd.length === 0 || isAddingMember}
                className="w-full py-2 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 cursor-pointer shadow flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {isAddingMember
                    ? "Adding..."
                    : `Add ${selectedMembersToAdd.length || ''} Member${selectedMembersToAdd.length === 1 ? '' : 's'}`}
                </span>
              </button>
            </div>
          )}

          {groupPerms.whoCanViewMembers === 'admins' && !isGroupAdmin ? (
            <div className="py-4 text-center text-xs text-[#8696a0] italic bg-[#182229] rounded-xl border border-white/5">
              🔒 Member list is hidden by group administration.
            </div>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {participants.map((p) => {
                const isOwner = p.uid === (chat.createdBy || chat.adminIds?.[0]);
                const isAdmin = (chat.adminIds || []).includes(p.uid);
                const isMod = (chat.moderatorIds || []).includes(p.uid);
                const isSelf = p.uid === currentUser.uid;
                const canManageUser = (isGroupAdmin || isGroupOwner) && !isSelf && !isOwner;

                return (
                  <div
                    key={p.uid}
                    className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-[#182229] transition group relative"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Avatar src={p.photoURL} name={p.displayName} size="sm" isOnline={p.isOnline} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate flex items-center gap-1.5">
                          <span>{isSelf ? 'You' : p.displayName}</span>
                        </div>
                        <div className="text-[10px] text-[#8696a0] font-mono">{p.phoneNumber}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Badges */}
                      {isOwner && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-300" />
                          <span>Owner</span>
                        </span>
                      )}
                      {!isOwner && isAdmin && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00a884]/20 text-[#00a884] font-semibold border border-[#00a884]/30 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Admin</span>
                        </span>
                      )}
                      {isMod && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          <span>Mod</span>
                        </span>
                      )}

                      {/* Manage Member Menu Trigger */}
                      {canManageUser && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMemberMenuUid(activeMemberMenuUid === p.uid ? null : p.uid)
                            }
                            className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#202c33] transition cursor-pointer"
                            title="Member options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Dropdown Menu */}
                          {activeMemberMenuUid === p.uid && (
                            <div className="absolute right-0 top-8 z-50 bg-[#202c33] border border-[#2e3b44] rounded-2xl shadow-2xl py-1.5 w-48 text-xs animate-scale-in">
                              {isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => handleDismissAdmin(p.uid)}
                                  className="w-full px-3 py-2 text-left text-[#8696a0] hover:text-white hover:bg-[#111b21] flex items-center gap-2 cursor-pointer transition"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                                  <span>Dismiss as Admin</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMakeAdmin(p.uid)}
                                  className="w-full px-3 py-2 text-left text-white hover:bg-[#111b21] flex items-center gap-2 cursor-pointer transition"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
                                  <span>Make Group Admin</span>
                                </button>
                              )}

                              {isMod ? (
                                <button
                                  type="button"
                                  onClick={() => handleDismissModerator(p.uid)}
                                  className="w-full px-3 py-2 text-left text-[#8696a0] hover:text-white hover:bg-[#111b21] flex items-center gap-2 cursor-pointer transition"
                                >
                                  <Shield className="w-3.5 h-3.5 text-red-400" />
                                  <span>Dismiss Moderator</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMakeModerator(p.uid)}
                                  className="w-full px-3 py-2 text-left text-white hover:bg-[#111b21] flex items-center gap-2 cursor-pointer transition"
                                >
                                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Assign Moderator</span>
                                </button>
                              )}

                              <div className="h-[1px] bg-[#2e3b44] my-1" />

                              <button
                                type="button"
                                onClick={() => handleRemoveMember(p)}
                                className="w-full px-3 py-2 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer transition"
                              >
                                <UserMinus className="w-3.5 h-3.5 text-red-400" />
                                <span>Remove from Group</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom Danger & Management Actions */}
      <div className="p-4 space-y-2 bg-[#111b21] mt-auto border-t border-[#222e35] pb-safe">
        {/* Export Chat Action */}
        <div className="flex gap-2 w-full mb-1">
          <button
            type="button"
            onClick={() => exportChat(chat.id, 'txt')}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-[#00a884] flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export (.txt)</span>
          </button>
          <button
            type="button"
            onClick={() => exportChat(chat.id, 'json')}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-blue-400 flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export (.json)</span>
          </button>
        </div>

        {isSupportChat ? (
          <div className="p-3 bg-[#202c33] rounded-2xl border border-white/10 text-center space-y-1">
            <span className="text-xs font-semibold text-[#00a884] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#00a884]" /> Official Support Channel
            </span>
            <p className="text-[11px] text-[#8696a0]">
              Official LimoChat Support is permanent and cannot be deleted or blocked.
            </p>
          </div>
        ) : (
          <>
            {chat.type === 'direct' && targetUser && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isTargetBlocked) {
                      onUnblockUser(targetUser.uid);
                    } else {
                      onBlockUser(targetUser.uid);
                    }
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer border ${
                    isTargetBlocked
                      ? 'bg-gray-100 dark:bg-[#202c33] text-[#00a884] hover:bg-gray-200 dark:hover:bg-[#2a3942] border-gray-200 dark:border-[#2e3b44]'
                      : 'bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20 shadow-sm'
                  }`}
                >
                  <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>{isTargetBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteContact}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer border border-red-200 dark:border-red-500/20 shadow-sm"
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>Delete Contact</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDeleteChat}
              className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer border border-red-200 dark:border-red-500/20 shadow-sm"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span>Delete Conversation</span>
            </button>
          </>
        )}

        {chat.type !== 'direct' && (
          <button
            type="button"
            onClick={handleLeaveGroup}
            className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer border border-red-200 dark:border-red-500/20 shadow-sm"
          >
            <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span>Exit Group</span>
          </button>
        )}
      </div>

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
