'use client';

import { ClipboardList, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { WsEnvelope } from '@/hooks/use-websocket';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────

interface TaskSuggestionData {
  title: string;
  assignee: string | null;
  originalMessage: string;
  sender: string;
  messageId: string;
}

// ── Auto-dismiss timeout ────────────────────────────────────────────

const AUTO_DISMISS_MS = 15_000;

// ── Component ───────────────────────────────────────────────────────

export function TaskSuggestion() {
  const [suggestion, setSuggestion] = useState<TaskSuggestionData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [exiting, setExiting] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setExiting(true);
    setTimeout(() => {
      setSuggestion(null);
      setExiting(false);
    }, 200);
  }, [clearTimer]);

  const startDismissTimer = useCallback(() => {
    clearTimer();
    dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  }, [clearTimer, dismiss]);

  // Listen for task:suggestion events
  useWsEvent(
    'task:suggestion',
    useCallback(
      (envelope: WsEnvelope) => {
        const data = envelope.payload as unknown as TaskSuggestionData;
        if (!data?.title) return;
        setSuggestion(data);
        setExiting(false);
        startDismissTimer();
      },
      [startDismissTimer],
    ),
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const handleCreate = async () => {
    if (!suggestion) return;
    setIsCreating(true);
    try {
      await api.post('/api/tasks', {
        title: suggestion.title,
        assignee: suggestion.assignee,
        status: 'backlog',
      });
      dismiss();
    } catch (err) {
      console.error('[TaskSuggestion] Failed to create task:', err);
    } finally {
      setIsCreating(false);
    }
  };

  if (!suggestion) return null;

  return (
    <Card
      className={cn(
        'mx-4 mb-2 border-primary/20 bg-primary/5 transition-all duration-200',
        exiting && 'opacity-0 translate-y-1',
      )}
      data-testid="task-suggestion"
    >
      <div className="flex items-center gap-2 p-2.5">
        <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 text-xs">
          <span className="text-muted-foreground">Create task? </span>
          <span className="font-medium">&ldquo;{suggestion.title}&rdquo;</span>
          {suggestion.assignee && (
            <span className="text-muted-foreground">
              {' '}→ Assign to{' '}
              <span className="font-medium text-foreground">{suggestion.assignee}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-xs"
            onClick={handleCreate}
            disabled={isCreating}
            data-testid="task-suggestion-create"
          >
            {isCreating ? 'Creating…' : 'Create Task'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={dismiss}
            data-testid="task-suggestion-dismiss"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
