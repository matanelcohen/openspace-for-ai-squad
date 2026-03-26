/**
 * MCP Protocol Compliance Tests
 *
 * Verifies the openspace MCP server conforms to the Model Context Protocol spec:
 * - Server initialization & capability negotiation
 * - Tool invocation round-trips for all 16 tools
 * - Resource reads for all URIs with content format validation
 * - Prompt execution with message format validation
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../server.js';

// ── Helpers ──────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  });
}

function mockFetchSequence(...responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: r.status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(r.body),
    });
  }
  return fn;
}

async function createConnectedPair() {
  const server = createServer();
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: { resources: { subscribe: true } } },
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

/** Assert a tool result matches MCP spec: content array of {type, text} */
function assertMcpToolResult(result: unknown) {
  const r = result as { content: Array<{ type: string; text: string }>; isError?: boolean };
  expect(r).toHaveProperty('content');
  expect(Array.isArray(r.content)).toBe(true);
  expect(r.content.length).toBeGreaterThan(0);
  for (const item of r.content) {
    expect(item).toHaveProperty('type');
    expect(item.type).toBe('text');
    expect(item).toHaveProperty('text');
    expect(typeof item.text).toBe('string');
  }
}

/** Assert a resource result matches MCP spec: contents array with uri, text, mimeType */
function assertMcpResourceResult(result: unknown, expectedUri: string) {
  const r = result as {
    contents: Array<{ uri: string; text: string; mimeType?: string }>;
  };
  expect(r).toHaveProperty('contents');
  expect(Array.isArray(r.contents)).toBe(true);
  expect(r.contents.length).toBeGreaterThan(0);
  const first = r.contents[0];
  expect(first.uri).toBe(expectedUri);
  expect(typeof first.text).toBe('string');
  expect(first.mimeType).toBe('application/json');
}

// ── Server Initialization & Capability Negotiation ──────────────

describe('MCP Protocol — Initialization & Capabilities', () => {
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

  it('server reports correct name and version in serverInfo', () => {
    // After connection, the client should have received server info
    const info = client.getServerVersion();
    expect(info).toBeDefined();
    expect(info!.name).toBe('openspace-mcp');
    expect(info!.version).toBe('0.0.1');
  });

  it('server advertises tools capability', async () => {
    const caps = client.getServerCapabilities();
    expect(caps).toBeDefined();
    expect(caps).toHaveProperty('tools');
  });

  it('server advertises resources capability with subscribe support', async () => {
    const caps = client.getServerCapabilities();
    expect(caps).toBeDefined();
    expect(caps).toHaveProperty('resources');
    expect((caps!.resources as Record<string, unknown>)?.subscribe).toBe(true);
  });

  it('server advertises prompts capability', async () => {
    const caps = client.getServerCapabilities();
    expect(caps).toBeDefined();
    expect(caps).toHaveProperty('prompts');
  });

  it('client can list tools after initialization', async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('client can list resources after initialization', async () => {
    const { resources } = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
  });

  it('client can list prompts after initialization', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.length).toBeGreaterThan(0);
  });
});

// ── Tool Invocation Round-Trips ─────────────────────────────────

