import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Type, 
  Check, 
  Send, 
  Video, 
  Camera, 
  Lock, 
  Upload, 
  AtSign, 
  Trash2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Palette,
  Layers,
  Sparkles,
  Scissors,
  RotateCcw,
  RefreshCw,
  Search,
  Film
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { StatusUpdate, StatusPrivacyMode, UserProfile } from '../../types';
import { Avatar } from '../common/Avatar';
import { RealtimeCoordinator } from '../../utils/realtimeCoordinator';
import { 
  getPolicyRules, 
  checkContentViolation, 
  handleViolationIncident, 
  maskProhibitedContent, 
  PolicyCheckResult 
} from '../../utils/policyEngine';

interface NewStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusCreated?: (status: StatusUpdate) => void;
  initialType?: 'text' | 'image' | 'video' | 'camera';
}

const BG_COLORS = [
  '#005c4b', // Classic WhatsApp Emerald
  '#128c7e', // Teal Green
  '#1e3a8a', // Deep Ocean Blue
  '#5b21b6', // Royal Violet
  '#991b1b', // Deep Crimson
  '#b45309', // Warm Amber
  '#0f766e', // Persian Teal
  '#831843', // Velvet Berry
  '#374151', // Charcoal Slate
  '#0b141a', // Pitch Obsidian
];

