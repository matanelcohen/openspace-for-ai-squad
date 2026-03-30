'use client';

import { useParams, useRouter } from 'next/navigation';

import { SandboxIde } from '@/components/sandbox/sandbox-ide';
import { useSandbox } from '@/hooks/use-sandboxes';

export default function SandboxDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sandboxId = params.id as string;
  const { data: sandbox, isLoading, error } = useSandbox(sandboxId);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" />
          <p className="text-sm">Loading sandbox…</p>
        </div>
      </div>
    );
  }

  if (error || !sandbox) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Sandbox not found</p>
          <button
            onClick={() => router.push('/sandboxes')}
            className="mt-2 text-xs text-primary underline"
          >
            Back to sandboxes
          </button>
        </div>
      </div>
    );
  }

  return <SandboxIde sandbox={sandbox} className="h-[calc(100vh-64px)]" />;
}
