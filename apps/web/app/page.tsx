import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your squad at a glance.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Active Agents</CardDescription>
            <CardTitle>&mdash;</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting backend connection</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Open Tasks</CardDescription>
            <CardTitle>&mdash;</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting backend connection</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Decisions</CardDescription>
            <CardTitle>&mdash;</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting backend connection</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Squad Health</CardDescription>
            <CardTitle>&mdash;</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting backend connection</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
