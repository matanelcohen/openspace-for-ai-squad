import { Mic, MicOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MicrophoneButtonProps {
  isRecording: boolean;
  isMuted: boolean;
  onToggleRecording: () => void;
  disabled?: boolean;
  className?: string;
}

export function MicrophoneButton({
  isRecording,
  isMuted,
  onToggleRecording,
  disabled = false,
  className,
}: MicrophoneButtonProps) {
  return (
    <Button
      size="lg"
      variant={isRecording ? 'destructive' : 'default'}
      className={cn(
        'h-16 w-16 rounded-full transition-all',
        isRecording && 'animate-pulse',
        isMuted && 'opacity-50',
        className
      )}
      onClick={onToggleRecording}
      disabled={disabled}
      data-testid="microphone-button"
      data-recording={isRecording}
      data-muted={isMuted}
    >
      {isMuted ? (
        <MicOff className="h-6 w-6" />
      ) : (
        <Mic className="h-6 w-6" />
      )}
    </Button>
  );
}
