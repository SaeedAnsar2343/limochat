import React, { useState } from 'react';
import { Flag, X, ShieldAlert, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { Message, UserProfile } from '../../types';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface ReportMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
  currentUser: UserProfile;
}

const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or Bullying', desc: 'Disrespectful, aggressive, or abusive behavior' },
  { id: 'explicit', label: 'Sexually Explicit / Adult Content', desc: 'Pornography, nudity, or inappropriate media' },
  { id: 'hate_speech', label: 'Hate Speech or Threats', desc: 'Attacks on identity, discrimination, or violence' },
  { id: 'spam_scam', label: 'Spam, Scams, or Fraud', desc: 'Unsolicited advertising, deception, or phishing' },
  { id: 'child_safety', label: 'Child Safety Violation', desc: 'Strict zero-tolerance minor endangerment' },
  { id: 'other', label: 'Other Terms Violation', desc: 'Behavior breaking community guidelines' },
];

export const ReportMessageModal: React.FC<ReportMessageModalProps> = ({
  isOpen,
  onClose,
  message,
  currentUser,
}) => {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0].label);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const now = Date.now();
      const reportId = `report_${now}_${Math.random().toString(36).slice(2, 6)}`;
      const snippet = message.text || (message.type === 'image' ? '[Photo Attachment]' : '[Media Attachment]');

      const reportPayload = {
        id: reportId,
        userId: message.senderId,
        userName: message.senderName || 'User',
        userPhone: '',
        userEmail: '',
        chatId: message.chatId,
        messageId: message.id,
        messageText: snippet,
        matchedTerm: selectedReason,
        ruleId: `user_report_${selectedReason.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        ruleName: `User Report: ${selectedReason}`,
        suggestedAction: 'warn' as const,
        tempSuspensionMinutes: 60,
        status: 'pending_review' as const,
        timestamp: now,
        isUserReport: true,
        reportedByUid: currentUser.uid,
        reportedByName: currentUser.displayName || 'Anonymous User',
        reportReason: selectedReason,
        reportDetails: additionalDetails.trim(),
      };

      // Write to policy_incidents for Admin Portal Review
      await setDoc(doc(db, 'policy_incidents', reportId), reportPayload);

      // Write to message_reports collection for persistent report records
      try {
        await addDoc(collection(db, 'message_reports'), reportPayload);
      } catch (err) {
        console.warn("Could not save to message_reports collection:", err);
      }

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        onClose();
      }, 1600);
    } catch (err: any) {
      alert(`Could not submit report: ${err.message || 'Please try again later'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none animate-fade-in">
      {/* Backdrop for outside touch close */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-default"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />

      <div 
        className="relative z-50 w-full max-w-md max-h-[90vh] bg-[#202c33] border border-[#2e3b44] rounded-3xl shadow-2xl p-5 sm:p-6 text-white flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {isSubmitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Report Submitted</h3>
            <p className="text-xs text-[#8696a0] max-w-xs mx-auto leading-relaxed">
              Thank you for keeping LimoChat safe. Our Compliance and Safety Team has received this report for administrative review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[82vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2e3b44] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Flag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Report Message</h3>
                  <p className="text-[11px] text-[#8696a0]">Flag inappropriate content for Admin Review</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="space-y-4 py-3 overflow-y-auto flex-1 pr-1">
              {/* Target Message Snippet */}
              <div className="p-3 bg-[#111b21] rounded-2xl border border-[#2e3b44] space-y-1 flex-shrink-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8696a0]">
                  Reported Message from {message.senderName || 'User'}:
                </div>
                <p className="text-xs text-[#d1d7db] italic line-clamp-2">
                  "{message.text || (message.type === 'image' ? '📷 Photo Attachment' : '📎 Attachment')}"
                </p>
              </div>

              {/* Reason Radio List */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white block">
                  Why are you reporting this message?
                </label>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((r) => {
                    const isChecked = selectedReason === r.label;
                    return (
                      <label
                        key={r.id}
                        onClick={() => setSelectedReason(r.label)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                          isChecked
                            ? 'bg-[#00a884]/15 border-[#00a884] text-white shadow-xs'
                            : 'bg-[#182229] border-[#2e3b44] text-[#8696a0] hover:text-[#d1d7db] hover:border-[#3b4a54]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportReason"
                          checked={isChecked}
                          onChange={() => setSelectedReason(r.label)}
                          className="mt-0.5 text-[#00a884] focus:ring-0 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white">{r.label}</div>
                          <div className="text-[10px] text-[#8696a0]">{r.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Optional Additional Details */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white block">
                  Additional Context (Optional):
                </label>
                <textarea
                  rows={2}
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder="Describe any other relevant details..."
                  className="w-full bg-[#182229] border border-[#2e3b44] rounded-xl p-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] resize-none"
                />
              </div>
            </div>

            {/* Actions (Always visible at bottom) */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2e3b44] flex-shrink-0">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
