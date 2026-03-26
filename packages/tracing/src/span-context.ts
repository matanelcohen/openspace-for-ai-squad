import { AsyncLocalStorage } from 'node:async_hooks';

import type { SpanContext } from './types.js';

let idCounter = 0;

/** Generate a random hex ID. Uses crypto when available, falls back to counter. */
export function generateId(bytes = 16): string {
  try {
    const buf = new Uint8Array(bytes);
    // globalThis.crypto works in Node 19+ and all modern browsers
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Deterministic fallback for testing environments without crypto
    idCounter++;
    return idCounter.toString(16).padStart(bytes * 2, '0');
  }
}

export function generateTraceId(): string {
  return generateId(16); // 32 hex chars, W3C trace-id length
}

export function generateSpanId(): string {
  return generateId(8); // 16 hex chars, W3C span-id length
}

// ── AsyncLocalStorage-based context propagation ───────────────────

const contextStorage = new AsyncLocalStorage<SpanContext>();

/** Run `fn` with `ctx` as the active span context. */
export function runWithContext<T>(ctx: SpanContext, fn: () => T): T {
  return contextStorage.run(ctx, fn);
}

/** Get the currently active span context, or undefined if none. */
export function getActiveContext(): SpanContext | undefined {
  return contextStorage.getStore();
}
