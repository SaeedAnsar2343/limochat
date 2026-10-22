import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Shield, Ban, Check, UserX } from 'lucide-react';
import { UserProfile, UserPrivacy } from '../../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Avatar } from '../common/Avatar';

interface PrivacyModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePrivacy: (privacy: Partial<UserPrivacy>) => Promise<void>;
  onUnblockUser: (targetUid: string) => Promise<void>;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdatePrivacy,
  onUnblockUser,
}) => {
  const [blockedUsersList, setBlockedUsersList] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!isOpen || !user.blockedUsers || user.blockedUsers.length === 0) {
      setBlockedUsersList([]);
      return;
    }

    Promise.all(
      user.blockedUsers.map((uid) =>
        getDoc(doc(db, 'users', uid)).then((s) => (s.exists() ? (s.data() as UserProfile) : null))
      )
    ).then((list) => {
      setBlockedUsersList(list.filter((u): u is UserProfile => u !== null));
    });
  }, [isOpen, user.blockedUsers]);

  if (!isOpen) return null;

  const currentPrivacy = user.privacy || {
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    readReceipts: true,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 pt-safe pb-safe animate-fade-in">
      <div className="bg-[#202c33] text-[#e9edef] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3b44] bg-[#111b21]">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00a884]" />
            <h3 className="font-semibold text-white text-base">Privacy Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Last Seen and Online */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8696a0]">
              Who can see my last seen & online
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdatePrivacy({ lastSeen: 'everyone' })}
                className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                  currentPrivacy.lastSeen === 'everyone'
                    ? 'border-[#00a884] bg-[#00a884]/15 text-white'
                    : 'border-[#2e3b44] bg-[#111b21] text-[#8696a0] hover:text-white'
                }`}
              >
                <span>Everyone</span>
                {currentPrivacy.lastSeen === 'everyone' && <Check className="w-4 h-4 text-[#00a884]" />}
              </button>

              <button
                onClick={() => onUpdatePrivacy({ lastSeen: 'nobody' })}
                className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                  currentPrivacy.lastSeen === 'nobody'
                    ? 'border-[#00a884] bg-[#00a884]/15 text-white'
                    : 'border-[#2e3b44] bg-[#111b21] text-[#8696a0] hover:text-white'
                }`}
              >
                <span>Nobody</span>
                {currentPrivacy.lastSeen === 'nobody' && <Check className="w-4 h-4 text-[#00a884]" />}
              </button>
            </div>
            <p className="text-[11px] text-[#8696a0]">
              If you don't share your Last Seen, you won't be able to see other people's Last Seen.
            </p>
          </div>

          {/* Profile Photo Visibility */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8696a0]">
              Who can see my profile photo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdatePrivacy({ profilePhoto: 'everyone' })}
                className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                  currentPrivacy.profilePhoto === 'everyone'
                    ? 'border-[#00a884] bg-[#00a884]/15 text-white'
                    : 'border-[#2e3b44] bg-[#111b21] text-[#8696a0] hover:text-white'
                }`}
              >
                <span>Everyone</span>
                {currentPrivacy.profilePhoto === 'everyone' && <Check className="w-4 h-4 text-[#00a884]" />}
              </button>

              <button
                onClick={() => onUpdatePrivacy({ profilePhoto: 'nobody' })}
                className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                  currentPrivacy.profilePhoto === 'nobody'
                    ? 'border-[#00a884] bg-[#00a884]/15 text-white'
                    : 'border-[#2e3b44] bg-[#111b21] text-[#8696a0] hover:text-white'
                }`}
              >
                <span>Nobody</span>
                {currentPrivacy.profilePhoto === 'nobody' && <Check className="w-4 h-4 text-[#00a884]" />}
              </button>
            </div>
          </div>

          {/* Read Receipts */}
          <div className="flex items-center justify-between p-3.5 bg-[#111b21] rounded-2xl border border-[#2e3b44]">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-white">Read Receipts</h4>
              <p className="text-xs text-[#8696a0]">
                If turned off, you won't send or receive blue checkmarks.
              </p>
            </div>
            <button
              onClick={() => onUpdatePrivacy({ readReceipts: !currentPrivacy.readReceipts })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                currentPrivacy.readReceipts ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  currentPrivacy.readReceipts ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Blocked Contacts */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8696a0] flex items-center justify-between">
              <span>Blocked Contacts ({blockedUsersList.length})</span>
              <Ban className="w-3.5 h-3.5" />
            </label>

            {blockedUsersList.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {blockedUsersList.map((bu) => (
                  <div
                    key={bu.uid}
                    className="flex items-center justify-between p-2.5 bg-[#111b21] rounded-xl border border-[#2e3b44]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={bu.photoURL} name={bu.displayName} size="sm" />
                      <div>
                        <div className="text-xs font-medium text-white">{bu.displayName}</div>
                        <div className="text-[10px] text-[#8696a0] font-mono">{bu.phoneNumber}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => onUnblockUser(bu.uid)}
                      className="px-2.5 py-1 text-xs text-[#00a884] hover:bg-[#00a884]/10 rounded-lg transition font-medium"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-[#111b21] rounded-xl border border-[#2e3b44]/50 text-center text-xs text-[#8696a0]">
                No contacts blocked
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
