import type { FastifyPluginAsync } from 'fastify';

import type { WorkspaceService } from '../services/workspace/index.js';

const workspacesRoute: FastifyPluginAsync = async (app) => {
  /** List all workspaces. */
  app.get('/workspaces', async (_request, reply) => {
    return reply.send(app.workspaceService.list());
  });

  /** Get the currently active workspace. */
  app.get('/workspaces/active', async (_request, reply) => {
    const active = app.workspaceService.getActive();
    if (!active) {
      return reply.status(404).send({ error: 'No active workspace' });
    }
    return reply.send(active);
  });

  /** Create a new workspace. */
  app.post<{
    Body: { name: string; projectDir: string; icon?: string };
  }>('/workspaces', async (request, reply) => {
    const { name, projectDir, icon } = request.body ?? {};
    if (!name || !projectDir) {
      return reply.status(400).send({ error: 'name and projectDir are required' });
    }
    const workspace = app.workspaceService.create({ name, projectDir, icon });
    return reply.status(201).send(workspace);
  });

  /** Update workspace metadata. */
  app.put<{
    Params: { id: string };
    Body: { name?: string; icon?: string; description?: string };
  }>('/workspaces/:id', async (request, reply) => {
    const workspace = app.workspaceService.update(request.params.id, request.body ?? {});
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }
    return reply.send(workspace);
  });

  /** Delete a workspace. */
  app.delete<{ Params: { id: string } }>('/workspaces/:id', async (request, reply) => {
    const deleted = app.workspaceService.delete(request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }
    return reply.send({ success: true });
  });

  /** Activate a workspace. */
  app.post<{ Params: { id: string } }>('/workspaces/:id/activate', async (request, reply) => {
    const workspace = app.workspaceService.setActive(request.params.id);
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }
    return reply.send(workspace);
  });
};

export default workspacesRoute;

declare module 'fastify' {
  interface FastifyInstance {
    workspaceService: WorkspaceService;
  }
}
