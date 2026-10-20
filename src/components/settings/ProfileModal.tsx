import React, { useState } from 'react';
import { X, ShieldCheck, Copy, Check, QrCode, Camera, Edit2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { Avatar } from '../common/Avatar';
import { QRCodeModal } from '../common/QRCodeModal';

interface ProfileModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdateProfile,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [about, setAbout] = useState(user.about);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(user.phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    await onUpdateProfile({ displayName: displayName.trim() });
    setIsEditingName(false);
    setSaving(false);
  };

  const handleSaveAbout = async () => {
    if (!about.trim()) return;
    setSaving(true);
    await onUpdateProfile({ about: about.trim() });
    setIsEditingAbout(false);
    setSaving(false);
  };

  const handleSelectPresetAvatar = async (seed: string) => {
    const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    await onUpdateProfile({ photoURL: url });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-[#202c33] text-[#e9edef] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3b44] bg-[#111b21]">
            <h3 className="font-semibold text-white text-base">Profile</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
            {/* Avatar & presets */}
            <div className="flex flex-col items-center">
              <div className="relative mb-3 group cursor-pointer">
                <Avatar src={user.photoURL} name={user.displayName} size="xl" />
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>

              {/* Quick avatar choices */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[#8696a0]">Presets:</span>
                {['Felix', 'Luna', 'Jasper', 'Alex'].map((seed) => (
                  <img
                    key={seed}
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                    alt={seed}
                    onClick={() => handleSelectPresetAvatar(seed)}
                    className="w-7 h-7 rounded-full bg-[#111b21] cursor-pointer hover:ring-2 hover:ring-[#00a884] transition"
                  />
                ))}
              </div>
            </div>

            {/* Virtual Phone Number Box */}
            <div className="bg-[#111b21] border border-[#2e3b44] rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-[#00a884] font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Temporary Virtual Number</span>
                </div>
                <div className="text-base font-bold text-white font-mono tracking-wide">
                  {user.phoneNumber}
                </div>
                <p className="text-[10px] text-[#8696a0]">
                  Allocated uniquely to protect your personal identity.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyPhone}
                  className="p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-white transition"
                  title="Copy number"
                >
                  {copied ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowQR(true)}
                  className="p-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white transition shadow"
                  title="Show QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#8696a0] font-medium">Your Name</label>
              {isEditingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 bg-[#111b21] border border-[#2e3b44] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00a884]"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="px-3 py-1.5 bg-[#00a884] rounded-xl text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setDisplayName(user.displayName);
                      setIsEditingName(false);
                    }}
                    className="px-3 py-1.5 text-xs text-[#8696a0]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-[#111b21] rounded-xl border border-[#2e3b44]/60">
                  <span className="text-sm font-medium text-white">{user.displayName}</span>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="p-1 text-[#8696a0] hover:text-[#00a884]"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* About */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#8696a0] font-medium">About / Bio</label>
              {isEditingAbout ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    className="flex-1 bg-[#111b21] border border-[#2e3b44] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00a884]"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveAbout}
                    disabled={saving}
                    className="px-3 py-1.5 bg-[#00a884] rounded-xl text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setAbout(user.about);
                      setIsEditingAbout(false);
                    }}
                    className="px-3 py-1.5 text-xs text-[#8696a0]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-[#111b21] rounded-xl border border-[#2e3b44]/60">
                  <span className="text-sm text-[#d1d7db]">{user.about || 'Available'}</span>
                  <button
                    onClick={() => setIsEditingAbout(true)}
                    className="p-1 text-[#8696a0] hover:text-[#00a884]"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <QRCodeModal user={user} isOpen={showQR} onClose={() => setShowQR(false)} />
    </>
  );
};
