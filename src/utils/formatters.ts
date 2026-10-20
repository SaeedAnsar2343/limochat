// Utilities for formatting time, virtual numbers, and media

export function generateTemporaryNumber(): string {
  // Generates a WhatsApp-style temporary virtual phone number starting with +991
  // Format: +991 XXX XXXX
  const prefix = '+991';
  const group1 = Math.floor(200 + Math.random() * 800); // 3 digits (200-999)
  const group2 = Math.floor(1000 + Math.random() * 9000); // 4 digits (1000-9999)
  return `${prefix} ${group1} ${group2}`;
}

/**
 * Deterministically generates a lifetime permanent virtual +991 number from a user's unique ID.
 * This guarantees that even if caches or offline state occur, the user's phone number remains
 * identical for lifetime unless explicitly altered by an Administrator in the Admin Portal.
 */
export function generateDeterministicNumberForUid(uid: string): string {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 33) ^ uid.charCodeAt(i);
  }
  const absHash = Math.abs(hash);
  const group1 = 200 + (absHash % 800); // 200-999
  const group2 = 1000 + (Math.floor(absHash / 800) % 9000); // 1000-9999
  return `+991 ${group1} ${group2}`;
}

/**
 * Retrieves the persistent lifetime number for a user from local storage, or seeds it
 * deterministically and persists it indefinitely.
 */
export function getOrAssignLifetimeNumber(uid: string, existingNumber?: string): string {
  if (existingNumber && existingNumber.startsWith('+991')) {
    try {
      localStorage.setItem(`limochat_assigned_phone_${uid}`, existingNumber);
    } catch {}
    return existingNumber;
  }

  try {
    const cached = localStorage.getItem(`limochat_assigned_phone_${uid}`);
    if (cached && cached.startsWith('+991')) {
      return cached;
    }
  } catch {}

  const assigned = generateDeterministicNumberForUid(uid);
  try {
    localStorage.setItem(`limochat_assigned_phone_${uid}`, assigned);
  } catch {}
  return assigned;
}

export function formatTime(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatMessageDate(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (isYesterday) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatLastSeen(
  isOnline: boolean,
  lastSeenTimestamp: number | undefined,
  privacySetting: 'everyone' | 'contacts' | 'nobody' | undefined = 'everyone'
): string {
  if (privacySetting === 'nobody') {
    return '';
  }

  const isRecentlyActive = isOnline || (lastSeenTimestamp && (Date.now() - lastSeenTimestamp < 90000));

  if (isRecentlyActive) {
    return 'online';
  }

  if (!lastSeenTimestamp) {
    return 'offline';
  }

  const date = new Date(lastSeenTimestamp);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) {
    return 'last seen just now';
  }
  if (diffMinutes < 60) {
    return `last seen ${diffMinutes}m ago`;
  }

  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `last seen today at ${timeStr}`;
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `last seen yesterday at ${timeStr}`;
  }

  return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
