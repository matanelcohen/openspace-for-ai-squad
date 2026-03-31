/**
 * Tests for MemoryExtractor — LLM-based memory extraction from task results.
 */

import { describe, expect, it, vi } from 'vitest';

import { MemoryExtractor } from '../memory-extractor.js';
import type { AIProvider } from '../../ai/copilot-provider.js';

// ── Mock AI Provider ────────────────────────────────────────────

function mockAIProvider(response: string): AIProvider {
  return {
    chatCompletion: vi.fn().mockResolvedValue({ content: response }),
  } as unknown as AIProvider;
}

// ── Tests ────────────────────────────────────────────────────────

describe('MemoryExtractor', () => {
  it('extracts memories from a valid LLM response', async () => {
    const provider = mockAIProvider(
      JSON.stringify([
        { type: 'decision', content: 'Uses Fastify over Express' },
        { type: 'pattern', content: 'Tests use vitest with in-memory SQLite' },
      ]),
    );
    const extractor = new MemoryExtractor(provider);

    const result = await extractor.extract({
      agentId: 'bender',
      taskId: 'task-1',
      taskTitle: 'Build API scaffold',
      taskDescription: 'Set up the API',
      resultContent: 'Built using Fastify...',
      progressLog: [],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'decision', content: 'Uses Fastify over Express' });
    expect(result[1]).toEqual({ type: 'pattern', content: 'Tests use vitest with in-memory SQLite' });
  });

  it('handles markdown-wrapped JSON response', async () => {
    const provider = mockAIProvider(
      '```json\n[{"type": "preference", "content": "User prefers strict mode"}]\n```',
    );
    const extractor = new MemoryExtractor(provider);

    const result = await extractor.extract({
      agentId: 'bender',
      taskId: 'task-2',
      taskTitle: 'Config setup',
      taskDescription: 'Configure TS',
      resultContent: 'Configured strict...',
      progressLog: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('preference');
  });

  it('returns empty array when LLM returns empty array', async () => {
    const provider = mockAIProvider('[]');
    const extractor = new MemoryExtractor(provider);

    const result = await extractor.extract({
      agentId: 'bender',
      taskId: 'task-3',
      taskTitle: 'Trivial fix',
      taskDescription: 'Fix typo',
      resultContent: 'Fixed.',
      progressLog: [],
    });

    expect(result).toEqual([]);
  });

  it('returns empty array on LLM failure', async () => {
    const provider = {
      chatCompletion: vi.fn().mockRejectedValue(new Error('Rate limited')),
    } as unknown as AIProvider;
    const extractor = new MemoryExtractor(provider);

    const result = await extractor.extract({
      agentId: 'bender',
      taskId: 'task-4',
      taskTitle: 'Crash test',
      taskDescription: 'Test crash',
      resultContent: 'Result',
      progressLog: [],
    });

    expect(result).toEqual([]);
  });

  it('returns empty array on invalid JSON', async () => {
    const provider = mockAIProvider('not json at all');
    const extractor = new MemoryExtractor(provider);

    const result = await extractor.extract({
      agentId: 'bender',
      taskId: 'task-5',
      taskTitle: 'Bad parse',
      taskDescription: 'Test',
      resultContent: 'Result',
      progressLog: [],
    });

    expect(result).toEqual([]);
  });

  it('filters out invalid types', async () => {
    const provider = mockAIProvider(
      JSON.stringify([
        { type: 'decision', content: 'Valid' },
        { type: 'invalid_type', content: 'Should be filtered' },
        { type: 'pattern', content: 'Also valid' },
      ]),
    );
    const extractor = new MemoryExtractor(provider);

    const result = await extractor.extract({
      agentId: 'bender',
      taskId: 'task-6',
      taskTitle: 'Filter test',
      taskDescription: 'Test',
      resultContent: 'Result',
      progressLog: [],
    });

    expect(result).toHaveLength(2);
    expect(result.every((m) => ['decision', 'pattern', 'preference'].includes(m.type))).toBe(true);
  });

  it('limits to 5 memories max', async () => {
    const memories = Array.from({ length: 10 }, (_, i) => ({
      type: 'pattern',
      content: `Pattern ${i}`,
    }));
    const provider = mockAIProvider(JSON.stringify(memories));
    const extractor = new MemoryExtractor(provider);

    const result = await extractor.extract({
      agentId: 'bender',
      taskId: 'task-7',
      taskTitle: 'Limit test',
      taskDescription: 'Test',
      resultContent: 'Result',
      progressLog: [],
    });

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('truncates long content to 500 chars', async () => {
    const longContent = 'x'.repeat(1000);
    const provider = mockAIProvider(
      JSON.stringify([{ type: 'decision', content: longContent }]),
    );
    const extractor = new MemoryExtractor(provider);

    const result = await extractor.extract({
      agentId: 'bender',
      taskId: 'task-8',
      taskTitle: 'Truncate test',
      taskDescription: 'Test',
      resultContent: 'Result',
      progressLog: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.content.length).toBeLessThanOrEqual(500);
  });

  it('includes progress log in the prompt', async () => {
    const chatCompletion = vi.fn().mockResolvedValue({ content: '[]' });
    const provider = { chatCompletion } as unknown as AIProvider;
    const extractor = new MemoryExtractor(provider);

    await extractor.extract({
      agentId: 'bender',
      taskId: 'task-9',
      taskTitle: 'Progress test',
      taskDescription: 'Test',
      resultContent: 'Result',
      progressLog: ['Step 1 done', 'Step 2 done'],
    });

    const callArgs = chatCompletion.mock.calls[0]![0];
    expect(callArgs.messages[0].content).toContain('Step 1 done');
    expect(callArgs.messages[0].content).toContain('Step 2 done');
  });

  it('only uses last 20 progress entries', async () => {
    const chatCompletion = vi.fn().mockResolvedValue({ content: '[]' });
    const provider = { chatCompletion } as unknown as AIProvider;
    const extractor = new MemoryExtractor(provider);

    const progressLog = Array.from({ length: 30 }, (_, i) => `Entry ${i}`);

    await extractor.extract({
      agentId: 'bender',
      taskId: 'task-10',
      taskTitle: 'Limit progress',
      taskDescription: 'Test',
      resultContent: 'Result',
      progressLog,
    });

    const callArgs = chatCompletion.mock.calls[0]![0];
    // Should NOT contain early entries
    expect(callArgs.messages[0].content).not.toContain('Entry 0');
    // Should contain late entries
    expect(callArgs.messages[0].content).toContain('Entry 29');
  });
});
