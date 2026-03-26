/**
 * Embedding provider — pluggable interface for generating vector embeddings.
 *
 * Consumers supply an implementation (OpenAI, local model, etc.).
 * The memory store calls it to embed content before storage and queries before search.
 */

/** A vector embedding: array of floating-point numbers. */
export type Embedding = Float64Array;

/** Provider interface for generating embeddings. */
export interface EmbeddingProvider {
  /** Human-readable model identifier (e.g. "text-embedding-3-small"). */
  readonly modelId: string;
  /** Dimensionality of the output vectors. */
  readonly dimensions: number;
  /** Generate an embedding for a single text input. */
  embed(text: string): Promise<Embedding>;
  /** Generate embeddings for a batch of texts (order preserved). */
  embedBatch(texts: string[]): Promise<Embedding[]>;
}

// ── Cosine Similarity ──────────────────────────────────────────────

/** Compute cosine similarity between two vectors. Returns value in [-1, 1]. */
export function cosineSimilarity(a: Embedding | number[], b: Embedding | number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Serialization ──────────────────────────────────────────────────

/** Serialize an embedding to a Buffer for SQLite BLOB storage. */
export function embeddingToBuffer(embedding: Embedding | number[]): Buffer {
  const arr = embedding instanceof Float64Array ? embedding : Float64Array.from(embedding);
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

/** Deserialize a Buffer (from SQLite BLOB) back to an Embedding. */
export function bufferToEmbedding(buf: Buffer): Embedding {
  const copy = new ArrayBuffer(buf.byteLength);
  const view = new Uint8Array(copy);
  view.set(buf);
  return new Float64Array(copy);
}
