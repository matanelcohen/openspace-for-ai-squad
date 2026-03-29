/**
 * MCP Transport Tests
 *
 * Verifies connectivity and protocol flow over different transports:
 * - InMemory transport: lifecycle, connect/disconnect, concurrent sessions
 * - SSE transport: Express server serves /sse and /messages, health check
 * - Stdio transport: child process exchanges JSON-RPC messages over stdin/stdout
 */

import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../server.js';

// ── Helpers ──────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  });
}

// ── InMemory Transport Tests ────────────────────────────────────

describe('Transport — InMemory', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('connects and exchanges messages successfully', async () => {
    globalThis.fetch = mockFetch(200, []);
    const server = createServer();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);

    await client.close();
    await server.close();
  });

  it('supports clean disconnect and reconnect', async () => {
    globalThis.fetch = mockFetch(200, []);

    // First connection
    const server1 = createServer();
    const client1 = new Client({ name: 'test-client', version: '1.0.0' });
    const [ct1, st1] = InMemoryTransport.createLinkedPair();
    await Promise.all([server1.connect(st1), client1.connect(ct1)]);
    const { tools: tools1 } = await client1.listTools();
    expect(tools1.length).toBe(16);
    await client1.close();
    await server1.close();

    // Second connection (new pair)
    const server2 = createServer();
    const client2 = new Client({ name: 'test-client', version: '1.0.0' });
    const [ct2, st2] = InMemoryTransport.createLinkedPair();
    await Promise.all([server2.connect(st2), client2.connect(ct2)]);
    const { tools: tools2 } = await client2.listTools();
    expect(tools2.length).toBe(16);
    await client2.close();
    await server2.close();
  });

  it('supports multiple concurrent sessions', async () => {
    globalThis.fetch = mockFetch(200, [{ id: 'agent-1' }]);

    const server1 = createServer();
    const server2 = createServer();
    const client1 = new Client({ name: 'client-1', version: '1.0.0' });
    const client2 = new Client({ name: 'client-2', version: '1.0.0' });

    const [ct1, st1] = InMemoryTransport.createLinkedPair();
    const [ct2, st2] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server1.connect(st1),
      client1.connect(ct1),
      server2.connect(st2),
      client2.connect(ct2),
    ]);

    // Both clients should work independently
    const [result1, result2] = await Promise.all([
      client1.listTools(),
      client2.listTools(),
    ]);

    expect(result1.tools.length).toBe(16);
    expect(result2.tools.length).toBe(16);

    await Promise.all([
      client1.close(),
      client2.close(),
      server1.close(),
      server2.close(),
    ]);
  });

  it('tool calls work end-to-end over InMemory transport', async () => {
    globalThis.fetch = mockFetch(200, [{ id: 'bender', role: 'backend' }]);

    const server = createServer();
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);

    const result = await client.callTool({ name: 'list_agents', arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe('text');
    expect(JSON.parse(content[0].text)).toEqual([{ id: 'bender', role: 'backend' }]);

    await client.close();
    await server.close();
  });

  it('resource reads work end-to-end over InMemory transport', async () => {
    globalThis.fetch = mockFetch(200, [{ id: 'task-1' }]);

    const server = createServer();
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: { resources: { subscribe: true } } },
    );
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);

    const result = await client.readResource({ uri: 'squad://tasks' });
    expect(result.contents).toHaveLength(1);
    const text = (result.contents[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual([{ id: 'task-1' }]);

    await client.close();
    await server.close();
  });
});

// ── SSE Transport Tests ─────────────────────────────────────────

