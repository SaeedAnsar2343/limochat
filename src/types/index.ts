export type PrivacyScope = 'everyone' | 'contacts' | 'nobody';

export type UserPrivacy = {
  lastSeen: PrivacyScope;
  profilePhoto: PrivacyScope;
  readReceipts: boolean;
  about?: PrivacyScope;
  status?: PrivacyScope;
};

export type UserSession = {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ip?: string;
  lastActive: number;
  isCurrent?: boolean;
};

export type MessageToneType = 'pop' | 'chime' | 'submarine' | 'aurora' | 'bell';

export type UserPreferences = {
  enterIsSend: boolean;
  fontSize: 'sm' | 'base' | 'lg';
  notificationSound: boolean;
  ringtoneSound: boolean;
  messageTone?: MessageToneType;
  inAppVibration?: boolean;
  reactionNotifs?: boolean;
  highPriorityNotifs?: boolean;
  mediaAutoDownload: boolean;
  lowDataCalls?: boolean;
  disappearingDuration: number; // in hours, 0 = off
  securityNotifications: boolean;
  twoStepPin?: string;
  twoStepRecoveryEmail?: string;
  appLockEnabled?: boolean;
  appLockPin?: string;
  appLockTimeout?: 'immediately' | '1m' | '15m' | '1h';
  biometricEnabled?: boolean;
  appLanguage?: string;
  translateTargetLanguage?: string;
  appTheme?: 'dark' | 'light' | 'whatsapp-classic';
  wallpaper?: ChatWallpaper;
};

export type SuspensionType = 'permanent' | 'temporary';

export type UserRestrictions = {
  disableSendingMessages?: boolean;
  disableAddingContacts?: boolean;
  disableCalls?: boolean;
};

export type UserPunishment = {
  isSuspended: boolean;
  suspensionType?: SuspensionType;
  suspendedUntil?: number; // Unix timestamp in ms
  reason: string;
  appliedAt: number;
  appliedBy: string;
  restrictions?: UserRestrictions;
};

export type PolicyWarning = {
  id: string;
  ruleId?: string;
  reason: string;
  timestamp: number;
  appliedBy: string;
};

export type PolicyRuleAction = 'warn' | 'temporary_ban' | 'restrict_messaging' | 'permanent_ban';

export type PolicyRule = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  enabled?: boolean;
  autoWarn: boolean;
  defaultAction?: PolicyRuleAction;
  tempSuspensionMinutes?: number;
  checkMedia?: boolean;
  warningTemplate?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type ModerationMode = 'approval_required' | 'instant_autoban' | 'disabled';

export interface PolicyModerationSettings {
  enabled: boolean;
  mode: ModerationMode;
  notifyAdmins: boolean;
  updatedAt?: number;
  updatedBy?: string;
}

export interface PolicyIncident {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  userPhoto?: string;
  chatId: string;
  messageId?: string;
  messageText: string;
  matchedTerm: string;
  ruleId: string;
  ruleName: string;
  suggestedAction: PolicyRuleAction;
  tempSuspensionMinutes?: number;
  status: 'pending_review' | 'approved' | 'dismissed';
  timestamp: number;
  reviewedBy?: string;
  reviewedAt?: number;
  isUserReport?: boolean;
  reportedByUid?: string;
  reportedByName?: string;
  reportReason?: string;
  reportDetails?: string;
}

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  phoneNumber: string; // Virtual number: +991 xxx xxxx (lifetime persistent)
  about: string;
  isOnline: boolean;
  lastSeen: number; // Unix timestamp
  privacy: UserPrivacy;
  preferences?: UserPreferences;
  blockedUsers: string[];
  deletedContactUids?: string[];
  pinnedChatIds?: string[];
  activeSessions?: UserSession[];
  isBanned?: boolean;
  isAdmin?: boolean;
  allowSupportCalls?: boolean;
  isOnboarded?: boolean;
  createdAt: number;
  punishment?: UserPunishment;
  violationsCount?: number;
  policyWarnings?: PolicyWarning[];
};

