import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VoiceRoom } from '../voice-room';

vi.mock('@/hooks/use-voice-session', () => ({
  useVoiceSession: vi.fn(),
}));

vi.mock('../agent-circle', () => ({
  AgentCircle: ({ agentId, isSpeaking }: any) => (
    <div data-testid={`agent-circle-${agentId}`} data-speaking={isSpeaking}>
      Agent: {agentId}
    </div>
  ),
}));

vi.mock('../voice-transcript', () => ({
  VoiceTranscript: ({ messages }: any) => (
    <div data-testid="voice-transcript">Messages: {messages.length}</div>
  ),
}));

vi.mock('../microphone-button', () => ({
  MicrophoneButton: ({ onToggleRecording }: any) => (
    <button data-testid="microphone-button" onClick={onToggleRecording}>
      Mic
    </button>
  ),
}));

vi.mock('../voice-text-input', () => ({
  VoiceTextInput: ({ onSendMessage }: any) => (
    <button data-testid="voice-text-input" onClick={() => onSendMessage('test')}>
      Send
    </button>
  ),
}));

vi.mock('../session-controls', () => ({
  SessionControls: ({ onStartSession, onEndSession }: any) => (
    <div data-testid="session-controls">
      <button onClick={onStartSession}>Start</button>
      <button onClick={onEndSession}>End</button>
    </div>
  ),
}));

vi.mock('../agent-selector', () => ({
  AgentSelector: ({ onSelectAgent }: any) => (
    <button data-testid="agent-selector" onClick={() => onSelectAgent('leela')}>
      Select
    </button>
  ),
}));

import { useVoiceSession } from '@/hooks/use-voice-session';

describe('VoiceRoom', () => {
  const mockUseVoiceSession = useVoiceSession as any;

  beforeEach(() => {
    mockUseVoiceSession.mockReturnValue({
      session: null,
      isRecording: false,
      isMuted: false,
      currentSpeaker: null,
      startSession: vi.fn(),
      endSession: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleMute: vi.fn(),
      sendTextMessage: vi.fn(),
      playMessage: vi.fn(),
    });
  });

  it('renders voice room', () => {
    render(<VoiceRoom />);
    
    expect(screen.getByTestId('voice-room')).toBeInTheDocument();
    expect(screen.getByText('Voice Room')).toBeInTheDocument();
  });

  it('shows session controls', () => {
    render(<VoiceRoom />);
    
    expect(screen.getByTestId('session-controls')).toBeInTheDocument();
  });

  it('shows transcript', () => {
    render(<VoiceRoom />);
    
    expect(screen.getByTestId('voice-transcript')).toBeInTheDocument();
  });

  it('shows agents when session is active', () => {
    mockUseVoiceSession.mockReturnValue({
      session: {
        id: 'session-1',
        status: 'active',
        participantAgentIds: ['leela', 'bender'],
        messages: [],
      },
      isRecording: false,
      isMuted: false,
      currentSpeaker: null,
      startSession: vi.fn(),
      endSession: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleMute: vi.fn(),
      sendTextMessage: vi.fn(),
      playMessage: vi.fn(),
    });

    render(<VoiceRoom />);
    
    expect(screen.getByTestId('agent-circle-leela')).toBeInTheDocument();
    expect(screen.getByTestId('agent-circle-bender')).toBeInTheDocument();
  });

  it('shows controls when session is active', () => {
    mockUseVoiceSession.mockReturnValue({
      session: {
        id: 'session-1',
        status: 'active',
        participantAgentIds: ['leela'],
        messages: [],
      },
      isRecording: false,
      isMuted: false,
      currentSpeaker: null,
      startSession: vi.fn(),
      endSession: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleMute: vi.fn(),
      sendTextMessage: vi.fn(),
      playMessage: vi.fn(),
    });

    render(<VoiceRoom />);
    
    expect(screen.getByTestId('microphone-button')).toBeInTheDocument();
    expect(screen.getByTestId('voice-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('agent-selector')).toBeInTheDocument();
  });

  it('calls startSession with default agents', async () => {
    const user = userEvent.setup();
    const startSession = vi.fn();
    
    mockUseVoiceSession.mockReturnValue({
      session: null,
      isRecording: false,
      isMuted: false,
      currentSpeaker: null,
      startSession,
      endSession: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleMute: vi.fn(),
      sendTextMessage: vi.fn(),
      playMessage: vi.fn(),
    });

    render(<VoiceRoom />);
    
    await user.click(screen.getByText('Start'));
    expect(startSession).toHaveBeenCalledWith(['leela', 'bender', 'fry', 'zoidberg']);
  });

  it('highlights speaking agent', () => {
    mockUseVoiceSession.mockReturnValue({
      session: {
        id: 'session-1',
        status: 'active',
        participantAgentIds: ['leela', 'bender'],
        messages: [],
      },
      isRecording: false,
      isMuted: false,
      currentSpeaker: 'leela',
      startSession: vi.fn(),
      endSession: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleMute: vi.fn(),
      sendTextMessage: vi.fn(),
      playMessage: vi.fn(),
    });

    render(<VoiceRoom />);
    
    const leelaCircle = screen.getByTestId('agent-circle-leela');
    expect(leelaCircle).toHaveAttribute('data-speaking', 'true');
  });
});
