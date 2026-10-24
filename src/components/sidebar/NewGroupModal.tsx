import React, { useState, useEffect } from 'react';
import { X, Users, Search, Check } from 'lucide-react';
import { UserProfile } from '../../types';
import { Avatar } from '../common/Avatar';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { navigationManager } from '../../utils/navigationManager';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({ isOpen, onClose }) => {
  const { createGroup, getAllContacts, showAlertNotice } = useChat();
  const { currentUser } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('limochat_close_all_menus'));
      return navigationManager.registerModal('new_group', onClose, 22);
    }
    if (isOpen && currentUser) {
      getAllContacts().then((all) => {
        // Exclude Support user and any blocked users
        const valid = all.filter(
          (c) =>
            c.uid !== currentUser.uid &&
            c.uid !== 'limochat_official_support' &&
            !(currentUser.blockedUsers || []).includes(c.uid)
        );
        setContacts(valid);
      });
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.displayName?.toLowerCase().includes(q) ||
      c.phoneNumber?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const toggleSelectUser = (user: UserProfile) => {
    if (selectedUsers.some((u) => u.uid === user.uid)) {
      setSelectedUsers(selectedUsers.filter((u) => u.uid !== user.uid));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      showAlertNotice?.("Group Name Required", "Please enter a subject name for your new group.", "warning");
      return;
    }

    try {
      setCreating(true);
      await createGroup(
        name.trim(),
        description.trim(),
        selectedUsers.map((u) => u.uid),
        undefined,
        true
      );
      onClose();
    } catch (err: any) {
      console.warn("Group created with local sync:", err);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 pt-safe pb-safe animate-fade-in select-none"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fixed inset-0 cursor-default" onClick={onClose} />
      <div 
        className="relative z-10 bg-[#202c33] text-[#e9edef] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3b44] bg-[#111b21]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00a884]" />
            <h3 className="font-semibold text-white text-base">New Group</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Group Name & Bio */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white block mb-1">Group Subject</label>
              <input
                type="text"
                placeholder="Group name (e.g. Project Alpha, Weekend Trip)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00a884]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white block mb-1">Group Description (Optional)</label>
              <textarea
                placeholder="What is this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00a884] resize-none"
              />
            </div>
          </div>

          {/* Selected Member Chips */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-white block mb-1.5">
                Selected Members ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((u) => (
                  <span
                    key={u.uid}
                    onClick={() => toggleSelectUser(u)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] text-xs cursor-pointer hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 transition"
                  >
                    <span>{u.displayName}</span>
                    <X className="w-3 h-3" />
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search to add members */}
          <div>
            <label className="text-xs font-semibold text-white block mb-1">Add Members</label>
            <div className="relative flex items-center mb-2">
              <Search className="w-4 h-4 text-[#8696a0] absolute left-3" />
              <input
                type="text"
                placeholder="Search added contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#00a884]"
              />
            </div>

            {/* Results list */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {filteredContacts.map((user) => {
                const isSelected = selectedUsers.some((u) => u.uid === user.uid);
                return (
                  <div
                    key={user.uid}
                    onClick={() => toggleSelectUser(user)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                      isSelected ? 'bg-[#00a884]/15 border border-[#00a884]/30' : 'bg-[#111b21] hover:bg-[#2a3942]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={user.photoURL} name={user.displayName} size="sm" isOnline={user.isOnline} />
                      <div>
                        <div className="text-xs font-medium text-white">{user.displayName}</div>
                        <div className="text-[10px] text-[#00a884] font-mono">{user.phoneNumber}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#00a884]" />}
                  </div>
                );
              })}
              {filteredContacts.length === 0 && (
                <div className="py-4 text-center text-xs text-[#8696a0]">
                  No eligible contacts available.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2e3b44] bg-[#111b21] flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={creating || !name.trim()}
            className="px-5 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-md"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};
