import type { VoiceMessage, VoiceSession } from '@openspace/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';
import type { WsEnvelope } from '@/hooks/use-websocket';
import { api } from '@/lib/api-client';

// ── Browser Speech API helpers ───────────────────────────────────

/** Get the SpeechRecognition constructor (vendor-prefixed in some browsers). */
function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

/** Agent voice configs for browser SpeechSynthesis. */
const AGENT_VOICE_PITCH: Record<string, { pitch: number; rate: number }> = {
  leela: { pitch: 1.1, rate: 1.0 },
  fry: { pitch: 1.2, rate: 1.05 },
  bender: { pitch: 0.7, rate: 0.95 },
  zoidberg: { pitch: 1.3, rate: 1.0 },
};

/** Speak text using browser SpeechSynthesis with agent-specific voice. */
function speakAsAgent(agentId: string, text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(text);
  const config = AGENT_VOICE_PITCH[agentId] ?? { pitch: 1, rate: 1 };
  utterance.pitch = config.pitch;
  utterance.rate = config.rate;

  // Try to pick a distinct voice per agent
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const voiceIndex = Object.keys(AGENT_VOICE_PITCH).indexOf(agentId);
    utterance.voice = voices[voiceIndex % voices.length] ?? voices[0] ?? null;
  }

  window.speechSynthesis.speak(utterance);
}

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
    useCallback((_envelope: WsEnvelope) => {
      // Audio playback is handled by voice:transcript via browser TTS
    }, []),
  );

  // Also speak agent transcript responses via browser TTS
  useWsEvent(
    'voice:transcript',
    useCallback((envelope: WsEnvelope) => {
      const { agentId, text } = envelope.payload as {
        sessionId: string;
        agentId: string;
        text: string;
      };
      if (agentId && text) {
        speakAsAgent(agentId, text);
      }
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

    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      console.warn('Speech Recognition not supported');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript;
      if (transcript && session) {
        // Send transcript to backend for agent responses
        api
          .post('/api/voice/speak', { sessionId: session.id, text: transcript })
          .catch((err: unknown) => console.error('Voice speak failed:', err));
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    // Store reference for stopRecording
    mediaRecorderRef.current = recognition as unknown as MediaRecorder;
    recognition.start();
    setIsRecording(true);
  }, [session]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // mediaRecorderRef holds a SpeechRecognition instance
      const recognition = mediaRecorderRef.current as unknown as SpeechRecognition;
      recognition.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }, [isRecording]);

  /** Use browser Speech Recognition to listen and return transcript text. */
  const recordAndTranscribe = useCallback(async (): Promise<string | null> => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      console.warn('Speech Recognition not supported in this browser');
      return null;
    }

    return new Promise((resolve) => {
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsRecording(true);

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript ?? null;
        setIsRecording(false);
        resolve(transcript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
        resolve(null);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    });
  }, []);

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

      // Send transcript to backend for agent responses via copilot-sdk
      api
        .post('/api/voice/speak', {
          sessionId: session.id,
          text: content,
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
