import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Image, FileText, Film, Lock, FileSpreadsheet, FileArchive, FileCode } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('limochat_close_all_menus'));
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

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

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const fileExt = (fileData.name.split('.').pop() || '').toUpperCase();

  const getDocIconAndTheme = () => {
    if (fileExt === 'PDF') {
      return {
        bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
        badge: 'bg-rose-500 text-white',
        icon: <FileText className="w-10 h-10" />,
        label: 'PDF Document',
      };
    }
    if (['DOC', 'DOCX', 'TXT', 'RTF'].includes(fileExt)) {
      return {
        bg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
        badge: 'bg-blue-500 text-white',
        icon: <FileText className="w-10 h-10" />,
        label: `${fileExt} Document`,
      };
    }
    if (['XLS', 'XLSX', 'CSV'].includes(fileExt)) {
      return {
        bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        badge: 'bg-emerald-500 text-white',
        icon: <FileSpreadsheet className="w-10 h-10" />,
        label: 'Spreadsheet',
      };
    }
    if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(fileExt)) {
      return {
        bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        badge: 'bg-amber-500 text-black font-bold',
        icon: <FileArchive className="w-10 h-10" />,
        label: 'Archive File',
      };
    }
    if (['JS', 'TS', 'JSON', 'HTML', 'CSS', 'PY', 'JAVA', 'CPP', 'C'].includes(fileExt)) {
      return {
        bg: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
        badge: 'bg-purple-500 text-white',
        icon: <FileCode className="w-10 h-10" />,
        label: 'Code / Script',
      };
    }
    return {
      bg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
      badge: 'bg-cyan-600 text-white',
      icon: <FileText className="w-10 h-10" />,
      label: fileExt ? `${fileExt} File` : 'Document',
    };
  };

  const docTheme = getDocIconAndTheme();

  const modalContent = (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#0b141a] text-white select-none animate-fade-in pt-safe pb-safe pointer-events-auto">
      {/* Top Header */}
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between bg-[#111b21] border-b border-[#222e35] z-30 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full text-[#8696a0] hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer flex-shrink-0"
            title="Discard"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
              {fileData.type === 'image'
                ? 'Send Photo'
                : fileData.type === 'video'
                ? 'Send Video'
                : 'Send Document'}
            </h4>
            <span className="text-[11px] text-[#8696a0] font-mono truncate block">
              {fileData.name} • {formatFileSize(fileData.size)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {fileExt && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${docTheme.badge}`}>
              {fileExt}
            </span>
          )}
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden min-h-0 relative">
        {fileData.type === 'image' && (
          <div className="w-full h-full flex items-center justify-center p-2">
            <img
              src={fileData.dataUrl}
              alt="Preview"
              className="max-h-[65vh] max-w-full sm:max-w-2xl rounded-2xl shadow-2xl object-contain border border-white/10 animate-scale-in"
            />
          </div>
        )}

        {fileData.type === 'video' && (
          <div className="w-full h-full flex items-center justify-center p-2">
            <video
              src={fileData.dataUrl}
              controls
              playsInline
              className="max-h-[65vh] max-w-full sm:max-w-2xl rounded-2xl shadow-2xl object-contain bg-black border border-white/10 animate-scale-in"
            />
          </div>
        )}

        {fileData.type === 'file' && (
          <div className="w-full max-w-md bg-[#182229] border border-[#2e3b44] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center gap-4 shadow-2xl text-center animate-scale-in mx-auto">
            {/* Elevated Icon with Extension Badge */}
            <div className="relative">
              <div className={`w-20 h-20 rounded-2xl border flex items-center justify-center shadow-lg ${docTheme.bg}`}>
                {docTheme.icon}
              </div>
              {fileExt && (
                <span className={`absolute -bottom-2 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${docTheme.badge}`}>
                  {fileExt}
                </span>
              )}
            </div>

            {/* Document Details */}
            <div className="w-full px-2">
              <h5 className="font-semibold text-white text-sm sm:text-base break-all leading-snug line-clamp-2">
                {fileData.name}
              </h5>
              <div className="flex items-center justify-center gap-2 text-xs text-[#8696a0] mt-1.5 font-mono">
                <span>{formatFileSize(fileData.size)}</span>
                <span>•</span>
                <span>{docTheme.label}</span>
              </div>
            </div>

            {/* End-to-End Encryption Notice */}
            <div className="flex items-center gap-1.5 text-[11px] text-[#8696a0] bg-[#111b21] px-3 py-1.5 rounded-full border border-white/5">
              <Lock className="w-3 h-3 text-[#00a884]" />
              <span>End-to-end encrypted document</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Caption & Send Bar (Native WhatsApp Style) */}
      <div className="p-3 sm:p-4 bg-[#111b21] border-t border-[#222e35] z-30 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 flex items-center bg-[#202c33] rounded-2xl px-4 py-2.5 border border-[#2e3b44] focus-within:border-[#00a884] transition shadow-inner">
            <input
              ref={inputRef}
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Add a caption..."
              className="flex-1 bg-transparent text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#00a884] hover:bg-[#02906f] active:scale-90 text-white transition-all shadow-[0_2px_12px_rgba(0,168,132,0.4)] flex items-center justify-center cursor-pointer disabled:opacity-50 flex-shrink-0"
            title="Send"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
};
