// @ts-nocheck
'use client';

import { CornerDownLeft } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CommandInputProps {
  onSubmit: (command: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const MAX_HISTORY = 50;

export function CommandInput({
  onSubmit,
  disabled,
  placeholder = '$ enter command…',
  className,
}: CommandInputProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    onSubmit(trimmed);
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)];
      return next.slice(0, MAX_HISTORY);
    });
    setValue('');
    setHistoryIndex(-1);
  }, [value, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length === 0) return;
        const nextIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(nextIndex);
        setValue(history[nextIndex] ?? '');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setValue('');
        } else {
          const nextIndex = historyIndex - 1;
          setHistoryIndex(nextIndex);
          setValue(history[nextIndex] ?? '');
        }
      }
    },
    [submit, history, historyIndex],
  );

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span className="select-none text-muted-foreground">$</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setHistoryIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60"
        data-testid="command-input"
        autoComplete="off"
        spellCheck={false}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={submit}
        disabled={disabled || !value.trim()}
        data-testid="command-submit"
      >
        <CornerDownLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}
