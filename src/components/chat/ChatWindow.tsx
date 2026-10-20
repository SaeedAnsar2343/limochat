import React, { useState, useEffect, useMemo } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatInfoDrawer } from './ChatInfoDrawer';
import { ReportMessageModal } from './ReportMessageModal';
import { MediaViewerModal } from './MediaViewerModal';
import { JumpToDateModal } from './JumpToDateModal';
import { Message, UserProfile } from '../../types';
import { Ban, X, Star, Copy, Trash2, AlertTriangle, RotateCcw, Search, ChevronUp, ChevronDown, Calendar } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface ChatWindowProps {
  onBack: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ onBack }) => {
  const { 
    activeChat, 
    messages, 
    replyingTo, 
    setReplyingTo, 
    sendMessage, 
    deleteMessageForEveryone, 
    deleteMessageForMe, 
    deleteMessagesBulk,
    toggleStarMessage, 
    clearChatHistory,
    deleteChat,
    setTyping,
    wallpaper,
    markChatAsRead
  } = useChat();

  const { currentUser, blockUser, unblockUser } = useAuth();
  const { startCall } = useCall();
  const [showInfo, setShowInfo] = useState(false);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  // Multi-selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [showStarredFilter, setShowStarredFilter] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);

  // Message Search & Jump to Date State
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [showJumpToDateModal, setShowJumpToDateModal] = useState(false);

  const [viewingMedia, setViewingMedia] = useState<{
    url: string;
    type: 'image' | 'video' | 'file';
    senderName?: string;
    timestamp?: number;
    caption?: string;
    fileName?: string;
  } | null>(null);

  // All media items in current chat for rich carousel navigation
  const chatMediaList = useMemo(() => {
    return messages
      .filter((m) => (m.type === 'image' || m.type === 'video' || (m.type === 'file' && m.mediaUrl)) && !m.isDeletedForEveryone)
      .map((m) => ({
        id: m.id,
        url: m.mediaUrl || '',
        type: m.type as 'image' | 'video' | 'file',
        senderName: m.senderName,
        timestamp: m.timestamp,
        caption: m.text,
        fileName: m.fileName,
      }))
      .filter((m) => !!m.url);
  }, [messages]);

  const activeMediaIndex = useMemo(() => {
    if (!viewingMedia) return 0;
    const idx = chatMediaList.findIndex((m) => m.url === viewingMedia.url);
    return idx >= 0 ? idx : 0;
  }, [viewingMedia, chatMediaList]);

  const otherUid = activeChat?.type === 'direct' 
    ? activeChat.participants.find(p => p !== currentUser?.uid) 
    : null;

  // Real-time listener for direct chat partner's block status & profile
  useEffect(() => {
    if (!otherUid) {
      setOtherUser(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', otherUid), (snap) => {
      if (snap.exists()) {
        setOtherUser(snap.data() as UserProfile);
      }
    }, () => {});
    return () => unsub();
  }, [otherUid]);

  // Reset selection mode when activeChat changes
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
  }, [activeChat?.id]);

  // Mark chat as read when opened/viewing
  useEffect(() => {
    if (activeChat?.id && currentUser?.uid && (activeChat.unreadCount?.[currentUser.uid] || 0) > 0) {
      markChatAsRead(activeChat.id);
    }
  }, [activeChat?.id, activeChat?.unreadCount, currentUser?.uid, markChatAsRead]);

  // Jump to specific message and pulse highlight
  const jumpToMessage = (messageId: string) => {
    if (showStarredFilter) {
      setShowStarredFilter(false);
    }
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-pulse');
        setTimeout(() => {
          el.classList.remove('highlight-pulse');
        }, 2500);
      }
    }, 120);
  };

  // Search message filtering & jump
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setActiveMatchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matched = messages
      .filter((m) =>
        (m.text && m.text.toLowerCase().includes(q)) ||
        (m.fileName && m.fileName.toLowerCase().includes(q)) ||
        (m.senderName && m.senderName.toLowerCase().includes(q))
      )
      .map((m) => m.id);

    setSearchMatches(matched);
    if (matched.length > 0) {
      const lastIdx = matched.length - 1;
      setActiveMatchIndex(lastIdx);
      jumpToMessage(matched[lastIdx]);
    }
  }, [searchQuery, messages]);

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = activeMatchIndex > 0 ? activeMatchIndex - 1 : searchMatches.length - 1;
    setActiveMatchIndex(nextIdx);
    jumpToMessage(searchMatches[nextIdx]);
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = activeMatchIndex < searchMatches.length - 1 ? activeMatchIndex + 1 : 0;
    setActiveMatchIndex(nextIdx);
    jumpToMessage(searchMatches[nextIdx]);
  };

  if (!activeChat || !currentUser) return null;

  const isSupportChat =
    activeChat.id.startsWith('support_') ||
    activeChat.participants?.includes('limochat_official_support');
  const isBlockedByMe = otherUid && !isSupportChat ? (currentUser.blockedUsers || []).includes(otherUid) : false;
  const isBlockedByThem = (otherUser?.blockedUsers || []).includes(currentUser.uid);
  const isBlocked = isBlockedByMe || isBlockedByThem;

  const handleReply = (message: Message) => {
    setReplyingTo({
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text || (message.type === 'voice' ? '🎤 Voice Note' : '📎 Attachment'),
      type: message.type,
    });
  };

  // Selection handlers
  const handleToggleSelect = (messageId: string) => {
    setSelectedMessageIds(prev => 
      prev.includes(messageId) ? prev.filter(id => id !== messageId) : [...prev, messageId]
    );
  };

  const handleEnterSelectionMode = (initialMessageId?: string) => {
    setIsSelectionMode(true);
    if (initialMessageId) {
      setSelectedMessageIds([initialMessageId]);
    } else {
      setSelectedMessageIds([]);
    }
  };

  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
  };

  const handleStarSelected = () => {
    for (const id of selectedMessageIds) {
      toggleStarMessage(id);
    }
    handleExitSelectionMode();
  };

  const handleCopySelected = () => {
    const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
    const text = selectedMsgs.map(m => m.text).filter(Boolean).join('\n');
    if (text) {
      navigator.clipboard.writeText(text);
    }
    handleExitSelectionMode();
  };

  const displayMessages = messages.filter((m) => {
    // If past history is restricted for this user in this group, only show messages timestamped >= joinedAt
    if (
      activeChat.type === 'group' &&
      activeChat.memberHistoryRestricted?.[currentUser.uid] &&
      m.timestamp < (activeChat.memberJoinedAt?.[currentUser.uid] || 0)
    ) {
      return false;
    }
    // Starred filter
    if (showStarredFilter && !m.starredBy?.includes(currentUser.uid)) {
      return false;
    }
    return true;
  });

  // Check if all selected messages were sent by the current user
  const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
  const allSelectedAreMine = selectedMsgs.length > 0 && selectedMsgs.every(m => m.senderId === currentUser.uid);

  const confirmBulkDelete = async (forEveryone: boolean) => {
    await deleteMessagesBulk(selectedMessageIds, forEveryone);
    setShowBulkDeleteModal(false);
    handleExitSelectionMode();
  };

  const confirmClearChat = async () => {
    await clearChatHistory(activeChat.id);
    setShowClearConfirm(false);
  };

  const confirmDeleteChat = async () => {
    await deleteChat(activeChat.id);
    setShowDeleteChatConfirm(false);
    onBack();
  };

  const wallpaperClasses: Record<string, string> = {
    'default': 'whatsapp-bg',
    'dark-slate': 'bg-[#0f172a] wallpaper-slate',
    'emerald': 'bg-[#064e3b] wallpaper-emerald',
    'navy': 'bg-[#172554] wallpaper-navy',
    'light-doodle': 'whatsapp-bg-light',
    'apple-glass': 'bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#020617] backdrop-blur-3xl wallpaper-glass',
    'blurred-mesh': 'bg-gradient-to-tr from-[#005c4b]/30 via-[#111b21] to-[#1e1b4b]/40 backdrop-blur-2xl wallpaper-mesh',
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden relative">
      {/* Main Chat Flow */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Selection Header Mode vs Normal Chat Header */}
        {isSelectionMode ? (
          <div className="h-16 px-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between select-none z-10 animate-fade-in">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExitSelectionMode}
                className="p-2 rounded-full text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition cursor-pointer"
                title="Cancel selection"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-white font-semibold text-sm sm:text-base">
                {selectedMessageIds.length} selected
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 text-[#8696a0]">
              <button
                type="button"
                onClick={handleStarSelected}
                disabled={selectedMessageIds.length === 0}
                className="p-2.5 rounded-full hover:text-white hover:bg-[#2a3942] transition cursor-pointer disabled:opacity-30"
                title="Star selected"
              >
                <Star className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleCopySelected}
                disabled={selectedMessageIds.length === 0}
                className="p-2.5 rounded-full hover:text-white hover:bg-[#2a3942] transition cursor-pointer disabled:opacity-30"
                title="Copy selected text"
              >
                <Copy className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={selectedMessageIds.length === 0}
                className="p-2.5 rounded-full hover:text-red-400 hover:bg-[#2a3942] transition cursor-pointer disabled:opacity-30"
                title="Delete selected messages"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <ChatHeader
            chat={activeChat}
            currentUser={currentUser}
            isBlocked={isBlocked}
            onBack={onBack}
            onStartAudioCall={() => startCall({ chat: activeChat, callType: 'audio' })}
            onStartVideoCall={() => startCall({ chat: activeChat, callType: 'video' })}
            onToggleInfo={() => setShowInfo(!showInfo)}
            onOpenSearch={() => setIsSearchingMessages(true)}
            onOpenJumpToDate={() => setShowJumpToDateModal(true)}
            onEnterSelectionMode={() => handleEnterSelectionMode()}
            onClearChat={() => setShowClearConfirm(true)}
            onDeleteChat={isSupportChat ? undefined : () => setShowDeleteChatConfirm(true)}
            isFilteringStarred={showStarredFilter}
            onToggleStarredFilter={() => setShowStarredFilter(!showStarredFilter)}
            onToggleBlock={isSupportChat ? undefined : () => {
              if (otherUid) {
                if (isBlockedByMe) {
                  unblockUser(otherUid);
                } else {
                  blockUser(otherUid);
                }
              }
            }}
          />
        )}

        {/* In-Chat Message Search Bar */}
        {isSearchingMessages && (
          <div className="h-14 px-3 sm:px-4 bg-[#182229]/95 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between gap-2.5 animate-slide-down z-20 select-none shadow-md">
            <div className="flex items-center gap-2 flex-1 max-w-xl bg-white/[0.06] hover:bg-white/[0.09] focus-within:bg-white/[0.12] border border-white/15 focus-within:border-[#00a884]/60 px-3 py-1.5 rounded-2xl transition-all shadow-inner">
              <Search className="w-4 h-4 text-[#8696a0] flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages in this chat..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-[#8696a0] focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#8696a0] hover:text-white p-0.5 cursor-pointer transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-[#8696a0]">
              {searchQuery.trim() ? (
                searchMatches.length > 0 ? (
                  <span className="text-white font-mono text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold whitespace-nowrap">
                    {activeMatchIndex + 1} of {searchMatches.length}
                  </span>
                ) : (
                  <span className="text-red-400 text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-red-500/20 font-semibold whitespace-nowrap">No matches</span>
                )
              ) : null}

              <button
                type="button"
                onClick={handlePrevMatch}
                disabled={searchMatches.length === 0}
                className="p-1.5 rounded-xl hover:bg-white/10 hover:text-white disabled:opacity-30 transition cursor-pointer active:scale-95"
                title="Previous match"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleNextMatch}
                disabled={searchMatches.length === 0}
                className="p-1.5 rounded-xl hover:bg-white/10 hover:text-white disabled:opacity-30 transition cursor-pointer active:scale-95"
                title="Next match"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSearchingMessages(false);
                  setSearchQuery('');
                  setSearchMatches([]);
                }}
                className="p-1.5 rounded-xl hover:bg-white/10 hover:text-white transition cursor-pointer ml-1 active:scale-95"
                title="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Starred Messages Filter Active Banner */}
        {showStarredFilter && (
          <div className="bg-[#182229] border-b border-[#2e3b44] px-4 py-2 flex items-center justify-between text-xs text-amber-400 select-none animate-fade-in z-10">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>Filtered: Showing {displayMessages.length} starred {displayMessages.length === 1 ? 'message' : 'messages'}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowStarredFilter(false)}
              className="text-[11px] text-[#8696a0] hover:text-white transition px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 cursor-pointer font-medium"
            >
              Show all messages
            </button>
          </div>
        )}

        {/* Messages with Custom Wallpaper */}
        <div className={`flex-1 flex flex-col overflow-hidden ${wallpaperClasses[wallpaper] || 'whatsapp-bg'}`}>
          <MessageList
            messages={displayMessages}
            currentUser={currentUser}
            onReply={handleReply}
            onDeleteForEveryone={deleteMessageForEveryone}
            onDeleteForMe={deleteMessageForMe}
            onToggleStar={toggleStarMessage}
            selectedMessageIds={selectedMessageIds}
            isSelectionMode={isSelectionMode}
            onToggleSelect={handleToggleSelect}
            onEnterSelectionMode={handleEnterSelectionMode}
            onReportMessage={(m) => {
              setShowInfo(false);
              setIsSelectionMode(false);
              setReportingMessage(m);
            }}
            onViewMedia={(media) => {
              setShowInfo(false);
              setIsSelectionMode(false);
              setViewingMedia(media);
            }}
          />

          {/* Blocked Contact State vs Message Restriction vs Normal Message Input */}
          {isBlockedByMe ? (
            <div className="p-3.5 sm:p-4 bg-[#202c33]/95 backdrop-blur-xl border-t border-[#2e3b44] flex items-center justify-between gap-3 text-xs text-[#8696a0] select-none">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>You blocked this contact. Unblock to send messages or place calls.</span>
              </div>
              <button
                type="button"
                onClick={() => otherUid && unblockUser(otherUid)}
                className="px-3.5 py-1.5 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl font-semibold transition cursor-pointer flex-shrink-0"
              >
                Unblock
              </button>
            </div>
          ) : isBlockedByThem ? (
            <div className="p-4 bg-[#202c33]/95 backdrop-blur-xl border-t border-[#2e3b44] flex items-center justify-center gap-2 text-xs text-red-400 select-none">
              <Ban className="w-4 h-4 flex-shrink-0" />
              <span>You cannot send messages or call this contact.</span>
            </div>
          ) : currentUser.punishment?.restrictions?.disableSendingMessages ? (
            <div className="p-3.5 sm:p-4 bg-[#202c33]/95 backdrop-blur-xl border-t border-amber-500/30 flex items-center justify-center gap-2 text-xs text-amber-400 select-none">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                Sending messages is restricted on your account: "{currentUser.punishment.reason || 'Policy violation'}"
              </span>
            </div>
          ) : (
            <MessageInput
              replyingTo={replyingTo}
              onClearReply={() => setReplyingTo(null)}
              onSendMessage={sendMessage}
              onTyping={setTyping}
            />
          )}
        </div>
      </div>

      {/* Slide-out Contact / Group Info Panel */}
      <ChatInfoDrawer
        chat={activeChat}
        currentUser={currentUser}
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        messages={messages}
        onBlockUser={blockUser}
        onUnblockUser={unblockUser}
        onStartAudioCall={() => startCall({ chat: activeChat, callType: 'audio' })}
        onStartVideoCall={() => startCall({ chat: activeChat, callType: 'video' })}
        onOpenSearch={() => setIsSearchingMessages(true)}
        onOpenJumpToDate={() => setShowJumpToDateModal(true)}
        onJumpToMessage={jumpToMessage}
        onViewMedia={(media) => {
          setShowInfo(false);
          setViewingMedia(media);
        }}
        onToggleStarredFilter={() => setShowStarredFilter(prev => !prev)}
        isFilteringStarred={showStarredFilter}
      />

      {/* Jump to Date Modal */}
      {showJumpToDateModal && (
        <JumpToDateModal
          isOpen={showJumpToDateModal}
          onClose={() => setShowJumpToDateModal(false)}
          messages={messages}
          onSelectDate={jumpToMessage}
        />
      )}

      {/* SMART BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-default animate-fade-in" 
            onClick={() => setShowBulkDeleteModal(false)} 
          />
          <div className="relative z-50 w-full max-w-sm bg-[#202c33] border border-[#2e3b44] rounded-2xl p-5 shadow-2xl animate-scale-in">
            <h3 className="text-base font-semibold text-white mb-2">
              Delete {selectedMessageIds.length} {selectedMessageIds.length === 1 ? 'message' : 'messages'}?
            </h3>
            
            <p className="text-xs text-[#8696a0] mb-5 leading-relaxed">
              {allSelectedAreMine
                ? "You can delete these messages for everyone in the chat, or just remove them from your device."
                : "You have selected messages from other participants. You can remove them from your device."}
            </p>

            <div className="flex flex-col gap-2">
              {/* If all selected are own messages: Offer Delete for everyone */}
              {allSelectedAreMine && (
                <button
                  type="button"
                  onClick={() => confirmBulkDelete(true)}
                  className="w-full py-2.5 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-xl text-xs transition cursor-pointer text-left flex items-center justify-between"
                >
                  <span>Delete for everyone</span>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Delete for me is always available */}
              <button
                type="button"
                onClick={() => confirmBulkDelete(false)}
                className="w-full py-2.5 px-4 bg-[#182229] hover:bg-[#2a3942] text-[#e9edef] font-medium rounded-xl text-xs transition cursor-pointer text-left flex items-center justify-between"
              >
                <span>Delete for me</span>
                <Trash2 className="w-4 h-4 text-[#8696a0]" />
              </button>

              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="w-full py-2.5 px-4 text-center text-xs text-[#8696a0] hover:text-white transition cursor-pointer mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR CHAT HISTORY MODAL */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-default animate-fade-in" 
            onClick={() => setShowClearConfirm(false)} 
          />
          <div className="relative z-50 w-full max-w-sm bg-[#202c33] border border-[#2e3b44] rounded-2xl p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Clear this chat?</h3>
                <p className="text-[11px] text-[#8696a0]">This will clear messages from your device.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearChat}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Clear chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CHAT CONFIRMATION MODAL */}
      {showDeleteChatConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-default animate-fade-in" 
            onClick={() => setShowDeleteChatConfirm(false)} 
          />
          <div className="relative z-50 w-full max-w-sm bg-[#202c33] border border-[#2e3b44] rounded-2xl p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-red-500/20 rounded-xl text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete this chat?</h3>
                <p className="text-[11px] text-[#8696a0]">Chat will be permanently deleted from your chats list.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowDeleteChatConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#8696a0] hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteChat}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Delete chat
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Central Viewport-Level Report Message Modal */}
      {reportingMessage && (
        <ReportMessageModal
          isOpen={true}
          onClose={() => setReportingMessage(null)}
          message={reportingMessage}
          currentUser={currentUser}
        />
      )}

      {/* In-App Multi-Item Media Viewer Carousel */}
      {viewingMedia && (
        <MediaViewerModal
          isOpen={true}
          onClose={() => setViewingMedia(null)}
          mediaList={chatMediaList.length > 0 ? chatMediaList : [{
            url: viewingMedia.url,
            type: viewingMedia.type,
            senderName: viewingMedia.senderName,
            timestamp: viewingMedia.timestamp,
            caption: viewingMedia.caption,
            fileName: viewingMedia.fileName
          }]}
          initialIndex={activeMediaIndex}
          mediaUrl={viewingMedia.url}
          mediaType={viewingMedia.type}
          senderName={viewingMedia.senderName}
          timestamp={viewingMedia.timestamp}
          caption={viewingMedia.caption}
          fileName={viewingMedia.fileName}
        />
      )}
    </div>
  );
};
