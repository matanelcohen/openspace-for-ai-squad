'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { TraceList } from '@/components/traces/trace-list';
import { TraceStatsView } from '@/components/traces/trace-stats';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type Tab = 'traces' | 'stats';

export default function TracesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('traces');
  const [clearing, setClearing] = useState(false);
  const queryClient = useQueryClient();

  const handleClearAll = async () => {
    if (!confirm('Clear all traces? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.delete('/api/traces');
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['trace-stats'] });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Traces</h1>
          <p className="text-muted-foreground">Monitor agent runs, latency, costs, and errors.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={clearing}
          className="gap-1.5 text-muted-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {clearing ? 'Clearing...' : 'Clear All'}
        </Button>
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
