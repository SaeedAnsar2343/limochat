import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck,
  Phone,
  Sparkles,
  HelpCircle,
  Eye,
  Trash2,
  Terminal,
  Smile, 
  Paperclip, 
  Mic, 
  Send, 
  X, 
  Image, 
  FileText, 
  Camera,
  Reply,
  Lock,
  AtSign,
  ArrowRight
} from 'lucide-react';
import { QuotedMessage, MessageType, Message, UserProfile } from '../../types';
import { VoiceRecorder } from './VoiceRecorder';
import { MediaPreviewModal } from './MediaPreviewModal';
import { EmojiPickerDrawer } from './EmojiPickerDrawer';
import { formatFileSize } from '../../utils/formatters';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../common/Avatar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface MessageInputProps {
  replyingTo: QuotedMessage | null;
  onClearReply: () => void;
  onSendMessage: (text: string, type?: MessageType, mediaUrl?: string, extra?: Partial<Message>) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  replyingTo,
  onClearReply,
  onSendMessage,
  onTyping,
}) => {
  const { enterIsSend, activeChat } = useChat();
  const { currentUser } = useAuth();

  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);


  const isSupportChat = !!(
    activeChat?.id.startsWith('support_') ||
    activeChat?.participants?.includes('limochat_official_support') ||
    activeChat?.name === 'LimoChat Support'
  );

  const SUPPORT_COMMANDS = [
    { id: '/status', name: 'Account Status', desc: 'Permanent +991 line, 2FA & verified badge', icon: ShieldCheck },
    { id: '/call', name: 'Request Support Call', desc: 'Request live voice or video support authorization', icon: Phone },
    { id: '/version', name: 'App Version', desc: 'Check installed release build & updates', icon: Sparkles },
    { id: '/help', name: 'Support Guides & FAQ', desc: 'Frequently asked questions & usage guides', icon: HelpCircle },
    { id: '/security', name: 'Security & 2FA', desc: 'Check two-step verification & app lock', icon: Lock },
    { id: '/privacy', name: 'Privacy Controls', desc: 'Check visibility, receipts & disappearing timer', icon: Eye },
    { id: '/clear', name: 'Clear History', desc: 'Clear messages in this support conversation', icon: Trash2 },
  ];

  const isTypingCommand = isSupportChat && inputText.startsWith('/');
  const commandQuery = isTypingCommand ? inputText.slice(1).toLowerCase().trim() : '';
  const filteredCommands = isSupportChat && isTypingCommand
    ? SUPPORT_COMMANDS.filter((cmd) =>
        cmd.id.slice(1).toLowerCase().includes(commandQuery) ||
        cmd.name.toLowerCase().includes(commandQuery) ||
        cmd.desc.toLowerCase().includes(commandQuery)
      )
    : [];

  const handleExecuteCommand = async (cmdId: string) => {
    setInputText('');
    await onSendMessage(cmdId, 'text');
  };
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [pendingMediaPreview, setPendingMediaPreview] = useState<{
    name: string;
    size: number;
    type: 'image' | 'video' | 'file';
    dataUrl: string;
  } | null>(null);

  // Group @ Mention state
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Auto-focus input when a chat is opened on desktop / web
  useEffect(() => {
    if (!activeChat?.id) return;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (!isMobileDevice && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeChat?.id]);

  // Auto-close input menus when other menus or modals open
  useEffect(() => {
    const handleCloseInputMenus = () => {
      setShowEmojiPicker(false);
      setShowAttachMenu(false);
      setShowMentionList(false);
    };
    window.addEventListener('limochat_close_all_menus', handleCloseInputMenus);
    return () => window.removeEventListener('limochat_close_all_menus', handleCloseInputMenus);
  }, []);

  const commonEmojis = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '❤️', '😎', '👏', '🥳', '💯', '✨', '👋', '🚀', '⭐', '🤝', '🙌'];

  // Load group members for @ mentions
  useEffect(() => {
    if (activeChat?.type === 'group' && activeChat.participants && activeChat.participants.length > 0) {
      Promise.all(
        activeChat.participants
          .filter((uid) => uid !== currentUser?.uid && uid !== 'limochat_official_support')
          .map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) {
                return snap.data() as UserProfile;
              }
            } catch (e) {}
            return {
              uid,
              displayName: `Member ${uid.slice(0, 5)}`,
              photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${uid}`,
              phoneNumber: '',
              email: '',
              about: '',
              isOnline: false,
              lastSeen: 0,
              createdAt: 0,
              blockedUsers: [],
              privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', about: 'everyone', status: 'everyone', readReceipts: true },
            } as unknown as UserProfile;
          })
      ).then((members) => {
        setGroupMembers(members);
      });
    } else {
      setGroupMembers([]);
      setShowMentionList(false);
    }
  }, [activeChat?.id, activeChat?.participants, currentUser?.uid]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    onTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);

    // Group @ mention tagging
    if (activeChat?.type === 'group') {
      const cursor = e.target.selectionStart || val.length;
      const textUpToCursor = val.slice(0, cursor);
      const atIdx = textUpToCursor.lastIndexOf('@');

      if (atIdx !== -1) {
        const q = textUpToCursor.slice(atIdx + 1);
        // Only trigger if no whitespace inside mention query
        if (!/\s/.test(q)) {
          setShowMentionList(true);
          setMentionQuery(q.toLowerCase());
          setMentionStartIndex(atIdx);
          return;
        }
      }
      setShowMentionList(false);
    } else {
      setShowMentionList(false);
    }
  };

  const handleSelectMention = (member: UserProfile) => {
    if (mentionStartIndex === -1) return;
    const beforeAt = inputText.slice(0, mentionStartIndex);
    const afterMention = inputText.slice(mentionStartIndex + 1 + mentionQuery.length);
    const updated = `${beforeAt}@${member.displayName} ${afterMention}`;
    setInputText(updated);
    setShowMentionList(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const filteredMembers = groupMembers.filter((m) => {
    if (!mentionQuery) return true;
    return (
      m.displayName?.toLowerCase().includes(mentionQuery) ||
      m.phoneNumber?.includes(mentionQuery)
    );
  });

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    setShowMentionList(false);
    await onSendMessage(text, 'text');
    onTyping(false);
  };

  const effectiveOwner = activeChat?.createdBy || activeChat?.participants?.[0] || '';
  const isGroupOwner = effectiveOwner === currentUser?.uid;
  const isGroupAdmin = !!(activeChat?.adminIds && activeChat.adminIds.includes(currentUser?.uid || '')) || isGroupOwner;
  const isGroupModerator = !!(activeChat?.moderatorIds && activeChat.moderatorIds.includes(currentUser?.uid || ''));
  const canSendInGroup = isGroupAdmin || isGroupModerator;

  const isRestricted = activeChat?.type === 'group' && 
    activeChat.permissions?.whoCanSendMessage === 'admins' && 
    !canSendInGroup;

  if (isRestricted) {
    return (
      <div className="p-3.5 bg-[#202c33] border-t border-[#2e3b44] flex items-center justify-center text-xs text-[#8696a0] gap-2 select-none">
        <Lock className="w-4 h-4 text-[#8696a0]" />
        <span>Only group administrators and moderators can send messages to this group</span>
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionList && e.key === 'Escape') {
      setShowMentionList(false);
      return;
    }
    if (enterIsSend && e.key === 'Enter' && !e.shiftKey) {
      if (showMentionList && filteredMembers.length > 0) {
        e.preventDefault();
        handleSelectMention(filteredMembers[0]);
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendVoiceNote = async (blob: Blob, durationSec: number) => {
    setIsRecordingVoice(false);
    // Convert Blob to Data URL for instant delivery & playback
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      await onSendMessage('', 'voice', base64data, { mediaDuration: durationSec });
    };
    reader.readAsDataURL(blob);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isVideo = file.type.startsWith('video');
    reader.onloadend = () => {
      setPendingMediaPreview({
        name: file.name,
        size: file.size,
        type: isVideo ? 'video' : 'image',
        dataUrl: reader.result as string,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingMediaPreview({
        name: file.name,
        size: file.size,
        type: 'file',
        dataUrl: reader.result as string,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (isRecordingVoice) {
    return (
      <div className="p-3 bg-[#182229]/80 backdrop-blur-2xl border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] message-input-bar">
        <VoiceRecorder
          onSendVoice={handleSendVoiceNote}
          onCancel={() => setIsRecordingVoice(false)}
        />
      </div>
    );
  }

  return (
    <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 pb-safe bg-[#182229]/90 dark:bg-[#182229]/90 backdrop-blur-2xl backdrop-saturate-150 border-t border-white/[0.1] flex flex-col gap-2 relative message-input-bar shadow-[0_-8px_32px_rgba(0,0,0,0.35)] transition-all">
      {/* Quoted Message Preview (Drag-to-reply or quote) */}
      {replyingTo && (
        <div className="bg-[#111b21]/90 backdrop-blur-md border-l-4 border-[#00a884] rounded-r-2xl p-2.5 flex items-start justify-between animate-fade-in text-xs shadow-lg">
          <div className="flex items-start gap-2.5 min-w-0">
            <Reply className="w-4 h-4 text-[#00a884] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold text-white truncate block">
                Replying to {replyingTo.senderName}
              </span>
              <p className="text-[#8696a0] truncate mt-0.5 max-w-sm">
                {replyingTo.text || 'Media attachment'}
              </p>
            </div>
          </div>
          <button
            onClick={onClearReply}
            className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Group @ Mention Floating Tagging Sheet */}
      {showMentionList && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 sm:left-4 sm:max-w-sm mb-2 bg-[#202c33]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-56 flex flex-col animate-scale-in">
          <div className="px-3.5 py-2 bg-[#111b21]/90 border-b border-[#2e3b44] flex items-center justify-between text-xs font-semibold text-[#8696a0]">
            <div className="flex items-center gap-1.5 text-[#00a884]">
              <AtSign className="w-3.5 h-3.5" />
              <span>Tag Group Member</span>
            </div>
            <button
              type="button"
              onClick={() => setShowMentionList(false)}
              className="text-[#8696a0] hover:text-white transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-y-auto p-1.5 space-y-1">
            {filteredMembers.map((member) => (
              <div
                key={member.uid}
                onClick={() => handleSelectMention(member)}
                className="flex items-center justify-between gap-2.5 p-2 rounded-xl hover:bg-[#111b21] active:bg-[#182229] cursor-pointer transition select-none group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={member.photoURL} name={member.displayName} size="sm" isOnline={member.isOnline} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white group-hover:text-[#00a884] transition truncate">
                      {member.displayName}
                    </div>
                    {member.phoneNumber && (
                      <div className="text-[10px] text-[#8696a0] font-mono truncate">
                        {member.phoneNumber}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#00a884] opacity-0 group-hover:opacity-100 transition px-2 py-0.5 rounded-lg bg-[#00a884]/15 font-medium">
                  @Tag
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

            {/* Support Slash Commands Floating Palette - ONLY when typed '/' */}
      {isTypingCommand && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:max-w-md mb-2 bg-[#202c33]/95 backdrop-blur-2xl border border-[#00a884]/30 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-64 flex flex-col animate-scale-in">
          <div className="px-3.5 py-2 bg-[#111b21]/95 border-b border-[#2e3b44] flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-[#00a884]">
              <Terminal className="w-3.5 h-3.5" />
              <span>Support Commands</span>
            </div>
            <span className="text-[10px] text-[#8696a0]">Tap command to send</span>
          </div>
          <div className="overflow-y-auto p-1.5 space-y-1">
            {filteredCommands.map((cmd) => {
              const IconComp = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => handleExecuteCommand(cmd.id)}
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-[#111b21] active:bg-[#182229] transition cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#00a884]/15 border border-[#00a884]/30 flex items-center justify-center text-[#00a884] group-hover:scale-105 group-hover:bg-[#00a884]/25 transition flex-shrink-0">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white group-hover:text-[#00a884] transition flex items-center gap-2">
                        <span>{cmd.id}</span>
                        <span className="text-[10px] text-[#8696a0] font-normal">({cmd.name})</span>
                      </div>
                      <div className="text-[10px] text-[#8696a0] truncate">
                        {cmd.desc}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#8696a0] group-hover:text-[#00a884] group-hover:translate-x-0.5 transition flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Send Bar Dock with Glassmorphic Capsule */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Emoji Button */}
        <button
          onClick={() => {
            const next = !showEmojiPicker;
            if (next) window.dispatchEvent(new Event('limochat_close_all_menus'));
            setShowEmojiPicker(next);
            setShowAttachMenu(false);
          }}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 touch-manipulation flex-shrink-0 ${
            showEmojiPicker 
              ? 'text-[#00a884] bg-[#00a884]/20 border border-[#00a884]/50 shadow-[0_0_12px_rgba(0,168,132,0.35)]' 
              : 'text-gray-500 hover:text-gray-900 dark:text-[#8696a0] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08]'
          }`}
          title="Emojis, stickers & GIFs"
          aria-label="Emojis and stickers"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Attachment Button */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => {
              const next = !showAttachMenu;
              if (next) window.dispatchEvent(new Event('limochat_close_all_menus'));
              setShowAttachMenu(next);
              setShowEmojiPicker(false);
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 touch-manipulation ${
              showAttachMenu 
                ? 'text-[#00a884] bg-[#00a884]/20 border border-[#00a884]/50 shadow-[0_0_12px_rgba(0,168,132,0.35)]' 
                : 'text-gray-500 hover:text-gray-900 dark:text-[#8696a0] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08]'
            }`}
            title="Attach file or photo"
            aria-label="Attach media"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Attach Popup Menu */}
          {showAttachMenu && (
            <>
              <div 
                className="fixed inset-0 z-30 cursor-default" 
                onClick={() => setShowAttachMenu(false)} 
              />
              <div className="absolute bottom-14 left-0 z-40 bg-white/95 dark:bg-[#233138]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl p-2.5 shadow-2xl flex flex-col gap-1.5 w-52 animate-scale-in">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] text-xs text-gray-800 dark:text-[#d1d7db] hover:text-gray-900 dark:hover:text-white transition font-medium text-left cursor-pointer group"
                >
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                    <Image className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold">Photos & Videos</div>
                    <div className="text-[10px] text-gray-500 dark:text-[#8696a0]">Share images or clips</div>
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] text-xs text-gray-800 dark:text-[#d1d7db] hover:text-gray-900 dark:hover:text-white transition font-medium text-left cursor-pointer group"
                >
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold">Document</div>
                    <div className="text-[10px] text-gray-500 dark:text-[#8696a0]">PDF, Word, zip files</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        

        {/* Hidden inputs for attachments */}
        <input
          type="file"
          ref={imageInputRef}
          accept="image/*,video/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.doc,.docx,.txt,.zip"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Text Input with Single Glassmorphic pill Dock */}
        <div className="flex-1 message-input-pill bg-white dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.11] focus-within:bg-white dark:focus-within:bg-white/[0.13] border border-gray-300 dark:border-white/15 focus-within:border-[#00a884] dark:focus-within:border-[#00a884]/70 rounded-full px-4 py-2 sm:py-2.5 shadow-sm dark:shadow-inner transition-all flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full bg-transparent border-0 outline-0 ring-0 focus:outline-none focus:ring-0 p-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#8696a0] text-sm sm:text-base message-input-field"
          />
        </div>

        {/* Voice Note or Send Button (Branded, High Contrast, Always Visible) */}
        {inputText.trim() ? (
          <button
            onClick={handleSend}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-[#00a884] via-[#05c49b] to-[#14e2b0] hover:brightness-110 active:scale-90 text-white transition-all shadow-[0_2px_12px_rgba(0,168,132,0.5)] cursor-pointer flex items-center justify-center flex-shrink-0 animate-scale-in touch-manipulation group"
            title="Send Message"
            aria-label="Send message"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 group-hover:translate-x-0.5 transition-transform text-white" />
          </button>
        ) : (
          <button
            onClick={() => setIsRecordingVoice(true)}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#00a884] hover:bg-[#02906f] active:scale-90 text-white transition-all shadow-[0_2px_12px_rgba(0,168,132,0.4)] cursor-pointer flex items-center justify-center flex-shrink-0 touch-manipulation group"
            title="Record Voice Note"
            aria-label="Record voice note"
          >
            <Mic className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Comprehensive Emojis, LimoChat Exclusives, Animated Stickers & GIFs Drawer */}
      {showEmojiPicker && (
        <div className="w-full animate-fade-in pt-1">
          <EmojiPickerDrawer
            isOpen={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onSelectEmoji={(emoji) => {
              setInputText((prev) => prev + emoji);
              inputRef.current?.focus();
            }}
            onSelectGif={async (gifUrl, title) => {
              setShowEmojiPicker(false);
              await onSendMessage(title || 'GIF', 'image', gifUrl);
            }}
            onSendAnimatedEmoji={async (emoji, _name) => {
              await onSendMessage(emoji, 'text');
            }}
          />
        </div>
      )}
      {/* Media Send Preview Modal */}
      {pendingMediaPreview && (
        <MediaPreviewModal
          isOpen={true}
          fileData={pendingMediaPreview}
          onClose={() => setPendingMediaPreview(null)}
          onSend={async (caption, type, dataUrl, extra) => {
            await onSendMessage(caption || (type === 'image' ? 'Photo' : 'Attachment'), type, dataUrl, extra);
          }}
        />
      )}
    </div>
  );
};
