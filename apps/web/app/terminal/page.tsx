'use client';

import dynamic from 'next/dynamic';

// xterm.js requires DOM APIs — load client-side only
const Terminal = dynamic(
  () => import('@/components/terminal/terminal').then((m) => m.Terminal),
  { ssr: false },
);

export default function TerminalPage() {
  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col md:-m-6">
      <Terminal />
    </div>
  );
}
