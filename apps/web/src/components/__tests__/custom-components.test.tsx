import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { StatusBadge } from '@/components/status-badge';

describe('StatusBadge', () => {
  it('renders active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders idle status', () => {
    render(<StatusBadge status="idle" />);
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('renders spawned status', () => {
    render(<StatusBadge status="spawned" />);
    expect(screen.getByText('Spawned')).toBeInTheDocument();
  });

  it('renders failed status', () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('applies green styling for active', () => {
    const { container } = render(<StatusBadge status="active" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-green');
  });

  it('applies red styling for failed', () => {
    const { container } = render(<StatusBadge status="failed" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-red');
  });
});

describe('PriorityBadge', () => {
  it('renders P0 with Critical label', () => {
    render(<PriorityBadge priority="P0" />);
    expect(screen.getByText('P0 — Critical')).toBeInTheDocument();
  });

  it('renders P1 with High label', () => {
    render(<PriorityBadge priority="P1" />);
    expect(screen.getByText('P1 — High')).toBeInTheDocument();
  });

  it('renders P2 with Medium label', () => {
    render(<PriorityBadge priority="P2" />);
    expect(screen.getByText('P2 — Medium')).toBeInTheDocument();
  });

  it('renders P3 with Low label', () => {
    render(<PriorityBadge priority="P3" />);
    expect(screen.getByText('P3 — Low')).toBeInTheDocument();
  });

  it('applies red styling for P0', () => {
    const { container } = render(<PriorityBadge priority="P0" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-red');
  });

  it('applies custom className', () => {
    const { container } = render(<PriorityBadge priority="P0" className="custom" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('custom');
  });
});

describe('AgentAvatar', () => {
  it('renders emoji for known agents', () => {
    render(<AgentAvatar agentId="leela" name="Leela" />);
    expect(screen.getByText('👁️')).toBeInTheDocument();
  });

  it('renders emoji for bender', () => {
    render(<AgentAvatar agentId="bender" name="Bender" />);
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('renders initials for unknown agents', () => {
    render(<AgentAvatar agentId="unknown" name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('supports different sizes', () => {
    const { container: sm } = render(<AgentAvatar agentId="fry" name="Fry" size="sm" />);
    expect((sm.firstChild as HTMLElement).className).toContain('h-7');

    const { container: lg } = render(<AgentAvatar agentId="fry" name="Fry" size="lg" />);
    expect((lg.firstChild as HTMLElement).className).toContain('h-14');
  });

  it('applies custom className', () => {
    const { container } = render(
      <AgentAvatar agentId="fry" name="Fry" className="my-class" />,
    );
    expect((container.firstChild as HTMLElement).className).toContain('my-class');
  });
});
