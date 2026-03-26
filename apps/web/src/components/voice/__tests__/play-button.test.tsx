import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlayButton } from '../play-button';

describe('PlayButton', () => {
  it('renders play button', () => {
    render(<PlayButton messageId="msg-1" onPlay={vi.fn()} />);
    
    expect(screen.getByTestId('play-button')).toBeInTheDocument();
  });

  it('sets message id attribute', () => {
    render(<PlayButton messageId="msg-123" onPlay={vi.fn()} />);
    
    expect(screen.getByTestId('play-button')).toHaveAttribute('data-message-id', 'msg-123');
  });

  it('calls onPlay with message id when clicked', async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();
    
    render(<PlayButton messageId="msg-456" onPlay={onPlay} />);
    
    await user.click(screen.getByTestId('play-button'));
    expect(onPlay).toHaveBeenCalledWith('msg-456');
  });

  it('can be disabled', () => {
    render(<PlayButton messageId="msg-1" onPlay={vi.fn()} disabled={true} />);
    
    expect(screen.getByTestId('play-button')).toBeDisabled();
  });
});
