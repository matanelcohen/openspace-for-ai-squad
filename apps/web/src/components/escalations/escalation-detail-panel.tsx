'use client';

import type { EscalationItem } from '@matanelcohen/openspace-shared';
import { ArrowLeft, CheckCircle, MessageSquare, Shield, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AuditTrailTimeline } from '@/components/escalations/audit-trail-timeline';
import { ConfidenceBadge } from '@/components/escalations/confidence-badge';
import { EscalationStatusBadge } from '@/components/escalations/escalation-status-badge';
import { PriorityIndicator } from '@/components/escalations/priority-indicator';
import { ProposedActionDiff } from '@/components/escalations/proposed-action-diff';
import { SlaCountdown } from '@/components/escalations/sla-countdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  useApproveEscalation,
  useClaimEscalation,
  useRejectEscalation,
  useRequestChangesEscalation,
} from '@/hooks/use-escalation-actions';

interface EscalationDetailPanelProps {
  escalation: EscalationItem;
}

export function EscalationDetailPanel({ escalation }: EscalationDetailPanelProps) {
  const [comment, setComment] = useState('');
  const claim = useClaimEscalation();
  const approve = useApproveEscalation();
  const reject = useRejectEscalation();
  const requestChanges = useRequestChangesEscalation();

  const isPending =
    claim.isPending || approve.isPending || reject.isPending || requestChanges.isPending;

  const canAct = escalation.status === 'pending' || escalation.status === 'claimed';
  const needsClaim = escalation.status === 'pending';

  const handleClaim = () => claim.mutate(escalation.id);
  const handleApprove = () => {
    approve.mutate({ id: escalation.id, comment });
    setComment('');
  };
  const handleReject = () => {
    reject.mutate({ id: escalation.id, comment });
    setComment('');
  };
  const handleRequestChanges = () => {
    requestChanges.mutate({ id: escalation.id, comment });
    setComment('');
  };

  return (
    <div className="space-y-6" data-testid="escalation-detail-panel">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Link href="/escalations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Queue
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Escalation</h1>
            <EscalationStatusBadge status={escalation.status} />
          </div>
          <p className="text-sm text-muted-foreground font-mono">{escalation.id}</p>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityIndicator priority={escalation.priority} />
            <ConfidenceBadge score={escalation.context.confidenceScore} />
            {canAct && <SlaCountdown timeoutAt={escalation.timeoutAt} />}
          </div>
        </div>

        {/* Claim button */}
        {needsClaim && (
          <Button onClick={handleClaim} disabled={isPending} data-testid="claim-btn">
            <Shield className="mr-1.5 h-4 w-4" />
            {claim.isPending ? 'Claiming…' : 'Claim for Review'}
          </Button>
        )}
      </div>

      {/* Context cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agent context */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agent</span>
              <span className="font-medium">{escalation.context.agentId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reason</span>
              <span className="capitalize">{escalation.reason.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Workflow</span>
              <span className="font-mono text-xs">{escalation.context.workflowId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source Node</span>
              <span className="font-mono text-xs">{escalation.context.sourceNodeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chain Level</span>
              <span>{escalation.currentLevel}</span>
            </div>
            {escalation.claimedBy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reviewer</span>
                <span className="font-medium">{escalation.claimedBy}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(escalation.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{new Date(escalation.updatedAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SLA Deadline</span>
              <span>{new Date(escalation.timeoutAt).toLocaleString()}</span>
            </div>
            {escalation.claimedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Claimed At</span>
                <span>{new Date(escalation.claimedAt).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Proposed action diff */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposed Action & Reasoning</CardTitle>
        </CardHeader>
        <CardContent>
          <ProposedActionDiff
            proposedAction={escalation.context.proposedAction}
            reasoning={escalation.context.reasoning}
          />
        </CardContent>
      </Card>

      {/* Review comment */}
      {escalation.reviewComment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Comment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{escalation.reviewComment}</p>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {canAct && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="review-comment" className="text-sm font-medium">
                <MessageSquare className="mr-1.5 inline h-3.5 w-3.5" />
                Comment
              </label>
              <Textarea
                id="review-comment"
                placeholder="Add a review comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="review-comment"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleApprove}
                disabled={isPending}
                data-testid="approve-btn"
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                {approve.isPending ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isPending}
                data-testid="reject-btn"
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                {reject.isPending ? 'Rejecting…' : 'Reject'}
              </Button>
              <Button
                variant="outline"
                onClick={handleRequestChanges}
                disabled={isPending}
                data-testid="request-changes-btn"
              >
                <MessageSquare className="mr-1.5 h-4 w-4" />
                {requestChanges.isPending ? 'Requesting…' : 'Request Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit trail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTrailTimeline entries={escalation.auditTrail} />
        </CardContent>
      </Card>
    </div>
  );
}
