import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { Message } from '../../types';
import { formatMessageDate } from '../../utils/formatters';

interface JumpToDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSelectDate: (targetMessageId: string) => void;
}

export const JumpToDateModal: React.FC<JumpToDateModalProps> = ({
  isOpen,
  onClose,
  messages,
  onSelectDate,
}) => {
  const earliestTimestamp = messages.length > 0 ? messages[0].timestamp : Date.now();
  const latestTimestamp = messages.length > 0 ? messages[messages.length - 1].timestamp : Date.now();

  const minDateStr = new Date(earliestTimestamp).toISOString().split('T')[0];
  const maxDateStr = new Date(latestTimestamp).toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const [pickedDate, setPickedDate] = useState<string>(maxDateStr || todayStr);

  if (!isOpen) return null;

  const handleJump = (dateString: string) => {
    if (!messages.length) {
      onClose();
      return;
    }

    const startOfDay = new Date(`${dateString}T00:00:00`).getTime();
    const endOfDay = new Date(`${dateString}T23:59:59.999`).getTime();

    // 1. Try to find exact message on that day
    let target = messages.find((m) => m.timestamp >= startOfDay && m.timestamp <= endOfDay);

    // 2. If no message on that exact date, find first message after that date
    if (!target) {
      target = messages.find((m) => m.timestamp >= startOfDay);
    }

    // 3. Fallback: closest message before that date or first message
    if (!target) {
      target = messages[messages.length - 1];
    }

    if (target) {
      onSelectDate(target.id);
    }
    onClose();
  };

  const handleQuickPreset = (type: 'today' | 'yesterday' | '7days' | '30days' | 'beginning') => {
    const now = new Date();
    if (type === 'today') {
      handleJump(todayStr);
    } else if (type === 'yesterday') {
      now.setDate(now.getDate() - 1);
      handleJump(now.toISOString().split('T')[0]);
    } else if (type === '7days') {
      now.setDate(now.getDate() - 7);
      handleJump(now.toISOString().split('T')[0]);
    } else if (type === '30days') {
      now.setDate(now.getDate() - 30);
      handleJump(now.toISOString().split('T')[0]);
    } else if (type === 'beginning') {
      if (messages.length > 0) {
        onSelectDate(messages[0].id);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="fixed inset-0 cursor-default" onClick={onClose} />

      <div className="relative z-10 bg-[#202c33] text-[#e9edef] w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-[#2e3b44] flex flex-col animate-scale-in modal-content">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3b44] bg-[#111b21]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00a884]/20 rounded-xl text-[#00a884]">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">Jump to Date</h3>
              <p className="text-[11px] text-[#8696a0]">Navigate conversation history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#323f4b] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Quick Jump Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider block">
              Quick Shortcuts
            </span>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleQuickPreset('today')}
                className="px-3 py-1.5 rounded-xl bg-[#111b21] hover:bg-[#00a884] hover:text-white text-[#d1d7db] border border-[#2e3b44] transition cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('yesterday')}
                className="px-3 py-1.5 rounded-xl bg-[#111b21] hover:bg-[#00a884] hover:text-white text-[#d1d7db] border border-[#2e3b44] transition cursor-pointer"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('7days')}
                className="px-3 py-1.5 rounded-xl bg-[#111b21] hover:bg-[#00a884] hover:text-white text-[#d1d7db] border border-[#2e3b44] transition cursor-pointer"
              >
                7 Days Ago
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('beginning')}
                className="px-3 py-1.5 rounded-xl bg-[#111b21] hover:bg-[#00a884] hover:text-white text-[#d1d7db] border border-[#2e3b44] transition cursor-pointer"
              >
                Beginning of Chat
              </button>
            </div>
          </div>

          {/* Calendar Date Picker Input */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider block">
              Or Choose Specific Date
            </span>
            <input
              type="date"
              value={pickedDate}
              min={minDateStr}
              max={maxDateStr > todayStr ? maxDateStr : todayStr}
              onChange={(e) => setPickedDate(e.target.value)}
              className="w-full bg-[#111b21] border border-[#2e3b44] focus:border-[#00a884] rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none cursor-pointer"
            />
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleJump(pickedDate)}
              className="w-full py-2.5 bg-[#00a884] hover:bg-[#02906f] text-white font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>Jump to Messages</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
