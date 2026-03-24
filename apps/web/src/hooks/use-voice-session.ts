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

  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);

  // Keep sessionRef in sync
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ok */
      }
      recognitionRef.current = null;
    }
    setSession(null);
    setIsRecording(false);
  }, [session]);

  // Speech recognition refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);

  const startRecording = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession || currentSession.status !== 'active') return;

    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      console.warn('Speech Recognition not supported in this browser. Try Chrome.');
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ok */
      }
    }

    shouldListenRef.current = true;

    const startListening = () => {
      if (!shouldListenRef.current) return;

      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Only process final results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result?.[0] && result.isFinal) {
            const transcript = result[0].transcript.trim();
            if (transcript) {
              console.log('[Voice] Heard:', transcript);
              const sid = sessionRef.current?.id;
              if (sid) {
                api
                  .post('/api/voice/speak', { sessionId: sid, text: transcript })
                  .catch((err: unknown) => console.error('Voice speak failed:', err));
              } else {
                console.warn('[Voice] No active session to send transcript to');
              }
            }
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('[Voice] Recognition error:', event.error);
        // "no-speech" and "aborted" are normal — restart
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return; // onend will fire and restart
        }
        // For "not-allowed" or "service-not-available", stop trying
        if (event.error === 'not-allowed') {
          shouldListenRef.current = false;
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        // Auto-restart if we should still be listening
        if (shouldListenRef.current) {
          setTimeout(startListening, 300);
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setIsRecording(true);
      } catch (err) {
        console.error('[Voice] Failed to start:', err);
        setIsRecording(false);
      }
    };

    startListening();
  }, []);

  const stopRecording = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ok */
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  /** Use browser Speech Recognition to listen and return transcript text. */
  const recordAndTranscribe = useCallback(async (): Promise<string | null> => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      console.warn('Speech Recognition not supported in this browser');
      return null;
    }

    return new Promise((resolve) => {
      let resolved = false;
      const done = (result: string | null) => {
        if (resolved) return;
        resolved = true;
        setIsRecording(false);
        resolve(result);
      };

      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsRecording(true);

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript ?? null;
        done(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Speech recognition error:', event.error);
        done(null);
      };

      recognition.onend = () => {
        // If onresult didn't fire, resolve with null
        done(null);
      };

      try {
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        done(null);
      }

      // Safety timeout — 15 seconds max
      setTimeout(() => {
        if (!resolved) {
          try {
            recognition.stop();
          } catch {
            /* already stopped */
          }
          done(null);
        }
      }, 15_000);
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
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ok */
        }
      }
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
