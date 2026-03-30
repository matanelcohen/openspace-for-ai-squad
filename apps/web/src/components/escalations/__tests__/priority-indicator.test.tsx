import type { EscalationPriority } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PriorityIndicator } from '../priority-indicator';

describe('PriorityIndicator', () => {
  const priorities: { priority: EscalationPriority; label: string; colorHint: string }[] = [
    { priority: 'critical', label: 'Critical', colorHint: 'red' },
    { priority: 'high', label: 'High', colorHint: 'orange' },
    { priority: 'medium', label: 'Medium', colorHint: 'yellow' },
    { priority: 'low', label: 'Low', colorHint: 'blue' },
  ];

  it.each(priorities)('renders "$label" for priority "$priority"', ({ priority, label }) => {
    render(<PriorityIndicator priority={priority} />);
    expect(screen.getByTestId('priority-indicator')).toHaveTextContent(label);
  });

  it.each(priorities)(
    'applies $colorHint color class for "$priority"',
    ({ priority, colorHint }) => {
      render(<PriorityIndicator priority={priority} />);
      expect(screen.getByTestId('priority-indicator').className).toContain(colorHint);
    },
  );

  it('renders an icon', () => {
    render(<PriorityIndicator priority="critical" />);
    expect(screen.getByTestId('priority-indicator').querySelector('svg')).toBeTruthy();
  });

  it('accepts custom className', () => {
    render(<PriorityIndicator priority="high" className="test-cls" />);
    expect(screen.getByTestId('priority-indicator').className).toContain('test-cls');
  });
});
