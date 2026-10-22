import { rtdb } from '../firebase/config';
import { ref, set, push, onChildAdded, onValue, remove, off } from 'firebase/database';
import { supabase } from '../supabase/config';
import { Message, CallSession } from '../types';

/**
 * High-Availability Dual-Channel Realtime Coordinator
 * Channel 1: Firebase Realtime Database (Unlimited writes, sub-20ms latency)
 * Channel 2: Supabase Realtime Broadcast (In-memory WebSocket fallback, 0 DB writes)
 */
export class RealtimeCoordinator {
  private static seenSignalIds = new Set<string>();
  private static seenMsgIds = new Set<string>();

  // ==========================================
  // 1. WEBRTC CALL SIGNALING (OFFER/ANSWER/ICE)
  // ==========================================

  /**
   * Broadcast a call signaling packet (offer, answer, or candidate)
   * Streams via Firebase RTDB and Supabase broadcast.
   */
  public static async sendCallSignal(callId: string, signal: any): Promise<void> {
    const packet = {
      ...signal,
      packetId: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    // 1. Primary: Firebase RTDB
    try {
      const signalsRef = ref(rtdb, `calls/${callId}/signals`);
      await push(signalsRef, packet);
    } catch (rtdbErr) {
      console.warn('RTDB call signal notice, sending via Supabase Realtime channel:', rtdbErr);
    }

    // 2. Secondary High-Availability Channel: Supabase Realtime Broadcast
    try {
      const channel = supabase.channel(`call:${callId}`);
      await channel.send({
        type: 'broadcast',
        event: 'call_signal',
        payload: packet,
      });
    } catch (supaErr) {
      // Supabase is fallback
      console.warn('Supabase call broadcast notice:', supaErr);
    }
  }

  /**
   * Subscribe to incoming call signaling packets for an active call
   */
  public static subscribeToCallSignals(
    callId: string,
    onSignal: (signal: any) => void
  ): () => void {
    const signalsRef = ref(rtdb, `calls/${callId}/signals`);

    // 1. Listen via Firebase RTDB
    const rtdbCallback = (snapshot: any) => {
      const val = snapshot.val();
      if (!val) return;
      const packetId = val.packetId || `${val.type}_${val.timestamp}`;
      if (this.seenSignalIds.has(packetId)) return;
      this.seenSignalIds.add(packetId);

      // Clean old seen IDs cache
      if (this.seenSignalIds.size > 200) {
        const first = this.seenSignalIds.values().next().value;
        if (first) this.seenSignalIds.delete(first);
      }

      onSignal(val);
    };

    try {
      onChildAdded(signalsRef, rtdbCallback);
    } catch {}

    // 2. Listen via Supabase Realtime Broadcast Channel
    const supaChannel = supabase.channel(`call:${callId}`);
    supaChannel
      .on('broadcast', { event: 'call_signal' }, (payload: any) => {
        const val = payload.payload;
        if (!val) return;
        const packetId = val.packetId || `${val.type}_${val.timestamp}`;
        if (this.seenSignalIds.has(packetId)) return;
        this.seenSignalIds.add(packetId);

        onSignal(val);
      })
      .subscribe();

    // Return cleanup
    return () => {
      try {
        off(signalsRef, 'child_added', rtdbCallback);
      } catch {}
      try {
        supabase.removeChannel(supaChannel);
      } catch {}
    };
  }

  /**
   * Clean up finished call session from RTDB signaling path
   */
  public static async cleanupCallSignaling(callId: string): Promise<void> {
    try {
      const callRef = ref(rtdb, `calls/${callId}`);
      await remove(callRef);
    } catch {}
  }

  // ==========================================
  // 2. LIVE CHAT MESSAGING BROADCAST
  // ==========================================

  /**
   * Push instant live message through live streaming channels
   */
  public static async broadcastLiveMessage(chatId: string, message: Message): Promise<void> {
    // 1. Firebase RTDB Live Stream
    try {
      const msgRef = ref(rtdb, `live_chats/${chatId}/messages/${message.id}`);
      await set(msgRef, message);
    } catch (rtdbErr) {
      console.warn('RTDB live message notice:', rtdbErr);
    }

    // 2. Supabase Realtime Broadcast
    try {
      const channel = supabase.channel(`room:${chatId}`);
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: message,
      });
    } catch (supaErr) {
      console.warn('Supabase broadcast notice:', supaErr);
    }
  }

  /**
   * Subscribe to instant live messages on a chat
   */
  public static subscribeToLiveMessages(
    chatId: string,
    onMessage: (message: Message) => void
  ): () => void {
    const msgsRef = ref(rtdb, `live_chats/${chatId}/messages`);

    // 1. RTDB Listener
    const rtdbCallback = (snapshot: any) => {
      const msg = snapshot.val() as Message;
      if (!msg || !msg.id) return;
      if (this.seenMsgIds.has(msg.id)) return;
      this.seenMsgIds.add(msg.id);

      if (this.seenMsgIds.size > 500) {
        const first = this.seenMsgIds.values().next().value;
        if (first) this.seenMsgIds.delete(first);
      }

      onMessage(msg);
    };

    try {
      onChildAdded(msgsRef, rtdbCallback);
    } catch {}

    // 2. Supabase Channel Listener
    const channel = supabase.channel(`room:${chatId}`);
    channel
      .on('broadcast', { event: 'new_message' }, (payload: any) => {
        const msg = payload.payload as Message;
        if (!msg || !msg.id) return;
        if (this.seenMsgIds.has(msg.id)) return;
        this.seenMsgIds.add(msg.id);

        onMessage(msg);
      })
      .subscribe();

    return () => {
      try {
        off(msgsRef, 'child_added', rtdbCallback);
      } catch {}
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }

  // ==========================================
  // 3. EPHEMERAL LIVE TYPING (ZERO DB WRITES)
  // ==========================================

  public static async broadcastTyping(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    try {
      const channel = supabase.channel(`typing:${chatId}`);
      await channel.send({
        type: 'broadcast',
        event: 'typing_status',
        payload: { userId, isTyping, timestamp: Date.now() },
      });
    } catch {}

    try {
      const typingRef = ref(rtdb, `typing/${chatId}/${userId}`);
      if (isTyping) {
        await set(typingRef, Date.now());
      } else {
        await remove(typingRef);
      }
    } catch {}
  }

  public static subscribeToTyping(
    chatId: string,
    onTypingChange: (userId: string, isTyping: boolean) => void
  ): () => void {
    const channel = supabase.channel(`typing:${chatId}`);
    channel
      .on('broadcast', { event: 'typing_status' }, (payload: any) => {
        const data = payload.payload;
        if (data?.userId) {
          onTypingChange(data.userId, !!data.isTyping);
        }
      })
      .subscribe();

    const typingRef = ref(rtdb, `typing/${chatId}`);
    const rtdbCallback = (snapshot: any) => {
      const val = snapshot.val() || {};
      const now = Date.now();
      Object.entries(val).forEach(([uid, ts]) => {
        const isRecent = typeof ts === 'number' && now - ts < 4000;
        onTypingChange(uid, isRecent);
      });
    };

    try {
      onValue(typingRef, rtdbCallback);
    } catch {}

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
      try {
        off(typingRef, 'value', rtdbCallback);
      } catch {}
    };
  }
}
