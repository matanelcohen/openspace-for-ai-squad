import type { VoiceMessage, VoiceSession } from '@openspace/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';
import type { WsEnvelope } from '@/hooks/use-websocket';
import { api } from '@/lib/api-client';

export interface UseVoiceSessionReturn {
  session: VoiceSession | null;
  isRecording: boolean;
  isMuted: boolean;
  currentSpeaker: string | null;
  startSession: (agentIds: string[]) => void;
  endSession: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleMute: () => void;
  sendTextMessage: (content: string, targetAgentId?: string) => void;
  playMessage: (messageId: string) => void;
  /** Record a short audio clip and transcribe it. Returns the transcript text. */
  recordAndTranscribe: () => Promise<string | null>;
}

export function useVoiceSession(): UseVoiceSessionReturn {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Listen for real-time voice events
  useWsEvent(
    'voice:transcript',
    useCallback((envelope: WsEnvelope) => {
      const { sessionId, agentId, text } = envelope.payload as {
        sessionId: string;
        agentId: string;
        text: string;
      };
      setSession((prev) => {
        if (!prev || prev.id !== sessionId) return prev;
        const msg: VoiceMessage = {
          id: `voice-${Date.now()}-${agentId}`,
          sessionId,
          role: 'agent',
          agentId,
          content: text,
          timestamp: new Date().toISOString(),
          durationMs: null,
        };
        return { ...prev, messages: [...prev.messages, msg] };
      });
    }, []),
  );

  useWsEvent(
    'voice:speaking',
    useCallback((envelope: WsEnvelope) => {
      const { participantId, isSpeaking } = envelope.payload as {
        participantId: string;
        isSpeaking: boolean;
      };
      setCurrentSpeaker(isSpeaking ? participantId : null);
    }, []),
  );

  useWsEvent(
    'voice:audio',
    useCallback((envelope: WsEnvelope) => {
      const { audio } = envelope.payload as { audio: string };
      if (!audio) return;
      // Decode and play audio
      const audioData = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
      const blob = new Blob([audioData], { type: 'audio/opus' });
      const url = URL.createObjectURL(blob);
      const player = new Audio(url);
      player.play().catch(() => {
        /* autoplay blocked */
      });
      player.onended = () => URL.revokeObjectURL(url);
    }, []),
  );

  const startSession = useCallback(async (agentIds: string[]) => {
    try {
      const newSession = await api.post<VoiceSession>('/api/voice/sessions', {
        title: 'Voice Session',
        agentIds,
      });
      setSession(newSession);
    } catch (err) {
      console.error('Failed to start voice session:', err);
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!session) return;
    try {
      await api.delete(`/api/voice/sessions/${session.id}`);
    } catch {
      /* best effort */
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setSession(null);
    setIsRecording(false);
  }, [session]);

  const startRecording = useCallback(async () => {
    if (!session || session.status !== 'active') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToAPI(session.id, audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [session]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  /** Record a short clip, transcribe it, and return the text. */
  const recordAndTranscribe = useCallback(async (): Promise<string | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return new Promise((resolve) => {
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const base64 = await blobToBase64(blob);

          // If we have an active session, use it. Otherwise create a temp one.
          const sid = session?.id ?? 'inline-voice';
          try {
            const result = await api.post<{ transcript: { text: string } }>(
              '/api/voice/transcribe',
              { sessionId: sid, audio: base64, finalize: true },
            );
            resolve(result.transcript?.text ?? null);
          } catch {
            resolve(null);
          }
        };

        recorder.start();
        setIsRecording(true);

        // Auto-stop after silence or max 10 seconds
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
            setIsRecording(false);
          }
        }, 10_000);
      });
    } catch {
      return null;
    }
  }, [session]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
  }, [isMuted]);

  const sendTextMessage = useCallback(
    (content: string, _targetAgentId?: string) => {
      if (!session || session.status !== 'active') return;

      const userMsg: VoiceMessage = {
        id: `msg-${Date.now()}`,
        sessionId: session.id,
        role: 'user',
        agentId: null,
        content,
        timestamp: new Date().toISOString(),
        durationMs: null,
      };

      setSession((prev) => (prev ? { ...prev, messages: [...prev.messages, userMsg] } : null));

      // Send as audio transcription (text-only, no audio)
      api
        .post('/api/voice/transcribe', {
          sessionId: session.id,
          audio: btoa(content), // placeholder — route handles text
          finalize: true,
        })
        .catch((err: unknown) => console.error('Voice text send failed:', err));
    },
    [session],
  );

  const playMessage = useCallback(
    (messageId: string) => {
      if (!session) return;
      const message = session.messages.find((m) => m.id === messageId);
      if (message?.agentId) {
        setCurrentSpeaker(message.agentId);
        setTimeout(() => setCurrentSpeaker(null), message.durationMs ?? 2000);
      }
    },
    [session],
  );

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    session,
    isRecording,
    isMuted,
    currentSpeaker,
    startSession,
    endSession,
    startRecording,
    stopRecording,
    toggleMute,
    sendTextMessage,
    playMessage,
    recordAndTranscribe,
  };
}

// ── Helpers ──────────────────────────────────────────────────────

async function sendAudioToAPI(sessionId: string, blob: Blob): Promise<void> {
  const base64 = await blobToBase64(blob);
  await api.post('/api/voice/transcribe', {
    sessionId,
    audio: base64,
    finalize: true,
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip "data:audio/webm;base64," prefix
      resolve(dataUrl.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
