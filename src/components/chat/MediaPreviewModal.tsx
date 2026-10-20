import React, { useState } from 'react';
import { X, Send, Image, FileText, Film, Smile } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: {
    name: string;
    size: number;
    type: 'image' | 'video' | 'file';
    dataUrl: string;
  } | null;
  onSend: (caption: string, type: 'image' | 'video' | 'file', dataUrl: string, extra?: any) => Promise<void>;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  onClose,
  fileData,
  onSend,
}) => {
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !fileData) return null;

  const handleSend = async () => {
    if (isSending) return;
    try {
      setIsSending(true);
      await onSend(caption.trim(), fileData.type, fileData.dataUrl, {
        fileName: fileData.name,
        fileSize: formatFileSize(fileData.size),
      });
      setCaption('');
      onClose();
    } catch (err: any) {
      alert(`Could not send media: ${err.message || 'Error'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b141a]/95 backdrop-blur-2xl select-none animate-fade-in">
      {/* Top Header */}
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between bg-black/40 border-b border-white/10 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#8696a0] hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Discard"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h4 className="text-sm font-semibold text-white truncate max-w-xs">
              {fileData.type === 'image' ? 'Send Photo' : fileData.type === 'video' ? 'Send Video' : 'Send Document'}
            </h4>
            <span className="text-[11px] text-[#8696a0] font-mono">
              {fileData.name} • {formatFileSize(fileData.size)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
        {fileData.type === 'image' && (
          <img
            src={fileData.dataUrl}
            alt="Preview"
            className="max-h-[65vh] max-w-[90vw] sm:max-w-[70vw] rounded-2xl shadow-2xl object-contain border border-white/10"
          />
        )}

        {fileData.type === 'video' && (
          <video
            src={fileData.dataUrl}
            controls
            playsInline
            className="max-h-[65vh] max-w-[90vw] sm:max-w-[70vw] rounded-2xl shadow-2xl object-contain bg-black border border-white/10"
          />
        )}

        {fileData.type === 'file' && (
          <div className="bg-[#182229] border border-[#2e3b44] rounded-3xl p-8 flex flex-col items-center justify-center gap-4 shadow-2xl max-w-sm text-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-10 h-10" />
            </div>
            <div>
              <h5 className="font-semibold text-white text-base truncate max-w-xs">
                {fileData.name}
              </h5>
              <p className="text-xs text-[#8696a0] mt-1 font-mono">
                {formatFileSize(fileData.size)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Caption & Send Bar (WhatsApp style) */}
      <div className="p-3 sm:p-4 bg-[#111b21] border-t border-[#2e3b44] flex items-center gap-2 max-w-3xl mx-auto w-full z-20">
        <div className="flex-1 flex items-center gap-2 bg-[#2a3942] rounded-2xl px-4 py-2 border border-[#2e3b44]">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a caption..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className="p-3.5 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white transition shadow-lg flex items-center justify-center cursor-pointer disabled:opacity-50"
          title="Send"
        >
          <Send className="w-5 h-5 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
