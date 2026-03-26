import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CommandInput } from '../command-input';

describe('CommandInput', () => {
  it('renders with $ prompt', () => {
    render(<CommandInput onSubmit={vi.fn()} />);
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('renders input field', () => {
    render(<CommandInput onSubmit={vi.fn()} />);
    expect(screen.getByTestId('command-input')).toBeInTheDocument();
  });

  it('calls onSubmit when Enter is pressed', () => {
    const onSubmit = vi.fn();
    render(<CommandInput onSubmit={onSubmit} />);
    const input = screen.getByTestId('command-input');
    fireEvent.change(input, { target: { value: 'npm test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('npm test');
  });

  it('clears input after submit', () => {
    render(<CommandInput onSubmit={vi.fn()} />);
    const input = screen.getByTestId('command-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'npm test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('');
  });

  it('does not submit empty input', () => {
    const onSubmit = vi.fn();
    render(<CommandInput onSubmit={onSubmit} />);
    const input = screen.getByTestId('command-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('navigates history with ArrowUp', () => {
    const onSubmit = vi.fn();
    render(<CommandInput onSubmit={onSubmit} />);
    const input = screen.getByTestId('command-input') as HTMLInputElement;

    // Submit two commands
    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'second' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // ArrowUp should show most recent
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('second');

    // ArrowUp again for older
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('first');
  });

  it('navigates back with ArrowDown', () => {
    const onSubmit = vi.fn();
    render(<CommandInput onSubmit={onSubmit} />);
    const input = screen.getByTestId('command-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'cmd1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'cmd2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Navigate up twice then down
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('cmd2');

    // Down again clears
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('');
  });

  it('disables input when disabled prop is true', () => {
    render(<CommandInput onSubmit={vi.fn()} disabled />);
    expect(screen.getByTestId('command-input')).toBeDisabled();
  });
});
