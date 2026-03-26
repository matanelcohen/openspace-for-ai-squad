#!/usr/bin/env node

/**
 * openspace-mcp — stdio transport entry point.
 *
 * Usage:
 *   npx openspace-mcp                          # default: connect to localhost:3001
 *   OPENSPACE_API_URL=http://host:3001 npx openspace-mcp
 *
 * This is the entry point registered in package.json `bin` for npx/CLI usage.
 */

import 'dotenv/config';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('openspace-mcp failed to start:', err);
  process.exit(1);
});
