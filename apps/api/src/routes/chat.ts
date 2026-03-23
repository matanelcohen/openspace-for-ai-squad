/**
 * Chat API — P3-4
 *
 * POST /api/chat/messages — send a message
 * GET  /api/chat/messages — retrieve message history (paginated, filterable)
 */

import type { FastifyPluginAsync } from 'fastify';

import type { ChatService, SendMessageInput } from '../services/chat/index.js';

const chatRoute: FastifyPluginAsync = async (app) => {
  // POST /api/chat/messages — send a message
  app.post<{ Body: SendMessageInput }>('/chat/messages', async (request, reply) => {
    const body = request.body;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }

    if (typeof body.sender !== 'string' || body.sender.trim() === '') {
      return reply.status(400).send({ error: 'Field "sender" is required' });
    }

    if (typeof body.recipient !== 'string' || body.recipient.trim() === '') {
      return reply.status(400).send({ error: 'Field "recipient" is required' });
    }

    if (typeof body.content !== 'string' || body.content.trim() === '') {
      return reply.status(400).send({ error: 'Field "content" is required and must be non-empty' });
    }

    const message = await app.chatService.send({
      sender: body.sender.trim(),
      recipient: body.recipient.trim(),
      content: body.content,
      threadId: body.threadId ?? null,
    });

    return reply.status(201).send(message);
  });

  // GET /api/chat/messages — history with pagination + filtering
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      agent?: string;
      threadId?: string;
    };
  }>('/chat/messages', async (request, reply) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(request.query.offset) || 0, 0);
    const agent = request.query.agent || undefined;
    const threadId = request.query.threadId || undefined;

    const result = app.chatService.getMessages({ limit, offset, agent, threadId });

    return reply.send({
      messages: result.messages,
      total: result.total,
      limit,
      offset,
    });
  });
};

export default chatRoute;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    chatService: ChatService;
  }
}