describe('Transport — SSE', () => {
  const originalFetch = globalThis.fetch;

  // We import express and spin up the SSE server inline to test the transport
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  let expressApp: ReturnType<typeof import('express')['default']> | undefined;
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  let httpServer: import('node:http').Server | undefined;
  const SSE_PORT = 19283; // high ephemeral port to avoid collisions

  beforeAll(async () => {
    // Dynamic import to match the ESM setup
    const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
    const express = (await import('express')).default;

    expressApp = express();
    const transports = new Map<string, InstanceType<typeof SSEServerTransport>>();

    expressApp.get('/sse', async (_req, res) => {
      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);
      _req.on('close', () => transports.delete(transport.sessionId));
      const server = createServer();
      await server.connect(transport);
    });

    expressApp.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      await transport.handlePostMessage(req, res);
    });

    expressApp.get('/health', (_req, res) => {
      res.json({ status: 'ok', transport: 'sse', sessions: transports.size });
    });

    await new Promise<void>((resolve) => {
      httpServer = expressApp!.listen(SSE_PORT, () => resolve());
    });
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  beforeEach(() => {
    // Restore real fetch for SSE tests — they need actual HTTP
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('health endpoint responds on SSE server', async () => {
    const res = await fetch(`http://localhost:${SSE_PORT}/health`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.transport).toBe('sse');
  });

  it('SSE client connects and lists tools', async () => {
    const transport = new SSEClientTransport(
      new URL(`http://localhost:${SSE_PORT}/sse`),
    );
    const client = new Client({ name: 'sse-test-client', version: '1.0.0' });

    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.length).toBe(16);

    await client.close();
  });

  it('SSE client can list resources', async () => {
    const transport = new SSEClientTransport(
      new URL(`http://localhost:${SSE_PORT}/sse`),
    );
    const client = new Client(
      { name: 'sse-test-client', version: '1.0.0' },
      { capabilities: { resources: { subscribe: true } } },
    );

    await client.connect(transport);

    const { resources } = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('squad://agents');
    expect(uris).toContain('squad://tasks');

    await client.close();
  });

  it('SSE client can list prompts', async () => {
    const transport = new SSEClientTransport(
      new URL(`http://localhost:${SSE_PORT}/sse`),
    );
    const client = new Client({ name: 'sse-test-client', version: '1.0.0' });

    await client.connect(transport);

    const { prompts } = await client.listPrompts();
    expect(prompts.length).toBeGreaterThan(0);
    const names = prompts.map((p) => p.name);
    expect(names).toContain('squad-status-summary');
    expect(names).toContain('plan-feature');

    await client.close();
  });

  it('SSE client gets server version info', async () => {
    const transport = new SSEClientTransport(
      new URL(`http://localhost:${SSE_PORT}/sse`),
    );
    const client = new Client({ name: 'sse-test-client', version: '1.0.0' });

    await client.connect(transport);

    const info = client.getServerVersion();
    expect(info).toBeDefined();
    expect(info!.name).toBe('openspace-mcp');

    await client.close();
  });
});

// ── Stdio Transport Tests ───────────────────────────────────────

describe('Transport — Stdio', () => {
  // The CLI entry point is at packages/mcp-server/src/cli.ts
  // We use tsx to run it in TypeScript directly
  const cliPath = path.resolve(import.meta.dirname, '..', 'cli.ts');

  it('stdio client connects and lists tools via child process', async () => {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', cliPath],
      env: {
        ...process.env,
        OPENSPACE_API_URL: 'http://localhost:19999', // won't be called
      },
    });

    const client = new Client({ name: 'stdio-test-client', version: '1.0.0' });

    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.length).toBe(16);
    expect(tools.map((t) => t.name)).toContain('list_agents');

    const info = client.getServerVersion();
    expect(info).toBeDefined();
    expect(info!.name).toBe('openspace-mcp');

    await client.close();
  }, 30_000); // allow time for process spawn

  it('stdio client can list prompts and resource templates', async () => {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', cliPath],
      env: {
        ...process.env,
        OPENSPACE_API_URL: 'http://localhost:19999',
      },
    });

    const client = new Client(
      { name: 'stdio-test-client', version: '1.0.0' },
      { capabilities: { resources: { subscribe: true } } },
    );

    await client.connect(transport);

    // listPrompts and listResourceTemplates don't trigger fetch calls
    const [promptsResult, templatesResult] = await Promise.all([
      client.listPrompts(),
      client.listResourceTemplates(),
    ]);

    expect(promptsResult.prompts.length).toBeGreaterThan(0);
    expect(promptsResult.prompts.map((p) => p.name)).toContain('squad-status-summary');

    expect(templatesResult.resourceTemplates.length).toBeGreaterThan(0);
    expect(templatesResult.resourceTemplates.map((t) => t.uriTemplate)).toContain('squad://agents/{id}');

    await client.close();
  }, 30_000);
});
