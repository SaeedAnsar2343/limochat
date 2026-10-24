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
  UserPlus,
  LogOut
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
  const { currentUser, isAdmin, signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
              activeRail === 'chats' && !viewingArchived
                ? 'bg-white dark:bg-[#2a3942] text-[#00a884] shadow-sm rail-active'
                : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#2a3942]'
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
                ? 'bg-white dark:bg-[#2a3942] text-[#00a884] shadow-sm rail-active'
                : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#2a3942]'
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
                ? 'bg-white dark:bg-[#2a3942] text-[#00a884] shadow-sm rail-active'
                : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#2a3942]'
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
                ? 'bg-white dark:bg-[#2a3942] text-[#00a884] shadow-sm rail-active'
                : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#2a3942]'
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
            className="p-2.5 rounded-xl text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#2a3942] transition cursor-pointer"
            title="Channels & Broadcasts"
          >
            <Megaphone className="w-5 h-5" />
          </button>

          <div className="w-8 border-t border-gray-300 dark:border-[#2e3b44] my-1" />
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
                ? 'bg-white dark:bg-[#2a3942] text-amber-500 dark:text-amber-400 shadow-sm rail-active'
                : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#2a3942]'
            }`}
            title="Starred / Favourites"
          >
            <Star className="w-5 h-5" />
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              setShowMoreMenu(false);
              setShowSettings(true);
            }}
            className="p-2.5 rounded-xl text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#2a3942] transition cursor-pointer"
            title="Settings & Privacy"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Admin Control Portal */}
          {isAdmin && (
            <button
              onClick={() => setShowAdminPortal(true)}
              className="p-2.5 rounded-xl text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 transition cursor-pointer"
              title="Admin Control Portal"
            >
              <ShieldCheck className="w-5 h-5 text-red-600 dark:text-red-400" />
            </button>
          )}

          {/* User Profile Avatar at bottom of dock */}
          <div
            onClick={() => {
              setShowMoreMenu(false);
              setShowSettings(true);
            }}
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
            <div className="pt-safe mobile-header-safe min-h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2e3b44]">
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
                        className="absolute right-0 top-10 z-30 w-52 bg-white dark:bg-[#233138] border border-gray-200 dark:border-[#2e3b44] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-2xl py-1.5 text-xs text-gray-800 dark:text-[#d1d7db] animate-scale-in"
                        onClick={() => setShowMoreMenu(false)}
                      >
                      <button
                        onClick={() => setShowNewGroup(true)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                      >
                        <UserPlus className="w-4 h-4 text-[#00a884]" />
                        <span>New Group</span>
                      </button>

                      <button
                        onClick={() => setActiveRail('communities')}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                      >
                        <Users2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>New Community</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveFilter('favourites');
                          setViewingArchived(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                      >
                        <Star className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        <span>Starred messages</span>
                      </button>

                      <button
                        onClick={() => setViewingArchived(!viewingArchived)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                      >
                        <Archive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Archived chats ({archivedChatsCount})</span>
                      </button>

                      <div className="border-t border-gray-200 dark:border-[#2e3b44] my-1" />

                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowSettings(true);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-[#182229] flex items-center gap-2.5 transition cursor-pointer font-medium text-gray-800 dark:text-[#d1d7db]"
                      >
                        <Settings className="w-4 h-4 text-gray-600 dark:text-[#8696a0]" />
                        <span>Settings</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            setShowAdminPortal(true);
                          }}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2.5 text-red-600 dark:text-red-400 font-semibold transition cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span>Admin Control Portal</span>
                        </button>
                      )}

                      <div className="border-t border-gray-200 dark:border-[#2e3b44] my-1" />

                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowLogoutConfirm(true);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2.5 text-red-600 dark:text-red-400 font-medium transition cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span>Log Out</span>
                      </button>
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
        {activeRail === 'calls' && <CallHistoryView onSelectChat={() => { setActiveRail('chats'); onSelectChat(); }} />}

        {/* VIEW C: STATUS / STORIES */}
        {activeRail === 'status' && <StatusView />}

        {/* VIEW D: COMMUNITIES */}
        {activeRail === 'communities' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="pt-safe mobile-header-safe min-h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2e3b44]">
              <h2 className="text-base font-bold text-white tracking-tight">Communities</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CommunityList />
            </div>
          </div>
        )}

        {/* Mobile Glassy Bottom Navigation Bar (Modern Apple / VisionOS Glassmorphism Dock) */}
        <div className="md:hidden flex-shrink-0 z-30 px-3 pb-safe pt-1 pointer-events-none sticky bottom-0 mb-1">
          <nav 
            aria-label="Mobile Navigation"
            className="pointer-events-auto h-16 bg-[#182229]/80 dark:bg-[#182229]/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.12] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.18)] flex items-center justify-around px-2 relative overflow-hidden mobile-glass-dock"
          >
            {/* Top Specular Ambient Highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#00a884]/25 to-transparent pointer-events-none" />

            {/* 1. Chats Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveRail('chats');
                setViewingArchived(false);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all duration-200 cursor-pointer active:scale-90 relative ${
                activeRail === 'chats'
                  ? 'text-white font-semibold'
                  : 'text-[#8696a0] hover:text-white'
              }`}
            >
              <div className={`relative px-3 py-1 rounded-full transition-all duration-200 ${
                activeRail === 'chats' ? 'bg-[#00a884]/20 text-[#00a884] shadow-[0_0_12px_rgba(0,168,132,0.3)]' : ''
              }`}>
                <MessageSquare className={`w-5 h-5 transition-transform duration-200 ${activeRail === 'chats' ? 'scale-110 text-[#00a884]' : ''}`} />
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#00a884] text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-[#111b21] shadow-sm">
                    {totalUnreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-0.5 transition-colors ${activeRail === 'chats' ? 'text-white font-bold' : 'text-[#8696a0]'}`}>Chats</span>
              {activeRail === 'chats' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] shadow-[0_0_8px_#00a884] mt-0.5" />
              )}
            </button>

            {/* 2. Status Tab */}
            <button
              type="button"
              onClick={() => setActiveRail('status')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all duration-200 cursor-pointer active:scale-90 relative ${
                activeRail === 'status'
                  ? 'text-white font-semibold'
                  : 'text-[#8696a0] hover:text-white'
              }`}
            >
              <div className={`relative px-3 py-1 rounded-full transition-all duration-200 ${
                activeRail === 'status' ? 'bg-[#00a884]/20 text-[#00a884] shadow-[0_0_12px_rgba(0,168,132,0.3)]' : ''
              }`}>
                <CircleDot className={`w-5 h-5 transition-transform duration-200 ${activeRail === 'status' ? 'scale-110 text-[#00a884]' : ''}`} />
                {hasUnseenStatus && (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#00a884] ring-2 ring-[#111b21] animate-ping" />
                )}
                {hasUnseenStatus && (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#00a884] ring-2 ring-[#111b21]" />
                )}
              </div>
              <span className={`text-[11px] mt-0.5 transition-colors ${activeRail === 'status' ? 'text-white font-bold' : 'text-[#8696a0]'}`}>Status</span>
              {activeRail === 'status' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] shadow-[0_0_8px_#00a884] mt-0.5" />
              )}
            </button>

            {/* 3. Calls Tab */}
            <button
              type="button"
              onClick={() => setActiveRail('calls')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all duration-200 cursor-pointer active:scale-90 relative ${
                activeRail === 'calls'
                  ? 'text-white font-semibold'
                  : 'text-[#8696a0] hover:text-white'
              }`}
            >
              <div className={`relative px-3 py-1 rounded-full transition-all duration-200 ${
                activeRail === 'calls' ? 'bg-[#00a884]/20 text-[#00a884] shadow-[0_0_12px_rgba(0,168,132,0.3)]' : ''
              }`}>
                <Phone className={`w-5 h-5 transition-transform duration-200 ${activeRail === 'calls' ? 'scale-110 text-[#00a884]' : ''}`} />
              </div>
              <span className={`text-[11px] mt-0.5 transition-colors ${activeRail === 'calls' ? 'text-white font-bold' : 'text-[#8696a0]'}`}>Calls</span>
              {activeRail === 'calls' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] shadow-[0_0_8px_#00a884] mt-0.5" />
              )}
            </button>

            {/* 4. Settings Tab */}
            <button
              type="button"
              onClick={() => {
                setShowMoreMenu(false);
                setShowSettings(true);
              }}
              className="flex-1 flex flex-col items-center justify-center py-1.5 text-[#8696a0] hover:text-white transition-all duration-200 cursor-pointer active:scale-90 group"
            >
              <div className="px-3 py-1 rounded-full group-hover:bg-white/[0.06] transition-all duration-200">
                <Settings className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />
              </div>
              <span className="text-[11px] mt-0.5">Settings</span>
            </button>
          </nav>
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
      {showLogoutConfirm && (
        <ConfirmModal
          isOpen={showLogoutConfirm}
          title="Log Out of LimoChat?"
          description="Are you sure you want to log out? You will need to sign in again to access your messages, calls, and encrypted chats."
          confirmText="Log Out"
          cancelText="Cancel"
          variant="danger"
          icon={<LogOut className="w-5 h-5 text-red-500" />}
          onConfirm={() => {
            setShowLogoutConfirm(false);
            signOut();
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
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
