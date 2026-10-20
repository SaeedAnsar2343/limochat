import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  ShieldCheck, 
  MessageSquare, 
  UserPlus, 
  ArrowRight, 
  Sparkles,
  Phone,
  UserCheck,
  Trash2,
  Ban,
  CheckCircle2,
  Users
} from 'lucide-react';
import { UserProfile } from '../../types';
import { Avatar } from '../common/Avatar';
import { ConfirmModal } from '../common/ConfirmModal';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { ChatListSkeleton } from '../common/SkeletonLoading';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewGroup?: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ 
  isOpen, 
  onClose,
  onOpenNewGroup 
}) => {
  const { searchUsers, createDirectChat, startDirectChatWithContact, getAllContacts, chats, deleteChat } = useChat();
  const { currentUser, blockUser, unblockUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchedContacts, setSearchedContacts] = useState<UserProfile[]>([]);
  const [addedContacts, setAddedContacts] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      getAllContacts().then((all) => {
        setAddedContacts(
          all.filter((c) => c.uid !== currentUser.uid && c.uid !== 'limochat_official_support')
        );
      });
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchedContacts([]);
      return;
    }
    setLoading(true);
    try {
      const filtered = await searchUsers(val);
      setSearchedContacts(
        filtered.filter((u) => u.uid !== currentUser.uid && u.uid !== 'limochat_official_support')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = async (user: UserProfile) => {
    try {
      setStartingChat(true);
      await createDirectChat(user);
      onClose();
    } catch (err: any) {
      console.warn("Direct chat notice:", err);
      onClose();
    } finally {
      setStartingChat(false);
    }
  };

  const handleStartDirectQuery = async () => {
    if (!searchQuery.trim()) return;
    try {
      setStartingChat(true);
      await startDirectChatWithContact(searchQuery.trim());
      onClose();
    } catch (err: any) {
      console.warn("Direct query notice:", err);
      onClose();
    } finally {
      setStartingChat(false);
    }
  };

  const handleToggleBlock = async (userToToggle: UserProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    const isBlocked = (currentUser.blockedUsers || []).includes(userToToggle.uid);
    if (isBlocked) {
      await unblockUser(userToToggle.uid);
    } else {
      await blockUser(userToToggle.uid);
    }
  };

  const handleDeleteContact = async () => {
    if (!confirmDeleteUser) return;
    try {
      const matchingChat = chats.find(
        (c) => c.type === 'direct' && c.participants.includes(confirmDeleteUser.uid)
      );
      if (matchingChat) {
        await deleteChat(matchingChat.id);
      }
      setAddedContacts((prev) => prev.filter((c) => c.uid !== confirmDeleteUser.uid));
    } catch (err: any) {
      console.warn("Could not delete contact:", err);
    } finally {
      setConfirmDeleteUser(null);
    }
  };

  const filteredAddedContacts = addedContacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.displayName?.toLowerCase().includes(q) ||
      c.phoneNumber?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
        <div className="bg-[#182229]/95 text-[#e9edef] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[85vh] backdrop-blur-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3b44] bg-[#111b21]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-base">New Chat & Contacts</h3>
              <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] font-mono px-2 py-0.5 rounded-full">
                {addedContacts.length} Saved
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Live Search Input */}
          <div className="p-4 bg-[#111b21] border-b border-[#222e35]">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#8696a0] absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                autoFocus
                placeholder="Search contacts or find by +991 number..."
                className="w-full bg-[#202c33] border border-[#2e3b44] focus:border-[#00a884] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none transition"
              />
            </div>
          </div>

          {/* Action quick shortcut: New Group */}
          <div className="p-2 border-b border-[#222e35] bg-[#111b21]/50">
            <button
              onClick={() => {
                onClose();
                if (onOpenNewGroup) onOpenNewGroup();
              }}
              className="w-full flex items-center gap-3.5 px-3 py-2 rounded-2xl hover:bg-[#202c33] text-xs font-semibold text-white transition cursor-pointer"
            >
              <div className="p-2 rounded-xl bg-[#00a884]/20 text-[#00a884]">
                <UserPlus className="w-4 h-4" />
              </div>
              <span>Create New Group</span>
            </button>
          </div>

          {/* Contacts Body */}
          <div className="flex-1 overflow-y-auto min-h-[260px] divide-y divide-[#222e35]/40">
            {loading ? (
              <ChatListSkeleton count={4} />
            ) : searchQuery.trim().length > 0 ? (
              /* Search results (both filtered existing contacts & globally searched users) */
              <div>
                {/* 1. Existing contacts matching */}
                {filteredAddedContacts.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8696a0] px-4 pt-3 pb-1">
                      Existing Contacts ({filteredAddedContacts.length})
                    </div>
                    {filteredAddedContacts.map((contact) => {
                      const isBlocked = (currentUser.blockedUsers || []).includes(contact.uid);
                      return (
                        <div
                          key={contact.uid}
                          onClick={() => handleSelectContact(contact)}
                          className="flex items-center justify-between p-3.5 hover:bg-[#202c33] cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              src={contact.photoURL}
                              name={contact.displayName}
                              size="md"
                              isOnline={contact.isOnline}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-white truncate">
                                  {contact.displayName}
                                </span>
                                {isBlocked && (
                                  <span className="text-[9px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.2 rounded">
                                    BLOCKED
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#00a884] font-mono truncate">
                                {contact.phoneNumber}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleToggleBlock(contact, e)}
                              className={`p-2 rounded-xl transition cursor-pointer ${
                                isBlocked
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  : 'text-[#8696a0] hover:text-red-400 hover:bg-[#202c33]'
                              }`}
                              title={isBlocked ? "Unblock contact" : "Block contact"}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteUser(contact)}
                              className="p-2 rounded-xl text-[#8696a0] hover:text-red-400 hover:bg-[#202c33] transition cursor-pointer"
                              title="Delete contact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSelectContact(contact)}
                              className="p-2 rounded-xl bg-[#00a884]/20 hover:bg-[#00a884] text-[#00a884] hover:text-white transition cursor-pointer"
                              title="Chat"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Global Users Matching */}
                {searchedContacts.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8696a0] px-4 pt-3 pb-1 border-t border-[#2e3b44]">
                      Other Registered Users ({searchedContacts.length})
                    </div>
                    {searchedContacts.map((contact) => (
                      <div
                        key={contact.uid}
                        onClick={() => handleSelectContact(contact)}
                        className="flex items-center justify-between p-3.5 hover:bg-[#202c33] cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={contact.photoURL}
                            name={contact.displayName}
                            size="md"
                            isOnline={contact.isOnline}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-white truncate">
                              {contact.displayName}
                            </div>
                            <div className="text-xs text-[#00a884] font-mono truncate">
                              {contact.phoneNumber}
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={startingChat}
                          className="px-3 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {filteredAddedContacts.length === 0 && searchedContacts.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#8696a0] space-y-3">
                    <UserCheck className="w-8 h-8 text-[#8696a0] mx-auto opacity-40" />
                    <p>No contacts found matching "{searchQuery}".</p>
                    <button
                      type="button"
                      onClick={handleStartDirectQuery}
                      disabled={startingChat}
                      className="px-4 py-2 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl font-medium transition cursor-pointer inline-flex items-center gap-1.5 shadow"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Start chat with "{searchQuery}"</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* When not searching: Show All Already Added Contacts directly! */
              <div>
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8696a0]">
                    All Contacts ({addedContacts.length})
                  </span>
                  <span className="text-[10px] text-[#8696a0]">
                    Manage, Block, or Delete
                  </span>
                </div>

                {addedContacts.length > 0 ? (
                  addedContacts.map((contact) => {
                    const isBlocked = (currentUser.blockedUsers || []).includes(contact.uid);
                    return (
                      <div
                        key={contact.uid}
                        onClick={() => handleSelectContact(contact)}
                        className="flex items-center justify-between p-3.5 hover:bg-[#202c33] cursor-pointer transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={contact.photoURL}
                            name={contact.displayName}
                            size="md"
                            isOnline={contact.isOnline}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-white truncate">
                                {contact.displayName}
                              </span>
                              {isBlocked && (
                                <span className="text-[9px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.2 rounded">
                                  BLOCKED
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#00a884] font-mono truncate">
                              {contact.phoneNumber}
                            </div>
                            {contact.about && (
                              <div className="text-[11px] text-[#8696a0] truncate mt-0.5">
                                {contact.about}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions: Block, Delete, Chat */}
                        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleToggleBlock(contact, e)}
                            className={`p-2 rounded-xl transition cursor-pointer ${
                              isBlocked
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'text-[#8696a0] hover:text-red-400 hover:bg-[#202c33]'
                            }`}
                            title={isBlocked ? "Unblock contact" : "Block contact"}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteUser(contact)}
                            className="p-2 rounded-xl text-[#8696a0] hover:text-red-400 hover:bg-[#202c33] transition cursor-pointer"
                            title="Delete contact"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSelectContact(contact)}
                            className="p-2 rounded-xl bg-[#00a884]/20 hover:bg-[#00a884] text-[#00a884] hover:text-white transition cursor-pointer"
                            title="Chat"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-[#8696a0] px-6 space-y-2">
                    <Users className="w-8 h-8 text-[#8696a0]/30 mx-auto" />
                    <p className="font-semibold text-white">No contacts saved yet</p>
                    <p className="text-[11px]">Type above to search and message any user by +991 number.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Contact Confirmation Modal */}
      {confirmDeleteUser && (
        <ConfirmModal
          isOpen={true}
          title={`Delete ${confirmDeleteUser.displayName}?`}
          description={`This contact will be permanently deleted from your saved contacts and direct chats. They will no longer be able to view your status updates.`}
          confirmText="Delete Contact"
          variant="danger"
          onConfirm={handleDeleteContact}
          onCancel={() => setConfirmDeleteUser(null)}
        />
      )}
    </>
  );
};
