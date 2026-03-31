import type { SandboxInfo as Sandbox } from '@matanelcohen/openspace-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SandboxList } from '../sandbox-list';

function makeSandbox(id: string, name: string, overrides: Partial<Sandbox> = {}): Sandbox {
  return {
    id,
    name,
    runtime: 'node',
    status: 'running',
    agentId: null,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    image: 'node:20-slim',
    port: 3000,
    resources: { cpuPercent: 10, memoryMb: 128, memoryLimitMb: 512 },
    ...overrides,
  };
}

describe('SandboxList', () => {
  it('shows loading skeleton when isLoading', () => {
    const { container } = render(
      <SandboxList sandboxes={[]} selectedId={null} onSelect={vi.fn()} isLoading />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBe(3);
  });

  it('shows empty state when no sandboxes', () => {
    render(
      <SandboxList sandboxes={[]} selectedId={null} onSelect={vi.fn()} isLoading={false} />,
    );
    expect(screen.getByText('No active sandboxes')).toBeInTheDocument();
    expect(screen.getByText('Create a sandbox to get started')).toBeInTheDocument();
  });

  it('renders sandbox cards when sandboxes exist', () => {
    const sandboxes = [
      makeSandbox('sb-1', 'alpha'),
      makeSandbox('sb-2', 'beta'),
    ];
    render(
      <SandboxList sandboxes={sandboxes} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByTestId('sandbox-list')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('passes selectedId to cards', () => {
    const sandboxes = [makeSandbox('sb-1', 'alpha')];
    const { container } = render(
      <SandboxList sandboxes={sandboxes} selectedId="sb-1" onSelect={vi.fn()} />,
    );
    expect(container.querySelector('.ring-2')).toBeInTheDocument();
  });

  it('calls onSelect when a card is clicked', () => {
    const onSelect = vi.fn();
    const sandbox = makeSandbox('sb-1', 'alpha');
    render(
      <SandboxList sandboxes={[sandbox]} selectedId={null} onSelect={onSelect} />,
    );
    screen.getByTestId('sandbox-card-sb-1').click();
    expect(onSelect).toHaveBeenCalledWith(sandbox);
  });
});
