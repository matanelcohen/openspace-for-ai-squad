import { Play } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PlayButtonProps {
  messageId: string;
  onPlay: (messageId: string) => void;
  disabled?: boolean;
}

export function PlayButton({ messageId, onPlay, disabled = false }: PlayButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => onPlay(messageId)}
      disabled={disabled}
      data-testid="play-button"
      data-message-id={messageId}
    >
      <Play className="h-3 w-3" />
    </Button>
  );
}
