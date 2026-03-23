import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';

import healthRoute from './routes/health.js';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
}

export function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  // Plugins
  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });

  // Routes
  app.register(healthRoute);

  return app;
}
