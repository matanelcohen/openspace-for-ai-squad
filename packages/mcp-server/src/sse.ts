#!/usr/bin/env node

/**
 * openspace-mcp SSE transport entry point.
 *
 * Usage:
 *   node dist/sse.js                # default: SSE on :3002, API at localhost:3001
 *   MCP_PORT=8080 node dist/sse.js  # custom SSE port
 */

import 'dotenv/config';

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';

import { createServer } from './server.js';

const PORT = Number(process.env.MCP_PORT ?? 3002);

const app = express();

// Store active transports for cleanup
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (_req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);

  res.on('close', () => {
    transports.delete(transport.sessionId);
  });

  const server = createServer();
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', transport: 'sse', sessions: transports.size });
});

app.listen(PORT, () => {
  console.log(`openspace-mcp SSE server listening on http://localhost:${PORT}`);
  console.log(`  SSE endpoint:  http://localhost:${PORT}/sse`);
  console.log(`  Health check:  http://localhost:${PORT}/health`);
});
