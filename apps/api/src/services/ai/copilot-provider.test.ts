/**
 * Tests for the AI provider layer — copilot-provider.ts
 *
 * All tests use mocked SDK internals — no real API calls are made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentRoutingProfile } from '../voice/router.js';
import type { CopilotProviderConfig } from './copilot-provider.js';
import { CopilotProvider, createAIProvider, MockAIProvider } from './copilot-provider.js';

// ── Mock SDK primitives ──────────────────────────────────────────

function createMockSession(responseContent = 'Hello from AI') {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(handler);
      listeners.set(event, existing);
      return () => {
        const arr = listeners.get(event);
        if (arr)
          listeners.set(
            event,
            arr.filter((h) => h !== handler),
          );
      };
    }),
    send: vi.fn(async () => {
      // Simulate streaming by firing events in microtask
      queueMicrotask(() => {
        const deltaHandlers = listeners.get('assistant.message_delta') ?? [];
        for (const h of deltaHandlers) {
          h({ data: { deltaContent: responseContent } });
        }
        const msgHandlers = listeners.get('assistant.message') ?? [];
        for (const h of msgHandlers) {
          h({ data: { content: responseContent } });
        }
      });
      return 'msg-id';
    }),
    sendAndWait: vi.fn(async () => ({
      data: { content: responseContent },
    })),
    disconnect: vi.fn(async () => {}),
    _listeners: listeners,
  };
}

function createMockClient(session = createMockSession()) {
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => []),
    createSession: vi.fn(async () => session),
  };
}

// ── Helper: inject mock client into CopilotProvider ──────────────

function createTestProvider(
  mockClient: ReturnType<typeof createMockClient>,
  config: CopilotProviderConfig = {},
): CopilotProvider {
  const provider = new CopilotProvider(config);
  // Bypass SDK initialization by injecting mock client directly
  (provider as unknown as { client: unknown }).client = mockClient;
  (provider as unknown as { initialized: boolean }).initialized = true;
  return provider;
}

// ── Tests: CopilotProvider ───────────────────────────────────────

describe('CopilotProvider', () => {
  describe('lifecycle', () => {
    it('reports initialized=false before init', () => {
      const provider = new CopilotProvider();
      expect(provider.isInitialized()).toBe(false);
    });

    it('throws on chatCompletion before initialization', async () => {
      const provider = new CopilotProvider();
      await expect(
        provider.chatCompletion({
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toThrow('not initialized');
    });

    it('shutdown resets state', async () => {
      const mockClient = createMockClient();
      const provider = createTestProvider(mockClient);

      expect(provider.isInitialized()).toBe(true);
      await provider.shutdown();
      expect(provider.isInitialized()).toBe(false);
      expect(mockClient.stop).toHaveBeenCalled();
    });

    it('shutdown is safe to call twice', async () => {
      const mockClient = createMockClient();
      const provider = createTestProvider(mockClient);

      await provider.shutdown();
      await provider.shutdown(); // no-op
      expect(mockClient.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('chatCompletion', () => {
    it('sends prompt and returns content (non-streaming)', async () => {
      const session = createMockSession('The answer is 42');
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'What is 6*7?' }],
      });

      expect(result.content).toBe('The answer is 42');
      expect(result.model).toBe('gpt-4o');
      expect(session.sendAndWait).toHaveBeenCalled();
      expect(session.disconnect).toHaveBeenCalled();
    });

    it('uses custom model from config', async () => {
      const session = createMockSession('OK');
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient, {
        model: 'gpt-5',
      });

      const result = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(result.model).toBe('gpt-5');
      expect(mockClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-5' }),
      );
    });

    it('uses per-request model override', async () => {
      const session = createMockSession('OK');
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-sonnet-4.5',
      });

      expect(result.model).toBe('claude-sonnet-4.5');
    });

    it('passes system prompt to session config', async () => {
      const session = createMockSession('OK');
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      await provider.chatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        systemPrompt: 'You are a helpful assistant',
      });

      expect(mockClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          systemMessage: { content: 'You are a helpful assistant' },
        }),
      );
    });

    it('supports streaming mode', async () => {
      const session = createMockSession('streamed content');
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const chunks: string[] = [];
      const result = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Tell me a story' }],
        stream: true,
        onChunk: (chunk) => chunks.push(chunk),
      });

      expect(result.content).toBe('streamed content');
      expect(chunks).toContain('streamed content');
      // In streaming mode we use send(), not sendAndWait()
      expect(session.send).toHaveBeenCalled();
    });

    it('disconnects session even on error', async () => {
      const session = createMockSession('OK');
      session.sendAndWait = vi.fn(async () => {
        throw new Error('API error');
      });
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      await expect(
        provider.chatCompletion({
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toThrow('API error');

      expect(session.disconnect).toHaveBeenCalled();
    });

    it('handles empty response', async () => {
      const session = createMockSession('');
      session.sendAndWait = vi.fn(async () => undefined) as unknown as typeof session.sendAndWait;
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(result.content).toBe('');
    });

    it('builds prompt from multi-turn messages', async () => {
      const session = createMockSession('OK');
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      await provider.chatCompletion({
        messages: [
          { role: 'system', content: 'Be concise' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
          { role: 'user', content: 'How are you?' },
        ],
      });

      // Verify send was called (the prompt is constructed internally)
      const sendCalls = session.sendAndWait.mock.calls as unknown as Array<[{ prompt: string }]>;
      expect(sendCalls[0]?.[0]?.prompt).toContain('Hello');
      expect(sendCalls[0]?.[0]?.prompt).toContain('How are you?');
    });
  });

  describe('route (LLMRouter interface)', () => {
    const agents: AgentRoutingProfile[] = [
      { id: 'leela', name: 'Leela', role: 'Lead', keywords: ['plan'] },
      {
        id: 'bender',
        name: 'Bender',
        role: 'Backend',
        keywords: ['api'],
      },
    ];

    it('routes transcript to agents via LLM', async () => {
      const session = createMockSession(
        JSON.stringify({
          agentIds: ['bender'],
          reason: 'Backend question',
        }),
      );
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.route('How is the API going?', agents, []);

      expect(result.agentIds).toEqual(['bender']);
      expect(result.reason).toBe('Backend question');
    });

    it('filters out invalid agent IDs from LLM response', async () => {
      const session = createMockSession(
        JSON.stringify({
          agentIds: ['bender', 'unknown-agent'],
          reason: 'test',
        }),
      );
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.route('test', agents, []);
      expect(result.agentIds).toEqual(['bender']);
    });

    it('defaults to leela when no valid IDs returned', async () => {
      const session = createMockSession(
        JSON.stringify({
          agentIds: ['nonexistent'],
          reason: 'test',
        }),
      );
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.route('test', agents, []);
      expect(result.agentIds).toEqual(['leela']);
    });

    it('gracefully handles LLM routing errors', async () => {
      const session = createMockSession('not json');
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.route('test', agents, []);
      expect(result.agentIds).toEqual(['leela']);
      expect(result.reason).toContain('failed');
    });

    it('includes context in routing prompt', async () => {
      const session = createMockSession(JSON.stringify({ agentIds: ['leela'], reason: 'context' }));
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      await provider.route('test', agents, ['Previous: hello']);
      // Verify the prompt contained context
      const routeCalls = session.sendAndWait.mock.calls as unknown as Array<[{ prompt: string }]>;
      expect(routeCalls[0]?.[0]?.prompt).toContain('Previous: hello');
    });
  });

  describe('parse (LLMIntentParser interface)', () => {
    it('parses a create_task intent', async () => {
      const session = createMockSession(
        JSON.stringify({
          action: 'create_task',
          confidence: 0.9,
          params: { title: 'Add auth endpoint', assignee: 'bender' },
        }),
      );
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.parse('Create a task for adding auth endpoint', []);

      expect(result.action).toBe('create_task');
      expect(result.confidence).toBe(0.9);
      expect(result.params.title).toBe('Add auth endpoint');
      expect(result.transcript).toBe('Create a task for adding auth endpoint');
    });

    it('returns unknown on parse failure', async () => {
      const session = createMockSession('garbage');
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      const result = await provider.parse('something', []);
      expect(result.action).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('includes context in parse prompt', async () => {
      const session = createMockSession(
        JSON.stringify({
          action: 'query_status',
          confidence: 0.8,
          params: {},
        }),
      );
      const mockClient = createMockClient(session);
      const provider = createTestProvider(mockClient);

      await provider.parse("What's the status?", ['Bender: Working on API']);
      const parseCalls = session.sendAndWait.mock.calls as unknown as Array<[{ prompt: string }]>;
      expect(parseCalls[0]?.[0]?.prompt).toContain('Bender: Working on API');
    });
  });
});

// ── Tests: MockAIProvider ────────────────────────────────────────

describe('MockAIProvider', () => {
  let mock: MockAIProvider;

  beforeEach(() => {
    mock = new MockAIProvider();
  });

  describe('chatCompletion', () => {
    it('returns contextual mock response for greetings', async () => {
      const result = await mock.chatCompletion({
        messages: [{ role: 'user', content: 'Hello world' }],
      });

      expect(result.content.length).toBeGreaterThan(0);
      expect(result.model).toBe('mock');
    });

    it('handles empty messages gracefully', async () => {
      const result = await mock.chatCompletion({ messages: [] });
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.model).toBe('mock');
    });

    it('supports streaming via onChunk', async () => {
      const chunks: string[] = [];
      const result = await mock.chatCompletion({
        messages: [{ role: 'user', content: 'What is the status?' }],
        stream: true,
        onChunk: (chunk) => chunks.push(chunk),
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('').trim()).toBe(result.content);
    });
  });

  describe('route', () => {
    const agents: AgentRoutingProfile[] = [
      { id: 'leela', name: 'Leela', role: 'Lead', keywords: ['plan'] },
      {
        id: 'bender',
        name: 'Bender',
        role: 'Backend',
        keywords: ['api'],
      },
    ];

    it('matches agent by name mention', async () => {
      const result = await mock.route('Hey Bender, fix the API', agents, []);
      expect(result.agentIds).toEqual(['bender']);
    });

    it('defaults to first agent when no match', async () => {
      const result = await mock.route('Do something random', agents, []);
      expect(result.agentIds).toEqual(['leela']);
    });
  });

  describe('parse', () => {
    it('always returns unknown intent', async () => {
      const result = await mock.parse('Create a task', []);
      expect(result.action).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.transcript).toBe('Create a task');
    });
  });
});

// ── Tests: createAIProvider factory ──────────────────────────────

describe('createAIProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates MockAIProvider by default', async () => {
    vi.stubEnv('AI_PROVIDER', '');
    const provider = await createAIProvider('mock');
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('creates MockAIProvider when env is "mock"', async () => {
    vi.stubEnv('AI_PROVIDER', 'mock');
    const provider = await createAIProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('mock provider implements all AIProvider methods', async () => {
    const provider = await createAIProvider('mock');
    expect(typeof provider.chatCompletion).toBe('function');
    expect(typeof provider.route).toBe('function');
    expect(typeof provider.parse).toBe('function');
  });

  it('copilot-sdk type falls back to MockAIProvider when CLI is unavailable', async () => {
    // The SDK is installed but the CLI server won't be running in test,
    // so createAIProvider should gracefully fall back to mock.
    const provider = await createAIProvider('copilot-sdk');
    expect(typeof provider.chatCompletion).toBe('function');
    expect(typeof provider.route).toBe('function');
    expect(typeof provider.parse).toBe('function');
  });
});
