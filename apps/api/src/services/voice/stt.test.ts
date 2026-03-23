/**
 * Tests for STTService (P4-2).
 *
 * Covers audio buffering, transcription via mock provider,
 * empty audio handling, error recovery, and event emission.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { STTProvider } from './stt.js';
import { STTService } from './stt.js';

// ── Mock STT Provider ─────────────────────────────────────────────

function createMockProvider(overrides: Partial<STTProvider> = {}): STTProvider {
  return {
    transcribe: vi.fn().mockResolvedValue({ text: 'Hello world', language: 'en' }),
    ...overrides,
  };
}

describe('STTService', () => {
  let service: STTService;
  let mockProvider: STTProvider;

  beforeEach(() => {
    mockProvider = createMockProvider();
    service = new STTService(
      { apiKey: 'test-key', model: 'whisper-1', language: 'en' },
      mockProvider,
    );
  });

  afterEach(async () => {
    await service.shutdown();
  });

  // ── Audio buffering ────────────────────────────────────────────

  describe('audio buffering', () => {
    it('accumulates audio chunks for a session', () => {
      service.pushAudioChunk('session-1', Buffer.from('chunk1'));
      service.pushAudioChunk('session-1', Buffer.from('chunk2'));
      expect(service.hasBufferedAudio('session-1')).toBe(true);
    });

    it('ignores empty buffers', () => {
      service.pushAudioChunk('session-1', Buffer.alloc(0));
      expect(service.hasBufferedAudio('session-1')).toBe(false);
    });

    it('emits transcript:partial on each push', () => {
      const handler = vi.fn();
      service.on('transcript:partial', handler);
      service.pushAudioChunk('session-1', Buffer.from('data'));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].isFinal).toBe(false);
    });

    it('tracks separate buffers per session', () => {
      service.pushAudioChunk('session-1', Buffer.from('a'));
      service.pushAudioChunk('session-2', Buffer.from('b'));
      expect(service.hasBufferedAudio('session-1')).toBe(true);
      expect(service.hasBufferedAudio('session-2')).toBe(true);
    });

    it('clears buffer for a session', () => {
      service.pushAudioChunk('session-1', Buffer.from('data'));
      service.clearBuffer('session-1');
      expect(service.hasBufferedAudio('session-1')).toBe(false);
    });
  });

  // ── Transcription ──────────────────────────────────────────────

  describe('transcription', () => {
    it('transcribes buffered audio and returns final transcript', async () => {
      service.pushAudioChunk('session-1', Buffer.from('audio-data'));
      const result = await service.finalize('session-1');

      expect(result.isFinal).toBe(true);
      expect(result.text).toBe('Hello world');
      expect(result.language).toBe('en');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.sessionId).toBe('session-1');
    });

    it('calls provider with concatenated audio buffer', async () => {
      service.pushAudioChunk('session-1', Buffer.from('part1'));
      service.pushAudioChunk('session-1', Buffer.from('part2'));
      await service.finalize('session-1');

      expect(mockProvider.transcribe).toHaveBeenCalledTimes(1);
      const calledBuffer = (mockProvider.transcribe as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Buffer;
      expect(calledBuffer.toString()).toBe('part1part2');
    });

    it('passes context prompt to provider', async () => {
      service.pushAudioChunk('session-1', Buffer.from('audio'));
      await service.finalize('session-1', 'Previous context');

      const calledOptions = (mockProvider.transcribe as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(calledOptions.prompt).toBe('Previous context');
    });

    it('emits transcript:final on successful transcription', async () => {
      const handler = vi.fn();
      service.on('transcript:final', handler);
      service.pushAudioChunk('session-1', Buffer.from('audio'));
      await service.finalize('session-1');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].isFinal).toBe(true);
    });

    it('clears buffer after finalization', async () => {
      service.pushAudioChunk('session-1', Buffer.from('audio'));
      await service.finalize('session-1');
      expect(service.hasBufferedAudio('session-1')).toBe(false);
    });
  });

  // ── Empty audio handling ───────────────────────────────────────

  describe('empty audio', () => {
    it('returns empty transcript when no audio buffered', async () => {
      const result = await service.finalize('session-1');
      expect(result.text).toBe('');
      expect(result.isFinal).toBe(true);
      expect(result.confidence).toBe(0);
    });

    it('does not call provider when no audio buffered', async () => {
      await service.finalize('session-1');
      expect(mockProvider.transcribe).not.toHaveBeenCalled();
    });
  });

  // ── Error handling ─────────────────────────────────────────────

  describe('error handling', () => {
    it('returns empty transcript on provider error', async () => {
      const errorProvider = createMockProvider({
        transcribe: vi.fn().mockRejectedValue(new Error('API timeout')),
      });
      const errorService = new STTService({ apiKey: 'test' }, errorProvider);

      errorService.pushAudioChunk('session-1', Buffer.from('audio'));
      const result = await errorService.finalize('session-1');

      expect(result.text).toBe('');
      expect(result.isFinal).toBe(true);
      expect(result.confidence).toBe(0);

      await errorService.shutdown();
    });

    it('emits error event on provider failure', async () => {
      const errorProvider = createMockProvider({
        transcribe: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      const errorService = new STTService({ apiKey: 'test' }, errorProvider);

      const handler = vi.fn();
      errorService.on('error', handler);

      errorService.pushAudioChunk('session-1', Buffer.from('audio'));
      await errorService.finalize('session-1');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].error).toContain('Network error');

      await errorService.shutdown();
    });

    it('still emits transcript:final after error', async () => {
      const errorProvider = createMockProvider({
        transcribe: vi.fn().mockRejectedValue(new Error('Fail')),
      });
      const errorService = new STTService({ apiKey: 'test' }, errorProvider);

      const handler = vi.fn();
      errorService.on('transcript:final', handler);

      errorService.pushAudioChunk('session-1', Buffer.from('audio'));
      await errorService.finalize('session-1');

      expect(handler).toHaveBeenCalledTimes(1);

      await errorService.shutdown();
    });
  });

  // ── Shutdown ───────────────────────────────────────────────────

  describe('shutdown', () => {
    it('clears all buffers on shutdown', async () => {
      service.pushAudioChunk('session-1', Buffer.from('a'));
      service.pushAudioChunk('session-2', Buffer.from('b'));
      await service.shutdown();
      expect(service.hasBufferedAudio('session-1')).toBe(false);
      expect(service.hasBufferedAudio('session-2')).toBe(false);
    });
  });
});
