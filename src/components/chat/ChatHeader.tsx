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
  const [showSupportCallModal, setShowSupportCallModal] = useState(false);
  const [pendingCallType, setPendingCallType] = useState<'audio' | 'video'>('audio');

  // Auto-close dropdown when any other modal or menu opens across the app
  useEffect(() => {
    const handleCloseMenu = () => setShowMoreMenu(false);
    window.addEventListener('limochat_close_all_menus', handleCloseMenu);
    return () => window.removeEventListener('limochat_close_all_menus', handleCloseMenu);
  }, []);

  const isSupportChat =
    chat.id.startsWith('support_') ||
    chat.participants?.includes('limochat_official_support') ||
    chat.name === 'LimoChat Support';

  const isUserSideSupport = isSupportChat && currentUser.uid !== 'limochat_official_support';

  // If direct chat, listen to other user's real-time presence & profile
  useEffect(() => {
    setOtherUser(null);
    if (chat.type !== 'direct') return;

    const otherUid = chat.participants.find((p) => p !== currentUser.uid);
    if (!otherUid) return;

    if (otherUid === 'limochat_official_support') {
      setOtherUser({
        uid: 'limochat_official_support',
        displayName: 'LimoChat Support',
        phoneNumber: '+991 100 0001',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=LimoSupport',
        email: 'support@limochat.app',
        about: 'Official LimoChat Assistant & Support Desk',
        isOnline: true,
        lastSeen: Date.now(),
        createdAt: Date.now(),
        privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', about: 'everyone', readReceipts: true, status: 'everyone' },
        blockedUsers: [],
      });
      return;
    }

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

  const isContact = Boolean(otherUser && (!currentUser.deletedContactUids?.includes(otherUser.uid)));
  const isPhotoHidden = chat.type === 'direct' && Boolean(
    otherUser?.privacy?.profilePhoto === 'nobody' ||
    (otherUser?.privacy?.profilePhoto === 'contacts' && !isContact)
  );
  const isLastSeenHidden = chat.type === 'direct' && Boolean(
    otherUser?.privacy?.lastSeen === 'nobody' ||
    (otherUser?.privacy?.lastSeen === 'contacts' && !isContact)
  );
  const activeDisappearingDuration = chat.disappearingDuration || currentUser.preferences?.disappearingDuration || 0;

  const getSubtitle = () => {
    if (isTyping) {
      return <span className="text-[#00a884] font-medium animate-pulse">typing...</span>;
    }

    if (isUserSideSupport) {
      return (
        <span className="text-[#00a884] font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
          Official Support Desk • 24/7 Verified
        </span>
      );
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
      if (isLastSeenHidden) {
        return null;
      }
      const statusText = formatLastSeen(
        otherUser.isOnline,
        otherUser.lastSeen,
        otherUser.privacy?.lastSeen,
        isContact
      );
      return (
        <span className={otherUser.isOnline ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'}>
          {statusText}
        </span>
      );
    }

    return null;
  };

  let displayName = chat.name || 'Chat';
  let avatarUrl = chat.avatar;

  if (isUserSideSupport) {
    displayName = 'LimoChat Support';
    avatarUrl = 'https://api.dicebear.com/7.x/bottts/svg?seed=LimoSupport';
  } else if (chat.type === 'direct') {
    if (otherUser?.displayName) {
      displayName = otherUser.displayName;
      avatarUrl = otherUser.photoURL || avatarUrl;
    } else if (chat.name && chat.name !== currentUser.displayName) {
      displayName = chat.name;
    } else {
      displayName = 'Contact';
    }
  }

  return (
    <div className="pt-safe mobile-header-safe min-h-16 px-3 sm:px-4 bg-[#202c33]/95 dark:bg-[#202c33]/95 backdrop-blur-2xl border-b border-white/[0.08] flex items-center justify-between select-none relative z-30 shadow-sm transition-all">
      {/* Left: Back button & Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
        <button
          onClick={onBack}
          className="p-2 rounded-full text-[#8696a0] hover:text-white hover:bg-white/10 active:bg-white/20 active:scale-95 transition-all md:hidden -ml-1 cursor-pointer flex-shrink-0 touch-manipulation"
          title="Back to chats"
          aria-label="Back to chats"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div
          onClick={onToggleInfo}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0 active:opacity-80 transition"
        >
          <div className="relative flex-shrink-0">
            <Avatar
              src={avatarUrl}
              name={displayName}
              size="md"
              hidePhoto={isPhotoHidden}
              isOnline={chat.type === 'direct' ? (isLastSeenHidden ? undefined : otherUser?.isOnline) : undefined}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-white text-sm sm:text-[15px] truncate group-hover:text-[#00a884] transition-colors">
                {displayName}
              </h3>
              {isUserSideSupport && (
                <span className="text-[10px] text-[#00a884] bg-[#00a884]/20 border border-[#00a884]/30 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3 text-[#00a884]" />
                  <span>Verified</span>
                </span>
              )}
              {chat.type === 'direct' && otherUser?.phoneNumber && (
                <span className="text-[10px] text-[#8696a0] bg-[#111b21] px-1.5 py-0.5 rounded border border-[#2e3b44] font-mono hidden md:inline">
                  {otherUser.phoneNumber}
                </span>
              )}
              {activeDisappearingDuration > 0 && (
                <span
                  className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-mono flex items-center gap-1"
                  title={`Disappearing messages active: ${activeDisappearingDuration === 24 ? '24 Hours' : activeDisappearingDuration === 168 ? '7 Days' : '90 Days'}`}
                >
                  <span>⏱️</span>
                  <span>{activeDisappearingDuration === 24 ? '24h' : activeDisappearingDuration === 168 ? '7d' : '90d'}</span>
                </span>
              )}
            </div>
            <div className="text-[11px] sm:text-xs truncate">{getSubtitle()}</div>
          </div>
        </div>
      </div>

      {/* Right: Actions (Video Call, Audio Call, 3-Dots Menu) */}
      <div className="flex items-center gap-1 sm:gap-1.5 text-[#8696a0]">
        <button
          onClick={() => {
            if (isBlocked) return;
            if (isUserSideSupport && !chat.supportCallsAllowed) {
              setPendingCallType('video');
              setShowSupportCallModal(true);
              return;
            }
            onStartVideoCall();
          }}
          disabled={isBlocked}
          className={`p-2 sm:p-2.5 rounded-full transition-all active:scale-95 ${
            isBlocked ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-white/10 active:bg-white/15 cursor-pointer'
          }`}
          title={isBlocked ? "Calls disabled (Contact blocked)" : (isUserSideSupport && !chat.supportCallsAllowed ? "Request Support Video Call" : "Start Video Call")}
        >
          <Video className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          onClick={() => {
            if (isBlocked) return;
            if (isUserSideSupport && !chat.supportCallsAllowed) {
              setPendingCallType('audio');
              setShowSupportCallModal(true);
              return;
            }
            onStartAudioCall();
          }}
          disabled={isBlocked}
          className={`p-2 sm:p-2.5 rounded-full transition-all active:scale-95 ${
            isBlocked ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-white/10 active:bg-white/15 cursor-pointer'
          }`}
          title={isBlocked ? "Calls disabled (Contact blocked)" : (isUserSideSupport && !chat.supportCallsAllowed ? "Request Support Voice Call" : "Start Audio Call")}
        >
          <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* 3-Dots More Menu Trigger (Search is accessible here) */}
        <div className="relative">
          <button
            onClick={() => {
              const next = !showMoreMenu;
              if (next) window.dispatchEvent(new Event('limochat_close_all_menus'));
              setShowMoreMenu(next);
            }}
            className="p-2 sm:p-2.5 rounded-full hover:text-white hover:bg-white/10 active:bg-white/15 transition-all active:scale-95 cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {showMoreMenu && (
            <>
              {/* Outside Touch / Click Backdrop */}
              <div
                className="fixed inset-0 z-[65] cursor-default"
                onClick={() => setShowMoreMenu(false)}
              />

              {/* Dropdown Menu - Elevated above message bubbles & cards */}
              <div
                className="absolute right-0 top-11 z-[70] w-52 bg-white dark:bg-[#233138]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-2xl py-1.5 text-xs text-gray-800 dark:text-[#d1d7db] animate-scale-in"
                onClick={() => setShowMoreMenu(false)}
              >
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onToggleInfo();
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                >
                  <Info className="w-4 h-4 text-[#00a884]" />
                  <span>{chat.type === 'direct' ? 'Contact info' : 'Group info'}</span>
                </button>

                {onOpenSearch && (
                  <button
                    onClick={onOpenSearch}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                  >
                    <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Search messages</span>
                  </button>
                )}

                {onOpenJumpToDate && (
                  <button
                    onClick={onOpenJumpToDate}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                  >
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Jump to date</span>
                  </button>
                )}

                {onToggleStarredFilter && (
                  <button
                    onClick={onToggleStarredFilter}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2.5 text-amber-600 dark:text-amber-400 transition cursor-pointer font-medium"
                  >
                    <Star className={`w-4 h-4 ${isFilteringStarred ? 'fill-amber-500 text-amber-500' : 'text-amber-500'}`} />
                    <span>{isFilteringStarred ? 'Show all messages' : 'Starred messages'}</span>
                  </button>
                )}

                {onEnterSelectionMode && (
                  <button
                    onClick={onEnterSelectionMode}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                  >
                    <CheckSquare className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Select messages</span>
                  </button>
                )}

                {onClearChat && (
                  <button
                    onClick={onClearChat}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-amber-50 dark:hover:bg-white/10 flex items-center gap-2.5 text-amber-600 dark:text-amber-300 transition cursor-pointer font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Clear chat history</span>
                  </button>
                )}

                {onToggleBlock && chat.type === 'direct' && (
                  <button
                    onClick={onToggleBlock}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-red-50 dark:hover:bg-white/10 flex items-center gap-2.5 text-red-600 dark:text-red-400 transition cursor-pointer font-medium"
                  >
                    <Ban className="w-4 h-4" />
                    <span>{isBlocked ? 'Unblock contact' : 'Block contact'}</span>
                  </button>
                )}

                <div className="border-t border-gray-200 dark:border-white/10 my-1" />

                {onDeleteChat && (
                  <button
                    onClick={onDeleteChat}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2.5 transition cursor-pointer font-semibold"
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
