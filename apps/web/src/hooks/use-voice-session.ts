import type { VoiceMessage, VoiceSession } from '@openspace/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

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
}

export function useVoiceSession(): UseVoiceSessionReturn {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startSession = useCallback((agentIds: string[]) => {
    const newSession: VoiceSession = {
      id: `session-${Date.now()}`,
      title: 'Voice Session',
      status: 'active',
      participantAgentIds: agentIds,
      startedAt: new Date().toISOString(),
      endedAt: null,
      messages: [],
    };
    setSession(newSession);
  }, []);

  const endSession = useCallback(() => {
    if (session) {
      setSession({
        ...session,
        status: 'ended',
        endedAt: new Date().toISOString(),
      });
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
    }
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

      mediaRecorder.onstop = () => {
        const _audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // In a real implementation, this would send to the API
        // For now, we'll simulate a transcript
        const newMessage: VoiceMessage = {
          id: `msg-${Date.now()}`,
          sessionId: session.id,
          role: 'user',
          agentId: null,
          content: 'User speech transcription...',
          timestamp: new Date().toISOString(),
          durationMs: 3000,
        };
        
        setSession(prev => prev ? {
          ...prev,
          messages: [...prev.messages, newMessage],
        } : null);

        // Simulate agent response
        setTimeout(() => {
          const agentResponse: VoiceMessage = {
            id: `msg-${Date.now()}`,
            sessionId: session.id,
            role: 'agent',
            agentId: session.participantAgentIds[0] || 'leela',
            content: 'Agent response to user input...',
            timestamp: new Date().toISOString(),
            durationMs: 2500,
          };
          
          setCurrentSpeaker(agentResponse.agentId);
          setSession(prev => prev ? {
            ...prev,
            messages: [...prev.messages, agentResponse],
          } : null);

          setTimeout(() => setCurrentSpeaker(null), 2500);
        }, 500);
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

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
  }, [isMuted]);

  const sendTextMessage = useCallback((content: string, targetAgentId?: string) => {
    if (!session || session.status !== 'active') return;

    const newMessage: VoiceMessage = {
      id: `msg-${Date.now()}`,
      sessionId: session.id,
      role: 'user',
      agentId: null,
      content,
      timestamp: new Date().toISOString(),
      durationMs: null,
    };

    setSession(prev => prev ? {
      ...prev,
      messages: [...prev.messages, newMessage],
    } : null);

    // Simulate agent response
    setTimeout(() => {
      const respondingAgentId = targetAgentId || session.participantAgentIds[0] || 'leela';
      const agentResponse: VoiceMessage = {
        id: `msg-${Date.now()}`,
        sessionId: session.id,
        role: 'agent',
        agentId: respondingAgentId,
        content: `Response to: ${content}`,
        timestamp: new Date().toISOString(),
        durationMs: null,
      };

      setCurrentSpeaker(respondingAgentId);
      setSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, agentResponse],
      } : null);

      setTimeout(() => setCurrentSpeaker(null), 2000);
    }, 500);
  }, [session]);

  const playMessage = useCallback((messageId: string) => {
    if (!session) return;
    const message = session.messages.find(m => m.id === messageId);
    if (message && message.agentId) {
      setCurrentSpeaker(message.agentId);
      setTimeout(() => setCurrentSpeaker(null), message.durationMs || 2000);
    }
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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
  };
}
