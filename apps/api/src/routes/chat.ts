/**
 * Chat API — P3-4
 *
 * POST   /api/chat/messages — send a message
 * GET    /api/chat/messages — retrieve message history (paginated, filterable)
 * DELETE /api/chat/messages — clear chat history (filterable by agent/channel)
 * GET    /api/chat/stream   — SSE streaming chat endpoint
 */

import type { FastifyPluginAsync } from 'fastify';

import type { ChatService, SendMessageInput } from '../services/chat/index.js';

const chatRoute: FastifyPluginAsync = async (app) => {
  // Allow DELETE (and other bodyless methods) to send Content-Type: application/json
  // without a body — the default Fastify JSON parser rejects empty payloads.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      const str = typeof body === 'string' ? body : (body as Buffer).toString();
      if (str.trim() === '') return done(null, undefined);
      try {
        done(null, JSON.parse(str));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

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

  // DELETE /api/chat/messages — clear chat history
  app.delete<{
    Querystring: { agent?: string; channel?: string };
  }>('/chat/messages', async (request, reply) => {
    const agent = request.query.agent || undefined;
    const channel = request.query.channel || undefined;
    const result = await app.chatService.clearMessages({ agent, channel });
    return reply.status(200).send(result);
  });

  // GET /api/chat/stream — SSE streaming chat endpoint
  app.get<{
    Querystring: { recipient?: string; content?: string };
  }>('/chat/stream', async (request, reply) => {
    const { recipient, content } = request.query;

    if (!recipient || typeof recipient !== 'string' || recipient.trim() === '') {
      return reply.status(400).send({ error: 'Query parameter "recipient" is required' });
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return reply
        .status(400)
        .send({ error: 'Query parameter "content" is required and must be non-empty' });
    }

    const origin = request.headers.origin ?? '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': origin,
    });

    try {
      await app.chatService.sendStream(
        {
          sender: 'user',
          recipient: recipient.trim(),
          content,
        },
        (event) => {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        },
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      reply.raw.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    }

    reply.raw.end();
  });

  // Channel CRUD routes are registered separately at /api/channels (see app.ts).
};

export default chatRoute;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    chatService: ChatService;
  }
}
