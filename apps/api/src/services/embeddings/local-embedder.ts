/**
 * Local embedder using @huggingface/transformers.
 * Runs entirely on CPU — no API key needed.
 * Uses 'Xenova/all-MiniLM-L6-v2' (384 dimensions, fast, good quality).
 */

import type { Embedder } from '@openspace/shared';

let pipelineInstance: unknown = null;
let loading: Promise<void> | null = null;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIMENSIONS = 384;

type EmbeddingPipeline = (
  input: string[],
  opts: { pooling: string; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

async function getPipeline(): Promise<EmbeddingPipeline> {
  if (pipelineInstance) return pipelineInstance as EmbeddingPipeline;
  if (loading) {
    await loading;
    return pipelineInstance as EmbeddingPipeline;
  }

  loading = (async () => {
    // @ts-expect-error — dynamic ESM import
    const { pipeline } = await import('@huggingface/transformers');
    pipelineInstance = await pipeline('feature-extraction', MODEL_ID, {
      dtype: 'fp32',
    });
    console.log(`[Embedder] Loaded ${MODEL_ID} (${DIMENSIONS}d)`);
  })();

  await loading;
  loading = null;
  return pipelineInstance as EmbeddingPipeline;
}

export class LocalEmbedder implements Embedder {
  async embed(text: string): Promise<number[]> {
    const pipe = await getPipeline();
    const result = await pipe([text], { pooling: 'mean', normalize: true });
    const vectors = result.tolist();
    return vectors[0]!;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const pipe = await getPipeline();
    const result = await pipe(texts, { pooling: 'mean', normalize: true });
    return result.tolist();
  }

  getDimensions(): number {
    return DIMENSIONS;
  }
}
