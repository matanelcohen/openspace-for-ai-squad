import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MicrophoneButton } from '../microphone-button';

describe('MicrophoneButton', () => {
  it('renders microphone button', () => {
    render(
      <MicrophoneButton
        isRecording={false}
        isMuted={false}
        onToggleRecording={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('microphone-button')).toBeInTheDocument();
  });

  it('shows Mic icon when not muted', () => {
    const { container } = render(
      <MicrophoneButton
        isRecording={false}
        isMuted={false}
        onToggleRecording={vi.fn()}
      />
    );
    
    expect(container.querySelector('[class*="lucide-mic"]')).toBeInTheDocument();
  });

  it('shows MicOff icon when muted', () => {
    const { container } = render(
      <MicrophoneButton
        isRecording={false}
        isMuted={true}
        onToggleRecording={vi.fn()}
      />
    );
    
    expect(container.querySelector('[class*="lucide-mic-off"]')).toBeInTheDocument();
  });

  it('applies recording state', () => {
    render(
      <MicrophoneButton
        isRecording={true}
        isMuted={false}
        onToggleRecording={vi.fn()}
      />
    );
    
    const button = screen.getByTestId('microphone-button');
    expect(button).toHaveAttribute('data-recording', 'true');
    expect(button).toHaveClass('animate-pulse');
  });

  it('calls onToggleRecording when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    
    render(
      <MicrophoneButton
        isRecording={false}
        isMuted={false}
        onToggleRecording={onToggle}
      />
    );
    
    await user.click(screen.getByTestId('microphone-button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(
      <MicrophoneButton
        isRecording={false}
        isMuted={false}
        onToggleRecording={vi.fn()}
        disabled={true}
      />
    );
    
    expect(screen.getByTestId('microphone-button')).toBeDisabled();
  });

  it('sets muted data attribute', () => {
    render(
      <MicrophoneButton
        isRecording={false}
        isMuted={true}
        onToggleRecording={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('microphone-button')).toHaveAttribute('data-muted', 'true');
  });
});