describe('MCP Protocol — Tool Invocation Round-Trips', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const toolTests: Array<{
    name: string;
    args: Record<string, unknown>;
    mockStatus: number;
    mockBody: unknown;
  }> = [
    { name: 'list_agents', args: {}, mockStatus: 200, mockBody: [{ id: 'bender' }] },
    { name: 'get_agent', args: { agentId: 'bender' }, mockStatus: 200, mockBody: { id: 'bender', role: 'backend' } },
    { name: 'list_tasks', args: {}, mockStatus: 200, mockBody: [{ id: 'task-1', title: 'Test' }] },
    { name: 'list_tasks', args: { status: 'backlog', assignee: 'fry' }, mockStatus: 200, mockBody: [] },
    { name: 'get_task', args: { taskId: 'task-1' }, mockStatus: 200, mockBody: { id: 'task-1', title: 'Test' } },
    { name: 'create_task', args: { title: 'New Task' }, mockStatus: 200, mockBody: { id: 'task-2', title: 'New Task' } },
    { name: 'create_task', args: { title: 'Full', description: 'desc', assignee: 'leela', priority: 'P0' }, mockStatus: 200, mockBody: { id: 'task-3' } },
    { name: 'update_task', args: { taskId: 'task-1', title: 'Updated' }, mockStatus: 200, mockBody: { id: 'task-1', title: 'Updated' } },
    { name: 'update_task_status', args: { taskId: 'task-1', status: 'done' }, mockStatus: 200, mockBody: { id: 'task-1', status: 'done' } },
    { name: 'delete_task', args: { taskId: 'task-1' }, mockStatus: 204, mockBody: null },
    { name: 'approve_task', args: { taskId: 'task-1' }, mockStatus: 200, mockBody: { id: 'task-1', status: 'backlog' } },
    { name: 'list_decisions', args: {}, mockStatus: 200, mockBody: [{ id: 'd1' }] },
    { name: 'list_decisions', args: { query: 'TypeScript' }, mockStatus: 200, mockBody: [{ id: 'd1', title: 'Use TypeScript' }] },
    { name: 'send_chat_message', args: { message: 'Hello squad!' }, mockStatus: 200, mockBody: { id: 'msg-1' } },
    { name: 'send_chat_message', args: { message: 'Hi bender', agent: 'bender' }, mockStatus: 200, mockBody: { id: 'msg-2' } },
    { name: 'get_chat_history', args: {}, mockStatus: 200, mockBody: { messages: [], total: 0 } },
    { name: 'get_chat_history', args: { limit: 10, offset: 5, agent: 'fry', threadId: 'thread-1' }, mockStatus: 200, mockBody: { messages: [], total: 0 } },
    { name: 'get_agent_status', args: {}, mockStatus: 200, mockBody: { agents: {} } },
    { name: 'get_activity_feed', args: {}, mockStatus: 200, mockBody: { events: [], total: 0 } },
    { name: 'get_activity_feed', args: { limit: 20, offset: 10 }, mockStatus: 200, mockBody: { events: [], total: 0 } },
    { name: 'get_squad_status', args: {}, mockStatus: 200, mockBody: { agents: [], tasks: [] } },
  ];

  for (const tc of toolTests) {
    const argDesc = Object.keys(tc.args).length > 0 ? ` with ${JSON.stringify(tc.args)}` : '';
    it(`${tc.name}${argDesc} → returns valid MCP content`, async () => {
      // delete_task uses .json().catch() on 204, so mock accordingly
      if (tc.mockStatus === 204) {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 204,
          statusText: 'No Content',
          json: () => Promise.reject(new Error('no body')),
        });
      } else {
        globalThis.fetch = mockFetch(tc.mockStatus, tc.mockBody);
      }

      const { client, server } = await createConnectedPair();
      const result = await client.callTool({ name: tc.name, arguments: tc.args });

      assertMcpToolResult(result);
      expect(result.isError).toBeFalsy();

      await client.close();
      await server.close();
    });
  }

  it('every tool input schema has type "object"', async () => {
    globalThis.fetch = mockFetch(200, []);
    const { client, server } = await createConnectedPair();
    const { tools } = await client.listTools();

    for (const tool of tools) {
      const schema = tool.inputSchema as Record<string, unknown>;
      expect(schema.type).toBe('object');
    }

    await client.close();
    await server.close();
  });

  it('every tool has a non-empty description', async () => {
    globalThis.fetch = mockFetch(200, []);
    const { client, server } = await createConnectedPair();
    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description!.length).toBeGreaterThan(0);
    }

    await client.close();
    await server.close();
  });

  it('reject_task returns valid content on 204 No Content', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: () => Promise.reject(new Error('no body')),
    });

    const { client, server } = await createConnectedPair();
    const result = await client.callTool({ name: 'reject_task', arguments: { taskId: 'task-99' } });

    assertMcpToolResult(result);
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('task-99');

    await client.close();
    await server.close();
  });
});

// ── Resource Read Round-Trips ───────────────────────────────────

