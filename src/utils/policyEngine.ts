import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  arrayUnion, 
  increment,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { RealtimeCoordinator } from './realtimeCoordinator';
import { 
  UserProfile, 
  UserPunishment, 
  PolicyRuleAction, 
  PolicyRule, 
  PolicyModerationSettings, 
  PolicyIncident,
  ModerationMode
} from '../types';

export type { 
  PolicyRuleAction, 
  PolicyRule, 
  PolicyModerationSettings, 
  PolicyIncident,
  ModerationMode 
};

export interface ViolationAuditLog {
  id?: string;
  userId: string;
  userName: string;
  userPhone?: string;
  ruleId: string;
  ruleName: string;
  matchedTerm: string;
  snippet: string;
  actionTaken: string;
  timestamp: number;
}

export interface PolicyCheckResult {
  violated: boolean;
  rule: PolicyRule;
  matchedTerm: string;
  actionDescription: string;
}

export const DEFAULT_MODERATION_SETTINGS: PolicyModerationSettings = {
  enabled: true,
  mode: 'approval_required', // Flagged words show in Admin Portal for admin review and approval
  notifyAdmins: true,
};

export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: 'rule_explicit_language',
    name: 'Abusive & Explicit Words Filter',
    description: 'Prohibits profane, sexually explicit, and abusive text words across chat messages and captions.',
    keywords: ['sex', 'porn', 'xxx', 'child nudity', 'nudity', 'nsfw', 'hentai', 'dick', 'pussy', 'vagina', 'penis', 'boobs', 'pedophil', 'rape', 'incest'],
    enabled: true,
    autoWarn: true,
    defaultAction: 'temporary_ban',
    tempSuspensionMinutes: 60, // 1 hour
    checkMedia: true,
    warningTemplate: '⚠️ [Official Security Warning: Policy Violation Detected]\n\nDear {userName},\n\nYour message contained prohibited abusive or explicit language ("{term}").\n\nA 1-hour temporary suspension and official violation strike have been applied to your account.\n\nPlease keep communication respectful and appropriate.',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'rule_adult_media',
    name: 'Pornographic & Adult Media Protection',
    description: 'Screens media attachments, video/photo captions, and filenames for adult, pornographic, or sexually explicit content.',
    keywords: ['porn', 'xxx', 'sex', 'nude', 'naked', 'nsfw', 'erotic', 'boobs', 'adult', '18+', 'hardcore', 'onlyfans'],
    enabled: true,
    autoWarn: true,
    defaultAction: 'temporary_ban',
    tempSuspensionMinutes: 1440, // 24 hours
    checkMedia: true,
    warningTemplate: '🚫 [Critical Security Alert: Adult / Pornographic Content]\n\nDear {userName},\n\nYou attempted to transmit adult or pornographic media ("{term}").\n\nSharing explicit pornographic material violates LimoChat safety guidelines and telecommunications regulations. A 24-hour suspension has been placed on your account.',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'rule_child_safety',
    name: 'Child Safety & Protection (Zero Tolerance)',
    description: 'Strict zero-tolerance policy against any form of child sexual abuse material (CSAM), minor nudity, or child exploitation.',
    keywords: ['child nudity', 'child sex', 'child porn', 'csam', 'underage sex', 'minor nude', 'pedophil', 'pedo'],
    enabled: true,
    autoWarn: true,
    defaultAction: 'permanent_ban',
    checkMedia: true,
    warningTemplate: '🛑 [CRITICAL NOTICE: ZERO TOLERANCE SAFETY BREACH]\n\nDear {userName},\n\nYour account has triggered a critical child safety policy violation ("{term}").\n\nYour account and +991 virtual number have been permanently terminated immediately. This breach has been recorded in the compliance audit registry.',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
];

const LOCAL_STORAGE_RULES_KEY = 'limochat_policy_rules_v3';
const LOCAL_STORAGE_MODERATION_SETTINGS_KEY = 'limochat_moderation_settings_v3';
const PRIMARY_ADMIN_EMAIL = 'saeed.samadelivery@gmail.com'.toLowerCase();

/**
 * Check if a user is an administrator (Admins CANNOT be banned or restricted)
 */
