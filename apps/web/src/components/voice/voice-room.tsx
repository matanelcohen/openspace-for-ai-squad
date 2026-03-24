'use client';

import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { useEffect } from 'react';

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
    currentSpeaker,
    startRecording,
    stopRecording,
    toggleMute,
    endSession,
  } = voice;

  // Auto-start continuous recording when the voice room opens
  useEffect(() => {
    if (session?.status === 'active' && !isRecording) {
      startRecording();
    }
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {isRecording && !isMuted && (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Listening...
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
