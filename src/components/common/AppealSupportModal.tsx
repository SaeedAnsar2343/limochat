import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  X, 
  ArrowLeft, 
  ShieldAlert, 
  Headphones, 
  Lock, 
  AlertTriangle, 
  Clock, 
  CheckCheck,
  Check
} from 'lucide-react';
import { UserProfile, Message } from '../../types';
import { collection, doc, setDoc, onSnapshot, increment } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Avatar } from './Avatar';

interface AppealSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

export const AppealSupportModal: React.FC<AppealSupportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [appealText, setAppealText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const supportChatId = `support_${currentUser.uid}`;

  // Stream support messages in real-time
  useEffect(() => {
    if (!isOpen || !currentUser.uid) return;

    setLoading(true);
    const messagesRef = collection(db, 'chats', supportChatId, 'messages');
    const unsub = onSnapshot(messagesRef, (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Message);
      });
      list.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(list);
      setLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => {
      console.warn("Could not load support appeal messages:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen, supportChatId, currentUser.uid]);

  const handleSendAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = appealText.trim();
    if (!text || isSending) return;

    try {
      setIsSending(true);
      const now = Date.now();
      const msgId = `msg_appeal_${now}_${Math.random().toString(36).slice(2, 6)}`;

      const newMsg: Message = {
        id: msgId,
        chatId: supportChatId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Suspended User',
        senderPhoto: currentUser.photoURL || '',
        text,
        type: 'text',
        status: 'delivered',
        timestamp: now,
        isDeletedForEveryone: false,
        deletedForUsers: [],
        starredBy: [],
      };

      // Optimistic update
      setMessages((prev) => [...prev, newMsg]);
      setAppealText('');

      // Add message to Firestore
      const msgDoc = doc(db, 'chats', supportChatId, 'messages', msgId);
      await setDoc(msgDoc, newMsg, { merge: true });

      // Update support chat document: increment support staff unread count & mark awaiting reply
      const chatDoc = doc(db, 'chats', supportChatId);
      await setDoc(chatDoc, {
        id: supportChatId,
        type: 'direct',
        name: 'LimoChat Support',
        participants: [currentUser.uid, 'limochat_official_support'],
        updatedAt: now,
        [`unreadCount.limochat_official_support`]: increment(1),
        [`unreadCount.${currentUser.uid}`]: 0,
        lastMessage: {
          text,
          senderId: currentUser.uid,
          timestamp: now,
          type: 'text',
          status: 'delivered',
        },
      }, { merge: true });

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      alert(`Could not send appeal: ${err.message || 'Please check your connection and try again.'}`);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div 
        className="relative z-50 w-full max-w-2xl h-[92vh] sm:h-[85vh] bg-[#202c33] border border-[#2e3b44] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Support Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#111b21] border-b border-[#2e3b44] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer md:hidden"
              title="Return to suspension screen"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="relative">
              <Avatar
                src="https://api.dicebear.com/7.x/bottts/svg?seed=LimoSupport"
                name="LimoChat Support"
                size="md"
                isOnline={true}
              />
              <div className="absolute -bottom-0.5 -right-0.5 bg-[#00a884] rounded-full p-0.5 border border-[#111b21]">
                <Headphones className="w-2.5 h-2.5 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white truncate">LimoChat Support Desk</h3>
                <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.2 rounded font-mono font-bold border border-[#00a884]/30">
                  OFFICIAL
                </span>
              </div>
              <p className="text-[11px] text-[#8696a0] truncate">
                Suspension Appeals & Compliance Assistance Desk
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#182229] transition cursor-pointer flex-shrink-0"
            title="Close Appeal Chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Sandbox Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2.5 text-xs text-amber-300">
          <Lock className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <p className="leading-tight text-[11px]">
            <strong>Restricted Appeal Channel:</strong> All other chats, calls, and group rooms remain restricted. You can communicate with LimoChat Support to appeal your account suspension.
          </p>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]">
          {/* Welcome / Guidance card if empty */}
          {messages.length === 0 && !loading && (
            <div className="max-w-md mx-auto my-6 p-4 rounded-2xl bg-[#111b21] border border-[#2e3b44] text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#00a884]/20 text-[#00a884] mx-auto flex items-center justify-center">
                <Headphones className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-xs">Official Appeal Support Channel</h4>
              <p className="text-[11px] text-[#8696a0] leading-relaxed">
                Send a message below detailing why your account was sanctioned in error. Our administrative compliance team receives your inquiry directly in real-time.
              </p>
            </div>
          )}

          {loading ? (
            <div className="text-center text-xs text-[#8696a0] py-12 flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 animate-spin text-[#00a884]" />
              <span>Loading appeal history...</span>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === currentUser.uid;
              const isSupport = m.senderId === 'limochat_official_support';

              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                    isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed shadow-md ${
                      isMe
                        ? 'bg-[#005c4b] text-white rounded-br-sm'
                        : isSupport
                        ? 'bg-[#202c33] text-[#e9edef] border border-[#2e3b44] rounded-bl-sm'
                        : 'bg-[#182229] text-[#d1d7db] rounded-bl-sm'
                    }`}
                  >
                    {!isMe && (
                      <div className="text-[10px] text-[#00a884] font-semibold mb-1 flex items-center gap-1">
                        <Headphones className="w-3 h-3" />
                        <span>LimoChat Support Staff</span>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words">{m.text}</p>

                    <div className="flex items-center justify-end gap-1 text-[9px] text-white/50 mt-1 font-mono">
                      <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (
                        <span>
                          {m.status === 'read' ? (
                            <CheckCheck className="w-3 h-3 text-[#53bdeb]" />
                          ) : (
                            <Check className="w-3 h-3 text-white/60" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Composer Input */}
        <form onSubmit={handleSendAppeal} className="p-3 bg-[#182229] border-t border-[#2e3b44] flex items-center gap-2">
          <input
            type="text"
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            placeholder="Type your appeal message to LimoChat Support..."
            className="flex-1 bg-[#202c33] border border-[#2e3b44] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
          />
          <button
            type="submit"
            disabled={isSending || !appealText.trim()}
            className="p-2.5 bg-[#00a884] hover:bg-[#02906f] text-white rounded-2xl transition disabled:opacity-50 cursor-pointer shadow-md flex-shrink-0"
            title="Send Appeal Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
