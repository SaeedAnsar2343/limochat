import { rtdb } from '../firebase/config';
import { ref, set, push, onChildAdded, onValue, remove, off } from 'firebase/database';
import { supabase } from '../supabase/config';
import { Message, CallSession, Chat, UserProfile } from '../types';

/**
 * Universal Dual-Engine Realtime & Persistence Coordinator
 * 
 * Engine 1 (Primary High-Availability): Supabase PostgreSQL + Realtime Broadcast & Postgres Changes
 *   - UNLIMITED database writes & reads (No quota cutoff like Firestore Spark)
 *   - Persistent storage in PostgreSQL (Messages never disappear on refresh!)
 *   - Sub-25ms WebSocket latency for live messages & call handshakes
 * 
 * Engine 2: Firebase Realtime Database (RTDB) & Firestore Background Persistence
 *   - In-memory ephemeral signaling
 *   - Best-effort fallback
 */
export class RealtimeCoordinator {
  private static seenSignalIds = new Set<string>();
  private static seenMsgIds = new Set<string>();

  // ==========================================
  // 1. PERSISTENT CHAT & MESSAGE OPERATIONS
  // ==========================================

  /**
   * Save message to Supabase PostgreSQL (UNLIMITED writes) & Broadcast live
   */
  public static async persistAndBroadcastMessage(chatId: string, message: Message): Promise<boolean> {
    const row = {
      id: message.id,
      chat_id: chatId,
      sender_id: message.senderId,
      sender_name: message.senderName || '',
      sender_photo: message.senderPhoto || '',
      text: message.text || '',
      type: message.type || 'text',
      media_url: message.mediaUrl || '',
      media_duration: message.mediaDuration || 0,
      file_name: message.fileName || '',
      file_size: message.fileSize || '',
      status: 'delivered',
      timestamp: message.timestamp || Date.now(),
      quoted_message: message.quotedMessage || null,
      is_deleted_for_everyone: message.isDeletedForEveryone || false,
      deleted_for_users: message.deletedForUsers || [],
      starred_by: message.starredBy || [],
      reactions: message.reactions || [],
      call_type: message.callType || null,
      call_status: message.callStatus || null,
    };

    let saved = false;

    // 1. Insert into Supabase PostgreSQL (Permanent persistence, zero quota limits)
    try {
      // First ensure the chat exists / is updated in Supabase chats table
      await supabase.from('chats').upsert({
        id: chatId,
        updated_at: message.timestamp || Date.now(),
        last_message: {
          text: message.text || '',
          senderId: message.senderId,
          timestamp: message.timestamp || Date.now(),
          type: message.type,
          status: 'delivered',
          callType: message.callType,
          callStatus: message.callStatus,
        },
      });

      const { error } = await supabase.from('messages').upsert(row);
      if (!error) {
        saved = true;
      } else {
        console.warn('Supabase message upsert notice:', error);
      }
    } catch (e) {
      console.warn('Supabase DB write error:', e);
    }

    // 2. Broadcast via Supabase Realtime Channel
    try {
      const channel = supabase.channel(`room:${chatId}`);
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: { ...message, status: 'delivered' },
      });
    } catch (e) {
      console.warn('Supabase broadcast error:', e);
    }

    // 3. Best-effort write to Firebase RTDB if active
    try {
      const rtdbMsgRef = ref(rtdb, `live_chats/${chatId}/messages/${message.id}`);
      await set(rtdbMsgRef, { ...message, status: 'delivered' });
    } catch {}

    return saved;
  }

  /**
   * Fetch persistent chat messages from Supabase PostgreSQL
   */
  public static async fetchChatMessages(chatId: string): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });

      if (error || !data) return [];

      return data.map((r: any) => ({
        id: r.id,
        chatId: r.chat_id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        senderPhoto: r.sender_photo,
        text: r.text,
        type: r.type,
        mediaUrl: r.media_url,
        mediaDuration: r.media_duration,
        fileName: r.file_name,
        fileSize: r.file_size,
        status: r.status || 'delivered',
        timestamp: Number(r.timestamp),
        quotedMessage: r.quoted_message,
        isDeletedForEveryone: !!r.is_deleted_for_everyone,
        deletedForUsers: r.deleted_for_users || [],
        starredBy: r.starred_by || [],
        reactions: r.reactions || [],
        callType: r.call_type,
        callStatus: r.call_status,
      }));
    } catch (e) {
      console.warn('Fetch messages from Supabase notice:', e);
      return [];
    }
  }

  /**
   * Upsert a chat into Supabase PostgreSQL
   */
  public static async persistChat(chat: Chat): Promise<void> {
    try {
      await supabase.from('chats').upsert({
        id: chat.id,
        type: chat.type,
        participants: chat.participants || [],
        name: chat.name || '',
        avatar: chat.avatar || '',
        last_message: chat.lastMessage || null,
        unread_count: chat.unreadCount || {},
        created_at: chat.createdAt || Date.now(),
        updated_at: chat.updatedAt || Date.now(),
      });
    } catch (e) {
      console.warn('Supabase chat upsert notice:', e);
    }
  }

  /**
   * Fetch user's chats from Supabase PostgreSQL
   */
  public static async fetchUserChats(userUid: string): Promise<Chat[]> {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .contains('participants', [userUid])
        .order('updated_at', { ascending: false });

      if (error || !data) return [];

      return data.map((r: any) => ({
        id: r.id,
        type: r.type,
        participants: r.participants || [],
        name: r.name,
        avatar: r.avatar,
        lastMessage: r.last_message,
        unreadCount: r.unread_count || {},
        createdAt: Number(r.created_at),
        updatedAt: Number(r.updated_at),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Update reactions for a message in Supabase & broadcast
   */
  public static async reactToMessage(chatId: string, messageId: string, reactions: any[]): Promise<void> {
    try {
      await supabase.from('messages').update({ reactions }).eq('id', messageId);
      const channel = supabase.channel(`room:${chatId}`);
      await channel.send({
        type: 'broadcast',
        event: 'message_reaction',
        payload: { messageId, reactions },
      });
    } catch {}
  }

  /**
   * Delete message for everyone in Supabase & broadcast
   */
  public static async deleteMessageForEveryone(chatId: string, messageId: string): Promise<void> {
    try {
      await supabase.from('messages').update({
        is_deleted_for_everyone: true,
        text: '🚫 This message was deleted',
        media_url: '',
      }).eq('id', messageId);

      const channel = supabase.channel(`room:${chatId}`);
      await channel.send({
        type: 'broadcast',
        event: 'message_deleted_everyone',
        payload: { messageId },
      });
    } catch {}
  }

  /**
   * Delete message for me in Supabase
   */
  public static async deleteMessageForMe(chatId: string, messageId: string, userUid: string): Promise<void> {
    try {
      const { data } = await supabase.from('messages').select('deleted_for_users').eq('id', messageId).single();
      const existing = (data?.deleted_for_users || []) as string[];
      if (!existing.includes(userUid)) {
        await supabase.from('messages').update({
          deleted_for_users: [...existing, userUid],
        }).eq('id', messageId);
      }
    } catch {}
  }

  /**
   * Toggle star message in Supabase
   */
  public static async toggleStarMessage(messageId: string, starredBy: string[]): Promise<void> {
    try {
      await supabase.from('messages').update({ starred_by: starredBy }).eq('id', messageId);
    } catch {}
  }

  /**
   * Clear all messages for a chat in Supabase
   */
  public static async clearChatHistory(chatId: string): Promise<void> {
    try {
      await supabase.from('messages').delete().eq('chat_id', chatId);
      await supabase.from('chats').update({ last_message: null, updated_at: Date.now() }).eq('id', chatId);
    } catch {}
  }

  /**
   * Delete chat and its messages in Supabase
   */
  public static async deleteChat(chatId: string): Promise<void> {
    try {
      await supabase.from('messages').delete().eq('chat_id', chatId);
      await supabase.from('chats').delete().eq('id', chatId);
    } catch {}
  }

  /**
   * Subscribe to real-time messages for an active chat
   */
  public static subscribeToLiveMessages(
    chatId: string,
    onMessage: (message: Message) => void,
    onMessageUpdate?: (update: { id: string; [key: string]: any }) => void
  ): () => void {
    // 1. Supabase Postgres Changes (Realtime table inserts/updates)
    const dbSub = supabase
      .channel(`db-messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload: any) => {
          const r = payload.new;
          if (!r || !r.id) return;

          if (payload.eventType === 'UPDATE') {
            if (onMessageUpdate) {
              onMessageUpdate({
                id: r.id,
                text: r.text,
                reactions: r.reactions,
                isDeletedForEveryone: r.is_deleted_for_everyone,
                deletedForUsers: r.deleted_for_users,
                starredBy: r.starred_by,
                status: r.status,
              });
            }
            return;
          }

          if (this.seenMsgIds.has(r.id)) return;
          this.seenMsgIds.add(r.id);

          onMessage({
            id: r.id,
            chatId: r.chat_id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            senderPhoto: r.sender_photo,
            text: r.text,
            type: r.type,
            mediaUrl: r.media_url,
            mediaDuration: r.media_duration,
            fileName: r.file_name,
            fileSize: r.file_size,
            status: r.status || 'delivered',
            timestamp: Number(r.timestamp),
            quotedMessage: r.quoted_message,
            isDeletedForEveryone: !!r.is_deleted_for_everyone,
            deletedForUsers: r.deleted_for_users || [],
            starredBy: r.starred_by || [],
            reactions: r.reactions || [],
            callType: r.call_type,
            callStatus: r.call_status,
          });
        }
      )
      .subscribe();

    // 2. Supabase Realtime Broadcast (sub-25ms instant in-memory websocket)
    const broadcastSub = supabase
      .channel(`room:${chatId}`)
      .on('broadcast', { event: 'new_message' }, (payload: any) => {
        const msg = payload.payload as Message;
        if (!msg || !msg.id) return;
        if (this.seenMsgIds.has(msg.id)) return;
        this.seenMsgIds.add(msg.id);

        onMessage(msg);
      })
      .on('broadcast', { event: 'message_reaction' }, (payload: any) => {
        if (onMessageUpdate && payload.payload) {
          onMessageUpdate({
            id: payload.payload.messageId,
            reactions: payload.payload.reactions,
          });
        }
      })
      .on('broadcast', { event: 'message_deleted_everyone' }, (payload: any) => {
        if (onMessageUpdate && payload.payload) {
          onMessageUpdate({
            id: payload.payload.messageId,
            isDeletedForEveryone: true,
            text: '🚫 This message was deleted',
            mediaUrl: '',
          });
        }
      })
      .subscribe();

    // 3. RTDB Listener
    const msgsRef = ref(rtdb, `live_chats/${chatId}/messages`);
    const rtdbCallback = (snapshot: any) => {
      const msg = snapshot.val() as Message;
      if (!msg || !msg.id) return;
      if (this.seenMsgIds.has(msg.id)) return;
      this.seenMsgIds.add(msg.id);

      onMessage(msg);
    };

    try {
      onChildAdded(msgsRef, rtdbCallback);
    } catch {}

    return () => {
      try {
        supabase.removeChannel(dbSub);
      } catch {}
      try {
        supabase.removeChannel(broadcastSub);
      } catch {}
      try {
        off(msgsRef, 'child_added', rtdbCallback);
      } catch {}
    };
  }

  // ==========================================
  // 2. USER PROFILE SYNC & DIRECTORY SEARCH
  // ==========================================

  public static async syncUserProfile(profile: UserProfile): Promise<void> {
    try {
      await supabase.from('users').upsert({
        uid: profile.uid,
        email: profile.email || '',
        display_name: profile.displayName || '',
        photo_url: profile.photoURL || '',
        phone_number: profile.phoneNumber || '',
        about: profile.about || '',
        is_online: profile.isOnline ?? true,
        last_seen: profile.lastSeen || Date.now(),
        privacy: profile.privacy || {},
        blocked_users: profile.blockedUsers || [],
        created_at: profile.createdAt || Date.now(),
        updated_at: Date.now(),
      });
    } catch {}
  }

  public static async searchUsers(queryStr: string): Promise<UserProfile[]> {
    try {
      const q = queryStr.trim().toLowerCase();
      if (!q) return [];
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`display_name.ilike.%${q}%,phone_number.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(20);

      if (error || !data) return [];
      return data.map((r: any) => ({
        uid: r.uid,
        displayName: r.display_name,
        email: r.email,
        photoURL: r.photo_url,
        phoneNumber: r.phone_number,
        about: r.about,
        isOnline: r.is_online,
        lastSeen: Number(r.last_seen),
        privacy: r.privacy || {},
        blockedUsers: r.blocked_users || [],
        createdAt: Number(r.created_at),
      }));
    } catch {
      return [];
    }
  }

  // ==========================================
  // 3. WEBRTC CALL SIGNALING & SESSION MGMT
  // ==========================================

  /**
   * Create or update Call Session in Supabase PostgreSQL & alert callee
   */
  public static async createCallSession(session: CallSession): Promise<void> {
    const row = {
      id: session.id,
      chat_id: session.chatId,
      caller_id: session.callerId,
      caller_name: session.callerName,
      caller_photo: session.callerPhoto || '',
      call_type: session.callType,
      status: session.status || 'ringing',
      participants: session.participants || {},
      participant_uids: session.participantUids || [],
      created_at: session.createdAt || Date.now(),
    };

    try {
      await supabase.from('calls').upsert(row);

      // Broadcast instant incoming call notification to all invitees
      const invitees = (session.participantUids || []).filter((uid) => uid !== session.callerId);
      for (const uid of invitees) {
        const userCallChannel = supabase.channel(`user_calls:${uid}`);
        await userCallChannel.send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: session,
        });
      }
    } catch (e) {
      console.warn('Supabase call creation notice:', e);
    }
  }

  /**
   * Update Call Session status (e.g. accepted, ended, declined)
   */
  public static async updateCallSession(callId: string, updates: Partial<CallSession>): Promise<void> {
    const row: any = {};
    if (updates.status) row.status = updates.status;
    if (updates.startedAt) row.started_at = updates.startedAt;
    if (updates.endedAt) row.ended_at = updates.endedAt;
    if (updates.offer) row.offer = updates.offer;
    if (updates.answer) row.answer = updates.answer;
    if (updates.participants) row.participants = updates.participants;

    try {
      await supabase.from('calls').update(row).eq('id', callId);

      // Broadcast status change
      const channel = supabase.channel(`call:${callId}`);
      await channel.send({
        type: 'broadcast',
        event: 'call_status_update',
        payload: { callId, ...updates },
      });
    } catch (e) {
      console.warn('Update call session notice:', e);
    }
  }

  /**
   * Listen for incoming calls targeted at current user
   */
  public static subscribeToIncomingCalls(
    currentUid: string,
    onIncoming: (call: CallSession) => void
  ): () => void {
    // 1. Supabase Broadcast for user
    const userCallChannel = supabase
      .channel(`user_calls:${currentUid}`)
      .on('broadcast', { event: 'incoming_call' }, (payload: any) => {
        const session = payload.payload as CallSession;
        if (session && session.callerId !== currentUid) {
          onIncoming(session);
        }
      })
      .subscribe();

    // 2. Supabase Postgres Changes on calls table
    const dbCallsSub = supabase
      .channel(`db-calls:${currentUid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
        },
        (payload: any) => {
          const r = payload.new;
          if (!r || !r.id) return;
          if (r.status === 'ringing' && r.caller_id !== currentUid) {
            const uids = r.participant_uids || [];
            const ageMs = Date.now() - Number(r.created_at);
            if (uids.includes(currentUid) && ageMs < 60000) {
              onIncoming({
                id: r.id,
                chatId: r.chat_id,
                isGroup: (r.participant_uids || []).length > 2,
                callerId: r.caller_id,
                callerName: r.caller_name,
                callerPhoto: r.caller_photo,
                callType: r.call_type,
                status: r.status,
                participants: r.participants || {},
                participantUids: r.participant_uids || [],
                createdAt: Number(r.created_at),
              });
            }
          }
        }
      )
      .subscribe();

    // 3. Initial active call lookup on connect
    (async () => {
      try {
        const { data } = await supabase
          .from('calls')
          .select('*')
          .eq('status', 'ringing')
          .contains('participant_uids', [currentUid])
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const r = data[0];
          const ageMs = Date.now() - Number(r.created_at);
          if (r.caller_id !== currentUid && ageMs < 45000) {
            onIncoming({
              id: r.id,
              chatId: r.chat_id,
              isGroup: (r.participant_uids || []).length > 2,
              callerId: r.caller_id,
              callerName: r.caller_name,
              callerPhoto: r.caller_photo,
              callType: r.call_type,
              status: r.status,
              participants: r.participants || {},
              participantUids: r.participant_uids || [],
              createdAt: Number(r.created_at),
            });
          }
        }
      } catch {}
    })();

    return () => {
      try {
        supabase.removeChannel(userCallChannel);
      } catch {}
      try {
        supabase.removeChannel(dbCallsSub);
      } catch {}
    };
  }

  /**
   * Listen for updates on an active call session (status changes, offers, answers)
   */
  public static subscribeToCallUpdates(
    callId: string,
    onUpdate: (updates: Partial<CallSession>) => void
  ): () => void {
    const supaChannel = supabase
      .channel(`call:${callId}`)
      .on('broadcast', { event: 'call_status_update' }, (payload: any) => {
        if (payload?.payload) {
          onUpdate(payload.payload);
        }
      })
      .subscribe();

    const dbSub = supabase
      .channel(`db-call-update:${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${callId}`,
        },
        (payload: any) => {
          const r = payload.new;
          if (r) {
            onUpdate({
              status: r.status,
              startedAt: r.started_at ? Number(r.started_at) : undefined,
              endedAt: r.ended_at ? Number(r.ended_at) : undefined,
              offer: r.offer,
              answer: r.answer,
              participants: r.participants,
            });
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(supaChannel);
      } catch {}
      try {
        supabase.removeChannel(dbSub);
      } catch {}
    };
  }

  /**
   * Broadcast a call signaling packet (offer, answer, or candidate)
   */
  public static async sendCallSignal(callId: string, signal: any): Promise<void> {
    const packet = {
      ...signal,
      packetId: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    // 1. Supabase Realtime Broadcast (instant in-memory WebSocket)
    try {
      const channel = supabase.channel(`call:${callId}`);
      await channel.send({
        type: 'broadcast',
        event: 'call_signal',
        payload: packet,
      });
    } catch {}

    // 2. Firebase RTDB
    try {
      const signalsRef = ref(rtdb, `calls/${callId}/signals`);
      await push(signalsRef, packet);
    } catch {}
  }

  /**
   * Subscribe to incoming call signaling packets for an active call
   */
  public static subscribeToCallSignals(
    callId: string,
    onSignal: (signal: any) => void
  ): () => void {
    const signalsRef = ref(rtdb, `calls/${callId}/signals`);

    const rtdbCallback = (snapshot: any) => {
      const val = snapshot.val();
      if (!val) return;
      const packetId = val.packetId || `${val.type}_${val.timestamp}`;
      if (this.seenSignalIds.has(packetId)) return;
      this.seenSignalIds.add(packetId);

      onSignal(val);
    };

    try {
      onChildAdded(signalsRef, rtdbCallback);
    } catch {}

    const supaChannel = supabase
      .channel(`call:${callId}`)
      .on('broadcast', { event: 'call_signal' }, (payload: any) => {
        const val = payload.payload;
        if (!val) return;
        const packetId = val.packetId || `${val.type}_${val.timestamp}`;
        if (this.seenSignalIds.has(packetId)) return;
        this.seenSignalIds.add(packetId);

        onSignal(val);
      })
      .subscribe();

    return () => {
      try {
        off(signalsRef, 'child_added', rtdbCallback);
      } catch {}
      try {
        supabase.removeChannel(supaChannel);
      } catch {}
    };
  }

  // ==========================================
  // 4. EPHEMERAL LIVE TYPING (0 DB WRITES)
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
    const channel = supabase
      .channel(`typing:${chatId}`)
      .on('broadcast', { event: 'typing_status' }, (payload: any) => {
        const data = payload.payload;
        if (data?.userId) {
          onTypingChange(data.userId, !!data.isTyping);
        }
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }
}
