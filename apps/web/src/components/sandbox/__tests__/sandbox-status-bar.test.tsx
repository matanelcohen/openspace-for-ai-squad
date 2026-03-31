import type { Sandbox } from '@matanelcohen/openspace-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SandboxStatusBar } from '../sandbox-status-bar';

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
    resources: { cpuPercent: 45.3, memoryMb: 256, memoryLimitMb: 512 },
    ...overrides,
  };
}

describe('SandboxStatusBar', () => {
  it('renders the status bar', () => {
    render(<SandboxStatusBar sandbox={makeSandbox()} />);
    expect(screen.getByTestId('sandbox-status-bar')).toBeInTheDocument();
  });

  it('shows status text', () => {
    render(<SandboxStatusBar sandbox={makeSandbox({ status: 'running' })} />);
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('shows image name', () => {
    render(<SandboxStatusBar sandbox={makeSandbox({ image: 'python:3.12' })} />);
    expect(screen.getByText('python:3.12')).toBeInTheDocument();
  });

  it('shows CPU and memory for running sandbox', () => {
    render(<SandboxStatusBar sandbox={makeSandbox()} />);
    expect(screen.getByText('45.3%')).toBeInTheDocument();
    expect(screen.getByText('256/512MB (50%)')).toBeInTheDocument();
  });

  it('hides CPU and memory for stopped sandbox', () => {
    render(<SandboxStatusBar sandbox={makeSandbox({ status: 'stopped' })} />);
    expect(screen.queryByText(/CPU/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MB/)).not.toBeInTheDocument();
  });

  it('shows agent badge when agentId is present', () => {
    render(<SandboxStatusBar sandbox={makeSandbox({ agentId: 'bender' })} />);
    expect(screen.getByText('bender')).toBeInTheDocument();
  });

  it('hides agent badge when agentId is null', () => {
    render(<SandboxStatusBar sandbox={makeSandbox({ agentId: null })} />);
    expect(screen.queryByText(/agent/i)).not.toBeInTheDocument();
  });

  it('computes memory percentage correctly', () => {
    render(
      <SandboxStatusBar
        sandbox={makeSandbox({
          resources: { cpuPercent: 10, memoryMb: 100, memoryLimitMb: 400 },
        })}
      />,
    );
    expect(screen.getByText('100/400MB (25%)')).toBeInTheDocument();
  });

  it('handles zero memory limit gracefully', () => {
    render(
      <SandboxStatusBar
        sandbox={makeSandbox({
          resources: { cpuPercent: 0, memoryMb: 0, memoryLimitMb: 0 },
        })}
      />,
    );
    expect(screen.getByText('0/0MB (0%)')).toBeInTheDocument();
  });
});
