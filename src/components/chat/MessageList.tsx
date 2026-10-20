import React, { useEffect, useRef, useState } from 'react';
import { Message, UserProfile } from '../../types';
import { MessageBubble } from './MessageBubble';
import { formatMessageDate } from '../../utils/formatters';
import { Lock, ChevronDown } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  currentUser: UserProfile;
  onReply: (message: Message) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onToggleStar: (messageId: string) => void;
  selectedMessageIds?: string[];
  isSelectionMode?: boolean;
  onToggleSelect?: (messageId: string) => void;
  onEnterSelectionMode?: (messageId: string) => void;
  onReportMessage?: (message: Message) => void;
  onViewMedia?: (media: {
    url: string;
    type: 'image' | 'video' | 'file';
    senderName?: string;
    timestamp?: number;
    caption?: string;
    fileName?: string;
  }) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUser,
  onReply,
  onDeleteForEveryone,
  onDeleteForMe,
  onToggleStar,
  selectedMessageIds = [],
  isSelectionMode = false,
  onToggleSelect,
  onEnterSelectionMode,
  onReportMessage,
  onViewMedia,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Single active menu coordinator: only one message menu/modal can be open at a time
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [activeMenuMode, setActiveMenuMode] = useState<'desktop_menu' | 'desktop_emoji' | 'mobile_modal' | null>(null);

  const handleOpenDesktopMenu = (msgId: string) => {
    setActiveMenuMessageId(msgId);
    setActiveMenuMode('desktop_menu');
  };

  const handleOpenDesktopEmoji = (msgId: string) => {
    setActiveMenuMessageId(msgId);
    setActiveMenuMode('desktop_emoji');
  };

  const handleOpenMobileModal = (msgId: string) => {
    setActiveMenuMessageId(msgId);
    setActiveMenuMode('mobile_modal');
  };

  const handleCloseAnyMenu = () => {
    setActiveMenuMessageId(null);
    setActiveMenuMode(null);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isSelectionMode) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isSelectionMode]);

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 space-y-1 select-none relative scroll-smooth"
    >
      {/* End-to-End Encryption Notice Banner */}
      <div className="flex justify-center mb-4">
        <div className="bg-[#182229]/80 border border-[#233138] rounded-xl px-4 py-2 text-center max-w-md shadow-sm">
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#e9edef] font-medium mb-0.5">
            <Lock className="w-3.5 h-3.5 text-[#00a884]" />
            <span>End-to-End Encrypted</span>
          </div>
          <p className="text-[11px] text-[#8696a0] leading-tight">
            Messages and calls are secured with end-to-end encryption. Hold any message to react, select or manage.
          </p>
        </div>
      </div>

      {/* Messages */}
      {messages.map((message, index) => {
        const isMe = message.senderId === currentUser.uid;
        const prevMsg = messages[index - 1];
        const showDateSeparator =
          !prevMsg ||
          new Date(prevMsg.timestamp).toDateString() !== new Date(message.timestamp).toDateString();
        const isSelected = selectedMessageIds.includes(message.id);

        const isAnyMenuOpen = activeMenuMessageId === message.id;
        const isDesktopMenuOpen = isAnyMenuOpen && activeMenuMode === 'desktop_menu';
        const isDesktopEmojiOpen = isAnyMenuOpen && activeMenuMode === 'desktop_emoji';
        const isMobileModalOpen = isAnyMenuOpen && activeMenuMode === 'mobile_modal';

        return (
          <React.Fragment key={message.id}>
            {showDateSeparator && (
              <div className="flex justify-center my-3">
                <span className="bg-[#182229] border border-[#233138] text-[#8696a0] text-[11px] font-medium px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                  {formatMessageDate(message.timestamp)}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              isMe={isMe}
              currentUser={currentUser}
              onReply={onReply}
              onDeleteForEveryone={onDeleteForEveryone}
              onDeleteForMe={onDeleteForMe}
              onToggleStar={onToggleStar}
              isSelected={isSelected}
              isSelectionMode={isSelectionMode}
              onToggleSelect={onToggleSelect}
              onEnterSelectionMode={onEnterSelectionMode}
              isDesktopMenuOpen={isDesktopMenuOpen}
              isDesktopEmojiOpen={isDesktopEmojiOpen}
              isMobileModalOpen={isMobileModalOpen}
              isAnyMenuOpenForThisMessage={isAnyMenuOpen}
              onOpenDesktopMenu={() => handleOpenDesktopMenu(message.id)}
              onOpenDesktopEmoji={() => handleOpenDesktopEmoji(message.id)}
              onOpenMobileModal={() => handleOpenMobileModal(message.id)}
              onCloseAnyMenu={handleCloseAnyMenu}
              onReportMessage={onReportMessage}
              onViewMedia={onViewMedia}
            />
          </React.Fragment>
        );
      })}

      <div ref={bottomRef} />

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed sm:absolute bottom-20 sm:bottom-24 right-4 sm:right-6 z-20 p-2.5 rounded-full bg-[#202c33]/90 hover:bg-[#2a3942] active:scale-90 border border-white/15 text-white shadow-2xl backdrop-blur-xl transition-all cursor-pointer animate-scale-in flex items-center justify-center group"
          title="Scroll to latest messages"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5 text-white group-hover:text-[#00a884] transition-colors" />
        </button>
      )}
    </div>
  );
};
