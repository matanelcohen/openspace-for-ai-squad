'use client';

import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import type { UseVoiceSessionReturn } from '@/hooks/use-voice-session';

import { AgentCircle } from './agent-circle';
import { VoiceSpeaker } from './voice-speaker';
import { VoiceTranscript } from './voice-transcript';

interface VoiceRoomProps {
  voice: UseVoiceSessionReturn;
  onClose: () => void;
}

export function VoiceRoom({ voice, onClose }: VoiceRoomProps) {
  const {
    session,
    isListening,
    isMuted,
    transcript,
    currentSpeaker,
    setCurrentSpeaker,
    speechQueue,
    thinkingAgents,
    startListening,
    stopListening,
    toggleMute,
    endSession,
    pauseListening,
    resumeListening,
    browserSupported,
  } = voice;

  // Auto-start listening when session becomes active
  useEffect(() => {
    if (session?.status === 'active' && !isListening) {
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  const handleEndSession = () => {
    stopListening();
    endSession();
    onClose();
  };

  const handleSpeakingStart = useCallback(
    (agentId: string) => {
      setCurrentSpeaker(agentId);
      pauseListening();
    },
    [setCurrentSpeaker, pauseListening],
  );

  const handleSpeakingEnd = useCallback(
    (agentId: string) => {
      if (currentSpeaker === agentId) {
        setCurrentSpeaker(null);
      }
    },
    [currentSpeaker, setCurrentSpeaker],
  );

  const handleQueueEmpty = useCallback(() => {
    setCurrentSpeaker(null);
    if (!isMuted) {
      resumeListening();
    }
  }, [setCurrentSpeaker, isMuted, resumeListening]);

  if (!session || session.status !== 'active') {
    return null;
  }

  if (!browserSupported) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Speech recognition is not supported in this browser. Please use Chrome.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="voice-room">
      {/* TTS player (invisible — plays speech queue) */}
      <VoiceSpeaker
        queue={speechQueue}
        onSpeakingStart={handleSpeakingStart}
        onSpeakingEnd={handleSpeakingEnd}
        onQueueEmpty={handleQueueEmpty}
      />

      {/* Agent circles row */}
      <div className="flex items-center justify-center gap-4">
        {session.participantAgentIds.map((agentId) => (
          <div key={agentId} className="relative">
            <AgentCircle agentId={agentId} isSpeaking={currentSpeaker === agentId} />
            {thinkingAgents.has(agentId) && currentSpeaker !== agentId && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                <span className="h-1 w-1 animate-bounce rounded-full bg-yellow-500 [animation-delay:0ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-yellow-500 [animation-delay:150ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-yellow-500 [animation-delay:300ms]" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Thinking indicator */}
      {thinkingAgents.size > 0 && (
        <div className="mx-auto flex items-center gap-2 rounded-full bg-yellow-50 px-4 py-1.5 dark:bg-yellow-950">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-yellow-500 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-yellow-500 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-yellow-500 [animation-delay:300ms]" />
          </span>
          <span className="text-sm text-yellow-700 dark:text-yellow-300">
            {[...thinkingAgents].join(', ')} {thinkingAgents.size === 1 ? 'is' : 'are'} thinking...
          </span>
        </div>
      )}

      {/* Transcript (compact) */}
      {session.messages.length > 0 && (
        <VoiceTranscript
          messages={session.messages.slice(-3)}
          className="max-h-24 overflow-y-auto text-xs"
        />
      )}

      {/* Live user speech */}
      {transcript && (
        <div className="mx-auto flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 dark:bg-green-950">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-500 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-500 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-500 [animation-delay:300ms]" />
          </span>
          <span className="text-sm italic text-green-700 dark:text-green-300">{transcript}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant={isMuted ? 'destructive' : 'outline'}
          size="sm"
          onClick={toggleMute}
          className="gap-1.5"
        >
          {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>

        {isListening && !transcript && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Listening...
          </span>
        )}

        {currentSpeaker && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            {currentSpeaker} is speaking
          </span>
        )}

        <Button variant="destructive" size="sm" onClick={handleEndSession} className="gap-1.5">
          <PhoneOff className="h-3.5 w-3.5" />
          End
        </Button>
      </div>
    </div>
  );
}
