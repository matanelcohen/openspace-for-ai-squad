import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SandboxControls } from '../sandbox-controls';

describe('SandboxControls', () => {
  it('renders all three buttons', () => {
    render(
      <SandboxControls
        status="running"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sandbox-run')).toBeInTheDocument();
    expect(screen.getByTestId('sandbox-stop')).toBeInTheDocument();
    expect(screen.getByTestId('sandbox-destroy')).toBeInTheDocument();
  });

  it('enables run and stop when status is running', () => {
    render(
      <SandboxControls
        status="running"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sandbox-run')).not.toBeDisabled();
    expect(screen.getByTestId('sandbox-stop')).not.toBeDisabled();
  });

  it('disables run and stop when status is stopped', () => {
    render(
      <SandboxControls
        status="stopped"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sandbox-run')).toBeDisabled();
    expect(screen.getByTestId('sandbox-stop')).toBeDisabled();
  });

  it('disables destroy when creating', () => {
    render(
      <SandboxControls
        status="creating"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sandbox-destroy')).toBeDisabled();
  });

  it('disables destroy when destroying', () => {
    render(
      <SandboxControls
        status="destroying"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sandbox-destroy')).toBeDisabled();
  });

  it('allows destroy when stopped', () => {
    render(
      <SandboxControls
        status="stopped"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sandbox-destroy')).not.toBeDisabled();
  });

  it('calls onRun when run is clicked', async () => {
    const onRun = vi.fn();
    render(
      <SandboxControls
        status="running"
        onRun={onRun}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByTestId('sandbox-run'));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when stop is clicked', async () => {
    const onStop = vi.fn();
    render(
      <SandboxControls
        status="running"
        onRun={vi.fn()}
        onStop={onStop}
        onDestroy={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByTestId('sandbox-stop'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onDestroy when destroy is clicked', async () => {
    const onDestroy = vi.fn();
    render(
      <SandboxControls
        status="running"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={onDestroy}
      />,
    );
    await userEvent.click(screen.getByTestId('sandbox-destroy'));
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it('disables run when isRunning prop is true', () => {
    render(
      <SandboxControls
        status="running"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
        isRunning
      />,
    );
    expect(screen.getByTestId('sandbox-run')).toBeDisabled();
  });

  it('disables stop when isStopping prop is true', () => {
    render(
      <SandboxControls
        status="running"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
        isStopping
      />,
    );
    expect(screen.getByTestId('sandbox-stop')).toBeDisabled();
  });

  it('disables destroy when isDestroying prop is true', () => {
    render(
      <SandboxControls
        status="running"
        onRun={vi.fn()}
        onStop={vi.fn()}
        onDestroy={vi.fn()}
        isDestroying
      />,
    );
    expect(screen.getByTestId('sandbox-destroy')).toBeDisabled();
  });
});
