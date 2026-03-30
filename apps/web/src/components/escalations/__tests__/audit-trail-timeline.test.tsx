import type { AuditEntry } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuditTrailTimeline } from '../audit-trail-timeline';

describe('AuditTrailTimeline', () => {
  const entries: AuditEntry[] = [
    {
      id: 'a1',
      escalationId: 'esc-1',
      action: 'created',
      actor: 'system',
      timestamp: '2026-03-29T10:00:00Z',
      details: 'Escalation triggered by low confidence',
    },
    {
      id: 'a2',
      escalationId: 'esc-1',
      action: 'claimed',
      actor: 'reviewer-1',
      timestamp: '2026-03-29T10:05:00Z',
    },
    {
      id: 'a3',
      escalationId: 'esc-1',
      action: 'approved',
      actor: 'reviewer-1',
      timestamp: '2026-03-29T10:10:00Z',
      details: 'Looks good, approved.',
      previousStatus: 'claimed',
      newStatus: 'approved',
    },
  ];

  it('renders the timeline container', () => {
    render(<AuditTrailTimeline entries={entries} />);
    expect(screen.getByTestId('audit-trail-timeline')).toBeInTheDocument();
  });

  it('renders all entries', () => {
    render(<AuditTrailTimeline entries={entries} />);
    expect(screen.getByTestId('audit-entry-a1')).toBeInTheDocument();
    expect(screen.getByTestId('audit-entry-a2')).toBeInTheDocument();
    expect(screen.getByTestId('audit-entry-a3')).toBeInTheDocument();
  });

  it('shows formatted action labels', () => {
    render(<AuditTrailTimeline entries={entries} />);
    expect(screen.getByText('Escalation created')).toBeInTheDocument();
    expect(screen.getByText('Claimed for review')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('shows actor names', () => {
    render(<AuditTrailTimeline entries={entries} />);
    expect(screen.getByText('system')).toBeInTheDocument();
    // reviewer-1 appears twice (claimed + approved)
    expect(screen.getAllByText('reviewer-1').length).toBe(2);
  });

  it('shows detail text when present', () => {
    render(<AuditTrailTimeline entries={entries} />);
    expect(screen.getByText('Escalation triggered by low confidence')).toBeInTheDocument();
    expect(screen.getByText('Looks good, approved.')).toBeInTheDocument();
  });

  it('sorts entries newest-first', () => {
    render(<AuditTrailTimeline entries={entries} />);
    const allEntries = screen.getByTestId('audit-trail-timeline').children;
    // First child should be the newest (approved)
    expect(allEntries[0]).toHaveAttribute('data-testid', 'audit-entry-a3');
    expect(allEntries[2]).toHaveAttribute('data-testid', 'audit-entry-a1');
  });

  it('renders empty message when no entries', () => {
    render(<AuditTrailTimeline entries={[]} />);
    expect(screen.getByTestId('audit-trail-empty')).toBeInTheDocument();
    expect(screen.getByText('No audit trail entries.')).toBeInTheDocument();
  });

  it('renders icons for each entry', () => {
    render(<AuditTrailTimeline entries={entries} />);
    const timeline = screen.getByTestId('audit-trail-timeline');
    const svgs = timeline.querySelectorAll('svg');
    expect(svgs.length).toBe(3);
  });

  it('handles timed_out action', () => {
    const timedOutEntry: AuditEntry = {
      id: 'a4',
      escalationId: 'esc-1',
      action: 'timed_out',
      actor: 'system',
      timestamp: '2026-03-29T11:00:00Z',
    };
    render(<AuditTrailTimeline entries={[timedOutEntry]} />);
    expect(screen.getByText('Timed out')).toBeInTheDocument();
  });

  it('handles auto_escalated action', () => {
    const autoEntry: AuditEntry = {
      id: 'a5',
      escalationId: 'esc-1',
      action: 'auto_escalated',
      actor: 'system',
      timestamp: '2026-03-29T11:00:00Z',
    };
    render(<AuditTrailTimeline entries={[autoEntry]} />);
    expect(screen.getByText('Auto-escalated to next level')).toBeInTheDocument();
  });

  it('handles context_updated action', () => {
    const entry: AuditEntry = {
      id: 'a6',
      escalationId: 'esc-1',
      action: 'context_updated',
      actor: 'agent-fry',
      timestamp: '2026-03-29T11:00:00Z',
    };
    render(<AuditTrailTimeline entries={[entry]} />);
    expect(screen.getByText('Context updated')).toBeInTheDocument();
  });

  it('handles level_changed action', () => {
    const entry: AuditEntry = {
      id: 'a7',
      escalationId: 'esc-1',
      action: 'level_changed',
      actor: 'system',
      timestamp: '2026-03-29T11:00:00Z',
    };
    render(<AuditTrailTimeline entries={[entry]} />);
    expect(screen.getByText('Escalation level changed')).toBeInTheDocument();
  });
});
