import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Phone, 
  Video, 
  MoreVertical, 
  Search, 
  Users, 
  Info,
  ShieldCheck,
  CheckSquare,
  Trash2,
  RotateCcw,
  Ban,
  Star,
  Calendar
} from 'lucide-react';
import { Chat, UserProfile } from '../../types';
import { Avatar } from '../common/Avatar';
import { formatLastSeen } from '../../utils/formatters';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface ChatHeaderProps {
  chat: Chat;
  currentUser: UserProfile;
  isBlocked?: boolean;
  onBack: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onToggleInfo: () => void;
  onOpenSearch?: () => void;
  onOpenJumpToDate?: () => void;
  onEnterSelectionMode?: () => void;
  onClearChat?: () => void;
  onDeleteChat?: () => void;
  onToggleBlock?: () => void;
  isFilteringStarred?: boolean;
  onToggleStarredFilter?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chat,
  currentUser,
  isBlocked = false,
  onBack,
  onStartAudioCall,
  onStartVideoCall,
  onToggleInfo,
  onOpenSearch,
  onOpenJumpToDate,
  onEnterSelectionMode,
  onClearChat,
  onDeleteChat,
  onToggleBlock,
  isFilteringStarred = false,
  onToggleStarredFilter,
}) => {
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // If direct chat, listen to other user's real-time presence & profile
  useEffect(() => {
    if (chat.type !== 'direct') {
      setOtherUser(null);
      return;
    }

    const otherUid = chat.participants.find((p) => p !== currentUser.uid);
    if (!otherUid) return;

    const userRef = doc(db, 'users', otherUid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setOtherUser(snap.data() as UserProfile);
      }
    });

    return () => unsub();
  }, [chat.id, chat.type, currentUser.uid]);

  // Check if anyone else in the chat is typing
  const isTyping = Object.entries(chat.typingUsers || {}).some(
    ([uid, typing]) => uid !== currentUser.uid && typing
  );

  const getSubtitle = () => {
    if (isTyping) {
      return <span className="text-[#00a884] font-medium animate-pulse">typing...</span>;
    }

    if (chat.type === 'group') {
      return (
        <span className="text-[#8696a0]">
          {chat.participants.length} members
        </span>
      );
    }

    if (chat.type === 'announcement') {
      return <span className="text-[#8696a0]">Announcement Channel</span>;
    }

    if (otherUser) {
      const statusText = formatLastSeen(
        otherUser.isOnline,
        otherUser.lastSeen,
        otherUser.privacy?.lastSeen
      );
      return (
        <span className={otherUser.isOnline ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'}>
          {statusText}
        </span>
      );
    }

    return null;
  };

  const displayName = chat.type === 'direct' ? otherUser?.displayName || chat.name || 'Chat' : chat.name;
  const avatarUrl = chat.type === 'direct' ? otherUser?.photoURL || chat.avatar : chat.avatar;

  return (
    <div className="h-16 px-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between select-none z-10">
      {/* Left: Back button & Info */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition md:hidden"
          title="Back to chats"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div
          onClick={onToggleInfo}
          className="flex items-center gap-3 cursor-pointer group min-w-0"
        >
          <Avatar
            src={avatarUrl}
            name={displayName}
            size="md"
            isOnline={chat.type === 'direct' ? otherUser?.isOnline : undefined}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-white text-sm truncate group-hover:underline">
                {displayName}
              </h3>
              {chat.type === 'direct' && otherUser?.phoneNumber && (
                <span className="text-[10px] text-[#8696a0] bg-[#111b21] px-1.5 py-0.5 rounded border border-[#2e3b44] font-mono hidden sm:inline">
                  {otherUser.phoneNumber}
                </span>
              )}
            </div>
            <div className="text-xs truncate">{getSubtitle()}</div>
          </div>
        </div>
      </div>

      {/* Right: Actions (Video, Audio call, info) */}
      <div className="flex items-center gap-1 text-[#8696a0]">
        <button
          onClick={isBlocked ? undefined : onStartVideoCall}
          disabled={isBlocked}
          className={`p-2.5 rounded-full transition ${
            isBlocked ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-[#2a3942] cursor-pointer'
          }`}
          title={isBlocked ? "Calls disabled (Contact blocked)" : "Start Video Call"}
        >
          <Video className="w-5 h-5" />
        </button>

        <button
          onClick={isBlocked ? undefined : onStartAudioCall}
          disabled={isBlocked}
          className={`p-2.5 rounded-full transition ${
            isBlocked ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-[#2a3942] cursor-pointer'
          }`}
          title={isBlocked ? "Calls disabled (Contact blocked)" : "Start Audio Call"}
        >
          <Phone className="w-5 h-5" />
        </button>

        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="p-2.5 rounded-full hover:text-white hover:bg-[#2a3942] transition cursor-pointer"
            title="Search Messages"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        {/* 3-Dots More Menu Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2.5 rounded-full hover:text-white hover:bg-[#2a3942] transition cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMoreMenu && (
            <>
              {/* Outside Touch / Click Backdrop */}
              <div
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setShowMoreMenu(false)}
              />

              {/* Dropdown Menu */}
              <div
                className="absolute right-0 top-11 z-30 w-52 bg-[#233138] border border-[#2e3b44] rounded-2xl shadow-2xl py-1 text-xs text-[#d1d7db] animate-scale-in"
                onClick={() => setShowMoreMenu(false)}
              >
                <button
                  onClick={onToggleInfo}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Info className="w-4 h-4 text-[#00a884]" />
                  <span>{chat.type === 'direct' ? 'Contact info' : 'Group info'}</span>
                </button>

                {onOpenSearch && (
                  <button
                    onClick={onOpenSearch}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-emerald-400" />
                    <span>Search messages</span>
                  </button>
                )}

                {onOpenJumpToDate && (
                  <button
                    onClick={onOpenJumpToDate}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span>Jump to date</span>
                  </button>
                )}

                {onToggleStarredFilter && (
                  <button
                    onClick={onToggleStarredFilter}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 text-amber-400 transition cursor-pointer"
                  >
                    <Star className={`w-4 h-4 ${isFilteringStarred ? 'fill-amber-400' : ''}`} />
                    <span>{isFilteringStarred ? 'Show all messages' : 'Starred messages'}</span>
                  </button>
                )}

                {onEnterSelectionMode && (
                  <button
                    onClick={onEnterSelectionMode}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                    <span>Select messages</span>
                  </button>
                )}

                {onClearChat && (
                  <button
                    onClick={onClearChat}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 text-amber-300 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Clear chat history</span>
                  </button>
                )}

                {onToggleBlock && chat.type === 'direct' && (
                  <button
                    onClick={onToggleBlock}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 text-red-400 transition cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                    <span>{isBlocked ? 'Unblock contact' : 'Block contact'}</span>
                  </button>
                )}

                <div className="border-t border-[#2e3b44] my-1" />

                {onDeleteChat && (
                  <button
                    onClick={onDeleteChat}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-red-500/20 text-red-400 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete chat</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
