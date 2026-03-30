import type { VoiceSessionStatus } from '@matanelcohen/openspace-shared';
import { Mic, MicOff,Phone, PhoneOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SessionControlsProps {
  sessionStatus: VoiceSessionStatus | null;
  isMuted: boolean;
  onStartSession: () => void;
  onEndSession: () => void;
  onToggleMute: () => void;
}

export function SessionControls({
  sessionStatus,
  isMuted,
  onStartSession,
  onEndSession,
  onToggleMute,
}: SessionControlsProps) {
  const isActive = sessionStatus === 'active';

  return (
    <div className="flex gap-2 items-center" data-testid="session-controls">
      {isActive ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleMute}
            data-testid="mute-button"
          >
            {isMuted ? (
              <>
                <MicOff className="h-4 w-4 mr-2" />
                Unmute
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Mute
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onEndSession}
            data-testid="end-session-button"
          >
            <PhoneOff className="h-4 w-4 mr-2" />
            End Session
          </Button>
        </>
      ) : (
        <Button
          variant="default"
          size="sm"
          onClick={onStartSession}
          data-testid="start-session-button"
        >
          <Phone className="h-4 w-4 mr-2" />
          Start Session
        </Button>
      )}
    </div>
  );
}
