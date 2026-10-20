import React, { useState } from 'react';
import { 
  Phone, 
  Video, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed, 
  Plus, 
  Clock, 
  Search,
  Users
} from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { formatTime, formatDuration } from '../../utils/formatters';
import { CallHistoryItem } from '../../types';
import { CallListSkeleton } from '../common/SkeletonLoading';

export const CallHistoryView: React.FC = () => {
  const { callHistory, startCall } = useCall();
  const { currentUser } = useAuth();
  const { chats } = useChat();
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [search, setSearch] = useState('');

  if (!currentUser) return null;

  const filteredHistory = callHistory.filter((item) => {
    if (filter === 'missed' && item.direction !== 'missed') return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const otherName = (item.callerId === currentUser.uid ? item.receiverName : item.callerName) || '';
    return otherName.toLowerCase().includes(q) || (item.groupName && item.groupName.toLowerCase().includes(q));
  });

  const handleCallBack = (item: CallHistoryItem, callType: 'audio' | 'video') => {
    const targetUid = item.callerId === currentUser.uid ? item.receiverId : item.callerId;
    const targetName = item.callerId === currentUser.uid ? item.receiverName : item.callerName;
    const targetPhoto = item.callerId === currentUser.uid ? item.receiverPhoto : item.callerPhoto;

    // Check if matching chat exists
    const matchingChat = item.isGroup
      ? chats.find((c) => c.name === item.groupName)
      : chats.find((c) => targetUid && c.participants.includes(targetUid) && c.type === 'direct');

    if (matchingChat) {
      startCall({ chat: matchingChat, callType });
    } else if (targetUid) {
      startCall({
        user: {
          uid: targetUid,
          displayName: targetName || 'Contact',
          photoURL: targetPhoto || '',
          email: '',
          phoneNumber: '',
          about: '',
          isOnline: false,
          lastSeen: 0,
          privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', readReceipts: true },
          blockedUsers: [],
          createdAt: 0,
        },
        callType,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#111b21] overflow-y-auto select-none">
      {/* Top Header */}
      <div className="p-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between">
        <h2 className="text-base font-bold text-white tracking-tight">Calls</h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#111b21] rounded-xl p-0.5 border border-[#2e3b44] text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition font-medium ${
                filter === 'all' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('missed')}
              className={`px-3 py-1 rounded-lg transition font-medium ${
                filter === 'missed' ? 'bg-red-500 text-white' : 'text-[#8696a0] hover:text-white'
              }`}
            >
              Missed
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 bg-[#111b21] border-b border-[#222e35]/60">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#8696a0] absolute left-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search call logs..."
            className="w-full bg-[#202c33] text-xs text-[#e9edef] placeholder-[#8696a0] rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          />
        </div>
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#222e35]/40">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item) => {
            const isMeCaller = item.callerId === currentUser.uid;
            const displayName = isMeCaller
              ? item.receiverName || 'Contact'
              : item.callerName || 'Contact';
            const displayPhoto = isMeCaller ? item.receiverPhoto : item.callerPhoto;
            const isMissed = item.direction === 'missed';

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 hover:bg-[#202c33] transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={displayPhoto}
                    name={displayName}
                    size="md"
                  />

                  <div className="min-w-0">
                    <h4
                      className={`text-sm font-semibold truncate ${
                        isMissed ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {item.isGroup ? item.groupName || 'Group Call' : displayName}
                    </h4>

                    <div className="flex items-center gap-1.5 text-xs text-[#8696a0] mt-0.5">
                      {/* Direction Icon */}
                      {isMissed ? (
                        <PhoneMissed className="w-3.5 h-3.5 text-red-400" />
                      ) : isMeCaller ? (
                        <PhoneOutgoing className="w-3.5 h-3.5 text-[#00a884]" />
                      ) : (
                        <PhoneIncoming className="w-3.5 h-3.5 text-[#00a884]" />
                      )}

                      <span>
                        {formatTime(item.timestamp)}
                        {item.duration ? ` • ${formatDuration(item.duration)}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Call Actions */}
                <div className="flex items-center gap-1 text-[#00a884]">
                  <button
                    onClick={() => handleCallBack(item, 'audio')}
                    className="p-2 rounded-full hover:bg-[#2a3942] transition cursor-pointer"
                    title="Audio Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCallBack(item, 'video')}
                    className="p-2 rounded-full hover:bg-[#2a3942] transition cursor-pointer"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center text-xs text-[#8696a0] px-6 space-y-3">
            <Phone className="w-10 h-10 text-[#8696a0]/30 mx-auto" />
            <p>No call history logs found.</p>
            <p className="text-[11px] text-[#8696a0]/70">
              Calls you make or receive with HD voice and video will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
