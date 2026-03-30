'use client';

import { CheckCircle, MessageSquare, XCircle } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBulkApproveEscalations, useBulkRejectEscalations } from '@/hooks/use-escalation-actions';

type BulkAction = 'approve' | 'reject' | null;

interface BulkActionToolbarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

export function BulkActionToolbar({ selectedIds, onClearSelection }: BulkActionToolbarProps) {
  const [action, setAction] = useState<BulkAction>(null);
  const [comment, setComment] = useState('');

  const bulkApprove = useBulkApproveEscalations();
  const bulkReject = useBulkRejectEscalations();

  const count = selectedIds.size;
  if (count === 0) return null;

  const handleConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (action === 'approve') {
      await bulkApprove.mutateAsync({ ids, comment });
    } else if (action === 'reject') {
      await bulkReject.mutateAsync({ ids, comment });
    }
    setAction(null);
    setComment('');
    onClearSelection();
  };

  const isPending = bulkApprove.isPending || bulkReject.isPending;

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3"
        data-testid="bulk-action-toolbar"
      >
        <span className="text-sm font-medium">
          {count} selected
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAction('approve')}
          disabled={isPending}
          data-testid="bulk-approve-btn"
        >
          <CheckCircle className="mr-1.5 h-4 w-4 text-green-600" />
          Approve All
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAction('reject')}
          disabled={isPending}
          data-testid="bulk-reject-btn"
        >
          <XCircle className="mr-1.5 h-4 w-4 text-red-600" />
          Reject All
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          data-testid="clear-selection-btn"
        >
          Clear
        </Button>
      </div>

      <AlertDialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'approve' ? 'Bulk Approve' : 'Bulk Reject'} {count} Escalation{count !== 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === 'approve'
                ? `This will approve ${count} escalation(s) and allow the proposed actions to proceed.`
                : `This will reject ${count} escalation(s) and block the proposed actions.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium" htmlFor="bulk-comment">
              <MessageSquare className="mr-1.5 inline h-3.5 w-3.5" />
              Comment (optional)
            </label>
            <Textarea
              id="bulk-comment"
              placeholder="Add a comment for all selected escalations…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-2"
              rows={3}
              data-testid="bulk-comment"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending}
              className={
                action === 'reject'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
              data-testid="bulk-confirm-btn"
            >
              {isPending ? 'Processing…' : action === 'approve' ? 'Approve All' : 'Reject All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
