import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../server.js';

// ── Helpers ──────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown, statusText = 'OK') {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  });
}

async function createConnectedPair() {
  const server = createServer();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

// ── Tests ────────────────────────────────────────────────────────

describe('MCP Server — tool registration', () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    ({ client, server } = await createConnectedPair());
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('lists all expected tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    const expected = [
      'approve_task',
      'create_task',
      'delete_task',
      'get_activity_feed',
      'get_agent',
      'get_agent_status',
      'get_chat_history',
      'get_squad_status',
      'get_task',
      'list_agents',
      'list_decisions',
      'list_tasks',
      'reject_task',
      'send_chat_message',
      'update_task',
      'update_task_status',
    ].sort();

    expect(names).toEqual(expected);
  });

  it('has 16 tools total', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(16);
  });
});

describe('MCP Server — tool schemas', () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    ({ client, server } = await createConnectedPair());
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  function findTool(tools: Array<{ name: string; inputSchema?: unknown }>, name: string) {
    return tools.find((t) => t.name === name);
  }

  it('update_task has correct params', async () => {
    const { tools } = await client.listTools();
    const tool = findTool(tools, 'update_task');
    expect(tool).toBeDefined();
    const props = (tool!.inputSchema as Record<string, unknown>)?.properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty('taskId');
    expect(props).toHaveProperty('title');
    expect(props).toHaveProperty('description');
    expect(props).toHaveProperty('assignee');
    expect(props).toHaveProperty('priority');
    expect(props).toHaveProperty('status');
    expect(props).toHaveProperty('labels');
  });

  it('delete_task requires taskId', async () => {
    const { tools } = await client.listTools();
    const tool = findTool(tools, 'delete_task');
    const schema = tool!.inputSchema as Record<string, unknown>;
    expect((schema.required as string[]) ?? []).toContain('taskId');
  });

  it('approve_task requires taskId', async () => {
    const { tools } = await client.listTools();
    const tool = findTool(tools, 'approve_task');
    const schema = tool!.inputSchema as Record<string, unknown>;
    expect((schema.required as string[]) ?? []).toContain('taskId');
  });

  it('reject_task requires taskId', async () => {
    const { tools } = await client.listTools();
    const tool = findTool(tools, 'reject_task');
    const schema = tool!.inputSchema as Record<string, unknown>;
    expect((schema.required as string[]) ?? []).toContain('taskId');
  });

  it('get_chat_history has optional pagination params', async () => {
    const { tools } = await client.listTools();
    const tool = findTool(tools, 'get_chat_history');
    expect(tool).toBeDefined();
    const props = (tool!.inputSchema as Record<string, unknown>)?.properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty('limit');
    expect(props).toHaveProperty('offset');
    expect(props).toHaveProperty('agent');
    expect(props).toHaveProperty('threadId');
    // All are optional — required should not include them
    const required = (tool!.inputSchema as Record<string, unknown>)?.required as
      | string[]
      | undefined;
    expect(required ?? []).not.toContain('limit');
  });

  it('get_activity_feed has optional pagination params', async () => {
    const { tools } = await client.listTools();
    const tool = findTool(tools, 'get_activity_feed');
    expect(tool).toBeDefined();
    const props = (tool!.inputSchema as Record<string, unknown>)?.properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty('limit');
    expect(props).toHaveProperty('offset');
  });

  it('get_agent_status has no required params', async () => {
    const { tools } = await client.listTools();
    const tool = findTool(tools, 'get_agent_status');
    expect(tool).toBeDefined();
    const required = (tool!.inputSchema as Record<string, unknown>)?.required as
      | string[]
      | undefined;
    expect(required ?? []).toHaveLength(0);
  });
});

describe('MCP Server — tool execution', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('delete_task calls DELETE /api/tasks/:id', async () => {
    const fetchMock = mockFetch(204, null);
    globalThis.fetch = fetchMock;

    const { client, server } = await createConnectedPair();
    const result = await client.callTool({ name: 'delete_task', arguments: { taskId: 'task-1' } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/task-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('deleted successfully');

    await client.close();
    await server.close();
  });

  it('approve_task calls PATCH /api/tasks/:id/approve', async () => {
    const fetchMock = mockFetch(200, { id: 'task-1', status: 'backlog' });
    globalThis.fetch = fetchMock;

    const { client, server } = await createConnectedPair();
    const result = await client.callTool({ name: 'approve_task', arguments: { taskId: 'task-1' } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/task-1/approve'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(result.isError).toBeFalsy();

    await client.close();
    await server.close();
  });

  it('reject_task handles 204 No Content', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: () => Promise.reject(new Error('no body')),
    });

    const { client, server } = await createConnectedPair();
    const result = await client.callTool({ name: 'reject_task', arguments: { taskId: 'task-1' } });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('rejected and removed');

    await client.close();
    await server.close();
  });

  it('update_task sends PUT with all fields', async () => {
    const fetchMock = mockFetch(200, { id: 'task-1', title: 'updated' });
    globalThis.fetch = fetchMock;

    const { client, server } = await createConnectedPair();
    await client.callTool({
      name: 'update_task',
      arguments: {
        taskId: 'task-1',
        title: 'updated',
        priority: 'P0',
        labels: ['urgent'],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/task-1'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"title":"updated"'),
      }),
    );

    await client.close();
    await server.close();
  });

  it('get_chat_history passes query params', async () => {
    const fetchMock = mockFetch(200, { messages: [], total: 0 });
    globalThis.fetch = fetchMock;

    const { client, server } = await createConnectedPair();
    await client.callTool({
      name: 'get_chat_history',
      arguments: { limit: 10, agent: 'bender' },
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=10');
    expect(url).toContain('agent=bender');

    await client.close();
    await server.close();
  });

  it('get_agent_status calls /api/agents/status', async () => {
    const fetchMock = mockFetch(200, { agents: {} });
    globalThis.fetch = fetchMock;

    const { client, server } = await createConnectedPair();
    await client.callTool({ name: 'get_agent_status', arguments: {} });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/agents/status'));

    await client.close();
    await server.close();
  });

  it('get_activity_feed calls /api/activity with pagination', async () => {
    const fetchMock = mockFetch(200, { events: [], total: 0 });
    globalThis.fetch = fetchMock;

    const { client, server } = await createConnectedPair();
    await client.callTool({
      name: 'get_activity_feed',
      arguments: { limit: 20, offset: 5 },
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=5');

    await client.close();
    await server.close();
  });

  it('returns isError:true on non-OK response', async () => {
    const fetchMock = mockFetch(404, { error: 'Task not found: nope' });
    globalThis.fetch = fetchMock;

    const { client, server } = await createConnectedPair();
    const result = await client.callTool({
      name: 'update_task',
      arguments: { taskId: 'nope', title: 'x' },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Error');

    await client.close();
    await server.close();
  });
});
