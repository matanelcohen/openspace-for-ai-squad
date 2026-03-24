/**
 * Voice API routes — session management and transcription.
 *
 * POST   /api/voice/sessions       — Start a new voice session
 * DELETE /api/voice/sessions/:id   — End a voice session
 * GET    /api/voice/sessions       — List active sessions
 * POST   /api/voice/transcribe     — Upload audio for STT transcription
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

    // Join all requested agents as participants
    for (const agentId of session.participantAgentIds ?? agentIds) {
      app.voiceServices.sessionManager.joinSession(session.id, agentId, agentId, 'agent');
    }

    // Join the user
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

  // POST /api/voice/transcribe — upload audio chunk for STT
  app.post<{
    Body: { sessionId: string; audio: string; finalize?: boolean };
  }>('/voice/transcribe', async (request, reply) => {
    const { sessionId, audio, finalize = true } = request.body ?? {};

    if (!sessionId || !audio) {
      return reply.status(400).send({ error: 'sessionId and audio (base64) are required' });
    }

    const audioBuffer = Buffer.from(audio, 'base64');
    app.voiceServices.stt.pushAudioChunk(sessionId, audioBuffer);

    if (!finalize) {
      return reply.send({ status: 'buffered' });
    }

    const transcript = await app.voiceServices.stt.finalize(sessionId);

    // Route the transcript to agents
    const routing = await app.voiceServices.router.route(transcript.text);

    // Add to conversation context
    await app.voiceServices.context.addMessage(sessionId, 'user', null, transcript.text);

    // Generate agent responses and TTS
    const responses: Array<{
      agentId: string;
      text: string;
      audioBase64?: string;
    }> = [];

    for (const agentId of routing.agents) {
      try {
        // Notify speaking state
        app.voiceServices.sessionManager.setSpeaking(sessionId, agentId, true);

        // Get AI response
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
              ? [
                  {
                    role: 'system' as const,
                    content: `Recent conversation:\n${contextWindow}`,
                  },
                ]
              : []),
            { role: 'user' as const, content: transcript.text },
          ],
        });

        // Add agent response to context
        await app.voiceServices.context.addMessage(sessionId, 'agent', agentId, result.content);

        // Synthesize TTS
        let audioBase64: string | undefined;
        try {
          const chunks = await app.voiceServices.tts.synthesize(sessionId, agentId, result.content);
          if (chunks.length > 0) {
            const combined = Buffer.concat(chunks.map((c) => c.data));
            audioBase64 = combined.toString('base64');
          }
        } catch {
          // TTS failure is non-fatal — text response still works
        }

        responses.push({ agentId, text: result.content, audioBase64 });

        // Broadcast transcript + audio via WebSocket
        app.wsManager?.broadcast({
          type: 'voice:transcript',
          payload: { sessionId, agentId, text: result.content },
          timestamp: new Date().toISOString(),
        });

        if (audioBase64) {
          app.wsManager?.broadcast({
            type: 'voice:audio',
            payload: { sessionId, agentId, audio: audioBase64 },
            timestamp: new Date().toISOString(),
          });
        }

        app.voiceServices.sessionManager.setSpeaking(sessionId, agentId, false);
      } catch (err) {
        app.voiceServices.sessionManager.setSpeaking(sessionId, agentId, false);
        console.error(`[Voice] Agent ${agentId} response failed:`, err);
      }
    }

    return reply.send({
      transcript,
      routing,
      responses,
    });
  });
};

export default voiceRoute;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    voiceServices: VoiceServices;
  }
}