export type MessageType = 'text' | 'image' | 'voice' | 'file' | 'call_log' | 'video' | 'location' | 'contact' | 'sticker';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export type QuotedMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: MessageType;
};

export type Message = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  mediaDuration?: number; // For voice notes in seconds
  fileName?: string;
  fileSize?: string;
  status: MessageStatus;
  timestamp: number;
  quotedMessage?: QuotedMessage | null;
  isDeletedForEveryone?: boolean;
  deletedForUsers?: string[]; // uids of users who deleted for me
  starredBy?: string[]; // uids of users who starred this
  translatedText?: string;
  translatedLanguage?: string;
  callType?: CallType;
  callStatus?: 'missed' | 'ended' | 'declined';
  reactions?: { emoji: string; userId: string; userName: string }[];
};

export type ChatType = 'direct' | 'group' | 'announcement';

export type ChatTag = 'all' | 'unread' | 'favourites' | 'groups';

export type GroupPermissions = {
  whoCanSendMessage: 'all' | 'admins';
  whoCanAddMembers: 'all' | 'admins';
  whoCanEditInfo: 'all' | 'admins';
  whoCanViewMembers: 'all' | 'admins';
};

export type Chat = {
  id: string;
  type: ChatType;
  name?: string; // Group/Community name or direct chat
  avatar?: string;
  description?: string;
  participants: string[]; // uids
  adminIds?: string[]; // group admins
  communityId?: string; // If part of a community
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: number;
    type: MessageType;
    status: MessageStatus;
    callType?: CallType;
    callStatus?: 'missed' | 'ended' | 'declined';
  } | null;
  unreadCount?: { [uid: string]: number };
  typingUsers?: { [uid: string]: boolean };
  supportCallsAllowed?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  pinnedBy?: string[]; // uids of users who pinned this
  tags?: string[]; // 'favourites'
  permissions?: GroupPermissions;
  memberJoinedAt?: { [uid: string]: number };
  memberHistoryRestricted?: { [uid: string]: boolean };
  createdAt: number;
  updatedAt: number;
};

export type Community = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  creatorId: string;
  members: string[]; // uids
  announcementChatId: string;
  groupIds: string[];
  createdAt: number;
};

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed';

export type CallParticipant = {
  uid: string;
  displayName: string;
  photoURL?: string;
  status: 'invited' | 'joined' | 'left' | 'declined';
  audioMuted: boolean;
  videoMuted: boolean;
};

export type CallSession = {
  id: string;
  chatId?: string;
  isGroup: boolean;
  groupName?: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  callType: CallType;
  status: CallStatus;
  participants: { [uid: string]: CallParticipant };
  participantUids?: string[]; // Array of uids for simple index-free querying
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
};

export type CallHistoryItem = {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId?: string;
  receiverName?: string;
  receiverPhoto?: string;
  callType: CallType;
  direction: 'incoming' | 'outgoing' | 'missed';
  timestamp: number;
  duration?: number;
  isGroup?: boolean;
  groupName?: string;
};

export type StatusPrivacyMode = 'contacts' | 'contacts_except' | 'only_share_with';

export type StatusUpdate = {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userPhone?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'text' | 'image' | 'video';
  backgroundColor?: string;
  fontFamily?: string;
  timestamp: number;
  viewedBy?: string[];
  privacy?: StatusPrivacyMode;
  privacyUids?: string[];
  taggedContacts?: { uid: string; displayName: string }[];
  videoDuration?: number;
  segmentIndex?: number;
  totalSegments?: number;
  segmentStart?: number;
  segmentEnd?: number;
  isMuted?: boolean;
};

export type AppTheme = 'dark' | 'light' | 'whatsapp-classic';
export type ChatWallpaper = 'default' | 'dark-slate' | 'emerald' | 'navy' | 'light-doodle' | 'apple-glass' | 'blurred-mesh';
