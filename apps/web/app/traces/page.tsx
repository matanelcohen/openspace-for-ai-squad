'use client';

import { useState } from 'react';

import { TraceList } from '@/components/traces/trace-list';
import { TraceStatsView } from '@/components/traces/trace-stats';
import { cn } from '@/lib/utils';

type Tab = 'traces' | 'stats';

export default function TracesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('traces');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Traces</h1>
        <p className="text-muted-foreground">Monitor agent runs, latency, costs, and errors.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {[
          { key: 'traces' as Tab, label: 'Trace List' },
          { key: 'stats' as Tab, label: 'Statistics' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'traces' ? <TraceList /> : <TraceStatsView />}
    </div>
  );
}
