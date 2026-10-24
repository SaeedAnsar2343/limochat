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
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: callType === 'video' ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: { ideal: 'user' },
        frameRate: { ideal: 30, min: 15 }
      } : false,
    });
  } catch (err) {
    console.warn("Could not get media device with preferred constraints, attempting fallback:", err);
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: 'user' } : false,
      });
    } catch {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
  }
}

export async function getFlippedCameraTrack(
  currentFacing: 'user' | 'environment'
): Promise<{ track: MediaStreamTrack; facing: 'user' | 'environment' }> {
  const nextFacing: 'user' | 'environment' = currentFacing === 'user' ? 'environment' : 'user';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: nextFacing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    const track = stream.getVideoTracks()[0];
    if (track) return { track, facing: nextFacing };
  } catch (e) {
    console.warn('Direct facingMode flip failed, querying devices:', e);
  }

  // Device enumeration fallback
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');
    if (videoInputs.length > 1) {
      // Pick alternative camera
      const targetDevice = nextFacing === 'environment' ? videoInputs[videoInputs.length - 1] : videoInputs[0];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { ideal: targetDevice.deviceId } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (track) return { track, facing: nextFacing };
    }
  } catch (err) {
    console.warn('Device fallback failed:', err);
  }

  throw new Error('Unable to flip camera on this hardware');
}

export async function getScreenShareMedia(): Promise<MediaStream> {
  return await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
}
