import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Phone, 
  CircleDot, 
  Users2, 
  Megaphone, 
  Star, 
  Settings, 
  Search, 
  Plus, 
  MoreVertical, 
  Archive, 
  ChevronDown, 
  ArrowLeft,
  ShieldCheck, 
  Copy, 
  Check, 
  QrCode,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { ChatListItem } from './ChatListItem';
import { CommunityList } from './CommunityList';
import { NewChatModal } from './NewChatModal';
import { NewGroupModal } from './NewGroupModal';
import { SettingsDrawer } from '../settings/SettingsDrawer';
import { QRCodeModal } from '../common/QRCodeModal';
import { AdminPortalModal } from '../admin/AdminPortalModal';
import { StatusView } from '../status/StatusView';
import { CallHistoryView } from '../calls/CallHistoryView';
import { ChatListSkeleton } from '../common/SkeletonLoading';
import { ConfirmModal } from '../common/ConfirmModal';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Chat, StatusUpdate } from '../../types';

interface SidebarProps {
  onSelectChat: () => void;
}

type RailTab = 'chats' | 'calls' | 'status' | 'communities' | 'channels';
type FilterTag = 'all' | 'unread' | 'favourites' | 'groups';

export const Sidebar: React.FC<SidebarProps> = ({ onSelectChat }) => {
  const { currentUser, isAdmin } = useAuth();
  const { chats, activeChat, setActiveChat, markChatAsRead } = useChat();

  const [activeRail, setActiveRail] = useState<RailTab>('chats');
  const [activeFilter, setActiveFilter] = useState<FilterTag>('all');
  const [viewingArchived, setViewingArchived] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Modals & Menus
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restrictionAlert, setRestrictionAlert] = useState<string | null>(null);

  const handleOpenNewChat = () => {
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const isUserAdmin = currentUser?.isAdmin === true || userEmail === 'saeed.samadelivery@gmail.com';
    if (!isUserAdmin && currentUser?.punishment?.restrictions?.disableAddingContacts) {
      setRestrictionAlert(
        `Action Restricted: Your ability to add contacts or start new chats is suspended due to an active account sanction ("${currentUser.punishment.reason || 'Policy violation'}").`
      );
      return;
    }
    setShowNewChat(true);
  };

  // Status updates check for rail unread indicator
  const [hasUnseenStatus, setHasUnseenStatus] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'statuses'), (snapshot) => {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      let unseen = false;
      snapshot.forEach((doc) => {
        const data = doc.data() as StatusUpdate;
        if (
          data.userId !== currentUser.uid &&
          data.timestamp &&
          data.timestamp >= twentyFourHoursAgo &&
          (!data.viewedBy || !data.viewedBy.includes(currentUser.uid))
        ) {
          unseen = true;
        }
      });
      setHasUnseenStatus(unseen);
    }, () => {});

    return () => unsub();
  }, [currentUser]);

  if (!currentUser) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(currentUser.phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Counts
  const totalUnreadCount = chats.reduce((acc, c) => {
    return acc + (c.unreadCount?.[currentUser.uid] || 0);
  }, 0);

  const groupChatsCount = chats.filter((c) => c.type === 'group').length;
  const archivedChatsCount = chats.filter((c) => c.isArchived).length;

  // Filtered Chats
  const targetChatSource = viewingArchived
    ? chats.filter((c) => c.isArchived)
    : chats.filter((c) => !c.isArchived);

  const filteredChats = targetChatSource.filter((c) => {
    // 1. Tag filter
    if (!viewingArchived) {
      if (activeFilter === 'unread') {
        const unread = c.unreadCount?.[currentUser.uid] || 0;
        if (unread === 0) return false;
      } else if (activeFilter === 'favourites') {
        if (!c.tags?.includes('favourites') && !c.isPinned) return false;
      } else if (activeFilter === 'groups') {
        if (c.type !== 'group') return false;
      }
    }

    // 2. Search filter
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(q);
    const lastMsgMatch = c.lastMessage?.text?.toLowerCase().includes(q);
    return nameMatch || lastMsgMatch;
  });

  // Sort: pinned first (per user or global), then newest timestamp
  const sortedChats = [...filteredChats].sort((a, b) => {
    const isPinnedA = a.pinnedBy?.includes(currentUser.uid) || !!a.isPinned;
    const isPinnedB = b.pinnedBy?.includes(currentUser.uid) || !!b.isPinned;
    if (isPinnedA && !isPinnedB) return -1;
    if (!isPinnedA && isPinnedB) return 1;
    const timeA = a.lastMessage?.timestamp || a.updatedAt || 0;
    const timeB = b.lastMessage?.timestamp || b.updatedAt || 0;
    return timeB - timeA;
  });

  return (
    <div className="w-full md:w-[460px] lg:w-[480px] h-full flex flex-row flex-shrink-0 select-none bg-[#111b21] border-r border-[#222e35]">
      {/* 1. FAR-LEFT VERTICAL DOCK / ICON RAIL (MATCHING SCREENSHOT) */}
      <div className="sidebar-dock hidden md:flex w-14 sm:w-16 h-full bg-[#202c33]/90 backdrop-blur-xl border-r border-[#2e3b44] flex-col items-center justify-between py-3 flex-shrink-0 z-20">
        {/* Top Icons */}
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Chats Icon */}
          <button
            onClick={() => {
              setActiveRail('chats');
              setViewingArchived(false);
            }}
            className={`relative p-2.5 rounded-xl transition cursor-pointer ${
              activeRail === 'chats'
                ? 'bg-[#2a3942] text-[#00a884] rail-active'
                : 'text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
            title="Chats"
          >
            <MessageSquare className="w-5 h-5" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#00a884] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </button>

          {/* Calls Icon */}
          <button
            onClick={() => setActiveRail('calls')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              activeRail === 'calls'
                ? 'bg-[#2a3942] text-[#00a884] rail-active'
                : 'text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
            title="Call History"
          >
            <Phone className="w-5 h-5" />
          </button>

          {/* Status / Stories Icon */}
          <button
            onClick={() => setActiveRail('status')}
            className={`relative p-2.5 rounded-xl transition cursor-pointer ${
              activeRail === 'status'
                ? 'bg-[#2a3942] text-[#00a884] rail-active'
                : 'text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
            title="Status Updates"
          >
            <CircleDot className="w-5 h-5" />
            {hasUnseenStatus && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#00a884] ring-2 ring-[#202c33]" />
            )}
          </button>

          {/* Communities Icon */}
          <button
            onClick={() => setActiveRail('communities')}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              activeRail === 'communities'
                ? 'bg-[#2a3942] text-[#00a884] rail-active'
                : 'text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
            title="Communities"
          >
            <Users2 className="w-5 h-5" />
          </button>

          {/* Channels / Megaphone Icon */}
          <button
            onClick={() => {
              setActiveRail('chats');
              setActiveFilter('all');
            }}
            className="p-2.5 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition cursor-pointer"
            title="Channels & Broadcasts"
          >
            <Megaphone className="w-5 h-5" />
          </button>

          <div className="w-8 border-t border-[#2e3b44] my-1" />
        </div>

        {/* Bottom Icons */}
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Starred Messages */}
          <button
            onClick={() => {
              setActiveRail('chats');
              setActiveFilter('favourites');
            }}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              activeFilter === 'favourites' && activeRail === 'chats'
                ? 'bg-[#2a3942] text-amber-400 rail-active'
                : 'text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
            }`}
            title="Starred / Favourites"
          >
            <Star className="w-5 h-5" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition cursor-pointer"
            title="Settings & Privacy"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Admin Control Portal */}
          {isAdmin && (
            <button
              onClick={() => setShowAdminPortal(true)}
              className="p-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/15 transition cursor-pointer"
              title="Admin Control Portal"
            >
              <ShieldCheck className="w-5 h-5 text-red-400" />
            </button>
          )}

          {/* User Profile Avatar at bottom of dock */}
          <div
            onClick={() => setShowSettings(true)}
            className="p-1 cursor-pointer hover:opacity-85 transition"
            title={`${currentUser.displayName} • ${currentUser.phoneNumber}`}
          >
            <Avatar
              src={currentUser.photoURL}
              name={currentUser.displayName}
              size="sm"
              isOnline={true}
            />
          </div>
        </div>
      </div>

      {/* 2. MAIN SIDEBAR CONTENT PANEL */}
      <div className="flex-1 flex flex-col h-full bg-[#111b21] overflow-hidden">
        {/* VIEW A: CHATS */}
        {activeRail === 'chats' && (
          <>
            {/* Header */}
            <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2e3b44]">
              {viewingArchived ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewingArchived(false)}
                    className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-lg font-bold text-white tracking-tight">Archived Chats</h1>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">LimoChat</h1>
                </div>
              )}

              {/* Action Icons */}
              <div className="flex items-center gap-1.5 text-[#8696a0]">
                {/* New Chat Button */}
                <button
                  onClick={handleOpenNewChat}
                  className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center transition shadow cursor-pointer"
                  title="New Chat"
                >
                  <Plus className="w-5 h-5" />
                </button>

                {/* More Options Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-2 rounded-full hover:text-white hover:bg-[#2a3942] transition cursor-pointer"
                    title="Menu"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {showMoreMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-20 cursor-default"
                        onClick={() => setShowMoreMenu(false)}
                      />
                      <div
                        className="absolute right-0 top-10 z-30 w-48 bg-[#233138] border border-[#2e3b44] rounded-2xl shadow-2xl py-1 text-xs text-[#d1d7db] animate-scale-in"
                        onClick={() => setShowMoreMenu(false)}
                      >
                      <button
                        onClick={() => setShowNewGroup(true)}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5"
                      >
                        <UserPlus className="w-4 h-4 text-[#00a884]" />
                        <span>New Group</span>
                      </button>

                      <button
                        onClick={() => setActiveRail('communities')}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5"
                      >
                        <Users2 className="w-4 h-4 text-cyan-400" />
                        <span>New Community</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveFilter('favourites');
                          setViewingArchived(false);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5"
                      >
                        <Star className="w-4 h-4 text-amber-400" />
                        <span>Starred messages</span>
                      </button>

                      <button
                        onClick={() => setViewingArchived(!viewingArchived)}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5"
                      >
                        <Archive className="w-4 h-4 text-purple-400" />
                        <span>Archived chats ({archivedChatsCount})</span>
                      </button>

                      <div className="border-t border-[#2e3b44] my-1" />

                      <button
                        onClick={() => setShowSettings(true)}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#182229] flex items-center gap-2.5"
                      >
                        <Settings className="w-4 h-4 text-[#8696a0]" />
                        <span>Settings</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            setShowAdminPortal(true);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-red-500/10 flex items-center gap-2.5 text-red-400 font-semibold"
                        >
                          <ShieldCheck className="w-4 h-4 text-red-400" />
                          <span>Admin Control Portal</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
                </div>
              </div>
            </div>

            {/* Search Input Bar (Matching WhatsApp Web pill) */}
            <div className="px-3 pt-2.5 pb-2 bg-[#111b21]">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-[#8696a0] absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search or start a new chat"
                  className="w-full bg-[#202c33] text-xs text-[#e9edef] placeholder-[#8696a0] rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884] border border-transparent focus:border-[#00a884]/40"
                />
              </div>
            </div>

            {/* Filter Pill Chips (Matching Screenshot: All, Unread 82, Favourites, Groups 7, Follow up, Need Check) */}
            {!viewingArchived && (
              <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-b border-[#222e35]/60 bg-[#111b21] text-[11px] font-medium select-none">
                {/* All */}
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-[#2a3942] text-[#00a884] font-semibold border border-[#00a884]/30'
                      : 'bg-[#202c33] text-[#8696a0] hover:text-white hover:bg-[#26353d]'
                  }`}
                >
                  All
                </button>

                {/* Unread with Count */}
                <button
                  onClick={() => setActiveFilter('unread')}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'unread'
                      ? 'bg-[#2a3942] text-[#00a884] font-semibold border border-[#00a884]/30'
                      : 'bg-[#202c33] text-[#8696a0] hover:text-white hover:bg-[#26353d]'
                  }`}
                >
                  <span>Unread</span>
                  {totalUnreadCount > 0 && (
                    <span className="text-[10px] bg-[#00a884] text-white px-1.5 py-0.2 rounded-full font-bold">
                      {totalUnreadCount}
                    </span>
                  )}
                </button>

                {/* Favourites */}
                <button
                  onClick={() => setActiveFilter('favourites')}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
                    activeFilter === 'favourites'
                      ? 'bg-[#2a3942] text-amber-300 font-semibold border border-amber-400/30'
                      : 'bg-[#202c33] text-[#8696a0] hover:text-white hover:bg-[#26353d]'
                  }`}
                >
                  Favourites
                </button>

                {/* Groups with Count */}
                <button
                  onClick={() => setActiveFilter('groups')}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'groups'
                      ? 'bg-[#2a3942] text-cyan-300 font-semibold border border-cyan-400/30'
                      : 'bg-[#202c33] text-[#8696a0] hover:text-white hover:bg-[#26353d]'
                  }`}
                >
                  <span>Groups</span>
                  {groupChatsCount > 0 && (
                    <span className="text-[10px] bg-[#2e3b44] text-[#8696a0] px-1.5 py-0.2 rounded-full font-bold">
                      {groupChatsCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Archived Section Row (Matching Screenshot: [Archive] Archived (count)) */}
            {!viewingArchived && archivedChatsCount > 0 && (
              <div
                onClick={() => setViewingArchived(true)}
                className="px-4 py-3 bg-[#111b21] hover:bg-[#202c33] border-b border-[#222e35]/60 flex items-center justify-between cursor-pointer transition text-xs font-semibold text-[#e9edef]"
              >
                <div className="flex items-center gap-3">
                  <Archive className="w-4 h-4 text-[#00a884]" />
                  <span>Archived</span>
                </div>
                <span className="text-[11px] text-[#00a884] font-bold">
                  {archivedChatsCount}
                </span>
              </div>
            )}

            {/* Main Chat List Items */}
            <div className="flex-1 overflow-y-auto">
              {sortedChats.length > 0 ? (
                sortedChats.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isActive={activeChat?.id === chat.id}
                    currentUser={currentUser}
                    onClick={() => {
                      setActiveChat(chat);
                      if (currentUser?.uid && (chat.unreadCount?.[currentUser.uid] || 0) > 0) {
                        markChatAsRead(chat.id);
                      }
                      onSelectChat();
                    }}
                  />
                ))
              ) : (
                <div className="py-20 text-center text-xs text-[#8696a0] px-6 space-y-3">
                  <MessageSquare className="w-10 h-10 text-[#8696a0]/30 mx-auto" />
                  <p>
                    {viewingArchived
                      ? 'No archived chats.'
                      : activeFilter !== 'all'
                      ? `No chats found matching filter "${activeFilter}".`
                      : 'No conversations yet.'}
                  </p>
                  <button
                    onClick={() => {
                      setActiveFilter('all');
                      setViewingArchived(false);
                      handleOpenNewChat();
                    }}
                    className="px-4 py-2 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl font-medium transition cursor-pointer"
                  >
                    Start a New Chat
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* VIEW B: CALL HISTORY */}
        {activeRail === 'calls' && <CallHistoryView />}

        {/* VIEW C: STATUS / STORIES */}
        {activeRail === 'status' && <StatusView />}

        {/* VIEW D: COMMUNITIES */}
        {activeRail === 'communities' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2e3b44]">
              <h2 className="text-base font-bold text-white tracking-tight">Communities</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CommunityList />
            </div>
          </div>
        )}

        {/* Mobile Glassy Bottom Navigation Bar (Apple Style) */}
        <div className="md:hidden h-16 bg-[#182229]/85 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-2 flex-shrink-0 z-30">
          <button
            onClick={() => {
              setActiveRail('chats');
              setViewingArchived(false);
            }}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeRail === 'chats' ? 'text-[#00a884]' : 'text-[#8696a0]'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-[#00a884] text-white text-[9px] font-bold px-1 rounded-full">
                  {totalUnreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Chats</span>
          </button>

          <button
            onClick={() => setActiveRail('calls')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeRail === 'calls' ? 'text-[#00a884]' : 'text-[#8696a0]'
            }`}
          >
            <Phone className="w-5 h-5" />
            <span className="text-[10px] font-medium">Calls</span>
          </button>

          <button
            onClick={() => setActiveRail('status')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeRail === 'status' ? 'text-[#00a884]' : 'text-[#8696a0]'
            }`}
          >
            <div className="relative">
              <CircleDot className="w-5 h-5" />
              {hasUnseenStatus && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#00a884]" />
              )}
            </div>
            <span className="text-[10px] font-medium">Status</span>
          </button>

          <button
            onClick={() => setActiveRail('communities')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeRail === 'communities' ? 'text-[#00a884]' : 'text-[#8696a0]'
            }`}
          >
            <Users2 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Communities</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center gap-1 text-[#8696a0] hover:text-white transition cursor-pointer"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>
      </div>

      {/* Global Modals */}
      <NewChatModal 
        isOpen={showNewChat} 
        onClose={() => setShowNewChat(false)} 
        onOpenNewGroup={() => setShowNewGroup(true)} 
      />
      <NewGroupModal isOpen={showNewGroup} onClose={() => setShowNewGroup(false)} />
      <SettingsDrawer
        user={currentUser}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
      <QRCodeModal user={currentUser} isOpen={showQR} onClose={() => setShowQR(false)} />
      {isAdmin && (
        <AdminPortalModal
          isOpen={showAdminPortal}
          onClose={() => setShowAdminPortal(false)}
          onSelectChat={(chat) => {
            setActiveChat(chat);
            onSelectChat();
          }}
        />
      )}

      {restrictionAlert && (
        <ConfirmModal
          isOpen={true}
          title="Action Restricted"
          description={restrictionAlert}
          variant="warning"
          singleAction={true}
          confirmText="I Understand"
          onConfirm={() => setRestrictionAlert(null)}
        />
      )}
    </div>
  );
};
