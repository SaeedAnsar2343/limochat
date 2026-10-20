import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Copy, 
  Check, 
  UserPlus, 
  LogOut, 
  Ban, 
  Users, 
  Image, 
  FileText,
  Lock,
  Trash2,
  Search,
  AlertTriangle
} from 'lucide-react';
import { Chat, UserProfile, Message, GroupPermissions } from '../../types';
import { Avatar } from '../common/Avatar';
import { ConfirmModal } from '../common/ConfirmModal';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useChat } from '../../context/ChatContext';

interface ChatInfoDrawerProps {
  chat: Chat;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onBlockUser: (uid: string) => void;
  onUnblockUser: (uid: string) => void;
}

export const ChatInfoDrawer: React.FC<ChatInfoDrawerProps> = ({
  chat,
  currentUser,
  isOpen,
  onClose,
  messages,
  onBlockUser,
  onUnblockUser,
}) => {
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [copied, setCopied] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [availableContacts, setAvailableContacts] = useState<UserProfile[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState<UserProfile | null>(null);
  const [allowPastMessagesForMember, setAllowPastMessagesForMember] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const { updateGroupPermissions, deleteChat, deleteContact, getAllContacts } = useChat();

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

  const isGroupAdmin = chat.adminIds?.includes(currentUser.uid);
  const groupPerms: GroupPermissions = chat.permissions || {
    whoCanSendMessage: 'all',
    whoCanAddMembers: 'all',
    whoCanEditInfo: 'all',
    whoCanViewMembers: 'all',
  };

  const handleUpdatePerm = async (key: keyof GroupPermissions, val: 'all' | 'admins') => {
    const updated = { ...groupPerms, [key]: val };
    await updateGroupPermissions(chat.id, updated);
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

  const handleInitiateAddContact = (userToAdd: UserProfile) => {
    setMemberToAdd(userToAdd);
    setAllowPastMessagesForMember(true);
  };

  const handleConfirmAddContact = async () => {
    if (!memberToAdd) return;
    const userToAdd = memberToAdd;
    try {
      setIsAddingMember(true);
      const chatRef = doc(db, 'chats', chat.id);
      const now = Date.now();
      const updates: any = {
        participants: arrayUnion(userToAdd.uid),
      };
      updates[`memberJoinedAt.${userToAdd.uid}`] = allowPastMessagesForMember ? 0 : now;
      updates[`memberHistoryRestricted.${userToAdd.uid}`] = !allowPastMessagesForMember;

      await updateDoc(chatRef, updates);
      setParticipants((prev) => [...prev, userToAdd]);
      setAvailableContacts((prev) => prev.filter((c) => c.uid !== userToAdd.uid));
      setMemberToAdd(null);
    } catch (err: any) {
      setConfirmConfig({
        isOpen: true,
        title: "Could Not Add Member",
        description: err.message || "Failed to add member to group.",
        variant: "warning",
        singleAction: true,
        confirmText: "OK",
        onConfirm: () => setConfirmConfig(null),
      });
      setMemberToAdd(null);
    } finally {
      setIsAddingMember(false);
    }
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

  const mediaMessages = messages.filter((m) => m.type === 'image' && m.mediaUrl);
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

  return (
    <div className="w-80 md:w-88 h-full bg-[#111b21] border-l border-[#2e3b44] flex flex-col z-20 flex-shrink-0 animate-slide-left overflow-y-auto contact-info-drawer">
      {/* Header */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2e3b44] drawer-header">
        <h3 className="font-semibold text-white text-sm">
          {chat.type === 'direct' ? 'Contact Info' : 'Group Info'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Info */}
      <div className="p-6 flex flex-col items-center border-b border-[#222e35] bg-[#111b21]">
        <Avatar
          src={chat.type === 'direct' ? targetUser?.photoURL || chat.avatar : chat.avatar}
          name={chat.type === 'direct' ? targetUser?.displayName || chat.name : chat.name}
          size="xl"
          isOnline={chat.type === 'direct' ? targetUser?.isOnline : undefined}
          className="mb-3"
        />
        <h2 className="text-lg font-bold text-white text-center">
          {chat.type === 'direct' ? targetUser?.displayName || chat.name : chat.name}
        </h2>

        {chat.type === 'direct' && targetUser && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-[#00a884] bg-[#00a884]/10 px-3 py-1 rounded-full font-mono border border-[#00a884]/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{targetUser.phoneNumber}</span>
            <button
              onClick={() => handleCopyPhone(targetUser.phoneNumber)}
              className="ml-1 text-[#8696a0] hover:text-white"
              title="Copy number"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {chat.type !== 'direct' && (
          <p className="text-xs text-[#8696a0] mt-1 text-center">
            {chat.description || 'No description provided'}
          </p>
        )}
      </div>

      {/* About Section for Direct Chat */}
      {chat.type === 'direct' && targetUser && (
        <div className="p-4 border-b border-[#222e35] bg-[#111b21] space-y-1">
          <div className="text-xs text-[#8696a0] font-medium">About</div>
          <p className="text-sm text-[#d1d7db]">{targetUser.about || 'Available'}</p>
        </div>
      )}

      {/* Media & Docs Shared */}
      <div className="p-4 border-b border-[#222e35] bg-[#111b21] space-y-3">
        <div className="flex items-center justify-between text-xs text-[#8696a0]">
          <span className="font-medium">Media & Docs ({mediaMessages.length})</span>
          <Image className="w-4 h-4 text-[#8696a0]" />
        </div>
        {mediaMessages.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {mediaMessages.slice(0, 6).map((m) => (
              <img
                key={m.id}
                src={m.mediaUrl}
                alt="Shared"
                className="w-full h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition"
                onClick={() => window.open(m.mediaUrl, '_blank')}
              />
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#8696a0] italic">No shared media yet</div>
        )}
      </div>

      {/* Group Permissions & Privacy Controls (For Group Admins / Creator) */}
      {chat.type !== 'direct' && isGroupAdmin && (
        <div className="p-4 border-b border-[#222e35] bg-[#111b21] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Lock className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Group Privacy & Permissions</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#8696a0]">Send Messages</span>
              <select
                value={groupPerms.whoCanSendMessage}
                onChange={(e) => handleUpdatePerm('whoCanSendMessage', e.target.value as any)}
                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00a884]"
              >
                <option value="all">All Members</option>
                <option value="admins">Only Admins</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8696a0]">Add Members</span>
              <select
                value={groupPerms.whoCanAddMembers}
                onChange={(e) => handleUpdatePerm('whoCanAddMembers', e.target.value as any)}
                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00a884]"
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
                className="bg-[#202c33] border border-[#2e3b44] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00a884]"
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
            <span className="text-[#8696a0] font-medium">
              {participants.length} Participants
            </span>
            {(isGroupAdmin || groupPerms.whoCanAddMembers === 'all') && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="flex items-center gap-1 text-[#00a884] hover:underline cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            )}
          </div>

          {showAddMember && (
            <div className="p-3 bg-[#202c33] rounded-2xl space-y-2 border border-[#2e3b44] animate-scale-in">
              <div className="text-xs font-semibold text-white flex items-center justify-between">
                <span>Select from Contacts</span>
                <button
                  onClick={() => setShowAddMember(false)}
                  className="text-[#8696a0] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search contacts input */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-2.5" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full bg-[#111b21] pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#2e3b44] text-white focus:outline-none focus:border-[#00a884]"
                />
              </div>

              {/* Contact list dropdown */}
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredAvailableContacts.length > 0 ? (
                  filteredAvailableContacts.map((c) => (
                    <div
                      key={c.uid}
                      onClick={() => handleInitiateAddContact(c)}
                      className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#111b21] cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={c.photoURL} name={c.displayName} size="sm" isOnline={c.isOnline} />
                        <div className="min-w-0">
                          <div className="text-xs text-white truncate font-medium">{c.displayName}</div>
                          <div className="text-[10px] text-[#8696a0] font-mono">{c.phoneNumber}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#00a884] font-semibold px-2 py-0.5 rounded-lg bg-[#00a884]/15 hover:bg-[#00a884] hover:text-white transition">
                        + Add
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-3 text-xs text-[#8696a0] italic">
                    {availableContacts.length === 0 ? "No more contacts to add" : "No matching contacts"}
                  </div>
                )}
              </div>
            </div>
          )}

          {groupPerms.whoCanViewMembers === 'admins' && !isGroupAdmin ? (
            <div className="py-4 text-center text-xs text-[#8696a0] italic bg-[#182229] rounded-xl border border-white/5">
              🔒 Member list is hidden by group administration.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {participants.map((p) => {
                const isAdmin = chat.adminIds?.includes(p.uid);
                return (
                  <div key={p.uid} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={p.photoURL} name={p.displayName} size="sm" isOnline={p.isOnline} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {p.uid === currentUser.uid ? 'You' : p.displayName}
                        </div>
                        <div className="text-[10px] text-[#8696a0] font-mono">{p.phoneNumber}</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00a884]/20 text-[#00a884] font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-4 space-y-2 bg-[#111b21] mt-auto border-t border-[#222e35]">
        {isSupportChat ? (
          <div className="p-3 bg-[#202c33] rounded-2xl border border-white/10 text-center space-y-1">
            <span className="text-xs font-semibold text-[#00a884] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#00a884]" /> Official Support Desk
            </span>
            <p className="text-[11px] text-[#8696a0]">
              Official LimoChat Support desk cannot be blocked or deleted.
            </p>
          </div>
        ) : (
          <>
            {chat.type === 'direct' && targetUser && (
              <>
                <button
                  onClick={() => {
                    if (isTargetBlocked) {
                      onUnblockUser(targetUser.uid);
                    } else {
                      onBlockUser(targetUser.uid);
                    }
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    isTargetBlocked
                      ? 'bg-[#202c33] text-[#00a884] hover:bg-[#2a3942]'
                      : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  <span>{isTargetBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                </button>

                <button
                  onClick={handleDeleteContact}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Contact</span>
                </button>
              </>
            )}

            <button
              onClick={handleDeleteChat}
              className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Chat</span>
            </button>
          </>
        )}

        {chat.type !== 'direct' && (
          <button
            onClick={handleLeaveGroup}
            className="w-full py-2.5 px-3 rounded-xl bg-[#202c33] text-red-400 hover:bg-[#2a3942] flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit Group</span>
          </button>
        )}
      </div>

      {/* Confirm Add Member & Past Message History Access Modal */}
      {memberToAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
          <div className="bg-[#202c33] text-[#e9edef] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#2e3b44] p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar src={memberToAdd.photoURL} name={memberToAdd.displayName} size="md" />
              <div className="min-w-0">
                <h4 className="font-semibold text-white text-sm truncate">Add to {chat.name}</h4>
                <p className="text-xs text-[#8696a0] truncate">{memberToAdd.displayName} • {memberToAdd.phoneNumber || 'Member'}</p>
              </div>
            </div>

            <div className="bg-[#111b21] p-3.5 rounded-2xl border border-[#2e3b44] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">View Past Messages</span>
                <input
                  type="checkbox"
                  checked={allowPastMessagesForMember}
                  onChange={(e) => setAllowPastMessagesForMember(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-[#8696a0] leading-relaxed">
                {allowPastMessagesForMember
                  ? "✓ Allowed: Member can read all previous message history in this group."
                  : "✗ Restricted: Member can only view new messages sent after they join."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMemberToAdd(null)}
                className="px-4 py-2 rounded-xl text-xs text-[#8696a0] hover:text-white hover:bg-[#182229] transition font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAddingMember}
                onClick={handleConfirmAddContact}
                className="px-4 py-2 rounded-xl text-xs bg-[#00a884] hover:bg-[#02906f] text-white transition font-medium shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isAddingMember ? "Adding..." : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}

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
