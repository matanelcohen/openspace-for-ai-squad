import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VoiceTextInput } from '../voice-text-input';

describe('VoiceTextInput', () => {
  it('renders input field and send button', () => {
    render(<VoiceTextInput onSendMessage={vi.fn()} />);
    
    expect(screen.getByTestId('voice-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('text-input-field')).toBeInTheDocument();
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
  });

  it('shows placeholder text', () => {
    render(<VoiceTextInput onSendMessage={vi.fn()} placeholder="Type here..." />);
    
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
  });

  it('allows typing in input field', async () => {
    const user = userEvent.setup();
    render(<VoiceTextInput onSendMessage={vi.fn()} />);
    
    const input = screen.getByTestId('text-input-field');
    await user.type(input, 'Hello world');
    
    expect(input).toHaveValue('Hello world');
  });

  it('calls onSendMessage with trimmed content on submit', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    
    render(<VoiceTextInput onSendMessage={onSend} />);
    
    const input = screen.getByTestId('text-input-field');
    await user.type(input, '  Hello  ');
    await user.click(screen.getByTestId('send-button'));
    
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('clears input after sending', async () => {
    const user = userEvent.setup();
    render(<VoiceTextInput onSendMessage={vi.fn()} />);
    
    const input = screen.getByTestId('text-input-field');
    await user.type(input, 'Test message');
    await user.click(screen.getByTestId('send-button'));
    
    expect(input).toHaveValue('');
  });

  it('disables send button when input is empty', () => {
    render(<VoiceTextInput onSendMessage={vi.fn()} />);
    
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('enables send button when input has content', async () => {
    const user = userEvent.setup();
    render(<VoiceTextInput onSendMessage={vi.fn()} />);
    
    const input = screen.getByTestId('text-input-field');
    await user.type(input, 'Hello');
    
    expect(screen.getByTestId('send-button')).toBeEnabled();
  });

  it('can be disabled entirely', () => {
    render(<VoiceTextInput onSendMessage={vi.fn()} disabled={true} />);
    
    expect(screen.getByTestId('text-input-field')).toBeDisabled();
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('submits on form enter', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    
    render(<VoiceTextInput onSendMessage={onSend} />);
    
    const input = screen.getByTestId('text-input-field');
    await user.type(input, 'Hello{Enter}');
    
    expect(onSend).toHaveBeenCalledWith('Hello');
  });
});
