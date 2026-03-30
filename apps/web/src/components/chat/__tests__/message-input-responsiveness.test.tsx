import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { MessageInput } from '@/components/chat/message-input';

// ---------------------------------------------------------------------------
// Polyfills required for Radix UI + jsdom
// ---------------------------------------------------------------------------
beforeAll(() => {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props);
      this.pointerId = props.pointerId ?? 0;
      this.pointerType = props.pointerType ?? '';
    }
  } as unknown as typeof PointerEvent;

  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the outer wrapper div (data-testid="message-input") */
function getRoot() {
  return screen.getByTestId('message-input');
}

/** Returns the inner border container (direct child of the root with rounded-2xl) */
function getInnerContainer() {
  return getRoot().querySelector('.rounded-2xl')!;
}

/** Returns the button toolbar row containing mic + send buttons */
function getToolbar() {
  const sendButton = screen.getByTestId('send-button');
  return sendButton.closest('[class*="flex items-center justify-between"]')!;
}

// ============================================================================
// 1. Open / Close Transitions
// ============================================================================

describe('Open/Close transitions', () => {
  it('starts in closed state by default', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const root = getRoot();

    // Closed state has responsive padding classes
    expect(root.className).toContain('sm:px-16');
    expect(root.className).toContain('lg:px-40');

    // Inner container is scaled down in closed state
    const inner = getInnerContainer();
    expect(inner.className).toContain('scale-[0.98]');
    expect(inner.className).toContain('max-w-2xl');
  });

  it('opens when textarea receives focus', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.focus(textarea);

    const root = getRoot();
    // Open state removes responsive padding — only px-4 remains
    expect(root.className).not.toContain('sm:px-16');
    expect(root.className).not.toContain('lg:px-40');

    // Inner container is full-scale when open
    const inner = getInnerContainer();
    expect(inner.className).toContain('scale-100');
    expect(inner.className).not.toContain('max-w-2xl');
  });

  it('opens when text is typed (even without focus)', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    // Type without explicitly focusing first — change event triggers open
    fireEvent.change(textarea, { target: { value: 'hello' } });

    const root = getRoot();
    expect(root.className).not.toContain('sm:px-16');

    const inner = getInnerContainer();
    expect(inner.className).toContain('scale-100');
  });

  it('closes when textarea blurs and text is empty', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    // Open it
    fireEvent.focus(textarea);
    expect(getRoot().className).not.toContain('sm:px-16');

    // Close it
    fireEvent.blur(textarea);
    expect(getRoot().className).toContain('sm:px-16');
    expect(getInnerContainer().className).toContain('scale-[0.98]');
  });

  it('stays open after blur if textarea has content', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'still here' } });
    fireEvent.blur(textarea);

    // Should remain open because value.length > 0
    expect(getRoot().className).not.toContain('sm:px-16');
    expect(getInnerContainer().className).toContain('scale-100');
  });

  it('closes after sending a message (value clears)', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'msg' } });
    fireEvent.blur(textarea);

    // Open due to content
    expect(getInnerContainer().className).toContain('scale-100');

    // Send via Enter
    fireEvent.focus(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    fireEvent.blur(textarea);

    // Value cleared → closed
    expect(getRoot().className).toContain('sm:px-16');
  });

  it('toolbar (mic + send) is visible when open, hidden when closed', () => {
    render(<MessageInput onSend={vi.fn()} onVoiceRecord={vi.fn()} />);
    const toolbar = getToolbar();

    // Closed initially → toolbar hidden (max-h-0 opacity-0)
    expect(toolbar.className).toContain('max-h-0');
    expect(toolbar.className).toContain('opacity-0');

    // Focus to open
    fireEvent.focus(screen.getByTestId('message-textarea'));

    expect(toolbar.className).toContain('max-h-12');
    expect(toolbar.className).toContain('opacity-100');
  });

  it('keyboard hint footer is visible when open, hidden when closed', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const root = getRoot();
    const footer = root.querySelector('p')!;

    // Closed — footer hidden
    expect(footer.className).toContain('max-h-0');
    expect(footer.className).toContain('opacity-0');

    // Open
    fireEvent.focus(screen.getByTestId('message-textarea'));
    expect(footer.className).toContain('max-h-6');
    expect(footer.className).toContain('opacity-100');
  });
});

