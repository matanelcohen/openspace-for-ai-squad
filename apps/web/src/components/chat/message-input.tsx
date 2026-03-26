'use client';

import { ArrowUp, Mic, MicOff } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ChatGPT-style: input is "open" when focused or has content
  const isOpen = focused || value.length > 0;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

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
  const canSend = !!value.trim() && !disabled && !isActivelyRecording;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'border-t bg-background/80 backdrop-blur-sm pb-4 pt-2 transition-all duration-300 ease-in-out',
          isOpen ? 'px-4' : 'px-4 sm:px-16 md:px-28 lg:px-40',
        )}
        data-testid="message-input"
      >
        {isTyping && (
          <div
            className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="typing-indicator"
          >
            <span className="flex gap-0.5">
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
            </span>
            <span>typing...</span>
          </div>
        )}

        <div
          className={cn(
            'mx-auto flex flex-col rounded-2xl border bg-background transition-all duration-300 ease-in-out',
            isOpen
              ? 'w-full gap-2 p-2.5 scale-100'
              : 'w-full max-w-2xl gap-0 p-2 scale-[0.98]',
            focused && !disabled
              ? 'border-ring/75 ring-2 ring-ring/20 shadow-sm'
              : 'border-input hover:border-ring/40',
            disabled && 'opacity-60',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={isActivelyRecording ? 'Listening...' : 'Send a message...'}
            disabled={disabled || isActivelyRecording}
            className={cn(
              'w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed transition-all duration-300 ease-in-out',
              isOpen ? 'max-h-40 min-h-[40px] px-1.5 py-1' : 'max-h-10 min-h-[36px] px-1.5 py-1',
            )}
            rows={1}
            data-testid="message-textarea"
          />

          <div
            className={cn(
              'flex items-center justify-between overflow-hidden transition-all duration-300 ease-in-out',
              isOpen ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <div className="flex items-center gap-1">
              {onVoiceRecord && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActivelyRecording ? 'destructive' : 'ghost'}
                      size="icon"
                      onClick={handleMicClick}
                      disabled={disabled}
                      className={cn(
                        'h-8 w-8 shrink-0 rounded-full transition-colors',
                        isActivelyRecording && 'animate-pulse',
                      )}
                      data-testid="mic-button"
                    >
                      {isActivelyRecording ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isActivelyRecording ? 'Stop recording' : 'Voice input'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  size="icon"
                  className={cn(
                    'h-8 w-8 shrink-0 rounded-full transition-all duration-200',
                    canSend
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 scale-100'
                      : 'bg-muted text-muted-foreground scale-95',
                  )}
                  data-testid="send-button"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Send message</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <p
          className={cn(
            'mt-1.5 text-center text-[10px] text-muted-foreground/50 transition-all duration-300 ease-in-out',
            isOpen ? 'max-h-6 opacity-100' : 'max-h-0 opacity-0 overflow-hidden',
          )}
        >
          Press{' '}
          <kbd className="rounded border border-border/50 px-1 py-0.5 font-mono text-[10px]">
            Enter
          </kbd>{' '}
          to send ·{' '}
          <kbd className="rounded border border-border/50 px-1 py-0.5 font-mono text-[10px]">
            Shift + Enter
          </kbd>{' '}
          for new line
        </p>
      </div>
    </TooltipProvider>
  );
}
