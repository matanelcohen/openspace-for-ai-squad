import type { Span, TraceCollectorConfig, TraceCollectorHandle } from './types.js';

/**
 * TraceCollector — batches completed spans and flushes them to a sink.
 *
 * Implements two flush triggers:
 * 1. Batch size: flushes when the buffer reaches `batchSize` spans
 * 2. Interval: flushes every `flushIntervalMs` milliseconds
 *
 * Call `shutdown()` to flush remaining spans and stop the timer.
 */
export class TraceCollector implements TraceCollectorHandle {
  private buffer: Span[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly config: TraceCollectorConfig;
  private flushing = false;
  private _totalFlushed = 0;

  constructor(config: TraceCollectorConfig) {
    this.config = config;
    if (config.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, config.flushIntervalMs);
      // Don't keep process alive just for tracing
      if (typeof this.timer === 'object' && 'unref' in this.timer) {
        this.timer.unref();
      }
    }
  }

  /** Submit a completed span to the buffer. */
  submit(span: Span): void {
    this.buffer.push(span);
    if (this.buffer.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  /** Flush all buffered spans to the sink. */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;

    const batch = this.buffer.splice(0);
    try {
      await this.config.sink(batch);
      this._totalFlushed += batch.length;
    } catch {
      // Put spans back on failure so they aren't lost
      this.buffer.unshift(...batch);
    } finally {
      this.flushing = false;
    }
  }

  /** Flush remaining spans and stop the interval timer. */
  async shutdown(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  /** Number of spans currently buffered. */
  get pendingCount(): number {
    return this.buffer.length;
  }

  /** Total spans successfully flushed since creation. */
  get totalFlushed(): number {
    return this._totalFlushed;
  }
}
