/**
 * Streaming TTS Service (P4-4)  Text-to-speech with per-agent voices.
 *
 * Each agent has a unique voice profile. Audio chunks stream back
 * as they generate (don't wait for full response).
 * Uses OpenAI TTS API with different voice parameters per agent.
 */

import { EventEmitter } from 'node:events';

import { nanoid } from 'nanoid';

//  Types

/** OpenAI TTS voice IDs. */
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface TTSConfig {
  /** OpenAI API key. */
  apiKey?: string;
  /** TTS model (default: tts-1). */
  model?: string;
  /** Audio output format (default: opus). */
  format?: 'opus' | 'mp3' | 'aac' | 'flac' | 'wav' | 'pcm';
  /** Speech speed multiplier 0.25-4.0 (default: 1.0). */
  speed?: number;
  /** Timeout in ms for API calls (default: 30000). */
  timeoutMs?: number;
}

export interface AudioChunk {
  /** Unique ID for this chunk. */
  id: string;
  /** Session this audio belongs to. */
  sessionId: string;
  /** Agent ID that generated this audio. */
  agentId: string;
  /** Raw audio bytes. */
  data: Buffer;
  /** Audio format. */
  format: string;
  /** Chunk index (for ordering). */
  index: number;
  /** Whether this is the last chunk. */
  isFinal: boolean;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

/** Per-agent voice mapping. */
export interface AgentVoiceConfig {
  agentId: string;
  voice: OpenAIVoice;
  speed?: number;
}

/** Abstraction for the TTS API. Facilitates testing. */
export interface TTSProvider {
  synthesize(
    text: string,
    options: {
      model: string;
      voice: OpenAIVoice;
      format: string;
      speed: number;
    },
  ): Promise<Buffer>;
}

//  Default Agent Voice Map

export const DEFAULT_AGENT_VOICES: Record<string, AgentVoiceConfig> = {
  leela: { agentId: 'leela', voice: 'nova', speed: 1.0 },
  fry: { agentId: 'fry', voice: 'echo', speed: 1.05 },
  bender: { agentId: 'bender', voice: 'onyx', speed: 0.95 },
  zoidberg: { agentId: 'zoidberg', voice: 'shimmer', speed: 1.0 },
};

//  Default OpenAI TTS Provider

export class OpenAITTSProvider implements TTSProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 30_000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async synthesize(
    text: string,
    options: { model: string; voice: OpenAIVoice; format: string; speed: number },
  ): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          input: text,
          voice: options.voice,
          response_format: options.format,
          speed: options.speed,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`OpenAI TTS API error (${response.status}): ${errorBody}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timer);
    }
  }
}

//  TTS Service

export class TTSService extends EventEmitter {
  private readonly model: string;
  private readonly format: string;
  private readonly defaultSpeed: number;
  private readonly agentVoices: Record<string, AgentVoiceConfig>;
  private readonly provider: TTSProvider;

  constructor(
    config: TTSConfig = {},
    agentVoices?: Record<string, AgentVoiceConfig>,
    provider?: TTSProvider,
  ) {
    super();
    this.model = config.model ?? 'tts-1';
    this.format = config.format ?? 'opus';
    this.defaultSpeed = config.speed ?? 1.0;
    this.agentVoices = agentVoices ?? { ...DEFAULT_AGENT_VOICES };
    this.provider =
      provider ??
      new OpenAITTSProvider(config.apiKey ?? process.env.OPENAI_API_KEY ?? '', config.timeoutMs);
  }

  /**
   * Synthesize speech for an agent's response text.
   * Splits text into sentence-level chunks and streams audio pieces.
   */
  async synthesize(sessionId: string, agentId: string, text: string): Promise<AudioChunk[]> {
    if (!text.trim()) {
      return [];
    }

    const voiceConfig = this.agentVoices[agentId];
    const voice = voiceConfig?.voice ?? 'alloy';
    const speed = voiceConfig?.speed ?? this.defaultSpeed;

    // Split text into sentence chunks for streaming
    const sentences = this.splitIntoChunks(text);
    const chunks: AudioChunk[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]!;
      if (!sentence.trim()) continue;

      try {
        const audioData = await this.provider.synthesize(sentence, {
          model: this.model,
          voice,
          format: this.format,
          speed,
        });

        const chunk: AudioChunk = {
          id: nanoid(10),
          sessionId,
          agentId,
          data: audioData,
          format: this.format,
          index: i,
          isFinal: i === sentences.length - 1,
          timestamp: new Date().toISOString(),
        };

        chunks.push(chunk);
        this.emit('audio:chunk', chunk);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.emit('error', { sessionId, agentId, error: errMsg });
      }
    }

    return chunks;
  }

  /**
   * Synthesize a sequence of agent responses with brief pauses.
   * Returns all audio chunks from all agents in order.
   */
  async synthesizeSequence(
    sessionId: string,
    responses: Array<{ agentId: string; text: string }>,
  ): Promise<AudioChunk[]> {
    const allChunks: AudioChunk[] = [];

    for (const response of responses) {
      const chunks = await this.synthesize(sessionId, response.agentId, response.text);
      allChunks.push(...chunks);
    }

    return allChunks;
  }

  /** Get the voice configuration for an agent. */
  getVoiceConfig(agentId: string): AgentVoiceConfig | undefined {
    return this.agentVoices[agentId];
  }

  /** Get all voice configurations. */
  getAllVoiceConfigs(): Record<string, AgentVoiceConfig> {
    return { ...this.agentVoices };
  }

  /** Set/update voice config for an agent. */
  setVoiceConfig(agentId: string, config: AgentVoiceConfig): void {
    this.agentVoices[agentId] = config;
  }

  /**
   * Split text into sentence-level chunks for streaming TTS.
   * Keeps chunks roughly sentence-sized for natural streaming.
   */
  private splitIntoChunks(text: string): string[] {
    // Split on sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
    return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  /** Shutdown: remove all listeners. */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
  }
}
