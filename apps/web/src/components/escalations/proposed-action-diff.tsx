interface ProposedActionDiffProps {
  proposedAction: string;
  reasoning: string;
}

export function ProposedActionDiff({ proposedAction, reasoning }: ProposedActionDiffProps) {
  return (
    <div className="space-y-4" data-testid="proposed-action-diff">
      <div>
        <h4 className="text-sm font-semibold mb-2">Proposed Action</h4>
        <div className="rounded-md border bg-muted/50 p-4">
          <pre className="text-sm whitespace-pre-wrap font-mono">{proposedAction}</pre>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2">Agent Reasoning</h4>
        <div className="rounded-md border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reasoning}</p>
        </div>
      </div>
    </div>
  );
}
