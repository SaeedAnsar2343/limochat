import React, { useState, useEffect, useRef } from 'react';
import { Mic, Trash2, Send, Pause, Play } from 'lucide-react';
import { formatDuration } from '../../utils/formatters';

interface VoiceRecorderProps {
  onSendVoice: (audioBlob: Blob, durationSec: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSendVoice, onCancel }) => {
  const [duration, setDuration] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let isMounted = true;

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start(100);
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
      } catch (err) {
        console.error("Microphone access error:", err);
        alert("Microphone permission denied or not available.");
        onCancel();
      }
    };

    startRecording();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleFinish = () => {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      onSendVoice(audioBlob, duration);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };

    mediaRecorderRef.current.stop();
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    onCancel();
  };

  return (
    <div className="flex items-center justify-between w-full bg-[#202c33] px-4 py-2.5 rounded-2xl border border-[#2a3942] animate-fade-in shadow-lg">
      <div className="flex items-center gap-3">
        {/* Pulsing Red Dot */}
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
        </span>
        <span className="text-sm font-mono text-white font-medium">
          {formatDuration(duration)}
        </span>
        <span className="text-xs text-[#8696a0] hidden sm:inline">
          Recording voice note...
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCancel}
          className="p-2 rounded-full text-[#8696a0] hover:text-red-400 hover:bg-[#2a3942] transition"
          title="Cancel recording"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <button
          onClick={handleFinish}
          className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white transition shadow-md flex items-center justify-center cursor-pointer"
          title="Send voice note"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
