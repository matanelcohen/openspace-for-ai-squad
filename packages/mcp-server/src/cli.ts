#!/usr/bin/env node

/**
 * openspace-mcp — stdio transport entry point.
 *
 * Usage:
 *   npx openspace-mcp                          # default: connect to localhost:3001
 *   OPENSPACE_API_URL=http://host:3001 npx openspace-mcp
 *
 * This is the entry point registered in package.json `bin` for npx/CLI usage
 * and also serves as the standalone `bin/mcp-server` for Claude Desktop, Cursor, etc.
 */

import 'dotenv/config';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    process.stderr.write(`openspace-mcp received ${signal}, shutting down…\n`);
    await transport.close();
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await server.connect(transport);
  process.stderr.write('openspace-mcp stdio transport ready\n');
}

main().catch((err) => {
  console.error('openspace-mcp failed to start:', err);
  process.exit(1);
});
