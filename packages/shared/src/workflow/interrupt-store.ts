/**
 * InterruptStore — In-memory implementation for managing interrupt lifecycle.
 *
 * Provides query-optimized access to interrupt states as a secondary
 * index alongside the checkpoint store. Suitable for testing and
 * single-process deployments.
 */

import type {
  InterruptResolution,
  InterruptState,
  InterruptStore,
} from '../types/interrupt.js';

export class InMemoryInterruptStore implements InterruptStore {
  private store = new Map<string, InterruptState>();

  async save(state: InterruptState): Promise<void> {
    this.store.set(state.id, { ...state });
  }

  async load(interruptId: string): Promise<InterruptState | null> {
    return this.store.get(interruptId) ?? null;
  }

  async loadByExecution(executionId: string): Promise<InterruptState[]> {
    return [...this.store.values()].filter(
      (s) => s.executionId === executionId && (s.status === 'pending' || s.status === 'claimed'),
    );
  }

  async loadByNode(executionId: string, nodeId: string): Promise<InterruptState | null> {
    return (
      [...this.store.values()].find(
        (s) => s.executionId === executionId && s.nodeId === nodeId && (s.status === 'pending' || s.status === 'claimed'),
      ) ?? null
    );
  }

  async resolve(interruptId: string, resolution: InterruptResolution): Promise<InterruptState> {
    const existing = this.store.get(interruptId);
    if (!existing) {
      throw new Error(`Interrupt "${interruptId}" not found`);
    }
    if (existing.status === 'resolved' || existing.status === 'auto_resolved') {
      throw new Error(`Interrupt "${interruptId}" is already resolved`);
    }

    const resolved: InterruptState = {
      ...existing,
      status: 'resolved',
      resolution,
    };
    this.store.set(interruptId, resolved);
    return resolved;
  }

  async findTimedOut(now?: string): Promise<InterruptState[]> {
    const currentTime = now ?? new Date().toISOString();
    return [...this.store.values()].filter(
      (s) =>
        (s.status === 'pending' || s.status === 'claimed') &&
        s.timeoutAt !== null &&
        new Date(currentTime) >= new Date(s.timeoutAt),
    );
  }

  async deleteByExecution(executionId: string): Promise<void> {
    for (const [id, state] of this.store.entries()) {
      if (state.executionId === executionId) {
        this.store.delete(id);
      }
    }
  }

  /** For testing: clear all stored interrupts. */
  clear(): void {
    this.store.clear();
  }

  /** For testing: get total count. */
  get size(): number {
    return this.store.size;
  }
}

export type { InterruptStore };
