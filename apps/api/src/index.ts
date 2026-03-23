import 'dotenv/config';

import { buildApp } from './app.js';

const PORT = Number(process.env.API_PORT ?? 3001);
const HOST = process.env.API_HOST ?? '0.0.0.0';

async function start() {
  const app = buildApp();

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