// ============================================================================
// 2. Keyboard Navigation
// ============================================================================

describe('Keyboard navigation', () => {
  it('Enter sends the message', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.change(textarea, { target: { value: 'Hello keyboard' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith('Hello keyboard');
  });

  it('Shift+Enter does NOT send the message', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.change(textarea, { target: { value: 'Line one' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('Enter does not send when message is whitespace-only', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('textarea is disabled when disabled prop is true (prevents keyboard input)', () => {
    render(<MessageInput onSend={vi.fn()} disabled />);
    const textarea = screen.getByTestId('message-textarea');

    // In a real browser, disabled textarea won't receive key events.
    // Verify the DOM attribute that enforces this.
    expect(textarea).toBeDisabled();
  });

  it('textarea is disabled during active recording (prevents keyboard input)', () => {
    render(<MessageInput onSend={vi.fn()} isRecording onVoiceRecord={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    // In a real browser, disabled textarea won't receive key events.
    expect(textarea).toBeDisabled();
  });

  it('clears input after successful Enter send', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'will be cleared' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(textarea.value).toBe('');
  });

  it('non-Enter keys do not trigger send', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.change(textarea, { target: { value: 'text' } });
    fireEvent.keyDown(textarea, { key: 'a' });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    fireEvent.keyDown(textarea, { key: 'Tab' });

    expect(onSend).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 3. Auto-Resize Behavior
// ============================================================================

describe('Auto-resize behavior', () => {
  it('textarea has rows=1 (single line default)', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;
    expect(textarea.rows).toBe(1);
  });

  it('textarea uses correct min-height for closed vs open state', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    // Closed state — min-h-[36px]
    expect(textarea.className).toContain('min-h-[36px]');
    expect(textarea.className).toContain('max-h-10');

    // Open state — min-h-[40px] max-h-40
    fireEvent.focus(textarea);
    expect(textarea.className).toContain('min-h-[40px]');
    expect(textarea.className).toContain('max-h-40');
  });

  it('textarea has resize-none to prevent manual resizing', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');
    expect(textarea.className).toContain('resize-none');
  });

  it('auto-resize runs on value change (height adjusts)', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;

    // jsdom doesn't compute real layout, but we can verify the height is set
    // by the autoResize effect. Mock scrollHeight to simulate multi-line content.
    Object.defineProperty(textarea, 'scrollHeight', { value: 80, configurable: true });

    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } });

    // The useEffect runs autoResize which sets style.height
    expect(textarea.style.height).toBe('80px');
  });

  it('auto-resize caps at 160px', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;

    // Mock scrollHeight larger than the 160px cap
    Object.defineProperty(textarea, 'scrollHeight', { value: 300, configurable: true });

    fireEvent.change(textarea, { target: { value: 'A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK' } });

    expect(textarea.style.height).toBe('160px');
  });

  it('auto-resize resets when text is cleared (after send)', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;

    Object.defineProperty(textarea, 'scrollHeight', { value: 100, configurable: true });
    fireEvent.change(textarea, { target: { value: 'multi\nline' } });
    expect(textarea.style.height).toBe('100px');

    // Simulate clearing (send resets value to '')
    Object.defineProperty(textarea, 'scrollHeight', { value: 36, configurable: true });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(textarea.style.height).toBe('36px');
  });
});

// ============================================================================
// 4. Focus States and Disabled States
// ============================================================================

describe('Focus states', () => {
  it('shows focus ring when textarea is focused', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.focus(textarea);

    const inner = getInnerContainer();
    expect(inner.className).toContain('ring-2');
    expect(inner.className).toContain('border-ring/75');
    expect(inner.className).toContain('shadow-sm');
  });

  it('removes focus ring when textarea is blurred', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.focus(textarea);
    expect(getInnerContainer().className).toContain('ring-2');

    fireEvent.blur(textarea);
    expect(getInnerContainer().className).not.toContain('ring-2');
    expect(getInnerContainer().className).toContain('border-input');
  });

  it('does not show focus ring when disabled even if focused', () => {
    render(<MessageInput onSend={vi.fn()} disabled />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.focus(textarea);

    const inner = getInnerContainer();
    // focused && !disabled is false, so no ring
    expect(inner.className).not.toContain('ring-2');
    expect(inner.className).not.toContain('shadow-sm');
  });
});

describe('Disabled states', () => {
  it('applies opacity-60 class to inner container when disabled', () => {
    render(<MessageInput onSend={vi.fn()} disabled />);
    const inner = getInnerContainer();
    expect(inner.className).toContain('opacity-60');
  });

  it('does not apply opacity-60 when not disabled', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const inner = getInnerContainer();
    expect(inner.className).not.toContain('opacity-60');
  });

  it('disables textarea when disabled prop is true', () => {
    render(<MessageInput onSend={vi.fn()} disabled />);
    expect(screen.getByTestId('message-textarea')).toBeDisabled();
  });

  it('disables textarea when actively recording', () => {
    render(<MessageInput onSend={vi.fn()} isRecording onVoiceRecord={vi.fn()} />);
    expect(screen.getByTestId('message-textarea')).toBeDisabled();
  });

  it('send button is disabled when input is empty', () => {
    render(<MessageInput onSend={vi.fn()} />);
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('send button is disabled when disabled prop is true even with content', () => {
    render(<MessageInput onSend={vi.fn()} disabled />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'content' } });
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('send button is enabled when input has content and not disabled', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'content' } });
    expect(screen.getByTestId('send-button')).not.toBeDisabled();
  });

  it('textarea shows cursor-not-allowed when disabled', () => {
    render(<MessageInput onSend={vi.fn()} disabled />);
    const textarea = screen.getByTestId('message-textarea');
    expect(textarea.className).toContain('disabled:cursor-not-allowed');
  });

  it('placeholder says "Listening..." during recording', () => {
    render(<MessageInput onSend={vi.fn()} isRecording onVoiceRecord={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe('Listening...');
  });

  it('placeholder says "Send a message..." when not recording', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe('Send a message...');
  });
});

