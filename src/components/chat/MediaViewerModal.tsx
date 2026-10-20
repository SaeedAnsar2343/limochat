import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Share2, 
  Maximize, 
  Minimize, 
  Film, 
  Check, 
  Play
} from 'lucide-react';
import { formatTime } from '../../utils/formatters';

export interface MediaItem {
  id?: string;
  url: string;
  type: 'image' | 'video' | 'file';
  senderName?: string;
  timestamp?: number;
  caption?: string;
  fileName?: string;
}

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Multi-item gallery support
  mediaList?: MediaItem[];
  initialIndex?: number;
  // Backward compatibility fallback props
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
  senderName?: string;
  timestamp?: number;
  caption?: string;
  fileName?: string;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  onClose,
  mediaList,
  initialIndex = 0,
  mediaUrl,
  mediaType = 'image',
  senderName,
  timestamp,
  caption,
  fileName,
}) => {
  // Normalize items array
  const items: MediaItem[] = React.useMemo(() => {
    if (mediaList && mediaList.length > 0) {
      return mediaList;
    }
    if (mediaUrl) {
      return [{
        url: mediaUrl,
        type: mediaType,
        senderName,
        timestamp,
        caption,
        fileName,
      }];
    }
    return [];
  }, [mediaList, mediaUrl, mediaType, senderName, timestamp, caption, fileName]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Touch gesture state for mobile swipe navigation
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);

  // Sync initialIndex when it changes
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < items.length) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, items.length]);

  // Reset zoom & rotation whenever active item changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [currentIndex]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (filmstripRef.current && items.length > 1) {
      const activeThumb = filmstripRef.current.children[currentIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex, items.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, items.length]);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  const isVideo = currentItem.type === 'video' || currentItem.url.startsWith('data:video') || currentItem.url.endsWith('.mp4');

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.3, 3.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.3, 0.6));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const toggleZoom = () => {
    setZoom((prev) => (prev > 1 ? 1 : 2));
  };

  const handleDownload = () => {
    try {
      const a = document.createElement('a');
      a.href = currentItem.url;
      a.download = currentItem.fileName || (isVideo ? `limochat_video_${Date.now()}.mp4` : `limochat_photo_${Date.now()}.jpg`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Download started');
    } catch (e) {
      window.open(currentItem.url, '_blank');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentItem.fileName || 'LimoChat Media',
          text: currentItem.caption || 'Shared via LimoChat',
          url: currentItem.url,
        });
        return;
      } catch (e) {}
    }
    // Fallback: Copy link
    try {
      await navigator.clipboard.writeText(currentItem.url);
      showToast('Media link copied to clipboard!');
    } catch (e) {
      showToast('Unable to copy link');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Touch Swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const diffX = touchStartXRef.current - e.changedTouches[0].clientX;
    const diffY = touchStartYRef.current - e.changedTouches[0].clientY;

    // Detect horizontal swipe (at least 45px distance and greater than vertical diff)
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-3xl select-none animate-fade-in text-white overflow-hidden">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#00a884] text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 animate-scale-in">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="h-16 px-3 sm:px-6 flex items-center justify-between bg-black/75 backdrop-blur-xl border-b border-white/10 z-30 flex-shrink-0">
        {/* Left: Sender & Metadata */}
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-xs">
                {currentItem.senderName ? `${currentItem.senderName}'s Media` : currentItem.fileName || 'Media Viewer'}
              </h4>
              {items.length > 1 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-emerald-400 font-bold">
                  {currentIndex + 1} of {items.length}
                </span>
              )}
            </div>
            {currentItem.timestamp && (
              <span className="text-[11px] text-[#8696a0] block truncate">
                {formatTime(currentItem.timestamp)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1 sm:gap-2 text-[#8696a0]">
          {!isVideo && (
            <>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer hidden sm:flex"
                title="Zoom in (+)"
              >
                <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer hidden sm:flex"
                title="Zoom out (-)"
              >
                <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer hidden sm:flex"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </>
          )}

          {items.length > 1 && (
            <button
              type="button"
              onClick={() => setShowFilmstrip((prev) => !prev)}
              className={`p-2 rounded-full transition cursor-pointer hidden sm:flex ${
                showFilmstrip ? 'text-[#00a884] bg-[#00a884]/20' : 'hover:text-white hover:bg-white/10'
              }`}
              title="Toggle thumbnails carousel"
            >
              <Film className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Share or copy media link"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Download file"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer hidden md:flex"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => window.open(currentItem.url, '_blank')}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer hidden sm:flex"
            title="Open in new window"
          >
            <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer text-white ml-1"
            title="Close viewer"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Main Viewport Area */}
      <div 
        className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={onClose}
      >
        {/* Previous Navigation Arrow */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            className="absolute left-2 sm:left-6 z-30 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white hover:scale-110 active:scale-95 transition shadow-2xl cursor-pointer"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* Next Navigation Arrow */}
        {currentIndex < items.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-2 sm:right-6 z-30 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white hover:scale-110 active:scale-95 transition shadow-2xl cursor-pointer"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* Media Container */}
        <div 
          className="relative max-w-full max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {isVideo ? (
            <video
              key={currentItem.url}
              src={currentItem.url}
              controls
              autoPlay
              playsInline
              className="max-h-[72vh] sm:max-h-[78vh] max-w-[94vw] rounded-2xl shadow-2xl object-contain bg-black"
            />
          ) : (
            <img
              key={currentItem.url}
              src={currentItem.url}
              alt={currentItem.caption || 'Media'}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-h-[72vh] sm:max-h-[78vh] max-w-[94vw] rounded-2xl shadow-2xl object-contain cursor-grab active:cursor-grabbing select-none"
              onDoubleClick={toggleZoom}
              title="Double click to toggle 2x zoom"
            />
          )}
        </div>
      </div>

      {/* Floating Caption Pill (if any) */}
      {currentItem.caption && (
        <div className="px-4 pb-2 text-center z-20 pointer-events-none">
          <div className="inline-block px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-md border border-white/15 shadow-xl max-w-xl mx-auto pointer-events-auto">
            <p className="text-xs sm:text-sm text-white/95 leading-relaxed font-normal">
              {currentItem.caption}
            </p>
          </div>
        </div>
      )}

      {/* Bottom Filmstrip Carousel */}
      {items.length > 1 && showFilmstrip && (
        <div className="p-3 bg-black/85 backdrop-blur-2xl border-t border-white/10 z-30 flex-shrink-0 animate-fade-in">
          <div 
            ref={filmstripRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-4xl mx-auto px-2 py-1"
          >
            {items.map((item, idx) => {
              const active = idx === currentIndex;
              const isItemVideo = item.type === 'video' || item.url.startsWith('data:video') || item.url.endsWith('.mp4');

              return (
                <div
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden cursor-pointer transition-all ${
                    active
                      ? 'ring-2 ring-[#00a884] scale-105 shadow-[0_0_14px_rgba(0,168,132,0.7)] opacity-100'
                      : 'opacity-50 hover:opacity-90 hover:scale-100'
                  }`}
                >
                  {isItemVideo ? (
                    <div className="w-full h-full bg-[#111b21] flex items-center justify-center">
                      <Play className="w-4 h-4 text-[#00a884]" />
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.caption || `Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {active && (
                    <div className="absolute inset-0 bg-[#00a884]/15 pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
