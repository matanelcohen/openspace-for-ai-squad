import type { SandboxInfo as Sandbox } from '@matanelcohen/openspace-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SandboxCard } from '../sandbox-card';

function makeSandbox(overrides: Partial<Sandbox> = {}): Sandbox {
  return {
    id: 'sb-1',
    name: 'test-sandbox',
    runtime: 'node',
    status: 'running',
    agentId: null,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    image: 'node:20-slim',
    port: 3000,
    resources: { cpuPercent: 12.5, memoryMb: 128, memoryLimitMb: 512 },
    ...overrides,
  };
}

describe('SandboxCard', () => {
  it('renders sandbox name', () => {
    render(<SandboxCard sandbox={makeSandbox({ name: 'my-sandbox' })} />);
    expect(screen.getByText('my-sandbox')).toBeInTheDocument();
  });

  it('shows running status badge', () => {
    render(<SandboxCard sandbox={makeSandbox({ status: 'running' })} />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows error status badge', () => {
    render(<SandboxCard sandbox={makeSandbox({ status: 'error' })} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows runtime label', () => {
    render(<SandboxCard sandbox={makeSandbox({ runtime: 'python' })} />);
    expect(screen.getByText(/Python/)).toBeInTheDocument();
  });

  it('shows resource usage for running sandbox', () => {
    render(<SandboxCard sandbox={makeSandbox({ status: 'running' })} />);
    expect(screen.getByText(/13% CPU/)).toBeInTheDocument();
    expect(screen.getByText(/128\/512MB/)).toBeInTheDocument();
  });

  it('hides resource usage for stopped sandbox', () => {
    render(<SandboxCard sandbox={makeSandbox({ status: 'stopped' })} />);
    expect(screen.queryByText(/CPU/)).not.toBeInTheDocument();
  });

  it('shows agent ID when present', () => {
    render(<SandboxCard sandbox={makeSandbox({ agentId: 'agent-42' })} />);
    expect(screen.getByText(/agent-42/)).toBeInTheDocument();
  });

  it('fires onSelect when clicked', () => {
    const onSelect = vi.fn();
    const sandbox = makeSandbox();
    render(<SandboxCard sandbox={sandbox} onSelect={onSelect} />);
    screen.getByTestId('sandbox-card-sb-1').click();
    expect(onSelect).toHaveBeenCalledWith(sandbox);
  });

  it('applies selected ring style', () => {
    const { container } = render(<SandboxCard sandbox={makeSandbox()} isSelected />);
    expect(container.querySelector('.ring-2')).toBeInTheDocument();
  });
});
