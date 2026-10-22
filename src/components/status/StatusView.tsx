import React, { useState, useEffect } from 'react';
import { Plus, Sparkles, Clock, MoreVertical, Eye, Pencil, Camera } from 'lucide-react';
import { StatusUpdate } from '../../types';
import { Avatar } from '../common/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { NewStatusModal } from './NewStatusModal';
import { StatusViewerModal } from './StatusViewerModal';
import { formatTime } from '../../utils/formatters';
import { StatusListSkeleton } from '../common/SkeletonLoading';
import { NativeNotificationService } from '../../utils/nativeNotifications';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';

export const StatusView: React.FC = () => {
  const { currentUser } = useAuth();
  const { chats } = useChat();
  const [statuses, setStatuses] = useState<StatusUpdate[]>(() => {
    try {
      const cached = localStorage.getItem('limochat_statuses');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [showNewModal, setShowNewModal] = useState(false);
  const [modalType, setModalType] = useState<'text' | 'camera' | 'image' | 'video'>('text');
  const [selectedUserStatuses, setSelectedUserStatuses] = useState<StatusUpdate[] | null>(null);

  // Sync statuses from Supabase PostgreSQL (Unlimited writes) & Firestore
  useEffect(() => {
    // 1. Fetch statuses from Supabase PostgreSQL
    RealtimeCoordinator.fetchStatuses().then((supaList) => {
      if (supaList.length > 0) {
        setStatuses((prev) => {
          const map = new Map<string, StatusUpdate>();
          prev.forEach((s) => map.set(s.id, s));
          supaList.forEach((s) => map.set(s.id, s));
          const merged = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          try {
            localStorage.setItem('limochat_statuses', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    }).catch(() => {});

    // 2. Real-time subscription to statuses (Postgres changes & broadcast)
    const unsubRealtime = RealtimeCoordinator.subscribeToStatuses(
      (newStatus) => {
        setStatuses((prev) => {
          const map = new Map<string, StatusUpdate>();
          prev.forEach((s) => map.set(s.id, s));
          map.set(newStatus.id, newStatus);
          const merged = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          try {
            localStorage.setItem('limochat_statuses', JSON.stringify(merged));
          } catch {}
          return merged;
        });

        // Push notification for new status from contacts
        if (currentUser?.uid && newStatus.userId !== currentUser.uid) {
          const statusNotifKey = `limochat_seen_status_${newStatus.id}`;
          if (!sessionStorage.getItem(statusNotifKey)) {
            sessionStorage.setItem(statusNotifKey, '1');
            NativeNotificationService.notifyStatusUpdate({
              userName: newStatus.userName || 'Contact',
              statusSnippet: newStatus.text || 'Shared a new status update',
              userId: newStatus.userId,
            });
          }
        }
      },
      (update) => {
        setStatuses((prev) => {
          const updated = prev.map((s) => (s.id === update.statusId ? { ...s, ...update } : s));
          try {
            localStorage.setItem('limochat_statuses', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    );

    // 3. Secondary companion Firestore snapshot
    const statusesRef = collection(db, 'statuses');
    const unsubFirestore = onSnapshot(statusesRef, (snapshot) => {
      const list: StatusUpdate[] = [];
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

      snapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() } as StatusUpdate;
        // Keep statuses from past 24 hours
        if (item.timestamp && item.timestamp >= twentyFourHoursAgo) {
          list.push(item);
        }
      });

      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      setStatuses((prev) => {
        const map = new Map<string, StatusUpdate>();
        prev.forEach((s) => map.set(s.id, s));
        list.forEach((s) => map.set(s.id, s));
        const merged = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        try {
          localStorage.setItem('limochat_statuses', JSON.stringify(merged));
        } catch {}
        return merged;
      });
    }, (err) => {
      console.warn("Statuses snapshot notice (Supabase active):", err);
    });

    return () => {
      unsubRealtime();
      unsubFirestore();
    };
  }, [currentUser?.uid]);

  if (!currentUser) return null;

  // Compute active direct contact UIDs (contacts who have not been deleted)
  const directContactUids = new Set<string>();
  chats.forEach((c) => {
    if (c.type === 'direct') {
      c.participants?.forEach((p) => {
        if (p !== currentUser.uid && p !== 'limochat_official_support') {
          directContactUids.add(p);
        }
      });
    }
  });

  // My statuses
  const myStatuses = statuses.filter((s) => s.userId === currentUser.uid);
  const otherStatuses = statuses.filter((s) => {
    if (s.userId === currentUser.uid) return false;

    // 1. Blocked contacts cannot see status / cannot be seen
    if ((currentUser.blockedUsers || []).includes(s.userId)) {
      return false;
    }

    // 2. Deleted contact rule: must be an active contact
    if (!directContactUids.has(s.userId)) {
      return false;
    }

    // 3. Status Privacy Filtering
    if (s.privacy === 'contacts_except' && s.privacyUids?.includes(currentUser.uid)) {
      return false;
    }
    if (s.privacy === 'only_share_with' && !s.privacyUids?.includes(currentUser.uid)) {
      return false;
    }
    return true;
  });

  // Group other statuses by user
  const otherUsersMap = new Map<string, StatusUpdate[]>();
  otherStatuses.forEach((s) => {
    const existing = otherUsersMap.get(s.userId) || [];
    otherUsersMap.set(s.userId, [...existing, s]);
  });

  const recentUpdates: { userId: string; userStatuses: StatusUpdate[] }[] = [];
  const viewedUpdates: { userId: string; userStatuses: StatusUpdate[] }[] = [];

  otherUsersMap.forEach((userStatuses, uid) => {
    // Check if user has viewed all statuses of this person
    const hasUnviewed = userStatuses.some(
      (s) => !s.viewedBy || !s.viewedBy.includes(currentUser.uid)
    );
    if (hasUnviewed) {
      recentUpdates.push({ userId: uid, userStatuses });
    } else {
      viewedUpdates.push({ userId: uid, userStatuses });
    }
  });

  const openNewStatus = (type: 'text' | 'camera' = 'text') => {
    setModalType(type);
    setShowNewModal(true);
  };

  const handleOpenMyStatus = () => {
    if (myStatuses.length > 0) {
      setSelectedUserStatuses(myStatuses);
    } else {
      openNewStatus('text');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#111b21] overflow-y-auto select-none relative">
      {/* Header */}
      <div className="pt-safe mobile-header-safe min-h-16 p-4 bg-[#202c33] border-b border-[#2e3b44] flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <h2 className="text-base font-bold text-white tracking-tight">Status</h2>
        <button
          onClick={() => openNewStatus('camera')}
          className="p-2 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white transition shadow cursor-pointer"
          title="Add Status Update"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-5 pb-24">
        {/* My Status Card */}
        <div
          onClick={handleOpenMyStatus}
          className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#202c33] cursor-pointer transition group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative flex-shrink-0">
              <div className={`p-0.5 rounded-full ${myStatuses.length > 0 ? 'ring-2 ring-[#00a884]' : ''}`}>
                <Avatar
                  src={currentUser.photoURL}
                  name={currentUser.displayName}
                  size="lg"
                />
              </div>
              {/* Plus badge */}
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#00a884] border-2 border-[#111b21] flex items-center justify-center text-white shadow-sm">
                <Plus className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-sm">My Status</h3>
              <p className="text-xs text-[#8696a0] truncate mt-0.5">
                {myStatuses.length > 0
                  ? `${myStatuses.length} active update${myStatuses.length > 1 ? 's' : ''} • Tap to view`
                  : 'Tap to add status update'}
              </p>
            </div>
          </div>

          {/* Dedicated + button if user already has active statuses */}
          {myStatuses.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openNewStatus('camera');
              }}
              className="p-2 rounded-full bg-[#202c33] group-hover:bg-[#00a884] text-[#00a884] group-hover:text-white transition cursor-pointer flex-shrink-0"
              title="Add another status"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Recent Updates */}
        {recentUpdates.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#8696a0] px-2 mb-2">
              Recent Updates
            </div>
            <div className="space-y-1">
              {recentUpdates.map(({ userId, userStatuses }) => {
                const latest = userStatuses[0];
                return (
                  <div
                    key={userId}
                    onClick={() => setSelectedUserStatuses(userStatuses)}
                    className="flex items-center gap-3.5 p-2.5 rounded-2xl hover:bg-[#202c33] cursor-pointer transition"
                  >
                    {/* Ring around avatar indicating unviewed status */}
                    <div className="p-0.5 rounded-full ring-[2.5px] ring-[#00a884] flex-shrink-0">
                      <Avatar
                        src={latest.userPhoto}
                        name={latest.userName}
                        size="md"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm truncate">
                        {latest.userName}
                      </h4>
                      <p className="text-xs text-[#8696a0] mt-0.5">
                        {formatTime(latest.timestamp)}
                        {userStatuses.length > 1 && ` • ${userStatuses.length} updates`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Viewed Updates */}
        {viewedUpdates.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#8696a0] px-2 mb-2">
              Viewed Updates
            </div>
            <div className="space-y-1 opacity-75 hover:opacity-100 transition">
              {viewedUpdates.map(({ userId, userStatuses }) => {
                const latest = userStatuses[0];
                return (
                  <div
                    key={userId}
                    onClick={() => setSelectedUserStatuses(userStatuses)}
                    className="flex items-center gap-3.5 p-2.5 rounded-2xl hover:bg-[#202c33] cursor-pointer transition"
                  >
                    <div className="p-0.5 rounded-full ring-2 ring-[#8696a0]/50 flex-shrink-0">
                      <Avatar
                        src={latest.userPhoto}
                        name={latest.userName}
                        size="md"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm truncate">
                        {latest.userName}
                      </h4>
                      <p className="text-xs text-[#8696a0] mt-0.5">
                        {formatTime(latest.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {recentUpdates.length === 0 && viewedUpdates.length === 0 && myStatuses.length === 0 && (
          <div className="py-16 text-center text-xs text-[#8696a0] px-6 space-y-3">
            <Sparkles className="w-10 h-10 text-[#00a884]/40 mx-auto" />
            <p className="max-w-xs mx-auto">
              No status updates yet. Post text, photos, or 30s videos to share with your contacts for 24 hours.
            </p>
            <button
              onClick={() => openNewStatus('camera')}
              className="px-4 py-2 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl font-medium transition cursor-pointer shadow-md"
            >
              Create My First Status
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Buttons (WhatsApp Style: Pencil for text, Camera for media) */}
      <div className="fixed sm:absolute bottom-6 right-6 flex flex-col items-center gap-3 z-30">
        <button
          type="button"
          onClick={() => openNewStatus('text')}
          className="w-10 h-10 rounded-full bg-[#202c33] hover:bg-[#2a3942] active:scale-95 text-[#8696a0] hover:text-white flex items-center justify-center shadow-lg border border-white/10 transition cursor-pointer"
          title="New text status"
        >
          <Pencil className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => openNewStatus('camera')}
          className="w-13 h-13 rounded-full bg-[#00a884] hover:bg-[#02906f] active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-[#00a884]/40 transition cursor-pointer"
          title="New photo or video status"
        >
          <Camera className="w-6 h-6" />
        </button>
      </div>

      {/* Modals */}
      <NewStatusModal
        isOpen={showNewModal}
        initialType={modalType}
        onClose={() => setShowNewModal(false)}
        onStatusCreated={(newS) => {
          setStatuses((prev) => [newS, ...prev]);
        }}
      />

      {selectedUserStatuses && (
        <StatusViewerModal
          isOpen={true}
          onClose={() => setSelectedUserStatuses(null)}
          statuses={selectedUserStatuses}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
