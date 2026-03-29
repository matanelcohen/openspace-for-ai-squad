'use client';

import { GitBranch, Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGitHubIssues, useGitHubPRs, useSyncIssues } from '@/hooks/use-github';
import { useTasks } from '@/hooks/use-tasks';

export default function GitHubPage() {
  const { data: issues, isLoading: issuesLoading, error: issuesError } = useGitHubIssues();
  const { data: prs, isLoading: prsLoading } = useGitHubPRs();
  const { data: tasks } = useTasks();
  const syncIssues = useSyncIssues();

  // Determine which issue numbers already have linked tasks
  const linkedIssueNumbers = new Set(
    tasks
      ?.flatMap((t) =>
        t.labels
          .filter((l) => l.startsWith('github-issue:'))
          .map((l) => Number(l.split(':')[1])),
      ) ?? [],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-6 w-6" />
          <h1 className="text-2xl font-bold tracking-tight">GitHub</h1>
        </div>
        <Button
          onClick={() => syncIssues.mutate()}
          disabled={syncIssues.isPending}
          data-testid="sync-issues-btn"
        >
          {syncIssues.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {syncIssues.isPending ? 'Syncing…' : 'Sync Issues to Tasks'}
        </Button>
      </div>

      {syncIssues.isSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          ✅ Synced {syncIssues.data.synced} issue(s) as new tasks.
        </div>
      )}

      {syncIssues.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          ❌ Sync failed: {(syncIssues.error as Error).message}
        </div>
      )}

      {/* Issues Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Open Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {issuesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : issuesError ? (
            <p className="text-sm text-muted-foreground">
              Could not load issues. Make sure <code>gh</code> CLI is installed and the repo has a
              remote.
            </p>
          ) : issues && issues.length > 0 ? (
            <div className="divide-y">
              {issues.map((issue) => (
                <div
                  key={issue.number}
                  className="flex items-center justify-between py-3"
                  data-testid={`issue-${issue.number}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      #{issue.number}
                    </span>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline"
                    >
                      {issue.title}
                    </a>
                    {issue.labels.map((l) => (
                      <Badge key={l.name} variant="outline" className="text-xs">
                        {l.name}
                      </Badge>
                    ))}
                  </div>
                  {linkedIssueNumbers.has(issue.number) ? (
                    <Badge variant="secondary" className="text-xs">
                      Linked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Not linked
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No open issues found.</p>
          )}
        </CardContent>
      </Card>

      {/* PRs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Open Pull Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {prsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : prs && prs.length > 0 ? (
            <div className="divide-y">
              {prs.map((pr) => (
                <div
                  key={pr.number}
                  className="flex items-center justify-between py-3"
                  data-testid={`pr-${pr.number}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">#{pr.number}</span>
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline"
                    >
                      {pr.title}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {pr.head.ref} → {pr.base.ref}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No open pull requests.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