export const isUserAdmin = (user: UserProfile | null, adminEmails: string[] = []): boolean => {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const email = (user.email || '').toLowerCase().trim();
  if (email && email === PRIMARY_ADMIN_EMAIL) return true;
  if (email && adminEmails.map((e) => e.toLowerCase().trim()).includes(email)) return true;

  // Also check cached admin emails from localStorage
  try {
    const cached = localStorage.getItem('limochat_admin_emails');
    if (cached) {
      const parsed: string[] = JSON.parse(cached);
      if (Array.isArray(parsed) && email && parsed.map((e) => e.toLowerCase().trim()).includes(email)) {
        return true;
      }
    }
  } catch {}

  // Also check if current Firebase Auth user is the primary admin
  try {
    const currentAuthEmail = (auth.currentUser?.email || '').toLowerCase().trim();
    if (currentAuthEmail === PRIMARY_ADMIN_EMAIL && (user.uid === auth.currentUser?.uid || !user.uid)) {
      return true;
    }
  } catch {}

  return false;
};

/**
 * Fetch Moderation Settings from Firestore or fallback to localStorage
 */
export const getModerationSettings = async (): Promise<PolicyModerationSettings> => {
  try {
    const docRef = doc(db, 'system_config', 'moderation_settings');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as PolicyModerationSettings;
      localStorage.setItem(LOCAL_STORAGE_MODERATION_SETTINGS_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn("Could not fetch moderation settings from Firestore:", err);
  }

  // Fallback to Supabase
  try {
    const remote = await RealtimeCoordinator.fetchSystemConfig('moderation_settings');
    if (remote) {
      localStorage.setItem(LOCAL_STORAGE_MODERATION_SETTINGS_KEY, JSON.stringify(remote));
      return remote as PolicyModerationSettings;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_MODERATION_SETTINGS_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  return DEFAULT_MODERATION_SETTINGS;
};

/**
 * Save Moderation Settings to Firestore, Supabase and localStorage
 */
export const saveModerationSettings = async (
  settings: PolicyModerationSettings,
  adminEmail?: string
): Promise<void> => {
  try {
    const payload = {
      ...settings,
      updatedAt: Date.now(),
      updatedBy: adminEmail || 'admin',
    };
    localStorage.setItem(LOCAL_STORAGE_MODERATION_SETTINGS_KEY, JSON.stringify(payload));
    const docRef = doc(db, 'system_config', 'moderation_settings');
    await setDoc(docRef, payload, { merge: true }).catch(() => {});
    await RealtimeCoordinator.saveSystemConfig('moderation_settings', payload).catch(() => {});
  } catch (err) {
    console.warn("Could not save moderation settings:", err);
  }
};

/**
 * Fetch all policy rules from Firestore or fallback to Supabase / localStorage / defaults
 */
export const getPolicyRules = async (): Promise<PolicyRule[]> => {
  try {
    const docRef = doc(db, 'system_config', 'policy_rules');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.rules) {
      const rules = snap.data().rules as PolicyRule[];
      localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(rules));
      return rules;
    }
  } catch (err) {
    console.warn("Could not fetch remote policy rules from Firestore:", err);
  }

  // Fallback to Supabase
  try {
    const remote = await RealtimeCoordinator.fetchSystemConfig('policy_rules');
    if (remote?.rules) {
      localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(remote.rules));
      return remote.rules as PolicyRule[];
    }
  } catch {}

  // Fallback to local storage
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_RULES_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  // Fallback to defaults
  return DEFAULT_POLICY_RULES;
};

/**
 * Save policy rules to Firestore, Supabase and local cache
 */
export const savePolicyRules = async (rules: PolicyRule[]): Promise<void> => {
  try {
    const payload = { rules, updatedAt: Date.now() };
    localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(rules));
    const docRef = doc(db, 'system_config', 'policy_rules');
    await setDoc(docRef, payload, { merge: true }).catch(() => {});
    await RealtimeCoordinator.saveSystemConfig('policy_rules', payload).catch(() => {});
  } catch (err) {
    console.warn("Error saving policy rules:", err);
  }
};

/**
 * Real-time subscription to Moderation Settings across devices
 */
export const subscribeToModerationSettings = (
  callback: (settings: PolicyModerationSettings) => void
): (() => void) => {
  const docRef = doc(db, 'system_config', 'moderation_settings');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as PolicyModerationSettings;
      localStorage.setItem(LOCAL_STORAGE_MODERATION_SETTINGS_KEY, JSON.stringify(data));
      callback(data);
    }
  }, (err) => {
    console.warn("Moderation settings subscription notice:", err);
  });
};

