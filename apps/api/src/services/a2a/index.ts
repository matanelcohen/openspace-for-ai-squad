/**
 * A2A service — creates a DefaultRequestHandler per squad agent.
 */

import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import type Database from 'better-sqlite3';

import type { AgentProfile } from '../agent-registry.js';
import type { AIProvider } from '../ai/copilot-provider.js';
import { buildAgentCard, buildAgentCards } from './agent-cards.js';
import type { A2ABridgeServices } from './squad-executor.js';
import { SquadAgentExecutor } from './squad-executor.js';
import { SqliteTaskStore } from './task-store.js';

export interface A2AServiceOptions {
  agents: AgentProfile[];
  aiProvider: AIProvider;
  baseUrl: string;
  /** SQLite database. If provided, uses persistent task storage. */
  db?: Database.Database | null;
  /** Optional bridge services for cross-system integration (chat, activity, tasks). */
  bridge?: A2ABridgeServices;
}

export interface A2AService {
  /** Map of agentId → DefaultRequestHandler */
  handlers: Map<string, DefaultRequestHandler>;
  /** All agent cards for the well-known endpoint */
  agentCards: ReturnType<typeof buildAgentCards>;
  /** Register a new agent at runtime. */
  registerAgent(agent: AgentProfile): void;
  /** Remove an agent at runtime. */
  unregisterAgent(id: string): void;
}

/**
 * Bootstrap A2A request handlers for every squad agent.
 */
export function createA2AService(opts: A2AServiceOptions): A2AService {
  const { agents, aiProvider, baseUrl, db, bridge } = opts;
  const cards = buildAgentCards(agents, baseUrl);
  const handlers = new Map<string, DefaultRequestHandler>();

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const card = cards[i]!;

    const taskStore = db ? new SqliteTaskStore(db) : new InMemoryTaskStore();

    const executor = new SquadAgentExecutor({
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      personality: agent.personality,
      aiProvider,
      bridge,
    });

    handlers.set(agent.id, new DefaultRequestHandler(card, taskStore, executor));
  }

  const service: A2AService = {
    handlers,
    agentCards: cards,

    registerAgent(agent: AgentProfile) {
      if (handlers.has(agent.id)) return;

      const card = buildAgentCard(agent, baseUrl);
      const taskStore = db ? new SqliteTaskStore(db) : new InMemoryTaskStore();
      const executor = new SquadAgentExecutor({
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        personality: agent.personality,
        aiProvider,
        bridge,
      });
      handlers.set(agent.id, new DefaultRequestHandler(card, taskStore, executor));
      cards.push(card);
    },

    unregisterAgent(id: string) {
      handlers.delete(id);
      const idx = cards.findIndex((c) => c.url.endsWith(`/a2a/${id}`));
      if (idx !== -1) cards.splice(idx, 1);
    },
  };

  return service;
}

export { buildAgentCards } from './agent-cards.js';
export type { A2ABridgeServices } from './squad-executor.js';
export { SquadAgentExecutor } from './squad-executor.js';
export { SqliteTaskStore } from './task-store.js';
