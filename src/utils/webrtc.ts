// WebRTC configuration and signaling utilities

export const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 10,
};

export async function getLocalUserMedia(callType: 'audio' | 'video'): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      } : false,
    });
  } catch (err) {
    console.warn("Could not get media device with preferred constraints, attempting audio only:", err);
    // If video fails (e.g. no webcam), fallback to audio
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }
}

export async function getScreenShareMedia(): Promise<MediaStream> {
  return await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
}
