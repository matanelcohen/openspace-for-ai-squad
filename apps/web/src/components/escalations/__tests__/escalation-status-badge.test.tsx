import type { EscalationStatus } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EscalationStatusBadge } from '../escalation-status-badge';

describe('EscalationStatusBadge', () => {
  const statuses: { status: EscalationStatus; label: string }[] = [
    { status: 'pending', label: 'Pending' },
    { status: 'claimed', label: 'In Review' },
    { status: 'approved', label: 'Approved' },
    { status: 'rejected', label: 'Rejected' },
    { status: 'timed_out', label: 'Timed Out' },
    { status: 'auto_escalated', label: 'Auto-Escalated' },
  ];

  it.each(statuses)('renders "$label" for status "$status"', ({ status, label }) => {
    render(<EscalationStatusBadge status={status} />);
    expect(screen.getByTestId('escalation-status-badge')).toHaveTextContent(label);
  });

  it('has correct data-testid', () => {
    render(<EscalationStatusBadge status="pending" />);
    expect(screen.getByTestId('escalation-status-badge')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<EscalationStatusBadge status="pending" className="extra-class" />);
    expect(screen.getByTestId('escalation-status-badge').className).toContain('extra-class');
  });

  it('renders an icon inside the badge', () => {
    render(<EscalationStatusBadge status="approved" />);
    const badge = screen.getByTestId('escalation-status-badge');
    expect(badge.querySelector('svg')).toBeTruthy();
  });
});
