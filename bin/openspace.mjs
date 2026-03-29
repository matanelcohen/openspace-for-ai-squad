#!/usr/bin/env node

/**
 * openspace CLI — starts the openspace.ai platform.
 *
 * Usage:
 *   openspace              Start API + Web (default)
 *   openspace --api-only   Start API server only
 *   openspace --port 3001  Custom API port
 *   openspace --web-port 3000  Custom web port
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
const apiOnly = args.includes('--api-only');
const apiPort = getArg('--port') ?? getArg('--api-port') ?? '3001';
const webPort = getArg('--web-port') ?? '3000';
const help = args.includes('--help') || args.includes('-h');

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

if (help) {
  console.log(`
🚀 openspace.ai — AI Squad Management Platform

Usage:
  openspace                    Start API + Web servers
  openspace --api-only         Start API server only
  openspace --port <port>      API port (default: 3001)
  openspace --web-port <port>  Web port (default: 3000)
  openspace --help             Show this help

Environment:
  COPILOT_CLI_URL    Copilot CLI server URL (e.g. localhost:3100)
  COPILOT_MODEL      AI model (default: claude-opus-4.6)
  SQUAD_DIR          Path to .squad directory (default: .squad)
`);
  process.exit(0);
}

// Check if built
const apiEntry = join(ROOT, 'apps', 'api', 'src', 'index.ts');
const webDir = join(ROOT, 'apps', 'web');

if (!existsSync(apiEntry)) {
  console.error('❌ API entry not found. Make sure the package is installed correctly.');
  process.exit(1);
}

console.log('🚀 openspace.ai starting...');
console.log(`   API: http://localhost:${apiPort}`);
if (!apiOnly) console.log(`   Web: http://localhost:${webPort}`);
console.log('');

// Start API
const apiProc = spawn('npx', ['tsx', apiEntry], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    API_PORT: apiPort,
    API_HOST: '0.0.0.0',
    WATCHPACK_POLLING: 'true',
  },
  stdio: 'inherit',
});

// Start Web (unless --api-only)
let webProc = null;
if (!apiOnly) {
  const nextBin = join(ROOT, 'node_modules', '.bin', 'next');
  if (existsSync(nextBin)) {
    webProc = spawn(nextBin, ['dev', '--port', webPort, '--hostname', '0.0.0.0'], {
      cwd: webDir,
      env: {
        ...process.env,
        WATCHPACK_POLLING: 'true',
      },
      stdio: 'inherit',
    });
  } else {
    // Try npx
    webProc = spawn('npx', ['next', 'dev', '--port', webPort, '--hostname', '0.0.0.0'], {
      cwd: webDir,
      env: {
        ...process.env,
        WATCHPACK_POLLING: 'true',
      },
      stdio: 'inherit',
    });
  }
}

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  apiProc.kill('SIGTERM');
  if (webProc) webProc.kill('SIGTERM');
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

apiProc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`API exited with code ${code}`);
    if (webProc) webProc.kill('SIGTERM');
    process.exit(code);
  }
});