// ============================================================================
// 5. Voice Recording Button & Send Button Accessibility
// ============================================================================

describe('Voice recording button accessibility', () => {
  it('mic button is rendered when onVoiceRecord is provided', () => {
    render(<MessageInput onSend={vi.fn()} onVoiceRecord={vi.fn()} />);
    expect(screen.getByTestId('mic-button')).toBeInTheDocument();
  });

  it('mic button is NOT rendered when onVoiceRecord is not provided', () => {
    render(<MessageInput onSend={vi.fn()} />);
    expect(screen.queryByTestId('mic-button')).not.toBeInTheDocument();
  });

  it('mic button is not disabled when component is enabled', () => {
    render(<MessageInput onSend={vi.fn()} onVoiceRecord={vi.fn()} />);
    expect(screen.getByTestId('mic-button')).not.toBeDisabled();
  });

  it('mic button is disabled when component is disabled', () => {
    render(<MessageInput onSend={vi.fn()} onVoiceRecord={vi.fn()} disabled />);
    expect(screen.getByTestId('mic-button')).toBeDisabled();
  });

  it('mic button uses ghost variant normally', () => {
    render(<MessageInput onSend={vi.fn()} onVoiceRecord={vi.fn()} />);
    const btn = screen.getByTestId('mic-button');
    // Ghost variant doesn't have destructive class
    expect(btn.className).not.toContain('destructive');
  });

  it('mic button uses destructive variant + pulse animation when recording', () => {
    render(<MessageInput onSend={vi.fn()} onVoiceRecord={vi.fn()} isRecording />);
    const btn = screen.getByTestId('mic-button');
    expect(btn.className).toContain('animate-pulse');
  });

  it('mic button calls onVoiceRecord and auto-sends transcript', async () => {
    const onSend = vi.fn();
    const onVoiceRecord = vi.fn().mockResolvedValue('transcribed text');

    render(<MessageInput onSend={onSend} onVoiceRecord={onVoiceRecord} />);

    // Open the input first so mic is visible
    fireEvent.focus(screen.getByTestId('message-textarea'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('mic-button'));
    });

    // Wait for the async onVoiceRecord to resolve
    await vi.waitFor(() => {
      expect(onVoiceRecord).toHaveBeenCalled();
      expect(onSend).toHaveBeenCalledWith('transcribed text');
    });
  });

  it('mic button does not auto-send if transcript is null', async () => {
    const onSend = vi.fn();
    const onVoiceRecord = vi.fn().mockResolvedValue(null);

    render(<MessageInput onSend={onSend} onVoiceRecord={onVoiceRecord} />);
    fireEvent.focus(screen.getByTestId('message-textarea'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('mic-button'));
    });

    await vi.waitFor(() => {
      expect(onVoiceRecord).toHaveBeenCalled();
    });

    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('Send button accessibility', () => {
  it('send button has data-testid', () => {
    render(<MessageInput onSend={vi.fn()} />);
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
  });

  it('send button disabled styling (bg-muted scale-95) when no content', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const btn = screen.getByTestId('send-button');
    expect(btn.className).toContain('bg-muted');
    expect(btn.className).toContain('scale-95');
  });

  it('send button active styling (bg-primary scale-100) when has content', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'hi' } });

    const btn = screen.getByTestId('send-button');
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('scale-100');
  });

  it('send button transitions between disabled and active states', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');
    const btn = screen.getByTestId('send-button');

    // Initially disabled
    expect(btn.className).toContain('bg-muted');

    // Type → active
    fireEvent.change(textarea, { target: { value: 'x' } });
    expect(btn.className).toContain('bg-primary');

    // Clear → disabled again
    fireEvent.change(textarea, { target: { value: '' } });
    expect(btn.className).toContain('bg-muted');
  });

  it('send button is disabled during recording even with content', () => {
    render(<MessageInput onSend={vi.fn()} onVoiceRecord={vi.fn()} isRecording />);
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });
});

