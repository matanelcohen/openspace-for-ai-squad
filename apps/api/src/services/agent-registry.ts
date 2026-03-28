/**
 * Dynamic Agent Registry — central roster of active AI agents.
 *
 * Loads agent profiles from the team_members table on startup and
 * keeps downstream services (AgentWorker, A2A, voice) in sync when
 * members are added, updated or removed at runtime.
 */

import type { AgentCapability, SquadSDKConfig } from '@openspace/shared';
import type Database from 'better-sqlite3';

// ── Types ────────────────────────────────────────────────────────

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  personality: string;
  capabilities?: AgentCapability[];
}

type ChangeListener = (agents: AgentProfile[]) => void;

interface TeamMemberRow {
  id: string;
  name: string;
  role: string;
  status: string;
}

// ── Personality inference ────────────────────────────────────────

const PERSONALITY_BY_ROLE: Record<string, string> = {
  Lead: 'Strategic, decisive, direct',
  'Frontend Dev': 'Creative, detail-oriented, user-focused',
  'Backend Dev': 'Logical, systematic, efficiency-driven',
  Tester: 'Thorough, skeptical, quality-obsessed',
};

export function personalityForRole(role: string): string {
  return PERSONALITY_BY_ROLE[role] ?? 'Professional, collaborative, dedicated';
}

/**
 * Derive a short, lowercase agent id from a team member name.
 * e.g. "Leela" → "leela", "Amy Wong" → "amy-wong"
 */
export function agentIdFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Registry ─────────────────────────────────────────────────────

export class AgentRegistry {
  private agents = new Map<string, AgentProfile>();
  private listeners: ChangeListener[] = [];

  constructor(private readonly db: Database.Database) {}

  /** Load all *active* team members and convert to AgentProfiles. */
  loadFromDatabase(): AgentProfile[] {
    const rows = this.db
      .prepare("SELECT id, name, role, status FROM team_members WHERE status = 'active'")
      .all() as TeamMemberRow[];

    this.agents.clear();

    for (const row of rows) {
      const profile: AgentProfile = {
        id: agentIdFromName(row.name),
        name: row.name,
        role: row.role,
        personality: personalityForRole(row.role),
      };
      this.agents.set(profile.id, profile);
    }

    return this.getAll();
  }

  /** Register (or update) an agent profile and notify listeners. */
  register(profile: AgentProfile): void {
    this.agents.set(profile.id, profile);
    this.notify();
  }

  /** Remove an agent by id and notify listeners. */
  unregister(id: string): void {
    if (this.agents.delete(id)) {
      this.notify();
    }
  }

  /** All active agents as an array. */
  getAll(): AgentProfile[] {
    return [...this.agents.values()];
  }

  /** Lookup a single agent. */
  get(id: string): AgentProfile | undefined {
    return this.agents.get(id);
  }

  /** Subscribe to roster changes. */
  onChange(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  /** Merge capabilities from squad.config.ts into loaded agent profiles. */
  applyConfigCapabilities(config: SquadSDKConfig): void {
    for (const agentDef of config.agents) {
      const profile = this.agents.get(agentDef.name);
      if (profile && agentDef.capabilities?.length) {
        profile.capabilities = agentDef.capabilities;
        this.agents.set(profile.id, profile);
      }
    }
    this.notify();
  }

  /** Find agents that have a specific capability. */
  findByCapability(capabilityName: string): AgentProfile[] {
    return this.getAll().filter((a) => a.capabilities?.some((c) => c.name === capabilityName));
  }

  // ── internal ───────────────────────────────────────────────────

  private notify(): void {
    const snapshot = this.getAll();
    for (const fn of this.listeners) {
      try {
        fn(snapshot);
      } catch {
        /* listener errors must not break the registry */
      }
    }
  }
}
