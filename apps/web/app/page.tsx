import { AgentGrid } from '@/components/dashboard/agent-grid';
import { SummaryStats } from '@/components/dashboard/summary-stats';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your squad at a glance.</p>
      </div>
      <SummaryStats />
      <div>
        <h2 className="mb-4 text-xl font-semibold">Squad Members</h2>
        <AgentGrid />
      </div>
    </div>
  );
}
