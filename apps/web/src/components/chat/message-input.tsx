'use client';

import { Mic, MicOff, Send } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  isTyping?: boolean;
  /** If provided, shows a mic button for voice input. */
  onVoiceRecord?: () => Promise<string | null>;
  isRecording?: boolean;
}

export function MessageInput({
  onSend,
  disabled,
  isTyping,
  onVoiceRecord,
  isRecording,
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const [recording, setRecording] = useState(false);

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

  const handleMicClick = async () => {
    if (!onVoiceRecord || recording) return;
    setRecording(true);
    try {
      const transcript = await onVoiceRecord();
      if (transcript) {
        onSend(transcript);
      }
    } finally {
      setRecording(false);
    }
  };

  const isActivelyRecording = recording || isRecording;

  return (
    <div className="border-t p-4" data-testid="message-input">
      {isTyping && (
        <div className="mb-2 text-xs text-muted-foreground" data-testid="typing-indicator">
          typing...
        </div>
      )}
      <div className="flex items-end gap-2">
        {onVoiceRecord && (
          <Button
            variant={isActivelyRecording ? 'destructive' : 'outline'}
            size="icon"
            onClick={handleMicClick}
            disabled={disabled}
            className="h-10 w-10 shrink-0"
            data-testid="mic-button"
            title={isActivelyRecording ? 'Recording...' : 'Voice input'}
          >
            {isActivelyRecording ? (
              <MicOff className="h-4 w-4 animate-pulse" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isActivelyRecording ? 'Listening...' : 'Type a message...'}
          disabled={disabled || isActivelyRecording}
          className="min-h-[40px] resize-none"
          rows={1}
          data-testid="message-textarea"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim() || isActivelyRecording}
          size="icon"
          className="h-10 w-10 shrink-0"
          data-testid="send-button"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
