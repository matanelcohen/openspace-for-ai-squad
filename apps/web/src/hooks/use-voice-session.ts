import type { VoiceMessage, VoiceSession } from '@openspace/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

import { useWsEvent } from '@/components/providers/websocket-provider';
import type { WsEnvelope } from '@/hooks/use-websocket';
import { api } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────

export interface SpeechQueueItem {
  id: string;
  agentId: string;
  text: string;
}

export interface UseVoiceSessionReturn {
  session: VoiceSession | null;
  isListening: boolean;
  isMuted: boolean;
  /** Live transcript while user is speaking. */
  transcript: string;
  currentSpeaker: string | null;
  setCurrentSpeaker: (agentId: string | null) => void;
  /** Queue of agent speech items for TTS playback (rendered by VoiceSpeaker). */
  speechQueue: SpeechQueueItem[];
  startSession: (agentIds: string[]) => void;
  endSession: () => void;
  startListening: () => void;
  stopListening: () => void;
  toggleMute: () => void;
  /** Whether the browser supports speech recognition. */
  browserSupported: boolean;
  /** Pause listening (e.g. while agent is speaking). */
  pauseListening: () => void;
  /** Resume listening after pause. */
  resumeListening: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useVoiceSession(): UseVoiceSessionReturn {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [speechQueue, setSpeechQueue] = useState<SpeechQueueItem[]>([]);

  const sessionRef = useRef<VoiceSession | null>(null);
  const seenTranscriptsRef = useRef<Set<string>>(new Set());

  // Keep sessionRef in sync
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // react-speech-recognition hook
  const {
    transcript,
    listening,
    resetTranscript,
    finalTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // When a final transcript is ready, send it to the backend
  useEffect(() => {
    if (!finalTranscript) return;
    const text = finalTranscript.trim();
    if (!text) return;

    // Deduplicate
    if (seenTranscriptsRef.current.has(text)) return;
    seenTranscriptsRef.current.add(text);
    setTimeout(() => seenTranscriptsRef.current.delete(text), 30_000);

    const sid = sessionRef.current?.id;
    if (sid) {
      console.log('[Voice] Heard:', text);
      api
        .post('/api/voice/speak', { sessionId: sid, text })
        .catch((err: unknown) => console.error('Voice speak failed:', err));
    }

    resetTranscript();
  }, [finalTranscript, resetTranscript]);

  // Listen for agent responses via WebSocket and queue them for TTS
  const seenResponsesRef = useRef<Set<string>>(new Set());

  useWsEvent(
    'voice:transcript',
    useCallback((envelope: WsEnvelope) => {
      const { sessionId, agentId, text } = envelope.payload as {
        sessionId: string;
        agentId: string;
        text: string;
      };
      if (!agentId || !text) return;

      // Deduplicate
      const key = `${agentId}:${text}`;
      if (seenResponsesRef.current.has(key)) return;
      seenResponsesRef.current.add(key);
      setTimeout(() => seenResponsesRef.current.delete(key), 30_000);

      // Add message to session transcript
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

      // Queue for TTS playback
      setSpeechQueue((prev) => [...prev, { id: `tts-${Date.now()}-${agentId}`, agentId, text }]);
    }, []),
  );

  // Session management
  const startSession = useCallback(async (agentIds: string[]) => {
    try {
      const newSession = await api.post<VoiceSession>('/api/voice/sessions', {
        title: 'Voice Session',
        agentIds,
      });
      setSession(newSession);
      setSpeechQueue([]);
      seenTranscriptsRef.current.clear();
      seenResponsesRef.current.clear();
    } catch (err) {
      console.error('Failed to start voice session:', err);
    }
  }, []);

  const endSession = useCallback(async () => {
    SpeechRecognition.stopListening();
    if (session) {
      try {
        await api.delete(`/api/voice/sessions/${session.id}`);
      } catch {
        /* best effort */
      }
    }
    setSession(null);
    setSpeechQueue([]);
  }, [session]);

  const startListeningFn = useCallback(() => {
    SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
  }, []);

  const stopListeningFn = useCallback(() => {
    SpeechRecognition.stopListening();
  }, []);

  const pauseListening = useCallback(() => {
    SpeechRecognition.stopListening();
  }, []);

  const resumeListening = useCallback(() => {
    SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      if (prev) {
        SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      } else {
        SpeechRecognition.stopListening();
      }
      return !prev;
    });
  }, []);

  return {
    session,
    isListening: listening,
    isMuted,
    transcript,
    currentSpeaker,
    setCurrentSpeaker,
    speechQueue,
    startSession,
    endSession,
    startListening: startListeningFn,
    stopListening: stopListeningFn,
    toggleMute,
    browserSupported: browserSupportsSpeechRecognition,
    pauseListening,
    resumeListening,
  };
}
