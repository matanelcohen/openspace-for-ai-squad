/**
 * Voice services barrel export (P4-1 through P4-6).
 *
 * The complete real-time voice pipeline:
 *   Session Manager → STT → Router → Context → TTS → Actions
 */

export { VoiceSessionManager } from './session-manager.js';
export type {
  SessionManagerConfig,
  VoiceParticipant,
  VoiceSessionEvent,
  VoiceSessionState,
} from './session-manager.js';

export { OpenAISTTProvider, STTService } from './stt.js';
export type { STTConfig, STTEvent, STTProvider, TranscriptChunk } from './stt.js';

export { DEFAULT_AGENT_PROFILES, VoiceRouter } from './router.js';
export type {
  AgentRoutingProfile,
  LLMRouter,
  RouterConfig,
  RoutingDecision,
} from './router.js';

export { DEFAULT_AGENT_VOICES, OpenAITTSProvider, TTSService } from './tts.js';
export type {
  AgentVoiceConfig,
  AudioChunk,
  OpenAIVoice,
  TTSConfig,
  TTSProvider,
} from './tts.js';

export { ConversationContextManager } from './context.js';
export type {
  ActionLogEntry,
  ConversationContextConfig,
  ConversationEntry,
  SessionContext,
} from './context.js';

export { VoiceActionService } from './actions.js';
export type {
  ActionExecutor,
  ActionResult,
  ActionType,
  LLMIntentParser,
  ParsedIntent,
} from './actions.js';
