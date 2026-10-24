import { createPortal } from 'react-dom';
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Check, Camera, Sparkles, ZoomIn, ZoomOut, RotateCw, Trash2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { navigationManager } from '../../utils/navigationManager';

interface AvatarEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSaveAvatar: (photoURL: string) => Promise<void>;
}

// 24 curated diverse preset avatars
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zack&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Sparky&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Quantum&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Volt&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Sunny&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cool&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Wink&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Star&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/personas/svg?seed=Alex&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/personas/svg?seed=Jordan&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/personas/svg?seed=Sam&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/personas/svg?seed=Taylor&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Sasha&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Chloe&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Elena&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aria&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Kai&backgroundColor=d1d4f9',
];

export const AvatarEditorModal: React.FC<AvatarEditorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveAvatar,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'upload'>('presets');
  const [selectedPreset, setSelectedPreset] = useState<string>(currentUser.photoURL || '');
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  
  // Circular Crop State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      return navigationManager.registerModal('avatar_editor', onClose, 30);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImageSrc(reader.result as string);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setActiveTab('upload');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Drag handlers for cropping
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers for mobile crop
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Crop to square/circular Canvas and save
  const handleSaveCropped = async () => {
    if (!uploadedImageSrc || !imageElementRef.current) return;
    try {
      setIsSaving(true);
      const canvas = document.createElement('canvas');
      const cropSize = 300;
      canvas.width = cropSize;
      canvas.height = cropSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = imageElementRef.current;
      const containerSize = 240; // Diameter of crop circle in px

      // Draw image onto canvas according to scale and pan offset
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cropSize, cropSize);

      const ratio = cropSize / containerSize;
      ctx.save();
      // Center the origin
      ctx.translate(cropSize / 2, cropSize / 2);
      ctx.scale(scale, scale);
      ctx.translate(position.x * ratio, position.y * ratio);

      // Draw image centered
      const drawWidth = (img.naturalWidth / img.naturalHeight) >= 1
        ? (cropSize * (img.naturalWidth / img.naturalHeight))
        : cropSize;
      const drawHeight = (img.naturalHeight / img.naturalWidth) >= 1
        ? (cropSize * (img.naturalHeight / img.naturalWidth))
        : cropSize;

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      await onSaveAvatar(croppedDataUrl);
      onClose();
    } catch (err: any) {
      alert(`Could not save cropped photo: ${err.message || 'Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreset = async (url: string) => {
    try {
      setIsSaving(true);
      setSelectedPreset(url);
      await onSaveAvatar(url);
      onClose();
    } catch (err: any) {
      alert(`Could not save avatar: ${err.message || 'Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    const defaultUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.displayName || 'User')}`;
    await handleSavePreset(defaultUrl);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe bg-black/80 backdrop-blur-md select-none animate-fade-in">
      <div 
        className="fixed inset-0 cursor-default" 
        onClick={() => { if (!isSaving) onClose(); }} 
      />

      <div 
        className="relative z-50 w-full max-w-md bg-[#202c33] border border-[#2e3b44] rounded-3xl shadow-2xl p-5 sm:p-6 text-white flex flex-col max-h-[92vh] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2e3b44] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00a884]/20 text-[#00a884]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Profile Photo</h3>
              <p className="text-xs text-[#8696a0]">Choose an avatar or upload a custom picture</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs: Preset Avatars vs Upload Custom */}
        <div className="flex items-center gap-2 my-3 p-1 bg-[#182229] rounded-2xl border border-[#2e3b44] flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-[#00a884] text-white shadow-sm'
                : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Preset Avatars</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              if (!uploadedImageSrc) fileInputRef.current?.click();
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-[#00a884] text-white shadow-sm'
                : 'text-[#8696a0] hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload & Crop</span>
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* TAB 1: PRESETS GALLERY */}
        {activeTab === 'presets' && (
          <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {PRESET_AVATARS.map((url, i) => {
                const isSelected = selectedPreset === url;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSavePreset(url)}
                    disabled={isSaving}
                    className={`relative p-1 rounded-2xl border-2 transition hover:scale-105 active:scale-95 cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'border-[#00a884] ring-2 ring-[#00a884]/40 bg-[#00a884]/15'
                        : 'border-[#2e3b44] bg-[#111b21] hover:border-[#8696a0]'
                    }`}
                  >
                    <img src={url} alt={`Avatar ${i}`} className="w-full h-auto aspect-square rounded-xl object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-[#00a884] text-white p-0.5 rounded-full shadow">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#2e3b44]">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 p-2 rounded-xl hover:bg-red-500/10 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset to Seed Avatar</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: UPLOAD & CIRCULAR CROP */}
        {activeTab === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-2 overflow-y-auto">
            {uploadedImageSrc ? (
              <div className="flex flex-col items-center gap-4 w-full">
                {/* Circular Crop Box */}
                <div
                  className="relative w-60 h-60 rounded-full border-4 border-[#00a884] overflow-hidden bg-black shadow-2xl cursor-move touch-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    ref={imageElementRef}
                    src={uploadedImageSrc}
                    alt="Upload to crop"
                    draggable={false}
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                      transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                    }}
                    className="w-full h-full object-contain pointer-events-none select-none max-w-none"
                  />
                  {/* Subtle target crosshair guide */}
                  <div className="absolute inset-0 pointer-events-none rounded-full border border-white/20" />
                </div>

                <p className="text-[11px] text-[#8696a0]">
                  Drag to reposition • Use slider to zoom
                </p>

                {/* Zoom Slider */}
                <div className="flex items-center gap-3 w-full max-w-xs px-2">
                  <ZoomOut className="w-4 h-4 text-[#8696a0]" />
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full accent-[#00a884] cursor-pointer"
                  />
                  <ZoomIn className="w-4 h-4 text-[#8696a0]" />
                </div>

                {/* Crop Action Buttons */}
                <div className="flex items-center gap-2 pt-2 w-full justify-end border-t border-[#2e3b44]">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer"
                  >
                    Choose Different Photo
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveCropped}
                    className="px-5 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : 'Set as Profile Photo'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-12 border-2 border-dashed border-[#2e3b44] hover:border-[#00a884] rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition hover:bg-[#182229]"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <h5 className="font-semibold text-white text-sm">Click to Upload Image</h5>
                  <p className="text-xs text-[#8696a0] mt-0.5">JPG, PNG, GIF, or WebP</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
};
