'use client';

import type { SandboxOutputLine } from '@matanelcohen/openspace-shared';
import { ArrowDown, Eraser } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { AnsiLine } from './ansi-line';

interface TerminalOutputProps {
  lines: SandboxOutputLine[];
  isStreaming?: boolean;
  onClear?: () => void;
  className?: string;
}

/**
 * Terminal-style output viewer with ANSI colour support.
 * Streams output with auto-scroll that respects manual scroll position.
 */
export function TerminalOutput({ lines, isStreaming, onClear, className }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const isNearBottom = useRef(true);

  // Track whether user has scrolled away from the bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const threshold = 40; // px
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isNearBottom.current = atBottom;
    setAutoScroll(atBottom);
  }, []);

  // Auto-scroll on new lines when near bottom
  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines, autoScroll]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  return (
    <div className={cn('relative flex flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">Terminal Output</span>
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              streaming
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground/70">
            {lines.length.toLocaleString()} lines
          </span>
          {onClear && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClear}
              data-testid="terminal-clear"
            >
              <Eraser className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-[#1e1e1e] p-3 font-mono text-xs leading-5 text-[#d4d4d4]"
        data-testid="terminal-output"
      >
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[#666]">
            <span>No output yet. Run a command to get started.</span>
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.index}
              className={cn(
                'whitespace-pre-wrap break-all',
                line.stream === 'stderr' && 'text-red-400',
              )}
            >
              <AnsiLine text={line.text} />
            </div>
          ))
        )}
        {isStreaming && (
          <span className="inline-block h-4 w-1.5 bg-[#d4d4d4] animate-terminal-blink" />
        )}
      </div>

      {/* Scroll-to-bottom FAB */}
      {!autoScroll && lines.length > 0 && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 h-8 w-8 rounded-full shadow-lg"
          onClick={scrollToBottom}
          data-testid="terminal-scroll-bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
