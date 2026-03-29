#!/usr/bin/env node

/**
 * openspace CLI — starts the openspace.ai platform.
 * Single process: Fastify API + Next.js UI on one port.
 *
 * Usage:
 *   openspace              Start on port 3000
 *   openspace --port 8080  Custom port
 *   openspace --api-only   No UI, API only
 *   openspace --help       Show help
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const port = getArg('--port') ?? '3000';
const apiOnly = args.includes('--api-only');
const isDev = args.includes('--dev');
const help = args.includes('--help') || args.includes('-h');

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

if (help) {
  console.log(`
🚀 openspace.ai — AI Squad Management Platform

Usage:
  openspace              Start on port 3000 (API + UI, production)
  openspace --dev        Start in development mode (with HMR)
  openspace --port 8080  Custom port
  openspace --api-only   Start API without UI
  openspace --help       Show this help

Environment:
  COPILOT_CLI_URL    Copilot CLI server URL (e.g. localhost:3100)
  COPILOT_MODEL      AI model (default: claude-opus-4.6)
  PORT               Server port (default: 3000)
`);
  process.exit(0);
}

const apiEntry = join(ROOT, 'apps', 'api', 'src', 'index.ts');
if (!existsSync(apiEntry)) {
  console.error('❌ API not found. Run from the openspace-ai directory or install globally.');
  process.exit(1);
}

// Find tsx binary
const tsxPaths = [
  join(ROOT, 'node_modules', '.bin', 'tsx'),
  join(ROOT, 'apps', 'api', 'node_modules', '.bin', 'tsx'),
];
let tsxBin = tsxPaths.find(p => existsSync(p));

console.log(`🚀 openspace.ai starting on port ${port}...`);
console.log(`   http://localhost:${port}${isDev ? ' (dev mode)' : ''}`);

// Production mode needs a built Next.js app
if (!isDev && !apiOnly) {
  const nextDir = join(ROOT, 'apps', 'web', '.next');
  if (!existsSync(nextDir)) {
    console.log('   📦 Building Next.js for production (first run)...');
    const { execSync } = await import('node:child_process');
    try {
      execSync('npx next build', { cwd: join(ROOT, 'apps', 'web'), stdio: 'inherit', env });
    } catch {
      console.warn('   ⚠️  Build failed — falling back to dev mode');
      env.NODE_ENV = 'development';
      env.OPENSPACE_DEV = 'true';
    }
  }
}

console.log('');

const env = {
  ...process.env,
  PORT: port,
  API_PORT: port,
  API_HOST: '0.0.0.0',
  SERVE_UI: apiOnly ? 'false' : 'true',
  NODE_ENV: isDev ? 'development' : 'production',
  OPENSPACE_DEV: isDev ? 'true' : 'false',
};

const proc = tsxBin
  ? spawn(tsxBin, [apiEntry], { cwd: process.cwd(), env, stdio: 'inherit' })
  : spawn('npx', ['tsx', apiEntry], { cwd: ROOT, env, stdio: 'inherit' });

function shutdown(signal) {
  console.log(`\n${signal}, shutting down...`);
  proc.kill('SIGTERM');
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
proc.on('exit', (code) => process.exit(code ?? 0));