// ============================================================================
// 6. Typing Indicator Integration
// ============================================================================

describe('Typing indicator', () => {
  it('shows animated dots and "typing..." text', () => {
    render(<MessageInput onSend={vi.fn()} isTyping />);
    const indicator = screen.getByTestId('typing-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain('typing...');

    // Verify 3 animated bounce dots
    const dots = indicator.querySelectorAll('.animate-bounce');
    expect(dots.length).toBe(3);
  });

  it('typing indicator is absent when isTyping is false', () => {
    render(<MessageInput onSend={vi.fn()} isTyping={false} />);
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });

  it('typing indicator is absent by default (isTyping undefined)', () => {
    render(<MessageInput onSend={vi.fn()} />);
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });
});

// ============================================================================
// 7. Edge Cases
// ============================================================================

describe('Edge cases', () => {
  it('rapid focus/blur cycles maintain correct state', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    // Rapid toggle
    fireEvent.focus(textarea);
    fireEvent.blur(textarea);
    fireEvent.focus(textarea);
    fireEvent.blur(textarea);

    // Should be closed (no content, not focused)
    expect(getRoot().className).toContain('sm:px-16');
  });

  it('whitespace-only content does not enable send button', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.change(textarea, { target: { value: '   \n\t  ' } });

    // canSend should be false (value.trim() is empty)
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('whitespace-only content still opens the input (value.length > 0)', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea');

    fireEvent.change(textarea, { target: { value: '   ' } });

    // isOpen is true because value.length > 0 (even if only spaces)
    expect(getInnerContainer().className).toContain('scale-100');
  });

  it('very long single-line message works correctly', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');
    const longMsg = 'x'.repeat(5000);

    fireEvent.change(textarea, { target: { value: longMsg } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith(longMsg);
  });

  it('special characters are preserved in messages', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');
    const specialMsg = '<script>alert("xss")</script> & "quotes" 🎉';

    fireEvent.change(textarea, { target: { value: specialMsg } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith(specialMsg);
  });

  it('concurrent disabled + isRecording both prevent sending', () => {
    render(<MessageInput onSend={vi.fn()} disabled isRecording onVoiceRecord={vi.fn()} />);
    expect(screen.getByTestId('message-textarea')).toBeDisabled();
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });
});
