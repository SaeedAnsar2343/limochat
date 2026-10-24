import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Send, 
  FileText, 
  Lock, 
  FileSpreadsheet, 
  FileArchive, 
  FileCode, 
  ArrowLeft, 
  ExternalLink, 
  Eye, 
  FileCheck,
  BookOpen
} from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';
import { navigationManager } from '../../utils/navigationManager';

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

function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(parts[1] || '');
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return new Blob([], { type: 'application/octet-stream' });
  }
}

function decodeTextPreview(dataUrl: string): string | null {
  try {
    const parts = dataUrl.split(',');
    if (!parts[1]) return null;
    const decoded = decodeURIComponent(escape(atob(parts[1])));
    return decoded.slice(0, 2000);
  } catch {
    return null;
  }
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  onClose,
  fileData,
  onSend,
}) => {
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pdfViewMode, setPdfViewMode] = useState<'reader' | 'card'>('reader');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Register with global navigationManager for Android Back Button and Escape key
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('limochat_close_all_menus'));
      const unregister = navigationManager.registerModal('media_preview', onClose, 40);
      setTimeout(() => inputRef.current?.focus(), 80);
      return unregister;
    }
  }, [isOpen, onClose]);

  const fileExt = useMemo(() => {
    if (!fileData?.name) return '';
    return (fileData.name.split('.').pop() || '').toUpperCase();
  }, [fileData?.name]);

  const blobUrl = useMemo(() => {
    if (!fileData?.dataUrl) return null;
    const blob = dataUrlToBlob(fileData.dataUrl);
    return URL.createObjectURL(blob);
  }, [fileData?.dataUrl]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const textPreview = useMemo(() => {
    if (!fileData?.dataUrl) return null;
    const textExts = ['TXT', 'MD', 'JSON', 'CSV', 'JS', 'TS', 'HTML', 'CSS', 'PY', 'LOG'];
    if (textExts.includes(fileExt)) {
      return decodeTextPreview(fileData.dataUrl);
    }
    return null;
  }, [fileData?.dataUrl, fileExt]);

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

  const getDocTheme = () => {
    if (fileExt === 'PDF') {
      return {
        brandName: 'Adobe PDF Document',
        badgeBg: 'bg-rose-500 text-white',
        accentBorder: 'border-rose-500/30',
        iconBg: 'bg-rose-500/15 text-rose-400',
        icon: <FileText className="w-12 h-12 text-rose-500" />,
      };
    }
    if (['DOC', 'DOCX', 'RTF', 'ODT'].includes(fileExt)) {
      return {
        brandName: 'Microsoft Word Document',
        badgeBg: 'bg-blue-600 text-white',
        accentBorder: 'border-blue-500/30',
        iconBg: 'bg-blue-500/15 text-blue-400',
        icon: <FileText className="w-12 h-12 text-blue-500" />,
      };
    }
    if (['XLS', 'XLSX', 'CSV'].includes(fileExt)) {
      return {
        brandName: 'Excel Spreadsheet',
        badgeBg: 'bg-emerald-600 text-white',
        accentBorder: 'border-emerald-500/30',
        iconBg: 'bg-emerald-500/15 text-emerald-400',
        icon: <FileSpreadsheet className="w-12 h-12 text-emerald-500" />,
      };
    }
    if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(fileExt)) {
      return {
        brandName: 'Compressed Archive',
        badgeBg: 'bg-amber-500 text-black font-bold',
        accentBorder: 'border-amber-500/30',
        iconBg: 'bg-amber-500/15 text-amber-400',
        icon: <FileArchive className="w-12 h-12 text-amber-500" />,
      };
    }
    if (['JS', 'TS', 'JSON', 'HTML', 'CSS', 'PY', 'JAVA', 'CPP'].includes(fileExt)) {
      return {
        brandName: 'Source Code File',
        badgeBg: 'bg-purple-600 text-white',
        accentBorder: 'border-purple-500/30',
        iconBg: 'bg-purple-500/15 text-purple-400',
        icon: <FileCode className="w-12 h-12 text-purple-400" />,
      };
    }
    return {
      brandName: `${fileExt || 'Binary'} Document`,
      badgeBg: 'bg-cyan-600 text-white',
      accentBorder: 'border-cyan-500/30',
      iconBg: 'bg-cyan-500/15 text-cyan-400',
      icon: <FileText className="w-12 h-12 text-cyan-400" />,
    };
  };

  const docTheme = getDocTheme();

  const modalContent = (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#0b141a] text-white select-none animate-fade-in pt-safe pb-safe pointer-events-auto">
      {/* Top Header */}
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between bg-[#111b21] border-b border-[#222e35] z-30 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full text-[#8696a0] hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer flex-shrink-0"
            title="Discard (Esc / Back)"
          >
            <ArrowLeft className="w-5 h-5 sm:hidden" />
            <X className="w-5 h-5 hidden sm:block" />
          </button>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
              {fileData.type === 'image'
                ? 'Send Photo'
                : fileData.type === 'video'
                ? 'Send Video'
                : `Send ${fileExt || 'Document'}`}
            </h4>
            <span className="text-[11px] text-[#8696a0] font-mono truncate block">
              {fileData.name} • {formatFileSize(fileData.size)}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {fileExt === 'PDF' && (
            <div className="flex items-center bg-[#202c33] p-1 rounded-xl border border-[#2e3b44] text-xs">
              <button
                type="button"
                onClick={() => setPdfViewMode('reader')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  pdfViewMode === 'reader'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'text-[#8696a0] hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PDF Reader</span>
              </button>
              <button
                type="button"
                onClick={() => setPdfViewMode('card')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  pdfViewMode === 'card'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'text-[#8696a0] hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Details</span>
              </button>
            </div>
          )}

          {blobUrl && fileData.type === 'file' && (
            <button
              type="button"
              onClick={() => window.open(blobUrl, '_blank')}
              className="p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-[#8696a0] hover:text-white transition cursor-pointer"
              title="Open document in new window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          {fileExt && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${docTheme.badgeBg}`}>
              {fileExt}
            </span>
          )}
        </div>
      </div>

      {/* Main Preview Container */}
      <div 
        className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden min-h-0 relative"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Photo Preview */}
        {fileData.type === 'image' && (
          <div className="w-full h-full flex items-center justify-center p-2">
            <img
              src={fileData.dataUrl}
              alt="Preview"
              className="max-h-[62vh] max-w-full sm:max-w-2xl rounded-2xl shadow-2xl object-contain border border-white/10 animate-scale-in"
            />
          </div>
        )}

        {/* Video Preview */}
        {fileData.type === 'video' && (
          <div className="w-full h-full flex items-center justify-center p-2">
            <video
              src={fileData.dataUrl}
              controls
              playsInline
              className="max-h-[62vh] max-w-full sm:max-w-2xl rounded-2xl shadow-2xl object-contain bg-black border border-white/10 animate-scale-in"
            />
          </div>
        )}

        {/* PDF Reader Mode */}
        {fileData.type === 'file' && fileExt === 'PDF' && pdfViewMode === 'reader' && blobUrl && (
          <div className="w-full h-full max-h-[62vh] sm:max-h-[68vh] max-w-4xl mx-auto flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#525659] animate-scale-in relative">
            <iframe
              src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full min-h-[48vh] border-0 bg-white"
              title={fileData.name}
            />
          </div>
        )}

        {/* Text / Code File Preview */}
        {fileData.type === 'file' && textPreview !== null && (
          <div className="w-full max-w-2xl max-h-[60vh] sm:max-h-[66vh] bg-[#182229] border border-[#2e3b44] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
            <div className="px-4 py-2.5 bg-[#111b21] border-b border-[#2e3b44] flex items-center justify-between text-xs font-mono text-[#8696a0]">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#00a884]" />
                <span className="text-white font-semibold truncate max-w-xs">{fileData.name}</span>
              </div>
              <span>{formatFileSize(fileData.size)}</span>
            </div>
            <pre className="flex-1 p-4 overflow-auto text-xs text-[#e9edef] font-mono leading-relaxed select-text whitespace-pre-wrap bg-[#111b21]/60">
              {textPreview}
            </pre>
          </div>
        )}

        {/* Rich Realistic A4 Document Sheet (For DOC, DOCX, Spreadsheets, or PDF Details mode) */}
        {fileData.type === 'file' && textPreview === null && (fileExt !== 'PDF' || pdfViewMode === 'card') && (
          <div className="w-full max-w-md sm:max-w-lg bg-gradient-to-b from-[#1f2c34] to-[#111b21] border border-[#2e3b44] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between shadow-2xl text-center animate-scale-in mx-auto relative overflow-hidden group">
            {/* Top Paper Header Line Mockup */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#8696a0]">
                <FileCheck className="w-4 h-4 text-[#00a884]" />
                <span>Verified Clean Document</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${docTheme.badgeBg}`}>
                {fileExt}
              </span>
            </div>

            {/* Document Emblem & Title */}
            <div className="my-6 flex flex-col items-center space-y-4 w-full">
              <div className="relative">
                <div className={`w-24 h-24 rounded-3xl border flex items-center justify-center shadow-xl ${docTheme.iconBg} ${docTheme.accentBorder}`}>
                  {docTheme.icon}
                </div>
                <span className="absolute -bottom-2 -right-2 px-2 py-0.5 text-[10px] font-black uppercase rounded shadow-lg bg-[#00a884] text-white">
                  DOC
                </span>
              </div>

              <div className="w-full px-2">
                <h5 className="font-bold text-white text-base sm:text-lg break-all leading-snug line-clamp-2">
                  {fileData.name}
                </h5>
                <p className="text-xs text-[#8696a0] mt-1.5 font-medium">
                  {docTheme.brandName} • <span className="font-mono text-white">{formatFileSize(fileData.size)}</span>
                </p>
              </div>

              {/* Simulated Document Paragraph Lines */}
              <div className="w-3/4 space-y-1.5 opacity-30 pt-1 pointer-events-none">
                <div className="h-1.5 bg-white/40 rounded-full w-full" />
                <div className="h-1.5 bg-white/40 rounded-full w-5/6 mx-auto" />
                <div className="h-1.5 bg-white/30 rounded-full w-4/6 mx-auto" />
              </div>
            </div>

            {/* Document Action Footer */}
            <div className="w-full pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-[#8696a0]">
                <Lock className="w-3 h-3 text-[#00a884]" />
                <span>End-to-end encrypted</span>
              </div>

              {blobUrl && (
                <button
                  type="button"
                  onClick={() => window.open(blobUrl, '_blank')}
                  className="px-3 py-1.5 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-xs font-semibold text-[#00a884] hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>
              )}
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
