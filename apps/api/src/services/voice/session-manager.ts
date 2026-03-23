/**
 * Voice Session Manager (P4-1) — WebSocket-based real-time voice sessions.
 *
 * Manages voice session lifecycle: create → join → active → leave → end.
 * Each voice session is a separate WebSocket endpoint from the data WS.
 * Tracks active participants, speaking state, and routes audio events.
 *
 * Config via env vars:
 *   OPENAI_API_KEY — OpenAI API key for Realtime/Whisper/TTS
 *   VOICE_MAX_SESSIONS — max concurrent voice sessions (default 10)
 *   VOICE_MAX_PARTICIPANTS — max participants per session (default 20)
 */

import { EventEmitter } from 'node:events';

import type { VoiceSession } from '@openspace/shared';
import { nanoid } from 'nanoid';

// ── Types ─────────────────────────────────────────────────────────

export type VoiceSessionEvent =
  | 'session:created'
  | 'session:ended'
  | 'participant:joined'
  | 'participant:left'
  | 'participant:speaking'
  | 'participant:silent'
  | 'transcript:partial'
  | 'transcript:final'
  | 'audio:chunk';

export interface VoiceParticipant {
  /** Unique participant ID (user or agent). */
  id: string;
  /** Display name. */
  name: string;
  /** 'user' or 'agent'. */
  role: 'user' | 'agent';
  /** Whether currently speaking. */
  isSpeaking: boolean;
  /** When they joined. */
  joinedAt: string;
}

export interface VoiceSessionState {
  session: VoiceSession;
  participants: Map<string, VoiceParticipant>;
}

export interface SessionManagerConfig {
  /** Max concurrent voice sessions. Default: 10. */
  maxSessions?: number;
  /** Max participants per session. Default: 20. */
  maxParticipants?: number;
  /** OpenAI API key (for downstream STT/TTS). */
  openaiApiKey?: string;
}

// ── Session Manager ───────────────────────────────────────────────

export class VoiceSessionManager extends EventEmitter {
  private sessions = new Map<string, VoiceSessionState>();
  private readonly maxSessions: number;
  private readonly maxParticipants: number;
  readonly openaiApiKey: string;

  constructor(config: SessionManagerConfig = {}) {
    super();
    this.maxSessions = config.maxSessions ?? 10;
    this.maxParticipants = config.maxParticipants ?? 20;
    this.openaiApiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '';
  }

  // ── Session lifecycle ──────────────────────────────────────────

  /** Create a new voice session. Returns the session object. */
  createSession(title: string, agentIds: string[] = []): VoiceSession {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum concurrent sessions (${this.maxSessions}) reached`);
    }

    const session: VoiceSession = {
      id: nanoid(12),
      title,
      status: 'active',
      participantAgentIds: [...agentIds],
      startedAt: new Date().toISOString(),
      endedAt: null,
      messages: [],
    };

    this.sessions.set(session.id, {
      session,
      participants: new Map(),
    });

    this.emit('session:created', session);
    return session;
  }

  /** End a voice session. */
  endSession(sessionId: string): VoiceSession | null {
    const state = this.sessions.get(sessionId);
    if (!state) return null;

    state.session.status = 'ended';
    state.session.endedAt = new Date().toISOString();

    // Remove all participants
    for (const participant of state.participants.values()) {
      this.emit('participant:left', {
        sessionId,
        participant,
      });
    }
    state.participants.clear();

    this.emit('session:ended', state.session);

    // Keep session in map for history retrieval; caller can call removeSession()
    return state.session;
  }

  /** Remove a session from the manager entirely (cleanup). */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  // ── Participant management ─────────────────────────────────────

  /** Add a participant to a session. */
  joinSession(
    sessionId: string,
    participantId: string,
    name: string,
    role: 'user' | 'agent',
  ): VoiceParticipant | null {
    const state = this.sessions.get(sessionId);
    if (!state) return null;

    if (state.session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active (status: ${state.session.status})`);
    }

    if (state.participants.size >= this.maxParticipants) {
      throw new Error(
        `Session ${sessionId} is full (max ${this.maxParticipants} participants)`,
      );
    }

    // Don't double-join
    if (state.participants.has(participantId)) {
      return state.participants.get(participantId)!;
    }

    const participant: VoiceParticipant = {
      id: participantId,
      name,
      role,
      isSpeaking: false,
      joinedAt: new Date().toISOString(),
    };

    state.participants.set(participantId, participant);

    // Track agent IDs
    if (role === 'agent' && !state.session.participantAgentIds.includes(participantId)) {
      state.session.participantAgentIds.push(participantId);
    }

    this.emit('participant:joined', { sessionId, participant });
    return participant;
  }

  /** Remove a participant from a session. */
  leaveSession(sessionId: string, participantId: string): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) return false;

    const participant = state.participants.get(participantId);
    if (!participant) return false;

    state.participants.delete(participantId);
    this.emit('participant:left', { sessionId, participant });

    return true;
  }

  // ── Speaking state ─────────────────────────────────────────────

  /** Mark a participant as currently speaking. */
  setSpeaking(sessionId: string, participantId: string, speaking: boolean): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) return false;

    const participant = state.participants.get(participantId);
    if (!participant) return false;

    participant.isSpeaking = speaking;

    this.emit(speaking ? 'participant:speaking' : 'participant:silent', {
      sessionId,
      participantId,
    });

    return true;
  }

  // ── Queries ────────────────────────────────────────────────────

  /** Get a session by ID. */
  getSession(sessionId: string): VoiceSession | null {
    return this.sessions.get(sessionId)?.session ?? null;
  }

  /** Get all active sessions. */
  getActiveSessions(): VoiceSession[] {
    return [...this.sessions.values()]
      .filter((s) => s.session.status === 'active')
      .map((s) => s.session);
  }

  /** Get all sessions (including ended). */
  getAllSessions(): VoiceSession[] {
    return [...this.sessions.values()].map((s) => s.session);
  }

  /** Get participants in a session. */
  getParticipants(sessionId: string): VoiceParticipant[] {
    const state = this.sessions.get(sessionId);
    if (!state) return [];
    return [...state.participants.values()];
  }

  /** Get who is currently speaking in a session. */
  getActiveSpeakers(sessionId: string): VoiceParticipant[] {
    return this.getParticipants(sessionId).filter((p) => p.isSpeaking);
  }

  /** Total active session count. */
  get activeSessionCount(): number {
    return [...this.sessions.values()].filter((s) => s.session.status === 'active').length;
  }

  /** Total session count (including ended). */
  get sessionCount(): number {
    return this.sessions.size;
  }

  // ── Shutdown ───────────────────────────────────────────────────

  /** End all sessions and clean up. */
  async shutdown(): Promise<void> {
    for (const sessionId of [...this.sessions.keys()]) {
      this.endSession(sessionId);
    }
    this.sessions.clear();
    this.removeAllListeners();
  }
}
