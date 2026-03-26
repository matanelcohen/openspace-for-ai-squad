/**
 * MCP Error Handling Tests
 *
 * Verifies the server handles edge cases gracefully:
 * - Invalid/unknown tool names → isError response
 * - Missing required parameters → isError response
 * - Network failures (fetch throws) → isError or rejection
 * - API returns server errors (500) → isError response
 * - Malformed arguments → isError response
 * - Invalid resource URIs → rejection (McpError)
 * - Invalid prompt names → rejection (McpError)
 *
 * Note: The MCP SDK returns `{ isError: true, content: [...] }` for tool-level
 * errors rather than rejecting the promise. Resource and prompt errors DO reject.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../server.js';

// ── Helpers ──────────────────────────────────────────────────────

type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  });
}

async function createConnectedPair() {
  const server = createServer();
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} },
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

/** Assert a callTool result is an error (isError: true with error text) */
function assertToolError(result: ToolResult, expectedSubstring?: string) {
  expect(result.isError).toBe(true);
  expect(result.content).toBeDefined();
  expect(result.content.length).toBeGreaterThan(0);
  expect(result.content[0].type).toBe('text');
  if (expectedSubstring) {
    expect(result.content[0].text.toLowerCase()).toContain(expectedSubstring.toLowerCase());
  }
}

// ── Invalid Tool Names ──────────────────────────────────────────

describe('MCP Error Handling — Invalid Tool Names', () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    ({ client, server } = await createConnectedPair());
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('returns isError for non-existent tool', async () => {
    const result = (await client.callTool({
      name: 'nonexistent_tool',
      arguments: {},
    })) as ToolResult;
    assertToolError(result, 'not found');
  });

  it('returns isError for empty tool name', async () => {
    const result = (await client.callTool({
      name: '',
      arguments: {},
    })) as ToolResult;
    assertToolError(result, 'not found');
  });

  it('returns isError for similar-but-wrong tool name', async () => {
    const result = (await client.callTool({
      name: 'list_agent',
      arguments: {},
    })) as ToolResult;
    assertToolError(result, 'not found');
  });

  it('error content includes the invalid tool name', async () => {
    const result = (await client.callTool({
      name: 'totally_fake_tool',
      arguments: {},
    })) as ToolResult;
    assertToolError(result);
    expect(result.content[0].text).toContain('totally_fake_tool');
  });
});

// ── Missing Required Parameters ─────────────────────────────────

describe('MCP Error Handling — Missing Required Parameters', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const missingParamTests = [
    { tool: 'get_agent', args: {}, missing: 'agentId' },
    { tool: 'get_task', args: {}, missing: 'taskId' },
    { tool: 'create_task', args: {}, missing: 'title' },
    { tool: 'delete_task', args: {}, missing: 'taskId' },
    { tool: 'update_task', args: { title: 'no id' }, missing: 'taskId' },
    { tool: 'update_task_status', args: { status: 'done' }, missing: 'taskId' },
    { tool: 'update_task_status', args: { taskId: 'task-1' }, missing: 'status' },
    { tool: 'send_chat_message', args: {}, missing: 'message' },
    { tool: 'approve_task', args: {}, missing: 'taskId' },
    { tool: 'reject_task', args: {}, missing: 'taskId' },
  ];

  for (const tc of missingParamTests) {
    it(`${tc.tool} without ${tc.missing} returns isError`, async () => {
      const { client, server } = await createConnectedPair();
      const result = (await client.callTool({
        name: tc.tool,
        arguments: tc.args,
      })) as ToolResult;

      assertToolError(result);

      await client.close();
      await server.close();
    });
  }
});

// ── Malformed Parameters ────────────────────────────────────────

