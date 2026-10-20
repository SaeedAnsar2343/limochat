import React, { useState, useRef, useEffect } from 'react';
import { 
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
  AtSign
} from 'lucide-react';
import { QuotedMessage, MessageType, Message, UserProfile } from '../../types';
import { VoiceRecorder } from './VoiceRecorder';
import { MediaPreviewModal } from './MediaPreviewModal';
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

  const isRestricted = activeChat?.type === 'group' && 
    activeChat.permissions?.whoCanSendMessage === 'admins' && 
    !activeChat.adminIds?.includes(currentUser?.uid || '');

  if (isRestricted) {
    return (
      <div className="p-3.5 bg-[#202c33] border-t border-[#2e3b44] flex items-center justify-center text-xs text-[#8696a0] gap-2 select-none">
        <Lock className="w-4 h-4 text-[#8696a0]" />
        <span>Only group administrators can send messages to this group</span>
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
    <div className="p-2 sm:p-3 bg-[#182229]/80 dark:bg-[#182229]/80 backdrop-blur-2xl backdrop-saturate-150 border-t border-white/[0.12] flex flex-col gap-2 relative message-input-bar shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
      {/* Quoted Message Preview (Drag-to-reply or quote) */}
      {replyingTo && (
        <div className="bg-[#111b21]/80 backdrop-blur-md border-l-4 border-[#00a884] rounded-r-xl p-2.5 flex items-start justify-between animate-fade-in text-xs shadow-md">
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
            className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition"
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

      {/* Main Bar with Glassmorphic elements */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Emoji Button */}
        <button
          onClick={() => {
            setShowEmojiPicker(!showEmojiPicker);
            setShowAttachMenu(false);
          }}
          className={`p-2 sm:p-2.5 rounded-full transition-all cursor-pointer ${
            showEmojiPicker 
              ? 'text-[#00a884] bg-[#00a884]/20 border border-[#00a884]/40 shadow-[0_0_12px_rgba(0,168,132,0.35)]' 
              : 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-white/[0.06]'
          }`}
          title="Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Attachment Button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowAttachMenu(!showAttachMenu);
              setShowEmojiPicker(false);
            }}
            className={`p-2 sm:p-2.5 rounded-full transition-all cursor-pointer ${
              showAttachMenu 
                ? 'text-[#00a884] bg-[#00a884]/20 border border-[#00a884]/40 shadow-[0_0_12px_rgba(0,168,132,0.35)]' 
                : 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-white/[0.06]'
            }`}
            title="Attach file or photo"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Attach Popup Menu */}
          {showAttachMenu && (
            <div className="absolute bottom-14 left-0 z-30 bg-[#233138]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 w-48 animate-scale-in">
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] text-xs text-[#d1d7db] transition font-medium text-left cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <Image className="w-4 h-4" />
                </div>
                <span>Photos & Videos</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] text-xs text-[#d1d7db] transition font-medium text-left cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <span>Document</span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden inputs for attachments */}
        <input
          type="file"
          ref={imageInputRef}
          accept="image/*"
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

        {/* Text Input with Glassmorphic pill */}
        <div className="flex-1 bg-white/[0.06] hover:bg-white/[0.09] focus-within:bg-white/[0.12] border border-white/10 focus-within:border-[#00a884]/60 rounded-2xl px-3.5 sm:px-4 py-1.5 sm:py-2 text-sm backdrop-blur-md transition-all flex items-center shadow-inner">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full bg-transparent text-white placeholder-[#8696a0] text-xs sm:text-sm focus:outline-none message-input-field"
          />
        </div>

        {/* Voice Note or Send Button */}
        {inputText.trim() ? (
          <button
            onClick={handleSend}
            className="p-2 sm:p-2.5 rounded-full bg-gradient-to-tr from-[#00a884] to-[#05c49b] hover:brightness-110 active:scale-95 text-white transition shadow-[0_0_18px_rgba(0,168,132,0.45)] cursor-pointer flex items-center justify-center flex-shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            onClick={() => setIsRecordingVoice(true)}
            className="p-2 sm:p-2.5 rounded-full text-[#8696a0] hover:text-[#00a884] hover:bg-[#00a884]/15 active:scale-95 transition cursor-pointer flex-shrink-0"
            title="Record Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Emoji Picker Drawer */}
      {showEmojiPicker && (
        <div className="bg-[#182229] border border-[#2e3b44] rounded-2xl p-3 grid grid-cols-9 gap-2 shadow-xl animate-fade-in">
          {commonEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setInputText((prev) => prev + emoji);
              }}
              className="text-xl p-1.5 hover:bg-[#202c33] rounded-lg transition active:scale-125"
            >
              {emoji}
            </button>
          ))}
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
