import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConfidenceBadge } from '../confidence-badge';

describe('ConfidenceBadge', () => {
  it('renders percentage from score', () => {
    render(<ConfidenceBadge score={0.85} />);
    expect(screen.getByTestId('confidence-badge')).toHaveTextContent('85%');
  });

  it('rounds to nearest integer', () => {
    render(<ConfidenceBadge score={0.666} />);
    expect(screen.getByTestId('confidence-badge')).toHaveTextContent('67%');
  });

  it('applies green color for high confidence (≥0.8)', () => {
    render(<ConfidenceBadge score={0.9} />);
    const badge = screen.getByTestId('confidence-badge');
    expect(badge.className).toContain('text-green');
  });

  it('applies yellow color for medium confidence (0.5–0.79)', () => {
    render(<ConfidenceBadge score={0.6} />);
    const badge = screen.getByTestId('confidence-badge');
    expect(badge.className).toContain('text-yellow');
  });

  it('applies red color for low confidence (<0.5)', () => {
    render(<ConfidenceBadge score={0.3} />);
    const badge = screen.getByTestId('confidence-badge');
    expect(badge.className).toContain('text-red');
  });

  it('renders SVG circle progress indicator', () => {
    render(<ConfidenceBadge score={0.75} />);
    const badge = screen.getByTestId('confidence-badge');
    expect(badge.querySelector('svg')).toBeTruthy();
    expect(badge.querySelectorAll('circle').length).toBe(2);
  });

  it('applies custom className', () => {
    render(<ConfidenceBadge score={0.5} className="my-class" />);
    expect(screen.getByTestId('confidence-badge').className).toContain('my-class');
  });
});
