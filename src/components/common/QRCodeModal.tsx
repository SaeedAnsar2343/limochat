import React, { useState } from 'react';
import { X, Copy, Check, Share2, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../../types';

interface QRCodeModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ user, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(user.phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate SVG QR Code URL using public api
  const qrData = encodeURIComponent(`limochat://contact?phone=${encodeURIComponent(user.phoneNumber)}&name=${encodeURIComponent(user.displayName)}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrData}&color=11-27-33&bgcolor=ffffff&margin=10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#202c33] text-[#e9edef] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between px-5 py-4 border-b border-[#2e3b44]">
          <h3 className="font-semibold text-lg text-white">Your Contact QR Code</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center text-center w-full">
          {/* Avatar and name */}
          <div className="relative mb-3">
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-16 h-16 rounded-full border-2 border-[#00a884] shadow-md object-cover"
            />
          </div>
          <h4 className="text-lg font-bold text-white mb-0.5">{user.displayName}</h4>
          <div className="flex items-center gap-1.5 text-xs text-[#00a884] bg-[#00a884]/10 px-2.5 py-1 rounded-full font-mono mb-4 border border-[#00a884]/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Virtual Number: {user.phoneNumber}</span>
          </div>

          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-xl shadow-lg mb-4">
            <img
              src={qrUrl}
              alt="Profile QR Code"
              className="w-48 h-48 block"
            />
          </div>

          <p className="text-xs text-[#8696a0] max-w-xs mb-5">
            Your QR code is private. If you share it with someone, they can scan it to message you on LimoChat without exposing your personal phone number.
          </p>

          {/* Action buttons */}
          <div className="flex w-full gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#2a3942] hover:bg-[#32444f] text-[#d1d7db] text-sm font-medium transition"
            >
              {copied ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied Number!' : 'Copy +991 Number'}</span>
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `Chat with ${user.displayName} on LimoChat`,
                    text: `Contact me on LimoChat using my virtual number: ${user.phoneNumber}`,
                  }).catch(() => {});
                } else {
                  handleCopy();
                }
              }}
              className="p-2.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white transition flex items-center justify-center"
              title="Share Contact"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
