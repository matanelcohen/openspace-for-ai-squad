import 'dotenv/config';
import './telemetry.js';

import { resolve } from 'node:path';

import { buildApp } from './app.js';

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
const HOST = process.env.API_HOST ?? '0.0.0.0';
const SERVE_UI = process.env.SERVE_UI !== 'false';

async function start() {
  const app = await buildApp();

  // Serve Next.js UI on the same port (only in production via openspace CLI)
  if (SERVE_UI && !process.env.TURBO_HASH && process.env.NODE_ENV !== 'development') {
    try {
      const webDir = resolve(import.meta.dirname ?? __dirname, '../../web');
      await app.register(import('@fastify/nextjs'), { dir: webDir, dev: false });
      app.next('/*');
      app.log.info(`[UI] Next.js serving from ${webDir}`);
    } catch {
      // Next.js not available — API-only mode (normal for pnpm dev)
    }
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully…`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
