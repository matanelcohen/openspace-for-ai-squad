/**
 * Tests for TTSService (P4-4).
 *
 * Covers per-agent voice mapping, streaming synthesis,
 * sentence chunking, error handling, and configuration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TTSProvider } from './tts.js';
import { DEFAULT_AGENT_VOICES, TTSService } from './tts.js';

// ── Mock TTS Provider ─────────────────────────────────────────────

function createMockProvider(overrides: Partial<TTSProvider> = {}): TTSProvider {
  return {
    synthesize: vi.fn().mockResolvedValue(Buffer.from('fake-audio-data')),
    ...overrides,
  };
}

describe('TTSService', () => {
  let service: TTSService;
  let mockProvider: TTSProvider;

  beforeEach(() => {
    mockProvider = createMockProvider();
    service = new TTSService(
      { apiKey: 'test-key', model: 'tts-1', format: 'opus' },
      undefined,
      mockProvider,
    );
  });

  afterEach(async () => {
    await service.shutdown();
  });

  // ── Per-agent voice mapping ────────────────────────────────────

  describe('per-agent voice mapping', () => {
    it('has distinct default voices for all 4 agents', () => {
      const configs = service.getAllVoiceConfigs();
      expect(configs.leela!.voice).toBe('nova');
      expect(configs.fry!.voice).toBe('echo');
      expect(configs.bender!.voice).toBe('onyx');
      expect(configs.zoidberg!.voice).toBe('shimmer');
    });

    it('all default voices are unique', () => {
      const voices = Object.values(DEFAULT_AGENT_VOICES).map((v) => v.voice);
      const uniqueVoices = new Set(voices);
      expect(uniqueVoices.size).toBe(voices.length);
    });

    it('gets voice config for a specific agent', () => {
      const config = service.getVoiceConfig('bender');
      expect(config).toBeTruthy();
      expect(config!.voice).toBe('onyx');
    });

    it('returns undefined for unknown agent', () => {
      expect(service.getVoiceConfig('unknown')).toBeUndefined();
    });

    it('allows updating voice config', () => {
      service.setVoiceConfig('bender', {
        agentId: 'bender',
        voice: 'alloy',
        speed: 1.2,
      });
      expect(service.getVoiceConfig('bender')!.voice).toBe('alloy');
    });
  });

  // ── Synthesis ──────────────────────────────────────────────────

  describe('synthesis', () => {
    it('synthesizes audio for a single sentence', async () => {
      const chunks = await service.synthesize('session-1', 'bender', 'Hello world.');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.agentId).toBe('bender');
      expect(chunks[0]!.sessionId).toBe('session-1');
      expect(chunks[0]!.data).toBeInstanceOf(Buffer);
      expect(chunks[0]!.isFinal).toBe(true);
    });

    it('uses the correct voice for each agent', async () => {
      await service.synthesize('session-1', 'leela', 'Status update.');
      const calls = (mockProvider.synthesize as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0]![1].voice).toBe('nova');

      await service.synthesize('session-1', 'bender', 'Backend ready.');
      expect(calls[1]![1].voice).toBe('onyx');
    });

    it('splits multi-sentence text into chunks', async () => {
      const chunks = await service.synthesize(
        'session-1',
        'leela',
        'First sentence. Second sentence. Third sentence.',
      );
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunks[chunks.length - 1]!.isFinal).toBe(true);
    });

    it('emits audio:chunk events as they generate', async () => {
      const handler = vi.fn();
      service.on('audio:chunk', handler);

      await service.synthesize('session-1', 'bender', 'Hello. World.');
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('returns empty array for empty text', async () => {
      const chunks = await service.synthesize('session-1', 'bender', '');
      expect(chunks).toHaveLength(0);
    });

    it('returns empty array for whitespace-only text', async () => {
      const chunks = await service.synthesize('session-1', 'bender', '   ');
      expect(chunks).toHaveLength(0);
    });

    it('falls back to alloy voice for unknown agent', async () => {
      await service.synthesize('session-1', 'unknown-agent', 'Hello.');
      const calls = (mockProvider.synthesize as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0]![1].voice).toBe('alloy');
    });

    it('uses custom speed from agent voice config', async () => {
      await service.synthesize('session-1', 'bender', 'Slow down.');
      const calls = (mockProvider.synthesize as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0]![1].speed).toBe(0.95);
    });
  });

  // ── Sequence synthesis ─────────────────────────────────────────

  describe('sequence synthesis', () => {
    it('synthesizes multiple agent responses in order', async () => {
      const chunks = await service.synthesizeSequence('session-1', [
        { agentId: 'leela', text: 'Here is the status.' },
        { agentId: 'bender', text: 'Backend is good.' },
        { agentId: 'fry', text: 'Frontend too.' },
      ]);

      expect(chunks.length).toBeGreaterThanOrEqual(3);
      // Check ordering: leela chunks come first, then bender, then fry
      const agentOrder = chunks.map((c) => c.agentId);
      const leelaIdx = agentOrder.indexOf('leela');
      const benderIdx = agentOrder.indexOf('bender');
      const fryIdx = agentOrder.indexOf('fry');
      expect(leelaIdx).toBeLessThan(benderIdx);
      expect(benderIdx).toBeLessThan(fryIdx);
    });

    it('handles empty response list', async () => {
      const chunks = await service.synthesizeSequence('session-1', []);
      expect(chunks).toHaveLength(0);
    });
  });

  // ── Error handling ─────────────────────────────────────────────

  describe('error handling', () => {
    it('emits error event on provider failure', async () => {
      const errorProvider = createMockProvider({
        synthesize: vi.fn().mockRejectedValue(new Error('TTS API error')),
      });
      const errorService = new TTSService({ apiKey: 'test' }, undefined, errorProvider);

      const handler = vi.fn();
      errorService.on('error', handler);

      await errorService.synthesize('session-1', 'bender', 'Hello.');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]![0].error).toContain('TTS API error');

      await errorService.shutdown();
    });

    it('continues processing other chunks on partial failure', async () => {
      let callCount = 0;
      const flakyProvider = createMockProvider({
        synthesize: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) throw new Error('First fails');
          return Buffer.from('audio');
        }),
      });
      const flakyService = new TTSService({ apiKey: 'test' }, undefined, flakyProvider);
      flakyService.on('error', () => {}); // prevent unhandled error throw

      const chunks = await flakyService.synthesize(
        'session-1',
        'bender',
        'First fails. Second works.',
      );
      // Only the second chunk succeeds
      expect(chunks).toHaveLength(1);

      await flakyService.shutdown();
    });
  });
});