const FONT_STYLES = [
  { id: 'sans', name: 'Sans', family: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif', name: 'Serif', family: 'Georgia, Cambria, serif' },
  { id: 'mono', name: 'Monospace', family: 'ui-monospace, monospace' },
  { id: 'cursive', name: 'Casual', family: "'Caveat', 'Brush Script MT', cursive, sans-serif" },
  { id: 'bold', name: 'Impact', family: "'Impact', 'Arial Black', sans-serif" },
];

const MAX_STATUS_VIDEO_DURATION = 30; // WhatsApp strict 30s rule

interface VideoSegment {
  index: number;
  start: number;
  end: number;
  duration: number;
  label: string;
}

export const NewStatusModal: React.FC<NewStatusModalProps> = ({
  isOpen,
  onClose,
  onStatusCreated,
  initialType = 'text',
}) => {
  const { currentUser } = useAuth();
  const { getAllContacts } = useChat();

  // Mode: 'text' | 'image' | 'video' | 'camera'
  const [statusType, setStatusType] = useState<'text' | 'image' | 'video' | 'camera'>('text');
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0]);
  const [selectedFont, setSelectedFont] = useState(FONT_STYLES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Video trimming & segmentation state
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoSegments, setVideoSegments] = useState<VideoSegment[]>([]);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number>(0);
  const [postAllSegments, setPostAllSegments] = useState<boolean>(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);

  // Status Privacy
  const [privacy, setPrivacy] = useState<StatusPrivacyMode>('contacts');
  const [privacyUids, setPrivacyUids] = useState<string[]>([]);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [privacySearchQuery, setPrivacySearchQuery] = useState('');

  // Tag Contacts
  const [taggedContacts, setTaggedContacts] = useState<{ uid: string; displayName: string }[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  // Contacts directory
  const [contacts, setContacts] = useState<UserProfile[]>([]);

  // Camera capture & live recording
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialType) setStatusType(initialType);
      getAllContacts().then(setContacts);
    }
  }, [isOpen, initialType]);

  // Manage camera lifecycle
  useEffect(() => {
    if (statusType === 'camera' && isOpen) {
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [statusType, cameraFacing, isOpen]);

  // Clean up object URLs when closing
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  }, [isOpen]);

  const startCamera = async (facing: 'user' | 'environment' = 'user') => {
    try {
      setCameraError(null);
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setCameraError("Camera/Microphone permission denied or unavailable. You can upload media directly.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const flipCamera = () => {
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture instant photo from camera
  const capturePhoto = () => {
    if (!cameraVideoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideoRef.current.videoWidth || 1280;
    canvas.height = cameraVideoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if user facing for natural selfie look
    if (cameraFacing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(cameraVideoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    stopCamera();
    setMediaUrl(dataUrl);
    setStatusType('image');
  };

  // Video recording from camera (Hold to record up to 30s)
  const startVideoRecording = () => {
    if (!cameraStreamRef.current) return;
    try {
      recordedChunksRef.current = [];
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? { mimeType: 'video/webm;codecs=vp9' }
        : MediaRecorder.isTypeSupported('video/webm')
        ? { mimeType: 'video/webm' }
        : MediaRecorder.isTypeSupported('video/mp4')
        ? { mimeType: 'video/mp4' }
        : undefined;

      const recorder = new MediaRecorder(cameraStreamRef.current, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        stopCamera();
        handleVideoLoaded(url);
      };

      recorder.start(250);
      setIsRecordingVideo(true);
      setRecordingSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= MAX_STATUS_VIDEO_DURATION - 1) {
            stopVideoRecording();
            return MAX_STATUS_VIDEO_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Recording start error:", err);
    }
  };

  const stopVideoRecording = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingVideo(false);
  };

  // File upload handler (Photos & Videos)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name || '');
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const resultUrl = event.target.result as string;
        if (type === 'video') {
          handleVideoLoaded(resultUrl);
        } else {
          setMediaUrl(resultUrl);
          setStatusType('image');
        }
      }
    };
    reader.readAsDataURL(file);
    // Reset file input target
    e.target.value = '';
  };

  // Calculate 30-second segments for a video
  const calculateSegments = (duration: number): VideoSegment[] => {
    if (duration <= MAX_STATUS_VIDEO_DURATION) {
      return [
        {
          index: 0,
          start: 0,
          end: duration,
          duration,
          label: `Full (${formatTimeDisplay(0)} - ${formatTimeDisplay(duration)})`,
        },
      ];
    }

    const count = Math.ceil(duration / MAX_STATUS_VIDEO_DURATION);
    const segs: VideoSegment[] = [];
    for (let i = 0; i < count; i++) {
      const start = i * MAX_STATUS_VIDEO_DURATION;
      const end = Math.min((i + 1) * MAX_STATUS_VIDEO_DURATION, duration);
      segs.push({
        index: i,
        start,
        end,
        duration: end - start,
        label: `Part ${i + 1} (${formatTimeDisplay(start)} - ${formatTimeDisplay(end)})`,
      });
    }
    return segs;
  };

  const handleVideoLoaded = (url: string) => {
    setMediaUrl(url);
    setStatusType('video');
    setSelectedSegmentIndex(0);
    setIsVideoPlaying(false);

    // Measure video duration dynamically
    const tempVideo = document.createElement('video');
    tempVideo.src = url;
    tempVideo.preload = 'metadata';
    tempVideo.onloadedmetadata = () => {
      const dur = tempVideo.duration || 0;
      setVideoDuration(dur);
      const segs = calculateSegments(dur);
      setVideoSegments(segs);
    };
  };

  const formatTimeDisplay = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Video playback loop within the active segment bounds
  const currentActiveSegment = videoSegments[selectedSegmentIndex] || {
    index: 0,
    start: 0,
    end: Math.min(videoDuration || MAX_STATUS_VIDEO_DURATION, MAX_STATUS_VIDEO_DURATION),
    duration: Math.min(videoDuration || MAX_STATUS_VIDEO_DURATION, MAX_STATUS_VIDEO_DURATION),
  };

  const handleTimeUpdate = () => {
    if (!previewVideoRef.current) return;
    const time = previewVideoRef.current.currentTime;
    setVideoCurrentTime(time);

    // If reached end of active segment, loop back to start
    if (time >= currentActiveSegment.end) {
      previewVideoRef.current.currentTime = currentActiveSegment.start;
      previewVideoRef.current.play().catch(() => {});
    }
  };

  const toggleVideoPlay = () => {
    if (!previewVideoRef.current) return;
    if (previewVideoRef.current.paused) {
      // Ensure we start within current segment
      if (
        previewVideoRef.current.currentTime < currentActiveSegment.start ||
        previewVideoRef.current.currentTime >= currentActiveSegment.end
      ) {
        previewVideoRef.current.currentTime = currentActiveSegment.start;
      }
      previewVideoRef.current.play().catch(() => {});
      setIsVideoPlaying(true);
    } else {
      previewVideoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const selectSegment = (index: number) => {
    setSelectedSegmentIndex(index);
    const seg = videoSegments[index];
    if (seg && previewVideoRef.current) {
      previewVideoRef.current.currentTime = seg.start;
      previewVideoRef.current.play().catch(() => {});
      setIsVideoPlaying(true);
    }
  };

  // Privacy toggles
  const togglePrivacyUid = (uid: string) => {
    if (privacyUids.includes(uid)) {
      setPrivacyUids(privacyUids.filter((id) => id !== uid));
    } else {
      setPrivacyUids([...privacyUids, uid]);
    }
  };

  // Tag contact toggles
  const toggleTagUser = (user: UserProfile) => {
    if (taggedContacts.some((c) => c.uid === user.uid)) {
      setTaggedContacts(taggedContacts.filter((c) => c.uid !== user.uid));
    } else {
      setTaggedContacts([...taggedContacts, { uid: user.uid, displayName: user.displayName }]);
    }
  };

  // Cycle background color for text status
  const cycleBackgroundColor = () => {
    const currentIndex = BG_COLORS.indexOf(selectedBg);
    const nextIndex = (currentIndex + 1) % BG_COLORS.length;
    setSelectedBg(BG_COLORS[nextIndex]);
  };

  // Cycle font family for text status
  const cycleFontFamily = () => {
    const currentIndex = FONT_STYLES.findIndex((f) => f.id === selectedFont.id);
    const nextIndex = (currentIndex + 1) % FONT_STYLES.length;
    setSelectedFont(FONT_STYLES[nextIndex]);
  };

  // Final Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    if (statusType === 'text' && !text.trim()) return;
    if ((statusType === 'image' || statusType === 'video') && !mediaUrl.trim()) return;

    try {
      setIsSubmitting(true);

      // Automated Safety & Policy Check with Prohibited Word Masking (e.g. "sex" -> "**x")
      let finalStatusText = text;
      try {
        const rules = await getPolicyRules();
        const maskResult = maskProhibitedContent(text, rules);
        if (maskResult.hasViolation && maskResult.matchedRule) {
          finalStatusText = maskResult.maskedText;
          const violationResult: PolicyCheckResult = {
            violated: true,
            rule: maskResult.matchedRule,
            matchedTerm: maskResult.detectedTerms.join(', '),
            actionDescription: maskResult.matchedRule.defaultAction || 'warn',
          };
          await handleViolationIncident(
            violationResult, 
            currentUser, 
            text || fileName || 'Status update', 
            undefined, 
            maskResult.maskedText
          );
        }
      } catch (err) {
        console.warn("Status policy check notice:", err);
      }

      // If posting a video that exceeds 30s and user chose "post all parts"
      if (statusType === 'video' && videoSegments.length > 1 && postAllSegments) {
        const total = videoSegments.length;
        const now = Date.now();

        for (let i = 0; i < total; i++) {
          const seg = videoSegments[i];
          const partCaption = finalStatusText.trim()
            ? `${finalStatusText.trim()} (Part ${i + 1}/${total})`
            : total > 1
            ? `Part ${i + 1} of ${total}`
            : '';

          const statusData: Omit<StatusUpdate, 'id'> = {
            userId: currentUser.uid,
            userName: currentUser.displayName || 'User',
            userPhoto: currentUser.photoURL || '',
            userPhone: currentUser.phoneNumber || '',
            text: partCaption,
            mediaUrl: mediaUrl.trim(),
            mediaType: 'video',
            backgroundColor: '#0b141a',
            timestamp: now + i * 50, // Staggered by 50ms so they appear in sequence
            viewedBy: [currentUser.uid],
            privacy,
            privacyUids,
            taggedContacts,
            videoDuration: seg.duration,
            segmentIndex: i,
            totalSegments: total,
            segmentStart: seg.start,
            segmentEnd: seg.end,
            isMuted: isVideoMuted,
          };

          const docRef = await addDoc(collection(db, 'statuses'), statusData).catch(() => null);
          const createdItem: StatusUpdate = {
            id: docRef ? docRef.id : `status_${now}_${i}`,
            ...statusData,
          };

          // Save to Supabase PostgreSQL (Unlimited writes) & Broadcast live
          await RealtimeCoordinator.createStatus(createdItem);

          if (onStatusCreated) {
            onStatusCreated(createdItem);
          }
        }
      } else {
        // Single update (Text, Photo, or Single 30s Video Segment)
        const activeSeg = statusType === 'video' ? currentActiveSegment : null;
        const now = Date.now();

        const statusData: Omit<StatusUpdate, 'id'> = {
          userId: currentUser.uid,
          userName: currentUser.displayName || 'User',
          userPhoto: currentUser.photoURL || '',
          userPhone: currentUser.phoneNumber || '',
          text: finalStatusText.trim(),
          mediaUrl: statusType !== 'text' ? mediaUrl.trim() : '',
          mediaType: statusType === 'video' ? 'video' : statusType === 'image' ? 'image' : 'text',
          backgroundColor: statusType === 'text' ? selectedBg : '#0b141a',
          fontFamily: statusType === 'text' ? selectedFont.family : undefined,
          timestamp: now,
          viewedBy: [currentUser.uid],
          privacy,
          privacyUids,
          taggedContacts,
          videoDuration: activeSeg ? activeSeg.duration : undefined,
          segmentIndex: activeSeg ? activeSeg.index : 0,
          totalSegments: activeSeg ? (videoSegments.length > 1 ? videoSegments.length : 1) : 1,
          segmentStart: activeSeg ? activeSeg.start : undefined,
          segmentEnd: activeSeg ? activeSeg.end : undefined,
          isMuted: statusType === 'video' ? isVideoMuted : undefined,
        };

        const docRef = await addDoc(collection(db, 'statuses'), statusData).catch(() => null);
        const createdItem: StatusUpdate = {
          id: docRef ? docRef.id : `status_${now}`,
          ...statusData,
        };

        // Save to Supabase PostgreSQL (Unlimited writes) & Broadcast live
        await RealtimeCoordinator.createStatus(createdItem);

        if (onStatusCreated) {
          onStatusCreated(createdItem);
        }
      }

      // Reset and close
      stopCamera();
      setText('');
      setMediaUrl('');
      setFileName('');
      setVideoSegments([]);
      onClose();
    } catch (err: any) {
      alert("Error posting status update: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !currentUser) return null;

  const filteredPrivacyContacts = contacts.filter((c) =>
    (c.displayName || '').toLowerCase().includes(privacySearchQuery.toLowerCase())
  );

  const filteredTagContacts = contacts.filter((c) =>
    (c.displayName || '').toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none animate-fade-in p-0 sm:p-4">
      {/* WhatsApp Modal Frame: Full viewport on mobile, sleek rounded card on desktop */}
      <div className="relative w-full h-[100dvh] sm:h-[88vh] sm:max-h-[820px] sm:max-w-md bg-[#0b141a] sm:rounded-3xl overflow-hidden flex flex-col border-0 sm:border border-white/10 shadow-2xl">
        
        {/* ================= TOP WHATSAPP TOOLBAR ================= */}
        <div className="px-4 py-3 bg-[#111b21]/90 backdrop-blur-md border-b border-[#202c33] flex items-center justify-between z-30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#202c33] transition cursor-pointer"
              title="Close / Discard"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="font-semibold text-white text-sm">
              {statusType === 'text'
                ? 'Text Status'
                : statusType === 'camera'
                ? 'Take Status'
                : statusType === 'video'
                ? 'Trim Video'
                : 'Photo Status'}
            </span>
          </div>

          {/* Contextual actions on the top right */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* TEXT MODE CONTROLS */}
            {statusType === 'text' && (
              <>
                <button
                  type="button"
                  onClick={cycleFontFamily}
                  className="px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-xs font-bold text-white flex items-center gap-1 transition cursor-pointer border border-white/10"
                  title="Change Font"
                >
                  <Type className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>{selectedFont.name}</span>
                </button>
                <button
                  type="button"
                  onClick={cycleBackgroundColor}
                  className="p-1.5 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-white transition cursor-pointer border border-white/10"
                  title="Change Background Color"
                >
                  <Palette className="w-4 h-4 text-emerald-400" />
                </button>
              </>
            )}

            {/* VIDEO MODE CONTROLS */}
            {statusType === 'video' && mediaUrl && (
              <>
                <button
                  type="button"
                  onClick={() => setIsVideoMuted(!isVideoMuted)}
                  className={`p-1.5 rounded-full transition cursor-pointer border border-white/10 ${
                    isVideoMuted
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-[#202c33] hover:bg-[#2a3942] text-white'
                  }`}
                  title={isVideoMuted ? 'Unmute Video' : 'Mute Video'}
                >
                  {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaUrl('');
                    setVideoSegments([]);
                    setStatusType('text');
                  }}
                  className="p-1.5 rounded-full bg-[#202c33] hover:bg-red-500/20 text-[#8696a0] hover:text-red-400 transition cursor-pointer border border-white/10"
                  title="Remove Video"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            {/* PHOTO MODE CONTROLS */}
            {statusType === 'image' && mediaUrl && (
              <button
                type="button"
                onClick={() => {
                  setMediaUrl('');
                  setStatusType('text');
                }}
                className="p-1.5 rounded-full bg-[#202c33] hover:bg-red-500/20 text-[#8696a0] hover:text-red-400 transition cursor-pointer border border-white/10"
                title="Remove Photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* CAMERA FLIP */}
            {statusType === 'camera' && (
              <button
                type="button"
                onClick={flipCamera}
                className="p-1.5 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-white transition cursor-pointer border border-white/10"
                title="Flip Camera"
              >
                <RefreshCw className="w-4 h-4 text-[#00a884]" />
              </button>
            )}
          </div>
        </div>

        {/* ================= MODE NAVIGATION TABS ================= */}
        {!mediaUrl && (
          <div className="flex border-b border-[#202c33] bg-[#111b21] px-2 text-xs font-semibold z-20 flex-shrink-0">
            <button
              type="button"
              onClick={() => setStatusType('text')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition cursor-pointer border-b-2 ${
                statusType === 'text'
                  ? 'border-[#00a884] text-[#00a884]'
                  : 'border-transparent text-[#8696a0] hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusType('camera')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition cursor-pointer border-b-2 ${
                statusType === 'camera'
                  ? 'border-[#00a884] text-[#00a884]'
                  : 'border-transparent text-[#8696a0] hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera</span>
            </button>

            <label
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition cursor-pointer border-b-2 ${
                statusType === 'image'
                  ? 'border-[#00a884] text-[#00a884]'
                  : 'border-transparent text-[#8696a0] hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'image')}
                className="hidden"
              />
            </label>

            <label
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition cursor-pointer border-b-2 ${
                statusType === 'video'
                  ? 'border-[#00a884] text-[#00a884]'
                  : 'border-transparent text-[#8696a0] hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video (30s)</span>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleFileUpload(e, 'video')}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* ================= MAIN INTERACTIVE CANVAS ================= */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-black">
          {/* 1. TEXT STATUS CANVAS */}
          {statusType === 'text' && (
            <div
              className="flex-1 flex flex-col items-center justify-center p-6 text-center transition-colors duration-300 relative"
              style={{ backgroundColor: selectedBg }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={400}
                placeholder="Type a status update..."
                style={{
                  fontFamily: selectedFont.family,
                  backgroundColor: 'transparent',
                  background: 'transparent',
                  color: '#ffffff',
                }}
                className="status-canvas-textarea w-full bg-transparent text-white placeholder-white/60 text-2xl sm:text-3xl font-bold text-center border-none focus:outline-none resize-none leading-relaxed drop-shadow-md"
                rows={4}
                autoFocus
              />

              {/* Tagged users preview badge on text canvas */}
              {taggedContacts.length > 0 && (
                <div className="absolute top-4 left-4 right-4 flex flex-wrap gap-1.5 justify-center">
                  {taggedContacts.map((c) => (
                    <span
                      key={c.uid}
                      className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-white text-[11px] border border-white/20"
                    >
                      @{c.displayName}
                    </span>
                  ))}
                </div>
              )}

              {/* Character counter & font preview label */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-white/70">
                <span>Font: {selectedFont.name}</span>
                <span>{text.length}/400</span>
              </div>
            </div>
          )}

          {/* 2. PHOTO STATUS CANVAS */}
          {statusType === 'image' && mediaUrl && (
            <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
              <img
                src={mediaUrl}
                alt="Status Photo"
                className="w-full h-full object-contain"
              />
              {taggedContacts.length > 0 && (
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-[11px] flex items-center gap-1.5 border border-white/10">
                  <AtSign className="w-3 h-3 text-[#00a884]" />
                  <span>{taggedContacts.map((c) => `@${c.displayName}`).join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* 3. VIDEO STATUS CANVAS WITH 30-SECOND TRIMMER & SEGMENTS */}
          {statusType === 'video' && mediaUrl && (
            <div className="flex-1 flex flex-col bg-black relative overflow-hidden">
              {/* WhatsApp Video Scrubber & Auto-Segment Header */}
              {videoSegments.length > 1 && (
                <div className="bg-[#111b21] p-2.5 border-b border-[#202c33] z-20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-white font-medium">
                      <Scissors className="w-3.5 h-3.5 text-[#00a884]" />
                      <span>Video Trimmed ({videoSegments.length} Parts of max 30s)</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#00a884]">
                      Total {formatTimeDisplay(videoDuration)}
                    </span>
                  </div>

                  {/* Segment Selection Pills Carousel */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {videoSegments.map((seg, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectSegment(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition flex-shrink-0 cursor-pointer ${
                          selectedSegmentIndex === idx
                            ? 'bg-[#00a884] text-white shadow-md'
                            : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                        }`}
                      >
                        <Film className="w-3 h-3" />
                        <span>Part {idx + 1}</span>
                        <span className="text-[10px] opacity-80">
                          ({formatTimeDisplay(seg.start)}-{formatTimeDisplay(seg.end)})
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Multi-part vs Single part Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#202c33]/80">
                    <span className="text-[11px] text-[#8696a0]">
                      Post option:
                    </span>
                    <button
                      type="button"
                      onClick={() => setPostAllSegments(!postAllSegments)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        postAllSegments
                          ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40'
                          : 'bg-[#202c33] text-[#8696a0]'
                      }`}
                    >
                      {postAllSegments
                        ? `✓ Post All ${videoSegments.length} Parts consecutively`
                        : `Post Only Part ${selectedSegmentIndex + 1}`}
                    </button>
                  </div>
                </div>
              )}

              {/* Video Player Display */}
              <div
                className="flex-1 flex items-center justify-center relative cursor-pointer group"
                onClick={toggleVideoPlay}
              >
                <video
                  ref={previewVideoRef}
                  src={mediaUrl}
                  playsInline
                  muted={isVideoMuted}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-contain"
                />

                {/* Central Play/Pause Watermark */}
                {!isVideoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition">
                    <div className="w-14 h-14 rounded-full bg-[#00a884]/90 text-white flex items-center justify-center shadow-xl">
                      <Play className="w-6 h-6 ml-1" />
                    </div>
                  </div>
                )}

                {/* Time Indicator Badge */}
                <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/70 text-white text-[11px] font-mono pointer-events-none">
                  {formatTimeDisplay(videoCurrentTime)} / {formatTimeDisplay(currentActiveSegment.end)}
                </div>

                {/* Tagged badge overlay */}
                {taggedContacts.length > 0 && (
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-[11px] flex items-center gap-1.5 border border-white/10 pointer-events-none">
                    <AtSign className="w-3 h-3 text-[#00a884]" />
                    <span>{taggedContacts.map((c) => `@${c.displayName}`).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. CAMERA LIVE VIEWFINDER & SHUTTER (Photo tap or Hold-to-record video) */}
          {statusType === 'camera' && (
            <div className="flex-1 flex flex-col bg-black relative items-center justify-center">
              {cameraError ? (
                <div className="p-6 text-center space-y-3 max-w-xs">
                  <p className="text-xs text-red-400">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCamera(cameraFacing)}
                    className="px-4 py-2 bg-[#00a884] text-white rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Retry Camera
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
                  />

                  {/* Recording Status Top Pill */}
                  {isRecordingVideo && (
                    <div className="absolute top-4 bg-red-600/90 text-white px-3.5 py-1 rounded-full text-xs font-semibold flex items-center gap-2 animate-pulse shadow-lg z-20">
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      <span>REC {recordingSeconds}s / {MAX_STATUS_VIDEO_DURATION}s</span>
                    </div>
                  )}

                  {/* WhatsApp Shutter Controls Bar */}
                  <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-8 z-20">
                    {/* Shutter Button (Tap = Photo, Hold/Click = Video) */}
                    <div className="relative flex items-center justify-center">
                      {/* Circular Progress Ring if recording video */}
                      {isRecordingVideo && (
                        <svg className="absolute w-24 h-24 -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="42"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-red-500 fill-none"
                            strokeDasharray={264}
                            strokeDashoffset={264 - (264 * recordingSeconds) / MAX_STATUS_VIDEO_DURATION}
                            style={{ transition: 'stroke-dashoffset 1s linear' }}
                          />
                        </svg>
                      )}

                      {!isRecordingVideo ? (
                        <button
                          type="button"
                          onClick={capturePhoto}
                          onMouseDown={startVideoRecording}
                          onMouseUp={stopVideoRecording}
                          onTouchStart={startVideoRecording}
                          onTouchEnd={stopVideoRecording}
                          className="w-18 h-18 rounded-full border-4 border-white bg-white/20 active:scale-95 transition flex items-center justify-center cursor-pointer shadow-2xl"
                          title="Tap for photo, Hold for 30s video"
                        >
                          <div className="w-14 h-14 rounded-full bg-white transition" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopVideoRecording}
                          className="w-18 h-18 rounded-full border-4 border-red-500 bg-red-500/20 flex items-center justify-center cursor-pointer shadow-2xl"
                          title="Stop recording"
                        >
                          <div className="w-8 h-8 rounded-lg bg-red-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="absolute bottom-1 text-[11px] text-white/70 font-medium">
                    Tap shutter for Photo • Hold for Video
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ================= WHATSAPP BOTTOM BAR ================= */}
        <div className="bg-[#111b21] border-t border-[#202c33] p-3 space-y-2 z-30 flex-shrink-0">
          {/* Privacy Pill & Tag Contact trigger */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowPrivacyPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-white text-[11px] font-medium transition cursor-pointer border border-white/10"
            >
              <Lock className="w-3 h-3 text-[#00a884]" />
              <span>
                Status ({privacy === 'contacts' ? 'My Contacts' : privacy === 'contacts_except' ? `${privacyUids.length} excluded` : `${privacyUids.length} shared`})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowTagPicker(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] text-[11px] font-medium transition cursor-pointer border border-white/10"
            >
              <AtSign className="w-3 h-3" />
              <span>Tag ({taggedContacts.length})</span>
            </button>
          </div>

          {/* Caption Input & Emerald WhatsApp Send Button */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  statusType === 'text'
                    ? 'Text status ready'
                    : 'Add a caption...'
                }
                disabled={statusType === 'text'}
                className="w-full bg-[#202c33] border border-white/10 rounded-full pl-4 pr-10 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition"
              />
              <button
                type="button"
                onClick={() => setShowTagPicker(true)}
                className="absolute right-3 text-[#8696a0] hover:text-white cursor-pointer"
                title="Tag contacts"
              >
                <AtSign className="w-4 h-4" />
              </button>
            </div>

            {/* WhatsApp Emerald Send Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={
                isSubmitting ||
                (statusType === 'text' && !text.trim()) ||
                ((statusType === 'image' || statusType === 'video') && !mediaUrl.trim())
              }
              className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#02906f] active:scale-95 text-white flex items-center justify-center transition disabled:opacity-40 cursor-pointer shadow-lg shadow-[#00a884]/30 flex-shrink-0 relative"
              title="Post Status"
            >
              <Send className="w-5 h-5 ml-0.5" />
              {/* Badge if multi-segment video will create multiple updates */}
              {statusType === 'video' && videoSegments.length > 1 && postAllSegments && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">
                  {videoSegments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ================= PRIVACY BOTTOM SHEET / MODAL ================= */}
        {showPrivacyPicker && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-fade-in">
            <div className="bg-[#111b21] rounded-t-3xl border-t border-[#202c33] p-4 max-h-[85vh] flex flex-col space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#202c33]">
                <h3 className="font-semibold text-white text-sm">Status Privacy</h3>
                <button
                  type="button"
                  onClick={() => setShowPrivacyPicker(false)}
                  className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#202c33]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-[#8696a0] text-[11px]">
                  Who can see my status updates:
                </p>

                <div
                  onClick={() => setPrivacy('contacts')}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    privacy === 'contacts' ? 'bg-[#00a884]/15 border border-[#00a884]/40' : 'bg-[#202c33]'
                  }`}
                >
                  <div>
                    <div className="font-medium text-white">My Contacts</div>
                    <div className="text-[11px] text-[#8696a0]">Share with all your saved contacts</div>
                  </div>
                  {privacy === 'contacts' && <Check className="w-4 h-4 text-[#00a884]" />}
                </div>

                <div
                  onClick={() => setPrivacy('contacts_except')}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    privacy === 'contacts_except' ? 'bg-[#00a884]/15 border border-[#00a884]/40' : 'bg-[#202c33]'
                  }`}
                >
                  <div>
                    <div className="font-medium text-white">My Contacts Except...</div>
                    <div className="text-[11px] text-[#8696a0]">
                      {privacyUids.length > 0 ? `${privacyUids.length} contacts excluded` : 'Hide from specific people'}
                    </div>
                  </div>
                  {privacy === 'contacts_except' && <Check className="w-4 h-4 text-[#00a884]" />}
                </div>

                <div
                  onClick={() => setPrivacy('only_share_with')}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    privacy === 'only_share_with' ? 'bg-[#00a884]/15 border border-[#00a884]/40' : 'bg-[#202c33]'
                  }`}
                >
                  <div>
                    <div className="font-medium text-white">Only Share With...</div>
                    <div className="text-[11px] text-[#8696a0]">
                      {privacyUids.length > 0 ? `${privacyUids.length} contacts included` : 'Select specific contacts'}
                    </div>
                  </div>
                  {privacy === 'only_share_with' && <Check className="w-4 h-4 text-[#00a884]" />}
                </div>
              </div>

              {/* Exclusion / Inclusion Checklist if not 'contacts' */}
              {privacy !== 'contacts' && (
                <div className="pt-2 border-t border-[#202c33] flex-1 flex flex-col space-y-2 min-h-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={privacySearchQuery}
                      onChange={(e) => setPrivacySearchQuery(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full bg-[#202c33] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                    />
                    <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-2.5 top-2.5" />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 max-h-48 pr-1">
                    {filteredPrivacyContacts.map((c) => {
                      const isSelected = privacyUids.includes(c.uid);
                      return (
                        <div
                          key={c.uid}
                          onClick={() => togglePrivacyUid(c.uid)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs transition ${
                            isSelected ? 'bg-[#00a884]/20 text-[#00a884]' : 'hover:bg-[#202c33] text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar src={c.photoURL} name={c.displayName} size="sm" />
                            <span className="truncate">{c.displayName}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#00a884]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowPrivacyPicker(false)}
                className="w-full py-2.5 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ================= TAG CONTACTS BOTTOM SHEET ================= */}
        {showTagPicker && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-fade-in">
            <div className="bg-[#111b21] rounded-t-3xl border-t border-[#202c33] p-4 max-h-[85vh] flex flex-col space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#202c33]">
                <h3 className="font-semibold text-white text-sm">Tag Contacts in Status</h3>
                <button
                  type="button"
                  onClick={() => setShowTagPicker(false)}
                  className="p-1 rounded-full text-[#8696a0] hover:text-white hover:bg-[#202c33]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  placeholder="Search contacts to tag..."
                  className="w-full bg-[#202c33] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                />
                <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-2.5 top-2.5" />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 max-h-56 pr-1">
                {filteredTagContacts.map((c) => {
                  const isTagged = taggedContacts.some((t) => t.uid === c.uid);
                  return (
                    <div
                      key={c.uid}
                      onClick={() => toggleTagUser(c)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs transition ${
                        isTagged ? 'bg-[#00a884]/20 text-[#00a884]' : 'hover:bg-[#202c33] text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar src={c.photoURL} name={c.displayName} size="sm" />
                        <span className="truncate">{c.displayName}</span>
                      </div>
                      {isTagged && <Check className="w-4 h-4 text-[#00a884]" />}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowTagPicker(false)}
                className="w-full py-2.5 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Done ({taggedContacts.length} tagged)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