/**
 * Real-time subscription to Policy Rules across devices
 */
export const subscribeToPolicyRules = (
  callback: (rules: PolicyRule[]) => void
): (() => void) => {
  const docRef = doc(db, 'system_config', 'policy_rules');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists() && snap.data()?.rules) {
      const rules = snap.data().rules as PolicyRule[];
      localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(rules));
      callback(rules);
    }
  }, (err) => {
    console.warn("Policy rules subscription notice:", err);
  });
};

/**
 * Masks prohibited words while keeping only the last character:
 * Examples:
 *   "sex"  -> "**x"
 *   "porn" -> "***n"
 *   "nudity" -> "*****y"
 */
export const maskProhibitedWord = (word: string): string => {
  if (!word) return '';
  if (word.length <= 1) return '*';
  const lastChar = word.slice(-1);
  return '*'.repeat(word.length - 1) + lastChar;
};

/**
 * Inspects and masks prohibited content inside a sentence/caption:
 * Replaces words like "sex" with "**x", "porn" with "***n".
 * Returns masked text and detected terms.
 */
export const maskProhibitedContent = (
  text: string,
  rules: PolicyRule[] = DEFAULT_POLICY_RULES
): {
  maskedText: string;
  detectedTerms: string[];
  hasViolation: boolean;
  matchedRule: PolicyRule | null;
} => {
  if (!text) return { maskedText: '', detectedTerms: [], hasViolation: false, matchedRule: null };

  let currentText = text;
  const detectedTerms: string[] = [];
  let firstMatchedRule: PolicyRule | null = null;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    for (const rawKw of rule.keywords) {
      const kw = rawKw.toLowerCase().trim();
      if (!kw) continue;

      if (kw.includes(' ')) {
        // Multi-word phrase with boundary
        const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'gi');
        if (regex.test(currentText)) {
          detectedTerms.push(rawKw);
          if (!firstMatchedRule) firstMatchedRule = rule;
          const maskedPhrase = kw
            .split(/\s+/)
            .map((w) => maskProhibitedWord(w))
            .join(' ');
          currentText = currentText.replace(regex, maskedPhrase);
        }
      } else {
        // Single word with strict word boundary
        const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'gi');
        if (regex.test(currentText)) {
          detectedTerms.push(rawKw);
          if (!firstMatchedRule) firstMatchedRule = rule;
          currentText = currentText.replace(regex, (match) => maskProhibitedWord(match));
        }
      }
    }
  }

  return {
    maskedText: currentText,
    detectedTerms: Array.from(new Set(detectedTerms)),
    hasViolation: detectedTerms.length > 0,
    matchedRule: firstMatchedRule,
  };
};

/**
 * Sanitize filename or caption text:
 * Never screen base64 data URLs, blob URLs, or web URLs for words,
 * as binary encoding and cryptographic download tokens randomly produce substrings like "sex", "xxx", etc.
 */
export const sanitizeFileNameOrCaption = (input?: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  // Never screen data URLs or blob URLs or raw web URLs
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return '';
  }

  // If filename looks like a raw hash / uuid / timestamp (e.g. 1729447382910_a8f3b2c1.png)
  const nameWithoutExt = trimmed.replace(/\.[^/.]+$/, '');
  if (/^[a-zA-Z0-9_-]{18,}$/.test(nameWithoutExt)) {
    return '';
  }

  return trimmed;
};

/**
 * Inspect text or media attachments against policy rules
 * NOTE: Admins CANNOT be banned or flagged!
 */
