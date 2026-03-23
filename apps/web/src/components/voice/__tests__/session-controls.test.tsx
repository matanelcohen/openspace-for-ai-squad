import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionControls } from '../session-controls';

describe('SessionControls', () => {
  it('shows start button when no session', () => {
    render(
      <SessionControls
        sessionStatus={null}
        isMuted={false}
        onStartSession={vi.fn()}
        onEndSession={vi.fn()}
        onToggleMute={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('start-session-button')).toBeInTheDocument();
    expect(screen.getByText(/start session/i)).toBeInTheDocument();
  });

  it('shows mute and end buttons when session is active', () => {
    render(
      <SessionControls
        sessionStatus="active"
        isMuted={false}
        onStartSession={vi.fn()}
        onEndSession={vi.fn()}
        onToggleMute={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('mute-button')).toBeInTheDocument();
    expect(screen.getByTestId('end-session-button')).toBeInTheDocument();
    expect(screen.queryByTestId('start-session-button')).not.toBeInTheDocument();
  });

  it('shows mute text when not muted', () => {
    render(
      <SessionControls
        sessionStatus="active"
        isMuted={false}
        onStartSession={vi.fn()}
        onEndSession={vi.fn()}
        onToggleMute={vi.fn()}
      />
    );
    
    expect(screen.getByText(/^mute$/i)).toBeInTheDocument();
  });

  it('shows unmute text when muted', () => {
    render(
      <SessionControls
        sessionStatus="active"
        isMuted={true}
        onStartSession={vi.fn()}
        onEndSession={vi.fn()}
        onToggleMute={vi.fn()}
      />
    );
    
    expect(screen.getByText(/unmute/i)).toBeInTheDocument();
  });

  it('calls onStartSession when start button clicked', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    
    render(
      <SessionControls
        sessionStatus={null}
        isMuted={false}
        onStartSession={onStart}
        onEndSession={vi.fn()}
        onToggleMute={vi.fn()}
      />
    );
    
    await user.click(screen.getByTestId('start-session-button'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleMute when mute button clicked', async () => {
    const user = userEvent.setup();
    const onToggleMute = vi.fn();
    
    render(
      <SessionControls
        sessionStatus="active"
        isMuted={false}
        onStartSession={vi.fn()}
        onEndSession={vi.fn()}
        onToggleMute={onToggleMute}
      />
    );
    
    await user.click(screen.getByTestId('mute-button'));
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('calls onEndSession when end button clicked', async () => {
    const user = userEvent.setup();
    const onEnd = vi.fn();
    
    render(
      <SessionControls
        sessionStatus="active"
        isMuted={false}
        onStartSession={vi.fn()}
        onEndSession={onEnd}
        onToggleMute={vi.fn()}
      />
    );
    
    await user.click(screen.getByTestId('end-session-button'));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
