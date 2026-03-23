'use client';

import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
