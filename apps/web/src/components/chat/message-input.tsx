'use client';

import { type KeyboardEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  isTyping?: boolean;
}

export function MessageInput({ onSend, disabled, isTyping }: MessageInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t p-4" data-testid="message-input">
      {isTyping && (
        <div className="mb-2 text-xs text-muted-foreground" data-testid="typing-indicator">
          typing...
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          className="min-h-[40px] resize-none"
          rows={1}
          data-testid="message-textarea"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          data-testid="send-button"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
