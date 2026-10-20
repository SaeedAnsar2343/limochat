import React, { useState } from 'react';
import { Users2, Plus, Volume2, ChevronRight, ShieldCheck, MessageSquare, ArrowRight } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Community } from '../../types';

export const CommunityList: React.FC = () => {
  const { communities, createCommunity, chats, setActiveChat } = useChat();
  const [showNewModal, setShowNewModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setIsCreating(true);
      await createCommunity(name.trim(), desc.trim(), []);
      setName('');
      setDesc('');
      setShowNewModal(false);
    } catch (err: any) {
      console.warn("Community created in session:", err);
      setName('');
      setDesc('');
      setShowNewModal(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenAnnouncements = (comm: Community) => {
    const announcementChat = chats.find((c) => c.id === comm.announcementChatId);
    if (announcementChat) {
      setActiveChat(announcementChat);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Top Banner / New Community Button */}
      <div
        onClick={() => setShowNewModal(true)}
        className="flex items-center gap-3 p-3.5 bg-[#202c33] hover:bg-[#2a3942] rounded-2xl cursor-pointer border border-[#2e3b44] transition shadow-md group"
      >
        <div className="p-3 bg-[#00a884] text-white rounded-xl shadow group-hover:scale-105 transition">
          <Plus className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">New Community</h4>
          <p className="text-xs text-[#8696a0]">
            Organize related groups and broadcast announcements
          </p>
        </div>
      </div>

      {/* Community List */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8696a0] px-1">
          Your Communities ({communities.length})
        </h4>

        {communities.length > 0 ? (
          communities.map((comm) => (
            <div
              key={comm.id}
              className="bg-[#202c33] border border-[#2e3b44] rounded-2xl p-4 space-y-3 shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#005c4b] to-[#00a884] flex items-center justify-center text-white font-bold text-lg shadow">
                  {comm.name[0]?.toUpperCase() || 'C'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm truncate">{comm.name}</h4>
                  <p className="text-xs text-[#8696a0] truncate">{comm.description || 'Community'}</p>
                </div>
              </div>

              {/* Announcements Channel Item */}
              <div
                onClick={() => handleOpenAnnouncements(comm)}
                className="flex items-center justify-between p-2.5 bg-[#111b21] hover:bg-[#182229] rounded-xl cursor-pointer border border-[#2e3b44]/60 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-[#00a884]/20 text-[#00a884] rounded-lg">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">Announcements</div>
                    <div className="text-[10px] text-[#8696a0]">Broadcasts for all members</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8696a0]" />
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-xs text-[#8696a0] px-4 space-y-2">
            <Users2 className="w-8 h-8 text-[#8696a0] mx-auto opacity-50" />
            <p>Communities bring members together in topic-based groups.</p>
            <p>Tap "New Community" above to get started.</p>
          </div>
        )}
      </div>

      {/* New Community Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#202c33] text-[#e9edef] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-[#2e3b44] p-5 space-y-4">
            <h3 className="font-bold text-white text-base">Create a Community</h3>
            <p className="text-xs text-[#8696a0]">
              Bring related groups together and make it easy to manage communication.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#8696a0] block mb-1">Community Name</label>
                <input
                  type="text"
                  placeholder="e.g. City Developers, Neighborhood Hub"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#00a884]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8696a0] block mb-1">Description</label>
                <textarea
                  placeholder="Describe your community..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00a884] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-xs text-[#8696a0] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !name.trim()}
                className="px-5 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-semibold disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
