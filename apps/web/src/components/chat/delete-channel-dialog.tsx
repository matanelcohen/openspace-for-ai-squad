'use client';

import type { ChatChannel } from '@matanelcohen/openspace-shared';

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

interface DeleteChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChatChannel | null;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteChannelDialog({
  open,
  onOpenChange,
  channel,
  onConfirm,
  isDeleting,
}: DeleteChannelDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="delete-channel-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete channel</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>&ldquo;{channel?.name}&rdquo;</strong>? This
            will permanently remove the channel and all its messages. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} data-testid="delete-channel-cancel">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            data-testid="delete-channel-confirm"
          >
            {isDeleting ? 'Deleting…' : 'Delete Channel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
