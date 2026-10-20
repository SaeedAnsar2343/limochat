import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, Play, Pause, ExternalLink } from 'lucide-react';
import { formatTime } from '../../utils/formatters';

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'file';
  senderName?: string;
  timestamp?: number;
  caption?: string;
  fileName?: string;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  senderName,
  timestamp,
  caption,
  fileName,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !mediaUrl) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = fileName || (mediaType === 'video' ? 'limochat_video.mp4' : 'limochat_image.jpg');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-2xl select-none animate-fade-in">
      {/* Header Bar */}
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between bg-black/60 border-b border-white/10 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h4 className="text-sm font-semibold text-white truncate max-w-xs">
              {senderName ? `${senderName}'s Media` : fileName || 'Media Viewer'}
            </h4>
            {timestamp && (
              <span className="text-xs text-[#8696a0]">
                {formatTime(timestamp)}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 sm:gap-2 text-[#8696a0]">
          {mediaType === 'image' && (
            <>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Rotate"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Download file"
          >
            <Download className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => window.open(mediaUrl, '_blank')}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer hidden sm:block"
            title="Open in new window"
          >
            <ExternalLink className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition cursor-pointer text-white ml-2"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden relative"
        onClick={onClose}
      >
        <div 
          className="relative max-w-full max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {mediaType === 'video' || mediaUrl.startsWith('data:video') || mediaUrl.endsWith('.mp4') ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[82vh] max-w-[95vw] rounded-2xl shadow-2xl object-contain bg-black"
            />
          ) : (
            <img
              src={mediaUrl}
              alt={caption || 'Media'}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-h-[82vh] max-w-[95vw] rounded-2xl shadow-2xl object-contain cursor-grab active:cursor-grabbing select-none"
              onDoubleClick={zoom > 1 ? handleReset : handleZoomIn}
            />
          )}
        </div>
      </div>

      {/* Bottom Caption Bar */}
      {caption && (
        <div className="p-4 bg-black/75 border-t border-white/10 text-center z-20">
          <p className="text-sm text-white/90 max-w-2xl mx-auto leading-relaxed">
            {caption}
          </p>
        </div>
      )}
    </div>
  );
};