export const checkContentViolation = (
  text: string,
  mediaNameOrUrl?: string,
  rules: PolicyRule[] = DEFAULT_POLICY_RULES,
  user?: UserProfile | null,
  adminEmails: string[] = []
): PolicyCheckResult | null => {
  // If user is administrator, bypass all moderation restrictions immediately
  if (user && isUserAdmin(user, adminEmails)) {
    return null;
  }

  const cleanMediaName = sanitizeFileNameOrCaption(mediaNameOrUrl);
  const combinedText = `${text || ''} ${cleanMediaName}`.toLowerCase().trim();
  if (!combinedText) return null;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    for (const rawKw of rule.keywords) {
      const kw = rawKw.toLowerCase().trim();
      if (!kw) continue;

      let matched = false;
      if (kw.includes(' ')) {
        // Multi-word phrase matching
        matched = combinedText.includes(kw);
      } else {
        // Strict word boundary matching (avoids false positives in innocent words or paths)
        const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
        matched = regex.test(combinedText);
      }

      if (matched) {
        let actionDescription = 'Warning issued via Support Desk';
        if (rule.defaultAction === 'temporary_ban') {
          const mins = rule.tempSuspensionMinutes || 60;
          actionDescription = `Temporary Suspension (${mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`}) + Official Warning`;
        } else if (rule.defaultAction === 'permanent_ban') {
          actionDescription = 'Permanent Account Suspension (Zero Tolerance)';
        } else if (rule.defaultAction === 'restrict_messaging') {
          actionDescription = 'Restriction on sending messages + Warning';
        }

        return {
          violated: true,
          rule,
          matchedTerm: rawKw,
          actionDescription,
        };
      }
    }
  }

  return null;
};

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Highlight prohibited terms inside text snippet for admin inspection
 */
export const highlightBannedWord = (text: string, term: string) => {
  if (!text || !term) return text;
  const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
  return text.replace(regex, `<mark class="bg-red-500/30 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-red-500/40">$1</mark>`);
};

/**
 * Handle violation according to active Moderation Setting (Approval Required vs Instant Auto-Ban)
 */
export const handleViolationIncident = async (
  violation: PolicyCheckResult,
  user: UserProfile,
  snippet: string,
  chatId?: string,
  maskedSnippet?: string
): Promise<{
  blocked: boolean;
  requiresApproval: boolean;
  actionMessage: string;
  maskedText: string;
}> => {
  // Administrators are immune to moderation actions and restrictions
  if (isUserAdmin(user)) {
    return { blocked: false, requiresApproval: false, actionMessage: '', maskedText: snippet };
  }

  const moderationSettings = await getModerationSettings();

  if (!moderationSettings.enabled || moderationSettings.mode === 'disabled') {
    return { blocked: false, requiresApproval: false, actionMessage: '', maskedText: snippet };
  }

  const now = Date.now();
  const incidentId = `inc_${now}_${Math.random().toString(36).slice(2, 6)}`;

  // Save Incident to Firestore `policy_incidents`
  const incident: PolicyIncident = {
    id: incidentId,
    userId: user.uid,
    userName: user.displayName || 'User',
    userPhone: user.phoneNumber || '',
    userEmail: user.email || '',
    userPhoto: user.photoURL || '',
    chatId: chatId || '',
    messageText: snippet,
    matchedTerm: violation.matchedTerm,
    ruleId: violation.rule.id,
    ruleName: violation.rule.name,
    suggestedAction: violation.rule.defaultAction || 'warn',
    tempSuspensionMinutes: violation.rule.tempSuspensionMinutes,
    status: moderationSettings.mode === 'instant_autoban' ? 'approved' : 'pending_review',
    timestamp: now,
  };

  try {
    await setDoc(doc(db, 'policy_incidents', incidentId), incident);
    await RealtimeCoordinator.savePolicyIncident(incident).catch(() => {});
  } catch (err) {
    console.warn("Could not save incident to Firestore:", err);
  }

  if (moderationSettings.mode === 'approval_required') {
    // MASKED MODE: Do NOT block the user and do NOT show an alert popup!
    // The user's message is delivered with masked terms (e.g. ***n, **x) and admin is alerted in Admin Portal.
    return {
      blocked: false,
      requiresApproval: true,
      actionMessage: '',
      maskedText: maskedSnippet || snippet,
    };
  }

  // Mode is 'instant_autoban': Immediately enforce punishment!
  await executePolicyEnforcement(violation, user, snippet);
  return {
    blocked: true,
    requiresApproval: false,
    actionMessage: `🚫 Message Blocked by Safety Policy!\n\nPolicy: ${violation.rule.name}\nMatched Prohibited Content: "${violation.matchedTerm}"\nEnforced Action: ${violation.actionDescription}\n\nAn official security warning has been dispatched via LimoChat Support.`,
    maskedText: maskedSnippet || snippet,
  };
};

/**
 * Auto-apply the configured punishments to the breaching user
 * (Administrators CANNOT be banned or sanctioned)
 */
export const executePolicyEnforcement = async (
  violation: PolicyCheckResult,
  user: UserProfile,
  snippet: string
): Promise<{ punishment: UserPunishment | null; warningMessage: string }> => {
  // If user is admin, reject banning
  if (isUserAdmin(user)) {
    return { punishment: null, warningMessage: '' };
  }

  const { rule, matchedTerm, actionDescription } = violation;
  const now = Date.now();

  let punishment: UserPunishment | null = null;

  if (rule.defaultAction === 'temporary_ban') {
    const durationMs = (rule.tempSuspensionMinutes || 60) * 60 * 1000;
    punishment = {
      isSuspended: true,
      suspensionType: 'temporary',
      suspendedUntil: now + durationMs,
      reason: `Automated policy violation: ${rule.name} (Matched prohibited term: "${matchedTerm}")`,
      appliedAt: now,
      appliedBy: 'LimoChat Automated Safety Engine',
      restrictions: {
        disableSendingMessages: true,
        disableAddingContacts: true,
        disableCalls: true,
      },
    };
  } else if (rule.defaultAction === 'permanent_ban') {
    punishment = {
      isSuspended: true,
      suspensionType: 'permanent',
      reason: `Zero tolerance violation: ${rule.name} (Prohibited term: "${matchedTerm}")`,
      appliedAt: now,
      appliedBy: 'LimoChat Automated Safety Engine',
      restrictions: {
        disableSendingMessages: true,
        disableAddingContacts: true,
        disableCalls: true,
      },
    };
  } else if (rule.defaultAction === 'restrict_messaging') {
    punishment = {
      isSuspended: false,
      reason: `Policy violation: ${rule.name} (Matched: "${matchedTerm}")`,
      appliedAt: now,
      appliedBy: 'LimoChat Automated Safety Engine',
      restrictions: {
        disableSendingMessages: true,
      },
    };
  }

  // Construct warning text from template
  const warningTemplate = rule.warningTemplate || DEFAULT_POLICY_RULES[0].warningTemplate!;
  const warningMessage = warningTemplate
    .replace('{userName}', user.displayName || 'User')
    .replace('{term}', matchedTerm);

  // 1. Update user profile in Firestore
  try {
    const userRef = doc(db, 'users', user.uid);
    const updatePayload: any = {
      violationsCount: increment(1),
    };
    if (punishment) {
      updatePayload.punishment = punishment;
      updatePayload.isBanned = punishment.isSuspended;
    }
    await updateDoc(userRef, updatePayload);
  } catch (err) {
    console.warn("Could not update user punishment in Firestore:", err);
  }

  // 2. Dispatch warning message into Support Chat (support_{uid})
  try {
    const supportChatId = `support_${user.uid}`;
    const msgId = `msg_warn_${now}`;
    const supportMsgDoc = doc(db, 'chats', supportChatId, 'messages', msgId);
    
    await setDoc(supportMsgDoc, {
      id: msgId,
      chatId: supportChatId,
      senderId: 'limochat_official_support',
      senderName: 'LimoChat Support',
      senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=LimoSupport',
      text: warningMessage,
      type: 'text',
      status: 'delivered',
      timestamp: now,
      isDeletedForEveryone: false,
      deletedForUsers: [],
    }, { merge: true });

    // Update support chat metadata
    const chatDoc = doc(db, 'chats', supportChatId);
    await setDoc(chatDoc, {
      id: supportChatId,
      type: 'direct',
      name: 'LimoChat Support',
      participants: [user.uid, 'limochat_official_support'],
      updatedAt: now,
      [`unreadCount.${user.uid}`]: increment(1),
      lastMessage: {
        text: '⚠️ Policy Violation Notice Dispatched',
        senderId: 'limochat_official_support',
        timestamp: now,
        type: 'text',
        status: 'delivered',
      },
    }, { merge: true });
  } catch (err) {
    console.warn("Could not dispatch support warning message:", err);
  }

  // 3. Log audit event in Firestore `violation_logs`
  try {
    await addDoc(collection(db, 'violation_logs'), {
      userId: user.uid,
      userName: user.displayName || 'Unknown',
      userPhone: user.phoneNumber || '',
      ruleId: rule.id,
      ruleName: rule.name,
      matchedTerm,
      snippet: snippet.slice(0, 150),
      actionTaken: actionDescription,
      timestamp: now,
    });
  } catch (err) {
    console.warn("Could not record audit log in Firestore:", err);
  }

  return { punishment, warningMessage };
};

/**
 * Fetch pending policy incidents requiring admin approval
 */
export const getPendingPolicyIncidents = async (): Promise<PolicyIncident[]> => {
  try {
    const q = query(
      collection(db, 'policy_incidents'),
      where('status', '==', 'pending_review'),
      limit(50)
    );
    const snap = await getDocs(q);
    const list: PolicyIncident[] = [];
    snap.forEach((d) => {
      list.push({ ...d.data(), id: d.id } as PolicyIncident);
    });
    
    // Also fetch from Supabase and merge
    try {
      const supaIncidents = await RealtimeCoordinator.fetchPendingIncidents();
      supaIncidents.forEach((si: any) => {
        if (!list.find((item) => item.id === si.id)) {
          list.push(si as PolicyIncident);
        }
      });
    } catch {}

    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  } catch (err) {
    console.warn("Could not fetch pending policy incidents from Firestore, checking Supabase:", err);
    try {
      const supaIncidents = await RealtimeCoordinator.fetchPendingIncidents();
      return supaIncidents as PolicyIncident[];
    } catch {
      return [];
    }
  }
};

/**
 * Admin Action: Approve Policy Incident and enforce punishment
 * Enforces strictly the selected action chosen by the administrator.
 */
export const approvePolicyIncident = async (
  incident: PolicyIncident,
  adminEmail: string,
  chosenAction?: PolicyRuleAction,
  chosenMinutes?: number
): Promise<void> => {
  const action: PolicyRuleAction = chosenAction || incident.suggestedAction || 'temporary_ban';
  const minutes = chosenMinutes !== undefined ? chosenMinutes : (incident.tempSuspensionMinutes || 60);
  const now = Date.now();
  let punishment: UserPunishment | null = null;
  let noticeAction = '';

  if (action === 'temporary_ban') {
    const durationMs = minutes * 60 * 1000;
    punishment = {
      isSuspended: true,
      suspensionType: 'temporary',
      suspendedUntil: now + durationMs,
      reason: `Violation approved by Admin: ${incident.ruleName} (Matched: "${incident.matchedTerm}")`,
      appliedAt: now,
      appliedBy: adminEmail,
      restrictions: {
        disableSendingMessages: true,
        disableAddingContacts: true,
        disableCalls: true,
      },
    };
    noticeAction = `Temporary Account Suspension (${minutes >= 60 ? `${Math.round(minutes / 60)} hour(s)` : `${minutes} minute(s)`})`;
  } else if (action === 'permanent_ban') {
    punishment = {
      isSuspended: true,
      suspensionType: 'permanent',
      reason: `Permanent suspension approved by Admin: ${incident.ruleName} (Matched: "${incident.matchedTerm}")`,
      appliedAt: now,
      appliedBy: adminEmail,
      restrictions: {
        disableSendingMessages: true,
        disableAddingContacts: true,
        disableCalls: true,
      },
    };
    noticeAction = 'Permanent Account Suspension & Virtual Number Deactivation';
  } else if (action === 'restrict_messaging') {
    const durationMs = minutes > 0 ? minutes * 60 * 1000 : 0;
    punishment = {
      isSuspended: false,
      reason: `Messaging restriction approved by Admin: ${incident.ruleName} (Matched: "${incident.matchedTerm}")`,
      appliedAt: now,
      appliedBy: adminEmail,
      suspendedUntil: durationMs > 0 ? now + durationMs : undefined,
      restrictions: {
        disableSendingMessages: true,
      },
    };
    noticeAction = `Restriction on Sending Messages (${minutes > 0 ? `${minutes}m` : 'Indefinite'})`;
  } else if (action === 'warn') {
    noticeAction = 'Official Security & Community Standards Warning';
  }

  // 1. Update user profile with punishment
  try {
    const userRef = doc(db, 'users', incident.userId);
    const userSnap = await getDoc(userRef).catch(() => null);
    const userData = userSnap?.data() as UserProfile | undefined;
    if (isUserAdmin(userData || null)) {
      console.warn("Target user is an administrator and cannot be punished.");
      return;
    }

    const updatePayload: any = {
      violationsCount: increment(1),
    };
    if (punishment) {
      updatePayload.punishment = punishment;
      updatePayload.isBanned = punishment.isSuspended;
    } else if (action === 'warn') {
      updatePayload.policyWarnings = arrayUnion({
        id: `warn_${now}`,
        reason: `Official Warning: ${incident.ruleName} ("${incident.matchedTerm}")`,
        ruleId: incident.ruleId,
        timestamp: now,
        appliedBy: adminEmail,
      });
    }
    await updateDoc(userRef, updatePayload);
    // Dual-Database: Update Supabase user admin state
    await RealtimeCoordinator.updateUserAdmin(incident.userId, {
      punishment: punishment || null,
      isBanned: punishment ? punishment.isSuspended : false,
    }).catch(() => {});
  } catch (err) {
    console.warn("Could not update user profile on approval:", err);
  }

  // 2. Dispatch warning to user via support chat
  try {
    const supportChatId = `support_${incident.userId}`;
    const msgId = `msg_warn_${now}`;
    const noticeText = `⚠️ [Official Administrative Notice: Policy Sanction Enforced]\n\nDear ${incident.userName},\n\nAn administrative review has confirmed a policy violation regarding prohibited content:\n• Policy: ${incident.ruleName}\n• Matched Content: "${incident.matchedTerm}"\n• Action Enforced: ${noticeAction}\n\nEnforced by Compliance Desk (${adminEmail}).\nIf you believe this sanction was made in error, reply directly in this support chat to appeal.`;

    await setDoc(doc(db, 'chats', supportChatId, 'messages', msgId), {
      id: msgId,
      chatId: supportChatId,
      senderId: 'limochat_official_support',
      senderName: 'LimoChat Support Desk',
      senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=LimoSupport',
      text: noticeText,
      type: 'text',
      status: 'delivered',
      timestamp: now,
      isDeletedForEveryone: false,
      deletedForUsers: [],
    }, { merge: true });

    await setDoc(doc(db, 'chats', supportChatId), {
      id: supportChatId,
      type: 'direct',
      name: 'LimoChat Support',
      participants: [incident.userId, 'limochat_official_support'],
      [`unreadCount.${incident.userId}`]: increment(1),
      lastMessage: {
        text: noticeText,
        senderId: 'limochat_official_support',
        timestamp: now,
        status: 'delivered',
      },
      updatedAt: now,
    }, { merge: true });
  } catch (err) {
    console.warn("Could not send support notice:", err);
  }

  // 3. Mark incident as approved
  try {
    await updateDoc(doc(db, 'policy_incidents', incident.id), {
      status: 'approved',
      actionTaken: action,
      actionMinutes: minutes,
      reviewedBy: adminEmail,
      reviewedAt: now,
    });
    // Dual-Database: Update status in Supabase
    await RealtimeCoordinator.updateIncidentStatus(incident.id, 'approved').catch(() => {});
  } catch {}

  // 4. Record in violation logs
  try {
    await addDoc(collection(db, 'violation_logs'), {
      userId: incident.userId,
      userName: incident.userName,
      userPhone: incident.userPhone,
      ruleId: incident.ruleId,
      ruleName: incident.ruleName,
      matchedTerm: incident.matchedTerm,
      snippet: incident.messageText.slice(0, 150),
      actionTaken: `${noticeAction} (Enforced by ${adminEmail})`,
      timestamp: now,
    });
  } catch {}
};

/**
 * Admin Action: Dismiss Policy Incident (False Positive)
 */
export const dismissPolicyIncident = async (
  incidentId: string,
  adminEmail: string
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'policy_incidents', incidentId), {
      status: 'dismissed',
      reviewedBy: adminEmail,
      reviewedAt: Date.now(),
    });
    // Dual-Database: Update status in Supabase
    await RealtimeCoordinator.updateIncidentStatus(incidentId, 'dismissed').catch(() => {});
  } catch (err) {
    console.warn("Could not dismiss policy incident:", err);
  }
};

/**
 * Fetch violation audit logs for Admin Portal
 */
export const getViolationAuditLogs = async (maxCount = 50): Promise<ViolationAuditLog[]> => {
  try {
    const q = query(collection(db, 'violation_logs'), orderBy('timestamp', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    const logs: ViolationAuditLog[] = [];
    snap.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as ViolationAuditLog);
    });
    return logs;
  } catch (err) {
    console.warn("Could not fetch remote violation logs:", err);
    return [];
  }
};
