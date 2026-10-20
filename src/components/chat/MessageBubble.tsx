import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Check, 
  CheckCheck, 
  Reply, 
  Trash2, 
  Star, 
  Copy, 
  MoreVertical, 
  Play, 
  Pause, 
  FileIcon, 
  Download,
  AlertCircle,
  Languages,
  Mic,
  RotateCcw,
  PhoneCall,
  PhoneMissed,
  Video,
  Phone,
  Smile,
  CheckSquare,
  Heart,
  Flag
} from 'lucide-react';
import { Message, UserProfile } from '../../types';
import { formatTime, formatDuration } from '../../utils/formatters';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';
import { translateText, SUPPORTED_LANGUAGES } from '../../utils/translate';
import { ReportMessageModal } from './ReportMessageModal';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  currentUser: UserProfile;
  onReply: (message: Message) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onToggleStar: (messageId: string) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onToggleSelect?: (messageId: string) => void;
  onEnterSelectionMode?: (messageId: string) => void;
  // Controlled menu coordinator props
  isDesktopMenuOpen?: boolean;
  isDesktopEmojiOpen?: boolean;
  isMobileModalOpen?: boolean;
  isAnyMenuOpenForThisMessage?: boolean;
  onOpenDesktopMenu?: () => void;
  onOpenDesktopEmoji?: () => void;
  onOpenMobileModal?: () => void;
  onCloseAnyMenu?: () => void;
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

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  currentUser,
  onReply,
  onDeleteForEveryone,
  onDeleteForMe,
  onToggleStar,
  isSelected = false,
  isSelectionMode = false,
  onToggleSelect,
  onEnterSelectionMode,
  isDesktopMenuOpen = false,
  isDesktopEmojiOpen = false,
  isMobileModalOpen = false,
  isAnyMenuOpenForThisMessage = false,
  onOpenDesktopMenu,
  onOpenDesktopEmoji,
  onOpenMobileModal,
  onCloseAnyMenu,
  onReportMessage,
  onViewMedia,
}) => {
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [openUpwards, setOpenUpwards] = useState(false);
  const threeDotsRef = useRef<HTMLDivElement | null>(null);

  // Screen adaptive placement: check if menu needs to flip upwards
  useEffect(() => {
    if (isDesktopMenuOpen && threeDotsRef.current) {
      const rect = threeDotsRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Chat input bar at bottom takes ~70-80px. Flip upwards if space below < 280px
      setOpenUpwards(spaceBelow < 280);
    }
  }, [isDesktopMenuOpen]);
  
  // Audio playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [detectedLang, setDetectedLang] = useState<string>('');
  const [currentTranslateLang, setCurrentTranslateLang] = useState<string>(
    currentUser.preferences?.translateTargetLanguage || 'en'
  );
  const [showLangPicker, setShowLangPicker] = useState(false);

  const { fontSize, reactToMessage } = useChat();
  const { startCall } = useCall();
  const fontClass = fontSize === 'lg' ? 'text-base' : fontSize === 'base' ? 'text-sm' : 'text-xs';

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(@[a-zA-Z0-9_\s]{1,30}?(?=\s|$|[.,!?]))/g);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        return (
          <span key={idx} className="text-[#53bdeb] font-semibold bg-[#53bdeb]/10 px-1 py-0.5 rounded">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Gesture refs
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  // Generate deterministic waveform bars
  const waveformBars = useMemo(() => {
    const seed = message.id || 'voice_default';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const bars: number[] = [];
    for (let i = 0; i < 32; i++) {
      const pseudoHeight = Math.abs(Math.sin(hash + i * 1.8) * 18) + 6;
      bars.push(Math.round(pseudoHeight));
    }
    return bars;
  }, [message.id]);

  // Aggregated reaction counts
  const reactionCounts = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    const map: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> = {};
    for (const r of message.reactions) {
      if (!map[r.emoji]) {
        map[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasReacted: false };
      }
      map[r.emoji].count += 1;
      map[r.emoji].users.push(r.userName || 'Someone');
      if (r.userId === currentUser.uid) {
        map[r.emoji].hasReacted = true;
      }
    }
    return Object.values(map);
  }, [message.reactions, currentUser.uid]);

  // Double tap heart pop handler
  const triggerDoubleTapHeart = () => {
    setShowHeartPop(true);
    setTimeout(() => setShowHeartPop(false), 750);
    reactToMessage(message.id, '❤️');
  };

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggeredRef.current = false;

    // Double-tap check (< 300ms)
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      triggerDoubleTapHeart();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    // Long press timer (400ms)
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (isSelectionMode) {
        onToggleSelect?.(message.id);
      } else {
        onOpenMobileModal?.();
      }
    }, 400);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartPosRef.current.x;
    const diffY = touch.clientY - touchStartPosRef.current.y;

    // Movement cancels long press
    if (Math.hypot(diffX, diffY) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Horizontal swipe-to-reply only when not selecting, not holding, and gesture is mainly horizontal
    if (!isSelectionMode && !isLongPressTriggeredRef.current && diffX > 0 && diffX < 80 && Math.abs(diffY) < 25) {
      setDragOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!isLongPressTriggeredRef.current) {
      if (isSelectionMode) {
        onToggleSelect?.(message.id);
      }
    }

    if (dragOffset > 45) {
      onReply(message);
    }
    setDragOffset(0);
    touchStartPosRef.current = null;
  };

  // Mouse double-click handler for desktop
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerDoubleTapHeart();
  };

  const handlePlayVoice = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleSeekWaveform = (index: number) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const newTime = (index / waveformBars.length) * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    if (!isPlayingAudio) {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const togglePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  // Translation handling
  const handleTranslate = async (targetLangCode?: string) => {
    if (showTranslated && !targetLangCode) {
      setShowTranslated(false);
      return;
    }

    const target = targetLangCode || currentTranslateLang;
    try {
      setIsTranslating(true);
      const res = await translateText(message.text, target);
      setTranslatedContent(res.translatedText);
      setDetectedLang(res.detectedSourceLanguage);
      setCurrentTranslateLang(target);
      setShowTranslated(true);
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setIsTranslating(false);
      setShowLangPicker(false);
    }
  };

  const isStarred = message.starredBy?.includes(currentUser.uid);

  return (
    <div
      id={`msg-${message.id}`}
      onClick={isSelectionMode ? () => onToggleSelect?.(message.id) : undefined}
      className={`group flex items-end gap-2 my-1 px-3 w-full transition-all select-none no-callout ${
        isMe ? 'justify-end' : 'justify-start'
      } ${isSelected ? 'bg-[#00a884]/15 py-1 rounded-xl' : ''} ${
        isSelectionMode ? 'cursor-pointer' : ''
      } ${isAnyMenuOpenForThisMessage ? 'z-40 relative' : 'z-0 relative'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenMobileModal?.();
      }}
      style={{
        transform: `translateX(${dragOffset}px)`,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      {/* Selection checkbox indicator when in multi-select mode */}
      {isSelectionMode && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(message.id);
          }}
          className="flex items-center justify-center mr-1.5 self-center flex-shrink-0 cursor-pointer"
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
            isSelected 
              ? 'bg-[#00a884] border-[#00a884] text-white' 
              : 'border-[#8696a0] hover:border-white'
          }`}>
            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
        </div>
      )}

      {/* Swipe to reply indicator */}
      {dragOffset > 25 && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-[#00a884] rounded-full text-white shadow-lg animate-scale-in">
          <Reply className="w-4 h-4" />
        </div>
      )}

      {/* Bubble Container */}
      <div
        className={`relative max-w-[88%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl px-3.5 py-2 text-sm shadow-md transition select-none ${
          isMe
            ? 'bg-[#005c4b] text-[#e9edef] rounded-br-xs message-bubble-out'
            : 'bg-[#202c33] text-[#e9edef] rounded-bl-xs message-bubble-in'
        } ${message.isDeletedForEveryone ? 'italic opacity-75' : ''} ${
          reactionCounts.length > 0 ? 'pb-3.5 mb-2.5' : ''
        }`}
      >
        {/* Heart Pop Animation on Double Tap */}
        {showHeartPop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <Heart className="w-14 h-14 text-red-500 fill-red-500 animate-heart-pop drop-shadow-lg" />
          </div>
        )}

        {/* Sender Name in Group */}
        {!isMe && message.senderName && (
          <div className="text-xs font-semibold text-[#53bdeb] mb-0.5 truncate">
            {message.senderName}
          </div>
        )}

        {/* Quoted Message (Drag/Replied preview - Click to jump to original) */}
        {message.quotedMessage && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (message.quotedMessage?.id) {
                const targetEl = document.getElementById(`msg-${message.quotedMessage.id}`);
                if (targetEl) {
                  targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  targetEl.classList.add('highlight-pulse');
                  setTimeout(() => targetEl.classList.remove('highlight-pulse'), 2000);
                }
              }
            }}
            className={`mb-2 p-2 rounded-lg border-l-4 text-xs cursor-pointer hover:opacity-90 active:scale-[0.99] transition ${
              isMe
                ? 'bg-[#025142] border-[#25d366] text-[#c0dad2]'
                : 'bg-[#182229] border-[#00a884] text-[#aebac1]'
            }`}
            title="Click to jump to quoted message"
          >
            <div className="font-semibold text-white mb-0.5">
              {message.quotedMessage.senderName}
            </div>
            <p className="line-clamp-2">{message.quotedMessage.text}</p>
          </div>
        )}

        {/* Message Content by Type */}
        {message.isDeletedForEveryone ? (
          <div className="flex items-center gap-2 text-xs text-[#8696a0] py-1">
            <AlertCircle className="w-4 h-4 text-[#8696a0]" />
            <span>This message was deleted</span>
          </div>
        ) : (
          <>
            {/* Image attachment */}
            {message.type === 'image' && message.mediaUrl && (
              <div className="mb-1 rounded-xl overflow-hidden max-h-80 bg-black/30">
                <img
                  src={message.mediaUrl}
                  alt="Attachment"
                  className="w-full h-auto object-cover max-h-80 cursor-pointer hover:opacity-95 transition"
                  onClick={() => {
                    if (onViewMedia) {
                      onViewMedia({
                        url: message.mediaUrl!,
                        type: 'image',
                        senderName: message.senderName,
                        timestamp: message.timestamp,
                        caption: message.text,
                      });
                    } else {
                      window.open(message.mediaUrl, '_blank');
                    }
                  }}
                />
              </div>
            )}

            {/* Video attachment */}
            {message.type === 'video' && message.mediaUrl && (
              <div 
                className="mb-1 rounded-xl overflow-hidden max-h-80 bg-black/60 relative cursor-pointer group"
                onClick={() => {
                  if (onViewMedia) {
                    onViewMedia({
                      url: message.mediaUrl!,
                      type: 'video',
                      senderName: message.senderName,
                      timestamp: message.timestamp,
                      caption: message.text,
                    });
                  }
                }}
              >
                <video
                  src={message.mediaUrl}
                  className="w-full h-auto object-cover max-h-80 rounded-xl"
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition">
                  <div className="w-12 h-12 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition">
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  </div>
                </div>
              </div>
            )}

            {/* REAL VOICE WAVEFORM PLAYER */}
            {message.type === 'voice' && message.mediaUrl && (
              <div className="py-1 min-w-[240px] sm:min-w-[280px]">
                <div className="flex items-center gap-3">
                  {/* Play / Pause button */}
                  <button
                    type="button"
                    onClick={handlePlayVoice}
                    className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center transition flex-shrink-0 shadow-md cursor-pointer"
                    title={isPlayingAudio ? "Pause" : "Play voice note"}
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>

                  {/* Interactive Waveform Bars */}
                  <div className="flex-1 flex flex-col justify-center">
                    <div 
                      className="flex items-center gap-[2.5px] h-8 cursor-pointer select-none py-1"
                      title="Click anywhere to scrub audio"
                    >
                      {waveformBars.map((height, i) => {
                        const totalDuration = audioRef.current?.duration || message.mediaDuration || 1;
                        const progressRatio = totalDuration > 0 ? currentTime / totalDuration : 0;
                        const barRatio = i / waveformBars.length;
                        const isPlayed = barRatio <= progressRatio;

                        return (
                          <div
                            key={i}
                            onClick={() => handleSeekWaveform(i)}
                            className="flex-1 rounded-full transition-all hover:opacity-80"
                            style={{
                              height: `${height}px`,
                              backgroundColor: isPlayed 
                                ? (isMe ? '#25d366' : '#00a884')
                                : (isMe ? 'rgba(255,255,255,0.35)' : 'rgba(134, 150, 160, 0.4)'),
                              minWidth: '2px',
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Progress duration & Speed pill */}
                    <div className="flex items-center justify-between text-[10px] text-[#8696a0] font-mono mt-0.5">
                      <span>
                        {formatDuration(currentTime > 0 ? currentTime : (message.mediaDuration || 0))}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={togglePlaybackRate}
                          className="px-1.5 py-0.5 rounded-full bg-black/20 hover:bg-black/40 text-white font-mono text-[9px] transition cursor-pointer"
                          title="Change playback speed"
                        >
                          {playbackRate}x
                        </button>
                        <Mic className="w-3 h-3 text-[#00a884]" />
                      </div>
                    </div>
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  src={message.mediaUrl}
                  onTimeUpdate={(e) => {
                    const audio = e.currentTarget;
                    setCurrentTime(audio.currentTime);
                  }}
                  onEnded={() => {
                    setIsPlayingAudio(false);
                    setCurrentTime(0);
                  }}
                />
              </div>
            )}

            {/* Document / File */}
            {message.type === 'file' && (
              <div className="flex items-center gap-3 p-2 bg-black/20 rounded-xl mb-1.5">
                <div className="p-2.5 bg-[#00a884]/20 rounded-lg text-[#00a884]">
                  <FileIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    {message.fileName || 'Document'}
                  </div>
                  <div className="text-[10px] text-[#8696a0]">{message.fileSize || 'Attachment'}</div>
                </div>
                {message.mediaUrl && (
                  <a
                    href={message.mediaUrl}
                    download={message.fileName || 'file'}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-[#8696a0] hover:text-white transition"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {/* Call Log Message Bubble (WhatsApp Style) */}
            {message.type === 'call_log' && (
              <div className="py-1 px-1 min-w-[220px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-full ${
                      message.callStatus === 'missed' 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'bg-[#00a884]/20 text-[#00a884]'
                    }`}>
                      {message.callStatus === 'missed' ? (
                        <PhoneMissed className="w-4 h-4" />
                      ) : message.callType === 'video' ? (
                        <Video className="w-4 h-4" />
                      ) : (
                        <PhoneCall className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className={`text-xs font-semibold ${
                        message.callStatus === 'missed' ? 'text-red-400' : 'text-white'
                      }`}>
                        {message.text}
                      </div>
                      <div className="text-[10px] text-[#8696a0]">
                        {message.callStatus === 'missed' 
                          ? 'Missed call • Tap to redial' 
                          : `${message.callType === 'video' ? 'Video call' : 'Voice call'} ended`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => startCall({ callType: message.callType || 'audio' })}
                    className="p-2 rounded-xl bg-black/20 hover:bg-[#00a884] hover:text-white text-[#00a884] transition cursor-pointer"
                    title={`Call back (${message.callType || 'audio'})`}
                  >
                    {message.callType === 'video' ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Text Message with Real-Time Translation */}
            {message.text && message.type !== 'call_log' && (
              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <p className={`${fontClass} leading-relaxed whitespace-pre-wrap break-words pr-2 flex-1`}>
                    {renderMessageContent(showTranslated && translatedContent ? translatedContent : message.text)}
                  </p>

                  {/* Translate Action Icon */}
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => handleTranslate()}
                      className={`p-1 rounded-full transition cursor-pointer flex-shrink-0 ${
                        showTranslated 
                          ? 'bg-[#00a884]/30 text-[#00a884]' 
                          : 'text-[#8696a0] hover:text-white hover:bg-black/20'
                      }`}
                      title={showTranslated ? "Show original text" : `Translate to ${currentTranslateLang.toUpperCase()}`}
                    >
                      <Languages className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin text-[#00a884]' : ''}`} />
                    </button>

                    {/* Change target language button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLangPicker(!showLangPicker);
                      }}
                      className="text-[9px] text-[#8696a0] hover:text-white px-1 uppercase font-mono"
                      title="Select target language"
                    >
                      {currentTranslateLang}
                    </button>

                    {/* Language Picker Dropdown */}
                    {showLangPicker && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 cursor-default" 
                          onClick={(e) => { e.stopPropagation(); setShowLangPicker(false); }} 
                        />
                        <div 
                          className="absolute right-0 top-6 z-50 w-44 max-h-48 overflow-y-auto bg-[#233138] border border-[#2e3b44] rounded-xl shadow-2xl py-1 text-xs text-[#d1d7db]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-3 py-1 text-[10px] uppercase font-semibold text-[#8696a0] border-b border-[#2e3b44]">
                            Translate into:
                          </div>
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => handleTranslate(lang.code)}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#182229] flex items-center justify-between ${
                                currentTranslateLang === lang.code ? 'text-[#00a884] font-semibold' : ''
                              }`}
                            >
                              <span>{lang.name}</span>
                              <span className="text-[10px] text-[#8696a0] font-mono">{lang.code.toUpperCase()}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Translation notification badge */}
                {showTranslated && (
                  <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-[#8696a0]">
                    <span className="flex items-center gap-1 text-[#00a884]">
                      <Languages className="w-3 h-3" />
                      <span>
                        Translated {detectedLang ? `from ${detectedLang.toUpperCase()}` : ''} to {currentTranslateLang.toUpperCase()}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTranslated(false)}
                      className="hover:underline flex items-center gap-0.5 text-[#e9edef] cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Original</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Timestamp, Star & Status Checkmarks */}
        <div className="flex items-center justify-end gap-1 text-[11px] text-[#8696a0] mt-1 float-right ml-3 select-none">
          {isStarred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 mr-0.5" />}
          <span>{formatTime(message.timestamp)}</span>

          {/* Delivery & Read Status Ticks (for current user's sent messages) */}
          {isMe && !message.isDeletedForEveryone && (
            <span className="ml-0.5">
              {message.status === 'sent' && (
                <span title="Sent"><Check className="w-3.5 h-3.5 text-[#8696a0]" /></span>
              )}
              {message.status === 'delivered' && (
                <span title="Delivered"><CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" /></span>
              )}
              {message.status === 'read' && (
                <span title="Read"><CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" /></span>
              )}
            </span>
          )}
        </div>

        {/* REACTION PILLS BADGE (WhatsApp style overlapping bottom) */}
        {reactionCounts.length > 0 && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              const myReaction = message.reactions?.find(r => r.userId === currentUser.uid);
              if (myReaction) {
                reactToMessage(message.id, myReaction.emoji);
              }
            }}
            className={`absolute -bottom-3.5 ${isMe ? 'right-2' : 'left-2'} z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shadow-md border cursor-pointer transition select-none ${
              reactionCounts.some(r => r.hasReacted) 
                ? 'bg-[#025142] border-[#00a884] text-white' 
                : 'bg-[#202c33] border-[#2e3b44] text-[#e9edef] hover:bg-[#2a3942]'
            }`}
            title={reactionCounts.map(r => `${r.emoji} ${r.users.join(', ')}`).join('\n')}
          >
            {reactionCounts.map(r => (
              <span key={r.emoji} className="flex items-center gap-0.5">
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-[10px] text-[#8696a0] font-semibold">{r.count}</span>}
              </span>
            ))}
          </div>
        )}

        {/* DESKTOP HOVER CONTROLS: Emoji React & 3-Dots Menu (Hidden on mobile) */}
        {!isSelectionMode && (
          <div className="absolute top-1 right-1 hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition z-20">
            {/* Desktop Smile Icon to React */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDesktopEmojiOpen) {
                    onCloseAnyMenu?.();
                  } else {
                    onOpenDesktopEmoji?.();
                  }
                }}
                className="p-1 rounded-full bg-black/40 text-[#8696a0] hover:text-white hover:bg-black/60 transition cursor-pointer"
                title="React to message"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>

              {/* Desktop Emoji Bar Popup */}
              {isDesktopEmojiOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={(e) => { e.stopPropagation(); onCloseAnyMenu?.(); }} 
                  />
                  <div 
                    className={`absolute ${
                      isMe ? 'right-0' : 'left-0'
                    } -top-11 z-50 flex items-center gap-1 px-2.5 py-1.5 bg-[#233138] border border-[#2e3b44] rounded-full shadow-2xl animate-scale-in`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          reactToMessage(message.id, emoji);
                          onCloseAnyMenu?.();
                        }}
                        className="text-lg hover:scale-130 active:scale-95 transition cursor-pointer select-none px-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Desktop 3-Dots Button */}
            <div className="relative" ref={threeDotsRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDesktopMenuOpen) {
                    onCloseAnyMenu?.();
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    setOpenUpwards(spaceBelow < 280);
                    onOpenDesktopMenu?.();
                  }
                }}
                className="p-1 rounded-full bg-black/40 text-[#8696a0] hover:text-white hover:bg-black/60 transition cursor-pointer"
                title="Message options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {/* Desktop Dropdown Context Menu - Elevated z-index & Screen-Adaptive (Opens upwards when near screen bottom) */}
              {isDesktopMenuOpen && (
                <>
                  {/* Backdrop for Auto-Close */}
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseAnyMenu?.();
                    }}
                  />
                  <div
                    className={`absolute ${
                      isMe ? 'right-0' : 'left-0'
                    } ${
                      openUpwards ? 'bottom-full mb-1' : 'top-7'
                    } z-50 min-w-[185px] bg-[#233138] border border-[#2e3b44] rounded-2xl shadow-2xl py-1 text-xs text-[#d1d7db] animate-scale-in`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        onReply(message);
                        onCloseAnyMenu?.();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Reply className="w-3.5 h-3.5 text-[#00a884]" />
                      <span>Reply</span>
                    </button>

                    {onEnterSelectionMode && (
                      <button
                        onClick={() => {
                          onEnterSelectionMode(message.id);
                          onCloseAnyMenu?.();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Select message</span>
                      </button>
                    )}

                    {message.text && (
                      <button
                        onClick={() => {
                          handleTranslate();
                          onCloseAnyMenu?.();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 cursor-pointer"
                      >
                        <Languages className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{showTranslated ? 'Original Text' : 'Translate'}</span>
                      </button>
                    )}

                    {message.mediaUrl && (
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = message.mediaUrl!;
                          a.download = message.fileName || (message.type === 'image' ? 'photo.jpg' : message.type === 'video' ? 'video.mp4' : 'media_download');
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          onCloseAnyMenu?.();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 cursor-pointer text-cyan-400"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download {message.type === 'image' ? 'photo' : message.type === 'video' ? 'video' : 'media'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(message.text || '');
                        onCloseAnyMenu?.();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#8696a0]" />
                      <span>Copy text</span>
                    </button>

                    <button
                      onClick={() => {
                        onToggleStar(message.id);
                        onCloseAnyMenu?.();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 cursor-pointer"
                    >
                      <Star className={`w-3.5 h-3.5 ${isStarred ? 'text-amber-400 fill-amber-400' : 'text-[#8696a0]'}`} />
                      <span>{isStarred ? 'Unstar' : 'Star message'}</span>
                    </button>

                    {/* Report Message to Admin Desk */}
                    <button
                      onClick={() => {
                        onReportMessage?.(message);
                        onCloseAnyMenu?.();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 text-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Report message</span>
                    </button>

                    <div className="border-t border-[#2e3b44] my-1" />

                    <button
                      onClick={() => {
                        onDeleteForMe(message.id);
                        onCloseAnyMenu?.();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete for me</span>
                    </button>

                    {isMe && !message.isDeletedForEveryone && (
                      <button
                        onClick={() => {
                          onDeleteForEveryone(message.id);
                          onCloseAnyMenu?.();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5 text-red-400 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete for everyone</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE ACTION SHEET & FLOATING REACTION BAR (Triggered on Hold / Long-press / ContextMenu) */}
      {isMobileModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center p-3 sm:p-4 select-none">
          {/* Backdrop for outside touch close */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in cursor-default"
            onClick={onCloseAnyMenu}
          />

          <div className="relative z-50 w-full max-w-sm flex flex-col gap-2.5 animate-scale-in">
            {/* Top: Floating Quick Reactions Pill */}
            <div className="flex items-center justify-around py-2.5 px-3 bg-[#202c33]/95 backdrop-blur-2xl border border-[#2e3b44] rounded-full shadow-2xl">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    reactToMessage(message.id, emoji);
                    onCloseAnyMenu?.();
                  }}
                  className="text-2xl hover:scale-130 active:scale-90 transition cursor-pointer select-none p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Selected Message Preview Snippet */}
            <div className="bg-[#182229]/90 backdrop-blur-xl border border-[#2e3b44] rounded-xl px-3.5 py-2 text-xs flex items-center justify-between text-[#8696a0]">
              <span className="truncate max-w-[220px] text-white font-medium">
                {message.text || (message.type === 'voice' ? '🎤 Voice note' : '📎 Attachment')}
              </span>
              <span className="text-[10px] font-mono">{formatTime(message.timestamp)}</span>
            </div>

            {/* Bottom Actions Card */}
            <div className="bg-[#202c33]/95 backdrop-blur-2xl border border-[#2e3b44] rounded-2xl shadow-2xl overflow-hidden divide-y divide-[#2e3b44] text-xs text-[#e9edef]">
              <button
                type="button"
                onClick={() => {
                  onReply(message);
                  onCloseAnyMenu?.();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left cursor-pointer"
              >
                <Reply className="w-4 h-4 text-[#00a884]" />
                <span className="font-medium">Reply</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleStar(message.id);
                  onCloseAnyMenu?.();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left cursor-pointer"
              >
                <Star className={`w-4 h-4 ${isStarred ? 'text-amber-400 fill-amber-400' : 'text-[#8696a0]'}`} />
                <span>{isStarred ? 'Unstar' : 'Star message'}</span>
              </button>

              {message.text && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(message.text || '');
                    onCloseAnyMenu?.();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-[#8696a0]" />
                  <span>Copy text</span>
                </button>
              )}

              {message.mediaUrl && (
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = message.mediaUrl!;
                    a.download = message.fileName || (message.type === 'image' ? 'photo.jpg' : message.type === 'video' ? 'video.mp4' : 'media_download');
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    onCloseAnyMenu?.();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left text-cyan-400 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span className="font-medium">Download {message.type === 'image' ? 'photo' : message.type === 'video' ? 'video' : 'media'}</span>
                </button>
              )}

              {onEnterSelectionMode && (
                <button
                  type="button"
                  onClick={() => {
                    onEnterSelectionMode(message.id);
                    onCloseAnyMenu?.();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                  <span>Select</span>
                </button>
              )}

              {message.text && (
                <button
                  type="button"
                  onClick={() => {
                    handleTranslate();
                    onCloseAnyMenu?.();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left cursor-pointer"
                >
                  <Languages className="w-4 h-4 text-cyan-400" />
                  <span>{showTranslated ? 'Original text' : `Translate to ${currentTranslateLang.toUpperCase()}`}</span>
                </button>
              )}

              {/* Report Message */}
              <button
                type="button"
                onClick={() => {
                  onReportMessage?.(message);
                  onCloseAnyMenu?.();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left text-amber-400 cursor-pointer"
              >
                <Flag className="w-4 h-4 text-amber-400" />
                <span className="font-medium">Report message</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onDeleteForMe(message.id);
                  onCloseAnyMenu?.();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left text-red-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete for me</span>
              </button>

              {isMe && !message.isDeletedForEveryone && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteForEveryone(message.id);
                    onCloseAnyMenu?.();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#182229] active:bg-[#182229] transition text-left text-red-400 font-semibold cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete for everyone</span>
                </button>
              )}
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onCloseAnyMenu}
              className="w-full py-3 bg-[#202c33]/95 backdrop-blur-xl border border-[#2e3b44] rounded-xl text-center text-xs font-semibold text-[#8696a0] hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