describe('MCP Error Handling — Malformed Parameters', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('update_task with invalid priority enum returns isError', async () => {
    const { client, server } = await createConnectedPair();
    const result = (await client.callTool({
      name: 'update_task',
      arguments: { taskId: 'task-1', priority: 'CRITICAL' },
    })) as ToolResult;

    assertToolError(result);

    await client.close();
    await server.close();
  });

  it('update_task with invalid status enum returns isError', async () => {
    const { client, server } = await createConnectedPair();
    const result = (await client.callTool({
      name: 'update_task',
      arguments: { taskId: 'task-1', status: 'invalid-status' },
    })) as ToolResult;

    assertToolError(result);

    await client.close();
    await server.close();
  });

  it('get_chat_history with negative limit returns isError', async () => {
    const { client, server } = await createConnectedPair();
    const result = (await client.callTool({
      name: 'get_chat_history',
      arguments: { limit: -1 },
    })) as ToolResult;

    assertToolError(result);

    await client.close();
    await server.close();
  });

  it('get_chat_history with limit exceeding max returns isError', async () => {
    const { client, server } = await createConnectedPair();
    const result = (await client.callTool({
      name: 'get_chat_history',
      arguments: { limit: 999 },
    })) as ToolResult;

    assertToolError(result);

    await client.close();
    await server.close();
  });

  it('get_activity_feed with negative offset returns isError', async () => {
    const { client, server } = await createConnectedPair();
    const result = (await client.callTool({
      name: 'get_activity_feed',
      arguments: { offset: -5 },
    })) as ToolResult;

    assertToolError(result);

    await client.close();
    await server.close();
  });

  it('update_task with labels as string instead of array returns isError', async () => {
    globalThis.fetch = mockFetch(200, {});
    const { client, server } = await createConnectedPair();
    const result = (await client.callTool({
      name: 'update_task',
      arguments: { taskId: 'task-1', labels: 'not-an-array' },
    })) as ToolResult;

    assertToolError(result);

    await client.close();
    await server.close();
  });
});

// ── Network / API Failures ──────────────────────────────────────

describe('MCP Error Handling — Network & API Failures', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns isError when API returns 500', async () => {
    globalThis.fetch = mockFetch(500, { error: 'Internal Server Error' });
    const { client, server } = await createConnectedPair();

    const result = (await client.callTool({
      name: 'update_task',
      arguments: { taskId: 'task-1', title: 'test' },
    })) as ToolResult;

    assertToolError(result, 'Error');

    await client.close();
    await server.close();
  });

  it('returns isError when API returns 404', async () => {
    globalThis.fetch = mockFetch(404, { error: 'Not Found' });
    const { client, server } = await createConnectedPair();

    const result = (await client.callTool({
      name: 'update_task_status',
      arguments: { taskId: 'nonexistent', status: 'done' },
    })) as ToolResult;

    assertToolError(result);

    await client.close();
    await server.close();
  });

  it('delete_task returns isError on non-OK status', async () => {
    globalThis.fetch = mockFetch(403, { error: 'Forbidden' });
    const { client, server } = await createConnectedPair();

    const result = (await client.callTool({
      name: 'delete_task',
      arguments: { taskId: 'task-1' },
    })) as ToolResult;

    assertToolError(result);

    await client.close();
    await server.close();
  });

  it('handles fetch network error gracefully on tool call', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { client, server } = await createConnectedPair();

    // Network errors surface as isError responses (SDK catches and wraps)
    const result = (await client.callTool({
      name: 'list_agents',
      arguments: {},
    })) as ToolResult;

    assertToolError(result, 'ECONNREFUSED');

    await client.close();
    await server.close();
  });

  it('handles fetch network error on resource read', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { client, server } = await createConnectedPair();

    await expect(
      client.readResource({ uri: 'squad://agents' }),
    ).rejects.toThrow();

    await client.close();
    await server.close();
  });

  it('handles fetch network error on prompt execution', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { client, server } = await createConnectedPair();

    await expect(
      client.getPrompt({ name: 'squad-status-summary' }),
    ).rejects.toThrow();

    await client.close();
    await server.close();
  });
});

// ── Invalid Resource URIs ───────────────────────────────────────

describe('MCP Error Handling — Invalid Resource URIs', () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    globalThis.fetch = mockFetch(200, []);
    ({ client, server } = await createConnectedPair());
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await client.close();
    await server.close();
  });

  it('rejects read of unknown resource URI', async () => {
    await expect(
      client.readResource({ uri: 'squad://nonexistent' }),
    ).rejects.toThrow();
  });

  it('rejects read of malformed URI scheme', async () => {
    await expect(
      client.readResource({ uri: 'http://example.com/not-a-resource' }),
    ).rejects.toThrow();
  });

  it('rejects read of completely invalid URI', async () => {
    await expect(
      client.readResource({ uri: '' }),
    ).rejects.toThrow();
  });
});

// ── Invalid Prompt Names ────────────────────────────────────────

describe('MCP Error Handling — Invalid Prompt Names', () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    globalThis.fetch = mockFetch(200, []);
    ({ client, server } = await createConnectedPair());
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await client.close();
    await server.close();
  });

  it('rejects get of non-existent prompt', async () => {
    await expect(
      client.getPrompt({ name: 'nonexistent-prompt' }),
    ).rejects.toThrow();
  });

  it('rejects get of empty prompt name', async () => {
    await expect(
      client.getPrompt({ name: '' }),
    ).rejects.toThrow();
  });
});
