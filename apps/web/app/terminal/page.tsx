'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

import { ErrorBoundary } from '@/components/error-boundary';

function TerminalLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading terminal…</span>
      </div>
    </div>
  );
}

function TerminalErrorFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3 text-red-400">
        <p className="text-sm">Failed to load terminal component.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

// xterm.js requires DOM APIs — load client-side only
const Terminal = dynamic(() => import('@/components/terminal/terminal').then((m) => m.Terminal), {
  ssr: false,
  loading: () => <TerminalLoadingFallback />,
  error: () => <TerminalErrorFallback />,
});

export default function TerminalPage() {
  return (
    <ErrorBoundary>
      <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col md:-m-6">
        <Terminal />
      </div>
    </ErrorBoundary>
  );
}
