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
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: { resources: { subscribe: true } } },
  );
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

// ── Resource registration ─────────────────────────────────────────

describe('MCP Server — resource registration', () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    // Mock fetch so resource reads don't fail
    globalThis.fetch = mockFetch(200, []);
    ({ client, server } = await createConnectedPair());
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await client.close();
    await server.close();
  });

  it('lists all static squad:// resources', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);

    expect(uris).toContain('squad://agents');
    expect(uris).toContain('squad://tasks');
    expect(uris).toContain('squad://activity');
    expect(uris).toContain('squad://decisions');
  });

  it('lists openspace:// resources for backward compatibility', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);

    expect(uris).toContain('openspace://squad');
    expect(uris).toContain('openspace://agents');
    expect(uris).toContain('openspace://tasks');
    expect(uris).toContain('openspace://decisions');
  });

  it('lists resource templates for squad://agents/{id} and squad://tasks/{id}', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    const patterns = resourceTemplates.map((t) => t.uriTemplate);

    expect(patterns).toContain('squad://agents/{id}');
    expect(patterns).toContain('squad://tasks/{id}');
  });

  it('reads squad://agents resource', async () => {
    const agents = [{ id: 'bender', role: 'backend' }];
    globalThis.fetch = mockFetch(200, agents);

    const result = await client.readResource({ uri: 'squad://agents' });
    const text = (result.contents[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual(agents);
  });

  it('reads squad://agents/{id} template resource', async () => {
    const agent = { id: 'bender', role: 'backend', expertise: ['TypeScript'] };
    globalThis.fetch = mockFetch(200, agent);

    const result = await client.readResource({ uri: 'squad://agents/bender' });
    const text = (result.contents[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual(agent);
  });

  it('reads squad://tasks resource', async () => {
    const tasks = [{ id: 'task-1', title: 'Test', status: 'backlog' }];
    globalThis.fetch = mockFetch(200, tasks);

    const result = await client.readResource({ uri: 'squad://tasks' });
    const text = (result.contents[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual(tasks);
  });

  it('reads squad://tasks/{id} template resource', async () => {
    const task = { id: 'task-1', title: 'Test', status: 'in-progress', subTasks: [] };
    globalThis.fetch = mockFetch(200, task);

    const result = await client.readResource({ uri: 'squad://tasks/task-1' });
    const text = (result.contents[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual(task);
  });

  it('reads squad://activity resource', async () => {
    const activity = { events: [{ type: 'task:created' }], total: 1 };
    globalThis.fetch = mockFetch(200, activity);

    const result = await client.readResource({ uri: 'squad://activity' });
    const text = (result.contents[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual(activity);
  });

  it('reads squad://decisions resource', async () => {
    const decisions = [{ id: 'd1', title: 'Use TypeScript' }];
    globalThis.fetch = mockFetch(200, decisions);

    const result = await client.readResource({ uri: 'squad://decisions' });
    const text = (result.contents[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual(decisions);
  });
});

// ── Prompt registration ──────────────────────────────────────────

describe('MCP Server — prompt registration', () => {
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

  it('lists squad-status-summary and plan-feature prompts', async () => {
    const { prompts } = await client.listPrompts();
    const names = prompts.map((p) => p.name).sort();

    expect(names).toContain('squad-status-summary');
    expect(names).toContain('plan-feature');
  });

  it('squad-status-summary has no required arguments', async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === 'squad-status-summary');
    expect(prompt).toBeDefined();
    // Zero-arg prompt — arguments should be absent or empty
    expect(prompt!.arguments ?? []).toHaveLength(0);
  });

  it('plan-feature has a required "feature" argument', async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === 'plan-feature');
    expect(prompt).toBeDefined();
    const featureArg = (prompt!.arguments ?? []).find(
      (a: { name: string }) => a.name === 'feature',
    );
    expect(featureArg).toBeDefined();
    expect(featureArg!.required).toBe(true);
  });

  it('squad-status-summary returns prompt messages with squad context', async () => {
    const squad = { agents: [], tasks: [] };
    const activity = { events: [], total: 0 };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(squad),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(activity),
      });

    const result = await client.getPrompt({ name: 'squad-status-summary' });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('squad');
    expect(text).toContain('status summary');
  });

  it('plan-feature returns prompt messages with feature context', async () => {
    const agents = [{ id: 'bender' }];
    const tasks = [{ id: 'task-1' }];
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(agents),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(tasks),
      });

    const result = await client.getPrompt({
      name: 'plan-feature',
      arguments: { feature: 'Add WebSocket support' },
    });
    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('Add WebSocket support');
    expect(text).toContain('Available Agents');
  });
});

// ── Resource subscriptions ──────────────────────────────────────

describe('MCP Server — resource subscriptions', () => {
  it('notifyResourceUpdated does not throw when connected', async () => {
    const { client, server } = await createConnectedPair();

    // Should not throw
    server.notifyResourceUpdated('squad://tasks');
    server.notifyResourceUpdated('squad://activity');

    await client.close();
    await server.close();
  });

  it('notifyResourceUpdated does not throw when no client connected', () => {
    const server = createServer();
    // No transport connected — should silently swallow
    expect(() => server.notifyResourceUpdated('squad://tasks')).not.toThrow();
  });
});
