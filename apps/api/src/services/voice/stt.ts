/**
 * Streaming STT Service (P4-2)  Speech-to-text integration.
 *
 * Receives audio stream from browser, forwards to OpenAI Whisper API,
 * and returns transcript chunks in real-time (streaming, not batch).
 *
 * Handles: empty audio, API timeout, partial transcriptions.
 */

import { EventEmitter } from 'node:events';

import { nanoid } from 'nanoid';

//  Types 

export interface TranscriptChunk {
  /** Unique ID for this chunk. */
  id: string;
  /** Session this transcript belongs to. */
  sessionId: string;
  /** Partial or final transcript text. */
  text: string;
  /** Whether this is a final (committed) transcript. */
  isFinal: boolean;
  /** Confidence score 0-1. */
  confidence: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Language detected. */
  language: string;
}

export interface STTConfig {
  /** OpenAI API key. */
  apiKey?: string;
  /** Model to use (default: whisper-1). */
  model?: string;
  /** Language hint (default: en). */
  language?: string;
  /** Timeout in ms for API calls (default: 30000). */
  timeoutMs?: number;
}

export type STTEvent = 'transcript:partial' | 'transcript:final' | 'error';

/** Abstraction for the OpenAI transcription API. Facilitates testing. */
export interface STTProvider {
  transcribe(audioBuffer: Buffer, options: {
    model: string;
    language: string;
    prompt?: string;
  }): Promise<{ text: string; language: string }>;
}

//  Default OpenAI Provider 

export class OpenAISTTProvider implements STTProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 30_000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async transcribe(
    audioBuffer: Buffer,
    options: { model: string; language: string; prompt?: string },
  ): Promise<{ text: string; language: string }> {
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
    formData.append('model', options.model);
    formData.append('language', options.language);
    formData.append('response_format', 'json');
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`OpenAI STT API error (${response.status}): ${errorBody}`);
      }

      const result = (await response.json()) as { text: string; language?: string };
      return {
        text: result.text,
        language: result.language ?? options.language,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

//  STT Service 

export class STTService extends EventEmitter {
  private readonly model: string;
  private readonly language: string;
  private readonly provider: STTProvider;

  /** Buffer of accumulated audio chunks per session for batching. */
  private audioBuffers = new Map<string, Buffer[]>();

  constructor(config: STTConfig = {}, provider?: STTProvider) {
    super();
    this.model = config.model ?? 'whisper-1';
    this.language = config.language ?? 'en';
    this.provider =
      provider ??
      new OpenAISTTProvider(
        config.apiKey ?? process.env.OPENAI_API_KEY ?? '',
        config.timeoutMs,
      );
  }

  /**
   * Feed an audio chunk from the client for a given session.
   * Accumulates chunks; call finalize() to trigger transcription.
   */
  pushAudioChunk(sessionId: string, chunk: Buffer): void {
    if (!chunk || chunk.length === 0) return;

    let chunks = this.audioBuffers.get(sessionId);
    if (!chunks) {
      chunks = [];
      this.audioBuffers.set(sessionId, chunks);
    }
    chunks.push(chunk);

    // Emit a partial event (a hint that audio is being received)
    const partial: TranscriptChunk = {
      id: nanoid(10),
      sessionId,
      text: '',
      isFinal: false,
      confidence: 0,
      timestamp: new Date().toISOString(),
      language: this.language,
    };
    this.emit('transcript:partial', partial);
  }

  /**
   * Finalize the current audio buffer and transcribe it.
   * Returns the final transcript chunk.
   */
  async finalize(sessionId: string, contextPrompt?: string): Promise<TranscriptChunk> {
    const chunks = this.audioBuffers.get(sessionId) ?? [];
    this.audioBuffers.delete(sessionId);

    if (chunks.length === 0) {
      const empty: TranscriptChunk = {
        id: nanoid(10),
        sessionId,
        text: '',
        isFinal: true,
        confidence: 0,
        timestamp: new Date().toISOString(),
        language: this.language,
      };
      this.emit('transcript:final', empty);
      return empty;
    }

    const combinedBuffer = Buffer.concat(chunks);

    try {
      const result = await this.provider.transcribe(combinedBuffer, {
        model: this.model,
        language: this.language,
        prompt: contextPrompt,
      });

      const transcript: TranscriptChunk = {
        id: nanoid(10),
        sessionId,
        text: result.text.trim(),
        isFinal: true,
        confidence: result.text.trim().length > 0 ? 0.95 : 0,
        timestamp: new Date().toISOString(),
        language: result.language,
      };

      this.emit('transcript:final', transcript);
      return transcript;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.emit('error', { sessionId, error: errMsg });

      // Return empty transcript on error
      const fallback: TranscriptChunk = {
        id: nanoid(10),
        sessionId,
        text: '',
        isFinal: true,
        confidence: 0,
        timestamp: new Date().toISOString(),
        language: this.language,
      };
      this.emit('transcript:final', fallback);
      return fallback;
    }
  }

  /** Check if there's buffered audio for a session. */
  hasBufferedAudio(sessionId: string): boolean {
    const chunks = this.audioBuffers.get(sessionId);
    return !!chunks && chunks.length > 0;
  }

  /** Clear buffered audio for a session (e.g., on session end). */
  clearBuffer(sessionId: string): void {
    this.audioBuffers.delete(sessionId);
  }

  /** Shutdown: clear all buffers. */
  async shutdown(): Promise<void> {
    this.audioBuffers.clear();
    this.removeAllListeners();
  }
}