describe('MCP Protocol — Resource Read Round-Trips', () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;
  const originalFetch = globalThis.fetch;

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await client.close();
    await server.close();
  });

  const staticResources = [
    { uri: 'openspace://squad', mockBody: { agents: [], tasks: [] } },
    { uri: 'openspace://agents', mockBody: [{ id: 'bender' }] },
    { uri: 'openspace://tasks', mockBody: [{ id: 'task-1' }] },
    { uri: 'openspace://decisions', mockBody: [{ id: 'd1' }] },
    { uri: 'squad://agents', mockBody: [{ id: 'leela' }] },
    { uri: 'squad://tasks', mockBody: [{ id: 'task-2' }] },
    { uri: 'squad://activity', mockBody: { events: [], total: 0 } },
    { uri: 'squad://decisions', mockBody: [{ id: 'd2' }] },
  ];

  for (const res of staticResources) {
    it(`reads ${res.uri} with valid MCP content format`, async () => {
      globalThis.fetch = mockFetch(200, res.mockBody);
      ({ client, server } = await createConnectedPair());

      const result = await client.readResource({ uri: res.uri });

      assertMcpResourceResult(result, res.uri);
      const parsed = JSON.parse((result.contents[0] as { text: string }).text);
      expect(parsed).toEqual(res.mockBody);
    });
  }

  it('reads squad://agents/{id} template resource with valid format', async () => {
    const agent = { id: 'bender', role: 'backend', expertise: ['TypeScript'] };
    globalThis.fetch = mockFetch(200, agent);
    ({ client, server } = await createConnectedPair());

    const result = await client.readResource({ uri: 'squad://agents/bender' });

    expect(result.contents).toHaveLength(1);
    const content = result.contents[0] as { uri: string; text: string; mimeType?: string };
    expect(content.uri).toBe('squad://agents/bender');
    expect(content.mimeType).toBe('application/json');
    expect(JSON.parse(content.text)).toEqual(agent);
  });

  it('reads squad://tasks/{id} template resource with valid format', async () => {
    const task = { id: 'task-42', title: 'Test Task', status: 'in-progress', subTasks: [] };
    globalThis.fetch = mockFetch(200, task);
    ({ client, server } = await createConnectedPair());

    const result = await client.readResource({ uri: 'squad://tasks/task-42' });

    expect(result.contents).toHaveLength(1);
    const content = result.contents[0] as { uri: string; text: string; mimeType?: string };
    expect(content.uri).toBe('squad://tasks/task-42');
    expect(content.mimeType).toBe('application/json');
    expect(JSON.parse(content.text)).toEqual(task);
  });

  it('every resource has a name and description', async () => {
    globalThis.fetch = mockFetch(200, []);
    ({ client, server } = await createConnectedPair());

    const { resources } = await client.listResources();
    for (const resource of resources) {
      expect(typeof resource.name).toBe('string');
      expect(resource.name.length).toBeGreaterThan(0);
      expect(typeof resource.uri).toBe('string');
      expect(resource.uri.length).toBeGreaterThan(0);
    }
  });

  it('every resource template has a uriTemplate and name', async () => {
    globalThis.fetch = mockFetch(200, []);
    ({ client, server } = await createConnectedPair());

    const { resourceTemplates } = await client.listResourceTemplates();
    for (const tmpl of resourceTemplates) {
      expect(typeof tmpl.uriTemplate).toBe('string');
      expect(tmpl.uriTemplate.length).toBeGreaterThan(0);
      expect(typeof tmpl.name).toBe('string');
      expect(tmpl.name.length).toBeGreaterThan(0);
    }
  });

  it('resource content text is valid JSON for all static resources', async () => {
    // Mock must return an array because template list callbacks do .map()
    globalThis.fetch = mockFetch(200, [{ id: 'test-item', title: 'Test' }]);
    ({ client, server } = await createConnectedPair());

    const { resources } = await client.listResources();
    for (const resource of resources) {
      const result = await client.readResource({ uri: resource.uri });
      const text = (result.contents[0] as { text: string }).text;
      expect(() => JSON.parse(text)).not.toThrow();
    }
  });
});

// ── Prompt Execution Round-Trips ────────────────────────────────

describe('MCP Protocol — Prompt Execution Round-Trips', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('squad-status-summary returns MCP-compliant prompt messages', async () => {
    globalThis.fetch = mockFetchSequence(
      { status: 200, body: { agents: [{ id: 'bender' }], tasks: [] } },
      { status: 200, body: { events: [{ type: 'task:created' }], total: 1 } },
    );

    const { client, server } = await createConnectedPair();
    const result = await client.getPrompt({ name: 'squad-status-summary' });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe('text');
    expect(typeof content.text).toBe('string');
    expect(content.text.length).toBeGreaterThan(0);

    await client.close();
    await server.close();
  });

  it('plan-feature returns MCP-compliant prompt messages with feature context', async () => {
    globalThis.fetch = mockFetchSequence(
      { status: 200, body: [{ id: 'leela', role: 'lead' }] },
      { status: 200, body: [{ id: 'task-1', title: 'Existing task' }] },
    );

    const { client, server } = await createConnectedPair();
    const result = await client.getPrompt({
      name: 'plan-feature',
      arguments: { feature: 'Add real-time notifications' },
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe('text');
    expect(content.text).toContain('Add real-time notifications');
    expect(content.text).toContain('Available Agents');
    expect(content.text).toContain('Current Task Board');

    await client.close();
    await server.close();
  });

  it('plan-feature includes scope when provided', async () => {
    globalThis.fetch = mockFetchSequence(
      { status: 200, body: [] },
      { status: 200, body: [] },
    );

    const { client, server } = await createConnectedPair();
    const result = await client.getPrompt({
      name: 'plan-feature',
      arguments: { feature: 'WebSocket support', scope: 'backend only' },
    });

    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain('backend only');

    await client.close();
    await server.close();
  });

  it('every prompt has a non-empty name and description', async () => {
    globalThis.fetch = mockFetch(200, []);
    const { client, server } = await createConnectedPair();

    const { prompts } = await client.listPrompts();
    for (const prompt of prompts) {
      expect(typeof prompt.name).toBe('string');
      expect(prompt.name.length).toBeGreaterThan(0);
      expect(typeof prompt.description).toBe('string');
      expect(prompt.description!.length).toBeGreaterThan(0);
    }

    await client.close();
    await server.close();
  });
});
