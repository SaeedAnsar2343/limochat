import React, { useEffect, useState } from 'react';
import { 
  Check, 
  CheckCheck, 
  Image, 
  Mic, 
  FileText, 
  VolumeX, 
  Pin, 
  Archive, 
  Star, 
  MoreVertical,
  Trash2,
  Mail,
  MailOpen,
  RotateCcw,
  PhoneCall,
  PhoneMissed
} from 'lucide-react';
import { Chat, UserProfile } from '../../types';
import { Avatar } from '../common/Avatar';
import { ConfirmModal } from '../common/ConfirmModal';
import { formatTime } from '../../utils/formatters';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useChat } from '../../context/ChatContext';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  currentUser: UserProfile;
  onClick: () => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
  chat,
  isActive,
  currentUser,
  onClick,
}) => {
  const { 
    togglePinChat, 
    deleteChat, 
    clearChatHistory, 
    markChatAsRead, 
    markChatAsUnread 
  } = useChat();

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // If direct chat, listen to other user's real-time online status
  useEffect(() => {
    if (chat.type !== 'direct') return;
    const otherUid = chat.participants.find((p) => p !== currentUser.uid);
    if (!otherUid) return;

    const unsub = onSnapshot(doc(db, 'users', otherUid), (snap) => {
      if (snap.exists()) {
        setOtherUser(snap.data() as UserProfile);
      }
    });

    return () => unsub();
  }, [chat.id, chat.type, currentUser.uid]);

  const displayName = chat.type === 'direct' ? otherUser?.displayName || chat.name || 'Contact' : chat.name;
  const avatarUrl = chat.type === 'direct' ? otherUser?.photoURL || chat.avatar : chat.avatar;
  const isOnline = chat.type === 'direct' ? otherUser?.isOnline : undefined;
  const isMeSender = chat.lastMessage?.senderId === currentUser.uid;

  // Toggle archive
  const handleToggleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        isArchived: !chat.isArchived,
      });
    } catch {}
  };

  // Toggle pin
  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    await togglePinChat(chat.id);
  };

  // Toggle favourite
  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const currentTags = chat.tags || [];
    const newTags = currentTags.includes('favourites')
      ? currentTags.filter((t) => t !== 'favourites')
      : [...currentTags, 'favourites'];

    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        tags: newTags,
      });
    } catch {}
  };

  const handleMarkReadUnread = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const unread = chat.unreadCount?.[currentUser.uid] || 0;
    if (unread > 0) {
      await markChatAsRead(chat.id);
    } else {
      await markChatAsUnread(chat.id);
    }
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setConfirmConfig({
      isOpen: true,
      title: `Clear "${displayName}"?`,
      description: "All messages in this chat will be cleared from your device.",
      confirmText: "Clear History",
      cancelText: "Cancel",
      variant: "warning",
      onConfirm: async () => {
        setConfirmConfig(null);
        await clearChatHistory(chat.id);
      },
    });
  };

  const isSupportChat =
    chat.id.startsWith('support_') ||
    chat.participants?.includes('limochat_official_support');

  const handleDeleteChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (isSupportChat) return;
    setConfirmConfig({
      isOpen: true,
      title: `Delete chat with "${displayName}"?`,
      description: "This will permanently delete the conversation and remove it from your chats list.",
      confirmText: "Delete Chat",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteChat(chat.id);
      },
    });
  };

  const renderLastMessageSnippet = () => {
    if (!chat.lastMessage) {
      return <span className="text-[#8696a0] italic">Tap to start chat</span>;
    }

    const { type, text, status, senderId, callType, callStatus } = chat.lastMessage;

    return (
      <div className="flex items-center gap-1 truncate text-[#8696a0]">
        {/* Delivery / Read Status Ticks for me */}
        {isMeSender && (
          <span className="flex-shrink-0 mr-0.5">
            {status === 'sent' && <Check className="w-3.5 h-3.5 text-[#8696a0]" />}
            {status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />}
            {status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
          </span>
        )}

        {/* Sender name preview in group if not me */}
        {!isMeSender && chat.type === 'group' && (
          <span className="text-[#8696a0] flex-shrink-0 font-normal">
            ~Member:&nbsp;
          </span>
        )}

        {/* Call log preview */}
        {type === 'call_log' && (
          <span className={`flex items-center gap-1 flex-shrink-0 text-xs ${callStatus === 'missed' ? 'text-red-400' : 'text-[#00a884]'}`}>
            {callStatus === 'missed' ? <PhoneMissed className="w-3.5 h-3.5" /> : <PhoneCall className="w-3.5 h-3.5" />}
          </span>
        )}

        {/* Media icon indicator */}
        {type === 'image' && <Image className="w-3.5 h-3.5 flex-shrink-0 text-[#8696a0]" />}
        {type === 'voice' && (
          <span className="flex items-center gap-1 text-[#00a884] flex-shrink-0 font-mono text-[11px]">
            <Mic className="w-3.5 h-3.5" />
            <span>Voice</span>
          </span>
        )}
        {type === 'file' && <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[#8696a0]" />}

        <span className="truncate">{text || (type === 'voice' ? 'Voice message' : 'Media')}</span>
      </div>
    );
  };

  const unread = chat.unreadCount?.[currentUser.uid] || 0;
  const isPinned = chat.pinnedBy?.includes(currentUser.uid) || !!chat.isPinned;
  const isFavourite = chat.tags?.includes('favourites');

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      className={`group relative flex items-center gap-3 px-3.5 py-3 cursor-pointer transition select-none chat-list-item ${
        isActive ? 'bg-[#2a3942] chat-list-item-active' : 'hover:bg-[#202c33]'
      } border-b border-[#222e35]/40`}
    >
      <div className="relative flex-shrink-0">
        <Avatar
          src={avatarUrl}
          name={displayName}
          size="md"
          isOnline={isOnline}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <h4 className="font-semibold text-[13.5px] text-[#e9edef] truncate">
              {displayName}
            </h4>
            {isPinned && <Pin className="w-3 h-3 text-[#00a884] rotate-45 flex-shrink-0" />}
            {isFavourite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
          </div>
          <span className="text-[11px] text-[#8696a0] flex-shrink-0 font-light">
            {formatTime(chat.lastMessage?.timestamp || chat.updatedAt)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="truncate flex-1 pr-2">
            {renderLastMessageSnippet()}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {unread > 0 && (
              <span className="bg-[#00a884] text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full flex-shrink-0 min-w-4 text-center">
                {unread}
              </span>
            )}

            {/* Quick Context Menu Trigger (Always accessible on mobile, hover-revealed on desktop) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-full text-[#8696a0] hover:text-[#d1d7db] dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation cursor-pointer flex-shrink-0"
              title="Chat Options"
              aria-label="Chat options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div
            className="absolute right-3 top-10 z-50 w-52 bg-[#233138] border border-[#2e3b44] rounded-xl shadow-2xl py-1.5 text-xs text-[#d1d7db] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
          <button
            onClick={handleTogglePin}
            className="w-full px-3 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 transition"
          >
            <Pin className="w-3.5 h-3.5 text-[#00a884]" />
            <span>{isPinned ? 'Unpin chat' : 'Pin chat'}</span>
          </button>

          <button
            onClick={handleMarkReadUnread}
            className="w-full px-3 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 transition"
          >
            {unread > 0 ? (
              <>
                <MailOpen className="w-3.5 h-3.5 text-[#8696a0]" />
                <span>Mark as read</span>
              </>
            ) : (
              <>
                <Mail className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Mark as unread</span>
              </>
            )}
          </button>

          <button
            onClick={handleToggleFavourite}
            className="w-full px-3 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 transition"
          >
            <Star className={`w-3.5 h-3.5 ${isFavourite ? 'text-amber-400 fill-amber-400' : 'text-[#8696a0]'}`} />
            <span>{isFavourite ? 'Remove Favourite' : 'Add to Favourites'}</span>
          </button>

          <button
            onClick={handleToggleArchive}
            className="w-full px-3 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 transition"
          >
            <Archive className="w-3.5 h-3.5 text-[#8696a0]" />
            <span>{chat.isArchived ? 'Unarchive chat' : 'Archive chat'}</span>
          </button>

          <button
            onClick={handleClearHistory}
            className="w-full px-3 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 text-amber-300 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear messages</span>
          </button>

          {!isSupportChat && (
            <>
              <div className="border-t border-[#2e3b44] my-1" />

              <button
                onClick={handleDeleteChat}
                className="w-full px-3 py-2 text-left hover:bg-red-500/20 text-red-400 flex items-center gap-2.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete chat</span>
              </button>
            </>
          )}
        </div>
      </>
    )}

    {confirmConfig && (
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        description={confirmConfig.description}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        variant={confirmConfig.variant}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(null)}
      />
    )}
    </div>
  );
};
