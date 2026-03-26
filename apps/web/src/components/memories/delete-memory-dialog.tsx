'use client';

import type { Memory } from '@openspace/shared';

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

interface DeleteMemoryDialogProps {
  memory: Memory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteMemoryDialog({
  memory,
  open,
  onOpenChange,
  onConfirm,
}: DeleteMemoryDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="delete-memory-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Memory</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this memory? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border bg-muted/50 p-3 text-sm">
          {memory.content.length > 120 ? `${memory.content.slice(0, 120)}…` : memory.content}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel-delete-button">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="confirm-delete-button"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
