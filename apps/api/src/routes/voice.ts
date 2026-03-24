/**
 * Voice API routes — session management and text-based voice conversation.
 *
 * STT is handled by browser Web Speech API (no OpenAI key needed).
 * TTS is handled by browser SpeechSynthesis (no OpenAI key needed).
 * Agent responses are powered by copilot-sdk.
 *
 * POST   /api/voice/sessions       — Start a new voice session
 * DELETE /api/voice/sessions/:id   — End a voice session
 * GET    /api/voice/sessions       — List active sessions
 * POST   /api/voice/speak          — Send text transcript, get agent responses
 */

import type { FastifyPluginAsync } from 'fastify';

import type { VoiceServices } from '../app.js';

const voiceRoute: FastifyPluginAsync = async (app) => {
  // POST /api/voice/sessions — start a new voice session
  app.post<{
    Body: { title?: string; agentIds?: string[] };
  }>('/voice/sessions', async (request, reply) => {
    const { title = 'Voice Session', agentIds = [] } = request.body ?? {};
    const session = app.voiceServices.sessionManager.createSession(title, agentIds);

    for (const agentId of session.participantAgentIds ?? agentIds) {
      app.voiceServices.sessionManager.joinSession(session.id, agentId, agentId, 'agent');
    }

    app.voiceServices.sessionManager.joinSession(session.id, 'user', 'User', 'user');

    return reply.status(201).send(session);
  });

  // GET /api/voice/sessions — list active sessions
  app.get('/voice/sessions', async (_request, reply) => {
    const sessions = app.voiceServices.sessionManager.getActiveSessions();
    return reply.send(sessions);
  });

  // DELETE /api/voice/sessions/:id — end a voice session
  app.delete<{ Params: { id: string } }>('/voice/sessions/:id', async (request, reply) => {
    const session = app.voiceServices.sessionManager.endSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return reply.send(session);
  });

  // POST /api/voice/speak — send text transcript, get agent responses
  // Browser handles STT (Web Speech API) and TTS (SpeechSynthesis)
  app.post<{
    Body: { sessionId: string; text: string };
  }>('/voice/speak', async (request, reply) => {
    const { sessionId, text } = request.body ?? {};

    if (!sessionId || !text) {
      return reply.status(400).send({ error: 'sessionId and text are required' });
    }

    const routing = await app.voiceServices.router.route(text);

    await app.voiceServices.context.addMessage(sessionId, 'user', null, text);

    const responses: Array<{ agentId: string; text: string }> = [];

    for (const agentId of routing.agents) {
      try {
        app.voiceServices.sessionManager.setSpeaking(sessionId, agentId, true);

        const agent = app.voiceServices.chatAgents.find((a) => a.id === agentId);
        if (!agent || !app.voiceServices.aiProvider) continue;

        const contextWindow = app.voiceServices.context.getContextSummary(sessionId);

        const result = await app.voiceServices.aiProvider.chatCompletion({
          systemPrompt:
            `You are ${agent.name}, the ${agent.role} of the openspace.ai squad. ` +
            `Personality: ${agent.personality} ` +
            `You are in a live voice conversation. Keep responses short and natural (1-2 sentences). ` +
            `Only speak for yourself. Other agents will respond separately.`,
          messages: [
            ...(contextWindow
              ? [{ role: 'system' as const, content: `Recent conversation:\n${contextWindow}` }]
              : []),
            { role: 'user' as const, content: text },
          ],
        });

        await app.voiceServices.context.addMessage(sessionId, 'agent', agentId, result.content);
        responses.push({ agentId, text: result.content });

        // Broadcast via WebSocket — browser plays TTS client-side
        app.wsManager?.broadcast({
          type: 'voice:transcript',
          payload: { sessionId, agentId, text: result.content },
          timestamp: new Date().toISOString(),
        });

        app.voiceServices.sessionManager.setSpeaking(sessionId, agentId, false);
      } catch (err) {
        app.voiceServices.sessionManager.setSpeaking(sessionId, agentId, false);
        console.error(`[Voice] Agent ${agentId} response failed:`, err);
      }
    }

    return reply.send({ text, routing, responses });
  });
};

export default voiceRoute;

declare module 'fastify' {
  interface FastifyInstance {
    voiceServices: VoiceServices;
  }
}
