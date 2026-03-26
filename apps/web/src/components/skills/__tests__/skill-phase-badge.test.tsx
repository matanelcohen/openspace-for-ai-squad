import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SkillPhaseBadge } from '../skill-phase-badge';

describe('SkillPhaseBadge', () => {
  it('renders "Active" label for active phase', () => {
    render(<SkillPhaseBadge phase="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByTestId('skill-phase-active')).toBeInTheDocument();
  });

  it('renders "Loaded" label for loaded phase', () => {
    render(<SkillPhaseBadge phase="loaded" />);
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });

  it('renders "Validated" label for validated phase', () => {
    render(<SkillPhaseBadge phase="validated" />);
    expect(screen.getByText('Validated')).toBeInTheDocument();
  });

  it('renders "Discovered" label for discovered phase', () => {
    render(<SkillPhaseBadge phase="discovered" />);
    expect(screen.getByText('Discovered')).toBeInTheDocument();
  });

  it('renders "Inactive" label for deactivated phase', () => {
    render(<SkillPhaseBadge phase="deactivated" />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders "Error" label for error phase', () => {
    render(<SkillPhaseBadge phase="error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('applies green styling for active phase', () => {
    render(<SkillPhaseBadge phase="active" />);
    const badge = screen.getByTestId('skill-phase-active');
    expect(badge.className).toMatch(/green/);
  });

  it('applies red styling for error phase', () => {
    render(<SkillPhaseBadge phase="error" />);
    const badge = screen.getByTestId('skill-phase-error');
    expect(badge.className).toMatch(/red/);
  });

  it('applies custom className', () => {
    render(<SkillPhaseBadge phase="active" className="ml-2" />);
    const badge = screen.getByTestId('skill-phase-active');
    expect(badge).toHaveClass('ml-2');
  });
});
