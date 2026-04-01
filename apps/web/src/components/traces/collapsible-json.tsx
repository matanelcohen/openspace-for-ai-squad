'use client';

import { Check, ChevronDown, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLLAPSE_THRESHOLD = 600; // chars
const COLLAPSED_LINES = 8;

function highlightJson(json: string): string {
  return json
    .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="text-blue-400">$1</span>:')
    .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="text-green-400">$1</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="text-amber-400">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="text-purple-400">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="text-red-400">$1</span>');
}

interface CollapsibleJsonProps {
  data: unknown;
  label?: string;
  maxHeight?: number;
}

export function CollapsibleJson({ data, label, maxHeight }: CollapsibleJsonProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(data, null, 2) ?? 'null';
  const isLarge = json.length > COLLAPSE_THRESHOLD;
  const lines = json.split('\n');
  const displayJson = !isLarge || expanded ? json : lines.slice(0, COLLAPSED_LINES).join('\n');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [json]);

  return (
    <div className="group/json relative rounded-md border border-border/50 bg-muted/30">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-1.5">
        {label && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isLarge && (
            <span className="text-[10px] text-muted-foreground">
              {lines.length} lines · {(json.length / 1024).toFixed(1)}KB
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleCopy}
            title="Copy JSON"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* JSON content */}
      <div
        className={cn('overflow-auto p-3', !expanded && isLarge && 'max-h-[200px]')}
        style={maxHeight && expanded ? { maxHeight } : undefined}
      >
        <pre
          className="whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: highlightJson(displayJson) }}
        />
        {isLarge && !expanded && (
          <div className="pointer-events-none absolute bottom-8 left-0 right-0 h-12 bg-gradient-to-t from-muted/80 to-transparent" />
        )}
      </div>

      {/* Expand/collapse toggle */}
      {isLarge && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-center gap-1 border-t border-border/30 px-3 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'Collapse' : `Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}
