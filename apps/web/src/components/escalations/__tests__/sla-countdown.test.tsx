import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlaCountdown } from '../sla-countdown';

describe('SlaCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the data-testid', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    expect(screen.getByTestId('sla-countdown')).toBeInTheDocument();
  });

  it('shows hours and minutes for > 1h remaining', () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    expect(screen.getByTestId('sla-countdown')).toHaveTextContent('2h 30m');
  });

  it('shows minutes and seconds for < 1h remaining', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000 + 15 * 1000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    expect(screen.getByTestId('sla-countdown')).toHaveTextContent('10m 15s');
  });

  it('shows seconds only for < 1m remaining', () => {
    const future = new Date(Date.now() + 45 * 1000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    expect(screen.getByTestId('sla-countdown')).toHaveTextContent('45s');
  });

  it('shows "Expired" for past timeout', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    render(<SlaCountdown timeoutAt={past} />);
    expect(screen.getByTestId('sla-countdown')).toHaveTextContent('Expired');
  });

  it('applies red urgency class for < 5 minutes', () => {
    const future = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    expect(screen.getByTestId('sla-countdown').className).toContain('text-red');
  });

  it('applies orange urgency class for < 15 minutes', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    expect(screen.getByTestId('sla-countdown').className).toContain('text-orange');
  });

  it('applies yellow urgency class for < 1 hour', () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    expect(screen.getByTestId('sla-countdown').className).toContain('text-yellow');
  });

  it('applies pulse animation when expired', () => {
    const past = new Date(Date.now() - 5000).toISOString();
    render(<SlaCountdown timeoutAt={past} />);
    expect(screen.getByTestId('sla-countdown').className).toContain('animate-pulse');
  });

  it('counts down over time', () => {
    const future = new Date(Date.now() + 65 * 1000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    expect(screen.getByTestId('sla-countdown')).toHaveTextContent('1m');

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByTestId('sla-countdown')).toHaveTextContent('59s');
  });

  it('applies custom className', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    render(<SlaCountdown timeoutAt={future} className="test-cls" />);
    expect(screen.getByTestId('sla-countdown').className).toContain('test-cls');
  });

  it('stores remaining ms in data-remaining', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    render(<SlaCountdown timeoutAt={future} />);
    const remaining = Number(screen.getByTestId('sla-countdown').getAttribute('data-remaining'));
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(60000);
  });
});
