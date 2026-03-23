import { Send } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface VoiceTextInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function VoiceTextInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...',
}: VoiceTextInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 items-center"
      data-testid="voice-text-input"
    >
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
        data-testid="text-input-field"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !message.trim()}
        data-testid="send-button"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
