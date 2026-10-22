import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Heart, 
  Eye, 
  Volume2, 
  VolumeX, 
  Film,
  Sparkles
} from 'lucide-react';
import { StatusUpdate, UserProfile } from '../../types';
import { Avatar } from '../common/Avatar';
import { formatTime } from '../../utils/formatters';
import { useChat } from '../../context/ChatContext';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { NativeNotificationService } from '../../utils/nativeNotifications';

interface StatusViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: StatusUpdate[];
  currentUser: UserProfile;
  initialIndex?: number;
}

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({
  isOpen,
  onClose,
  statuses,
  currentUser,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const { chats, createDirectChat, setActiveChat, sendMessage } = useChat();
  const progressIntervalRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex, isOpen]);

  const currentStatus = statuses[currentIndex];
  const isMyStatus = currentStatus?.userId === currentUser.uid;

  // Mark status as viewed in Firestore
  useEffect(() => {
    if (!isOpen || !currentStatus || !currentUser) return;
    if (!currentStatus.viewedBy?.includes(currentUser.uid)) {
      try {
        const docRef = doc(db, 'statuses', currentStatus.id);
        updateDoc(docRef, {
          viewedBy: arrayUnion(currentUser.uid),
        }).catch(() => {});
      } catch {}
    }
  }, [isOpen, currentIndex, currentStatus?.id]);

  // Handle segmented video playback boundaries
  useEffect(() => {
    if (!currentStatus) return;
    setIsMuted(!!currentStatus.isMuted);

    if (videoRef.current) {
      if (currentStatus.segmentStart !== undefined) {
        videoRef.current.currentTime = currentStatus.segmentStart;
      } else {
        videoRef.current.currentTime = 0;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, currentStatus]);

  // Handle slide progress timer
  // For video: synchronized with video element time
  // For text/photo: 5-second slide duration
  useEffect(() => {
    if (!isOpen || statuses.length === 0 || isPaused) return;

    const isVideo =
      currentStatus.mediaType === 'video' ||
      currentStatus.mediaUrl?.startsWith('data:video') ||
      currentStatus.mediaUrl?.match(/\.(mp4|webm|mov)($|\?)/i);

    if (isVideo) {
      // Handled via onTimeUpdate callback of the <video> element
      return;
    }

    const intervalTime = 50; // every 50ms
    const totalDuration = 5000; // 5000ms = 5s
    const step = (intervalTime / totalDuration) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < statuses.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          } else {
            clearInterval(progressIntervalRef.current);
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, intervalTime);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isOpen, currentIndex, statuses.length, isPaused, onClose, currentStatus]);

  if (!isOpen || statuses.length === 0 || !currentStatus) return null;

  const isVideoStory =
    currentStatus.mediaType === 'video' ||
    currentStatus.mediaUrl?.startsWith('data:video') ||
    currentStatus.mediaUrl?.match(/\.(mp4|webm|mov)($|\?)/i);

  const segmentStart = currentStatus.segmentStart ?? 0;
  const segmentEnd = currentStatus.segmentEnd ?? (currentStatus.videoDuration || 30);
  const segmentDuration = Math.max(1, segmentEnd - segmentStart);

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || isPaused) return;
    const time = videoRef.current.currentTime;

    // Check if reached segment end or end of video
    if (time >= segmentEnd || videoRef.current.ended) {
      handleNext();
      return;
    }

    // Calculate progress percentage inside current segment
    const elapsed = Math.max(0, time - segmentStart);
    const pct = Math.min(100, (elapsed / segmentDuration) * 100);
    setProgress(pct);
  };

  const handleNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isMyStatus) return;

    try {
      setSendingReply(true);
      let targetChat = chats.find(
        (c) => c.type === 'direct' && c.participants.includes(currentStatus.userId)
      );
      if (!targetChat) {
        targetChat = await createDirectChat({
          uid: currentStatus.userId,
          displayName: currentStatus.userName,
          photoURL: currentStatus.userPhoto || '',
          phoneNumber: currentStatus.userPhone || '',
          email: '',
          about: '',
          isOnline: false,
          lastSeen: 0,
          privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', readReceipts: true },
          blockedUsers: [],
          createdAt: 0,
        });
      }

      setActiveChat(targetChat);
      await sendMessage(replyText.trim(), 'text', undefined, {
        quotedMessage: {
          id: currentStatus.id,
          senderId: currentStatus.userId,
          senderName: currentStatus.userName,
          text: currentStatus.text || 'Status Update',
        },
      });
      // Notify status author
      NativeNotificationService.notifyStatusReaction({
        userName: currentUser.displayName || 'A contact',
        replyText: replyText.trim(),
        statusId: currentStatus.id,
      });

      setReplyText('');
    } catch (err: any) {
      console.warn("Status reply notice:", err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleQuickReact = async (emoji: string) => {
    if (isMyStatus || !currentStatus || !currentUser) return;
    try {
      // 1. Register reaction on status document
      const docRef = doc(db, 'statuses', currentStatus.id);
      await updateDoc(docRef, {
        reactions: arrayUnion({
          emoji,
          userId: currentUser.uid,
          userName: currentUser.displayName || 'User',
          timestamp: Date.now(),
        }),
      }).catch(() => {});

      // 2. Dispatch push notification to status author
      NativeNotificationService.notifyStatusReaction({
        userName: currentUser.displayName || 'A contact',
        emoji,
        statusId: currentStatus.id,
      });

      // 3. Send direct message with emoji quoting status (WhatsApp style)
      let targetChat = chats.find(
        (c) => c.type === 'direct' && c.participants.includes(currentStatus.userId)
      );
      if (!targetChat) {
        targetChat = await createDirectChat({
          uid: currentStatus.userId,
          displayName: currentStatus.userName,
          photoURL: currentStatus.userPhoto || '',
          phoneNumber: currentStatus.userPhone || '',
          email: '',
          about: '',
          isOnline: false,
          lastSeen: 0,
          privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', readReceipts: true },
          blockedUsers: [],
          createdAt: 0,
        });
      }
      setActiveChat(targetChat);
      await sendMessage(emoji, 'text', undefined, {
        quotedMessage: {
          id: currentStatus.id,
          senderId: currentStatus.userId,
          senderName: currentStatus.userName,
          text: currentStatus.text || 'Status Update',
        },
      });
    } catch (err: any) {
      console.warn("Status reaction notice:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none animate-fade-in p-0 sm:p-4">
      {/* Story Stage Container */}
      <div 
        className="relative w-full h-[100dvh] sm:h-[90vh] sm:max-h-[840px] sm:max-w-md sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        style={{
          backgroundColor: currentStatus.backgroundColor || '#0b141a',
        }}
        onMouseDown={() => {
          setIsPaused(true);
          if (videoRef.current) videoRef.current.pause();
        }}
        onMouseUp={() => {
          setIsPaused(false);
          if (videoRef.current) videoRef.current.play().catch(() => {});
        }}
        onTouchStart={() => {
          setIsPaused(true);
          if (videoRef.current) videoRef.current.pause();
        }}
        onTouchEnd={() => {
          setIsPaused(false);
          if (videoRef.current) videoRef.current.play().catch(() => {});
        }}
      >
        {/* Top Header & Multi-Story Progress Bars */}
        <div className="pt-safe p-4 z-20 bg-gradient-to-b from-black/85 via-black/40 to-transparent">
          {/* Segmented Progress Bars */}
          <div className="flex items-center gap-1.5 mb-3">
            {statuses.map((_, i) => (
              <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{
                    width:
                      i < currentIndex
                        ? '100%'
                        : i === currentIndex
                        ? `${progress}%`
                        : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* User Info & Controls */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Avatar
                src={currentStatus.userPhoto}
                name={currentStatus.userName}
                size="sm"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm leading-tight">
                    {isMyStatus ? 'My Status' : currentStatus.userName}
                  </span>
                  {/* Multi-Part badge if video segment */}
                  {currentStatus.totalSegments && currentStatus.totalSegments > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#00a884]/30 border border-[#00a884]/50 text-[#00a884] text-[10px] font-semibold flex items-center gap-1">
                      <Film className="w-2.5 h-2.5" />
                      <span>
                        Part {(currentStatus.segmentIndex ?? 0) + 1}/{currentStatus.totalSegments}
                      </span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/70">
                  {formatTime(currentStatus.timestamp)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isVideoStory && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Story Middle Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
          {/* Previous / Next invisible click zones */}
          <div
            onClick={handlePrev}
            className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer z-10 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition"
          >
            {currentIndex > 0 && (
              <div className="p-2 bg-black/40 rounded-full text-white backdrop-blur-sm">
                <ChevronLeft className="w-6 h-6" />
              </div>
            )}
          </div>

          <div
            onClick={handleNext}
            className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer z-10 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition"
          >
            <div className="p-2 bg-black/40 rounded-full text-white backdrop-blur-sm">
              <ChevronRight className="w-6 h-6" />
            </div>
          </div>

          {/* Media or Text Story */}
          {currentStatus.mediaUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              {isVideoStory ? (
                <video
                  ref={videoRef}
                  src={currentStatus.mediaUrl}
                  autoPlay
                  playsInline
                  muted={isMuted}
                  onTimeUpdate={handleVideoTimeUpdate}
                  className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl"
                />
              ) : (
                <img
                  src={currentStatus.mediaUrl}
                  alt="Status update"
                  className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl"
                />
              )}

              {/* Tagged Contacts Pill */}
              {currentStatus.taggedContacts && currentStatus.taggedContacts.length > 0 && (
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-[11px] flex items-center gap-1.5 border border-white/10 shadow-lg">
                  <span>🏷️</span>
                  <span>{currentStatus.taggedContacts.map((c) => `@${c.displayName}`).join(', ')}</span>
                </div>
              )}

              {/* Caption */}
              {currentStatus.text && (
                <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-2xl text-white text-xs sm:text-sm text-left shadow-lg border border-white/10">
                  {currentStatus.text}
                </div>
              )}
            </div>
          ) : (
            /* Text Story with Font Family */
            <div className="max-w-xs break-words space-y-4 px-4">
              <p 
                className="text-white text-2xl sm:text-3xl font-bold leading-relaxed tracking-wide drop-shadow-md"
                style={{ fontFamily: currentStatus.fontFamily || 'inherit' }}
              >
                {currentStatus.text}
              </p>

              {/* Tagged Contacts for Text Story */}
              {currentStatus.taggedContacts && currentStatus.taggedContacts.length > 0 && (
                <div className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs border border-white/10">
                  <span>🏷️</span>
                  <span>{currentStatus.taggedContacts.map((c) => `@${c.displayName}`).join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Bar: Quick Emoji Reactions & Reply Input or Views Counter */}
        <div className="pb-safe p-4 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-2.5">
          {isMyStatus ? (
            <div className="flex items-center justify-center gap-2 text-white/90 text-xs py-2 bg-black/50 rounded-full backdrop-blur-md border border-white/10">
              <Eye className="w-4 h-4 text-[#00a884]" />
              <span>
                {currentStatus.viewedBy ? currentStatus.viewedBy.length : 1} view{currentStatus.viewedBy && currentStatus.viewedBy.length === 1 ? '' : 's'}
              </span>
            </div>
          ) : (
            <>
              {/* Quick Reactions Bar (WhatsApp Style) */}
              <div className="flex items-center justify-around px-2 py-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
                {['❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '💯'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleQuickReact(emoji)}
                    className="text-xl sm:text-2xl hover:scale-130 active:scale-95 transition-transform p-1 cursor-pointer select-none"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to status..."
                  className="flex-1 bg-black/60 border border-white/20 rounded-full px-4 py-2.5 text-xs text-white placeholder-white/60 focus:outline-none focus:border-[#00a884] backdrop-blur-md"
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#02906f] active:scale-95 text-white transition disabled:opacity-50 cursor-pointer shadow-lg shadow-[#00a884]/30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
