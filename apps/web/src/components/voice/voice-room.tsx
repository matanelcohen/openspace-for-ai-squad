'use client';

import { Mic, MicOff, PhoneOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { UseVoiceSessionReturn } from '@/hooks/use-voice-session';

import { AgentCircle } from './agent-circle';
import { VoiceTranscript } from './voice-transcript';

interface VoiceRoomProps {
  voice: UseVoiceSessionReturn;
  onClose: () => void;
}

export function VoiceRoom({ voice, onClose }: VoiceRoomProps) {
  const {
    session,
    isRecording,
    isMuted,
    isSpeaking,
    interimTranscript,
    currentSpeaker,
    stopRecording,
    toggleMute,
    endSession,
  } = voice;

  const handleEndSession = () => {
    stopRecording();
    endSession();
    onClose();
  };

  if (!session || session.status !== 'active') {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="voice-room">
      {/* Agent circles row */}
      <div className="flex items-center justify-center gap-4">
        {session.participantAgentIds.map((agentId) => (
          <AgentCircle key={agentId} agentId={agentId} isSpeaking={currentSpeaker === agentId} />
        ))}
      </div>

      {/* Transcript (compact) */}
      {session.messages.length > 0 && (
        <VoiceTranscript
          messages={session.messages.slice(-3)}
          className="max-h-24 overflow-y-auto text-xs"
        />
      )}

      {/* Live speech indicator */}
      {isSpeaking && interimTranscript && (
        <div className="mx-auto flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 dark:bg-green-950">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-500 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-500 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-500 [animation-delay:300ms]" />
          </span>
          <span className="text-sm italic text-green-700 dark:text-green-300">
            {interimTranscript}
          </span>
        </div>
      )}

      {/* Controls: mute + recording indicator + end */}
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

        {isRecording && !isMuted && !isSpeaking && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Listening...
          </span>
        )}

        {isSpeaking && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            You&apos;re speaking
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
