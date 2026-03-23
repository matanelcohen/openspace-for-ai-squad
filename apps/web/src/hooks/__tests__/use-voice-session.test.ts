import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceSession } from '../use-voice-session';

// Mock MediaDevices API
global.navigator.mediaDevices = {
  getUserMedia: vi.fn(),
} as any;

// Mock MediaRecorder
global.MediaRecorder = class MockMediaRecorder {
  ondataavailable: ((event: any) => void) | null = null;
  onstop: (() => void) | null = null;
  
  start() {}
  stop() {
    if (this.onstop) {
      setTimeout(() => this.onstop?.(), 0);
    }
  }
} as any;

describe('useVoiceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with no session', () => {
    const { result } = renderHook(() => useVoiceSession());
    
    expect(result.current.session).toBeNull();
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.currentSpeaker).toBeNull();
  });

  it('starts a session', () => {
    const { result } = renderHook(() => useVoiceSession());
    
    act(() => {
      result.current.startSession(['leela', 'bender']);
    });
    
    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.status).toBe('active');
    expect(result.current.session?.participantAgentIds).toEqual(['leela', 'bender']);
  });

  it('ends a session', () => {
    const { result } = renderHook(() => useVoiceSession());
    
    act(() => {
      result.current.startSession(['leela']);
    });
    
    expect(result.current.session?.status).toBe('active');
    
    act(() => {
      result.current.endSession();
    });
    
    expect(result.current.session?.status).toBe('ended');
    expect(result.current.session?.endedAt).not.toBeNull();
  });

  it('toggles mute', () => {
    const { result } = renderHook(() => useVoiceSession());
    
    expect(result.current.isMuted).toBe(false);
    
    act(() => {
      result.current.toggleMute();
    });
    
    expect(result.current.isMuted).toBe(true);
    
    act(() => {
      result.current.toggleMute();
    });
    
    expect(result.current.isMuted).toBe(false);
  });

  it('sends text message', () => {
    const { result } = renderHook(() => useVoiceSession());
    
    act(() => {
      result.current.startSession(['leela']);
    });
    
    act(() => {
      result.current.sendTextMessage('Hello, team!');
    });
    
    expect(result.current.session?.messages).toHaveLength(1);
    expect(result.current.session?.messages[0].content).toBe('Hello, team!');
    expect(result.current.session?.messages[0].role).toBe('user');
  });

  it('simulates agent response after text message', () => {
    const { result } = renderHook(() => useVoiceSession());
    
    act(() => {
      result.current.startSession(['leela']);
    });
    
    act(() => {
      result.current.sendTextMessage('Hello');
    });
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.session?.messages.length).toBeGreaterThan(1);
    const agentMessage = result.current.session?.messages.find(m => m.role === 'agent');
    expect(agentMessage).toBeDefined();
    expect(agentMessage?.agentId).toBe('leela');
  });

  it('plays message and sets current speaker', () => {
    const { result } = renderHook(() => useVoiceSession());
    
    act(() => {
      result.current.startSession(['leela']);
      result.current.sendTextMessage('Test');
    });
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    const agentMessage = result.current.session?.messages.find(m => m.role === 'agent');
    
    act(() => {
      result.current.playMessage(agentMessage!.id);
    });
    
    expect(result.current.currentSpeaker).toBe('leela');
  });

  it('starts recording', async () => {
    const mockStream = {
      getTracks: () => [],
    };
    
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);
    
    const { result } = renderHook(() => useVoiceSession());
    
    act(() => {
      result.current.startSession(['leela']);
    });
    
    await act(async () => {
      await result.current.startRecording();
    });
    
    expect(result.current.isRecording).toBe(true);
  });

  it('stops recording', async () => {
    const mockStream = {
      getTracks: () => [],
    };
    
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);
    
    const { result } = renderHook(() => useVoiceSession());
    
    act(() => {
      result.current.startSession(['leela']);
    });
    
    await act(async () => {
      await result.current.startRecording();
    });
    
    expect(result.current.isRecording).toBe(true);
    
    act(() => {
      result.current.stopRecording();
    });
    
    expect(result.current.isRecording).toBe(false);
  });
});
