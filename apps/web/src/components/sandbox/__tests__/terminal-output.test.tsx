import type { SandboxOutputLine } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TerminalOutput } from '../terminal-output';

function makeLine(
  index: number,
  text: string,
  stream: 'stdout' | 'stderr' = 'stdout',
): SandboxOutputLine {
  return {
    index,
    text,
    timestamp: new Date().toISOString(),
    stream,
  };
}

describe('TerminalOutput', () => {
  it('shows empty state when no lines', () => {
    render(<TerminalOutput lines={[]} />);
    expect(screen.getByText(/No output yet/)).toBeInTheDocument();
  });

  it('renders stdout lines', () => {
    const lines = [makeLine(0, 'Hello from stdout'), makeLine(1, 'Second line')];
    render(<TerminalOutput lines={lines} />);
    expect(screen.getByText('Hello from stdout')).toBeInTheDocument();
    expect(screen.getByText('Second line')).toBeInTheDocument();
  });

  it('renders stderr lines with red styling', () => {
    const lines = [makeLine(0, 'Error: something broke', 'stderr')];
    const { container } = render(<TerminalOutput lines={lines} />);
    const errorLine = container.querySelector('.text-red-400');
    expect(errorLine).toBeInTheDocument();
    expect(errorLine).toHaveTextContent('Error: something broke');
  });

  it('renders ANSI colored output', () => {
    const lines = [makeLine(0, '\x1b[32mSuccess!\x1b[0m')];
    const { container } = render(<TerminalOutput lines={lines} />);
    expect(container.querySelector('.ansi-green')).toHaveTextContent('Success!');
  });

  it('displays line count', () => {
    const lines = Array.from({ length: 42 }, (_, i) => makeLine(i, `line ${i}`));
    render(<TerminalOutput lines={lines} />);
    expect(screen.getByText('42 lines')).toBeInTheDocument();
  });

  it('shows streaming indicator when streaming', () => {
    render(<TerminalOutput lines={[makeLine(0, 'test')]} isStreaming />);
    expect(screen.getByText('streaming')).toBeInTheDocument();
  });

  it('does not show streaming indicator when not streaming', () => {
    render(<TerminalOutput lines={[makeLine(0, 'test')]} isStreaming={false} />);
    expect(screen.queryByText('streaming')).not.toBeInTheDocument();
  });

  it('renders clear button when onClear is provided', () => {
    render(<TerminalOutput lines={[makeLine(0, 'test')]} onClear={() => {}} />);
    expect(screen.getByTestId('terminal-clear')).toBeInTheDocument();
  });

  it('does not render clear button when onClear is not provided', () => {
    render(<TerminalOutput lines={[makeLine(0, 'test')]} />);
    expect(screen.queryByTestId('terminal-clear')).not.toBeInTheDocument();
  });
});
