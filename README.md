# 💬 LimoChat — WhatsApp-Grade Chat, Calling & Communities

**LimoChat** is a production-grade, privacy-first web & mobile messaging application built with React 19, TypeScript, Tailwind CSS, Google Firebase, and WebRTC.

---

## 🌟 Key Features

### 🔐 1. Google Authentication & Virtual +991 Numbers
- **One-Click Google Sign-In**: Powered by Firebase Auth with Google provider.
- **Auto-Assigned Private Virtual Number**: Every new account is automatically provisioned a unique temporary virtual phone number starting with the **`+991`** prefix (e.g., `+991 742 8901`).
- **Zero SIM Exposure**: Users never reveal their personal mobile phone number or SIM card.
- **Contact Discovery**: Search and add contacts by display name or their `+991` virtual number.
- **Interactive QR Code Card**: Share contact info with one click via QR code or clipboard.

---

### 💬 2. Real-Time Chat & WhatsApp Capabilities
- **One-on-One Chats**: Instant messaging backed by Google Cloud Firestore real-time snapshots (`onSnapshot`).
- **Drag-to-Reply / Swipe-to-Reply**: Touch swipe on mobile or intuitive mouse drag on desktop to quote any message with live preview banner.
- **Message Delivery Pipeline**:
  - `✓` Single gray tick: Sent
  - `✓✓` Double gray ticks: Delivered to Firestore
  - `✓✓` Double blue ticks: Read by recipient
- **Delete for Everyone & Delete for Me**:
  - *Delete for Everyone*: Permanently erases message content across all devices and marks with a tombstone placeholder.
  - *Delete for Me*: Hides message specifically for the requesting user.
- **Voice Notes**:
  - In-app voice recorder using `MediaRecorder` API with live duration timer and waveform animation.
  - Interactive playback bar with progress tracker and audio scrubbing.
- **Media & Document Sharing**: Send photos, videos, and document attachments with download capabilities.
- **Star Messages**: Star important messages for quick reference.
- **Typing Indicators**: Real-time "typing..." notification when the other party is composing.

---

### 📞 3. HD Peer-to-Peer & Group Audio/Video Calling
- **WebRTC Engine**: STUN-backed WebRTC signaling for audio and video calls.
- **1-on-1 and Group Calls**: Call direct contacts or whole groups with audio or HD video.
- **In-Browser Audio Synthesizer**: Web Audio API polyphonic sound engine:
  - Melodic WhatsApp incoming call ringtone
  - Classical outgoing dial tone
  - Crisp message sent/received sounds
- **Active Call Controls**:
  - Microphone mute/unmute
  - Camera toggle on/off
  - Screen sharing (Share window/screen)
  - Call duration counter
  - Picture-in-picture local camera feed and multi-stream remote grid

---

### 👥 4. WhatsApp-Style Communities & Groups
- **Group Chats**: Create groups, assign admins, add/remove members, customize avatars and subjects.
- **Communities**: Parent community container that groups multiple sub-channels and includes an Announcements broadcast channel.

---

### ⚙️ 5. Settings & Granular Privacy
- **Privacy Controls**:
  - *Last Seen & Online Status*: Toggle between **Everyone** and **Nobody**.
  - *Profile Photo Visibility*: Toggle between **Everyone** and **Nobody**.
  - *Read Receipts*: Toggle double blue checkmarks on/off.
  - *Blocked Contacts*: View blocked user list with 1-click unblock.
- **Chat Customization**:
  - WhatsApp Themes (Dark, Light, Classic)
  - Chat Wallpapers: WhatsApp Doodle, Dark Slate, Emerald, Navy, Light Doodle
- **Profile Management**:
  - Edit display name & about bio
  - Choose from avatar presets or custom photo
  - View & copy virtual `+991` phone number

---

### 📄 6. Legal & Operational Pages
Directly accessible from both the **Login/Signup Screen** and the **Settings Drawer**:
1. **Privacy Policy**: Details end-to-end encryption, +991 virtual numbers, and zero phone tracking.
2. **Terms and Conditions**: Acceptable use, group etiquette, and community moderation policies.
3. **Operational & System Status**: Live ping diagnostics, 99.98% uptime telemetry, and incident history.
4. **What's New in v2.4.0**: Changelog highlighting group calls, communities, drag-to-reply, and privacy features.

---

## 🛠️ Project Structure

```
limochat/
├── firestore.rules               # Production Firestore security rules
├── storage.rules                 # Production Firebase Storage security rules
├── firebase.json                 # Firebase configuration
├── src/
│   ├── firebase/
│   │   └── config.ts             # Firebase SDK setup (Auth, Firestore, Storage)
│   ├── types/
│   │   └── index.ts              # Full TypeScript models (User, Chat, Message, Call)
│   ├── context/
│   │   ├── AuthContext.tsx       # Auth state, Google sign-in & +991 generation
│   │   ├── ChatContext.tsx       # Real-time messages, drag-to-reply, groups & communities
│   │   └── CallContext.tsx       # WebRTC calling engine & signaling
│   ├── utils/
│   │   ├── sound.ts              # Web Audio API ringtone & sound effects synthesizer
│   │   ├── formatters.ts         # Last seen, time, virtual phone formatters
│   │   └── webrtc.ts             # WebRTC media and STUN configuration
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginModal.tsx    # Google login + email auth + legal & status triggers
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx    # Main chat view
│   │   │   ├── ChatHeader.tsx    # Header with online status, last seen & call buttons
│   │   │   ├── MessageList.tsx   # Message stream with date separators
│   │   │   ├── MessageBubble.tsx # Bubble with drag-to-reply, ticks & delete for all
│   │   │   ├── MessageInput.tsx  # Input with emoji picker, voice recorder & attach menu
│   │   │   ├── ChatInfoDrawer.tsx# Group / contact details panel
│   │   │   └── VoiceRecorder.tsx # Web voice recorder with timer
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx       # Main navigation, tabs & +991 footer
│   │   │   ├── ChatListItem.tsx  # Contact item with unread badge & ticks
│   │   │   ├── NewChatModal.tsx  # Search users by name or +991 virtual number
│   │   │   ├── NewGroupModal.tsx # Group creation modal
│   │   │   └── CommunityList.tsx # WhatsApp-like Communities view
│   │   ├── calls/
│   │   │   ├── IncomingCallModal.tsx # Ringing modal with Answer/Decline
│   │   │   └── ActiveCallModal.tsx   # Active video/audio call screen with screen share
│   │   ├── settings/
│   │   │   ├── SettingsDrawer.tsx # Main settings view
│   │   │   ├── ProfileModal.tsx   # Profile editor & QR code trigger
│   │   │   └── PrivacyModal.tsx   # Last seen, read receipts & blocked users
│   │   ├── pages/
│   │   │   ├── PrivacyPolicyModal.tsx    # Privacy policy page
│   │   │   ├── TermsConditionsModal.tsx  # Terms & conditions page
│   │   │   ├── OperationalStatusModal.tsx# Live operational telemetry page
│   │   │   └── WhatsNewModal.tsx         # Release notes page
│   │   └── common/
│   │       ├── Avatar.tsx        # Avatar with online badge
│   │       └── QRCodeModal.tsx   # Shareable contact QR code
│   ├── App.tsx                   # Main layout (Responsive desktop & mobile view)
│   └── index.css                 # WhatsApp theme, doodle backgrounds & animations
```

---

## 🚀 Getting Started

### 1. Install dependencies:
```bash
npm install
```

### 2. Start the development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production:
```bash
npm run build
```
The optimized bundle is generated in the `dist/` directory ready for deployment.
