/**
 * Squad SDK Configuration — typed builder functions for squad.config.ts.
 *
 * These helpers provide type-safety and IDE auto-complete when defining
 * a squad configuration file. Each `define*` function is a simple identity
 * function that validates the shape at compile time.
 */

// ── Agent Capabilities ───────────────────────────────────────────

export interface AgentCapability {
  name: string;
  level: 'expert' | 'proficient' | 'basic';
}

// ── Team ─────────────────────────────────────────────────────────

export interface TeamDefinition {
  name: string;
  description?: string;
  members: string[];
  projectContext?: string;
}

// ── Agent ────────────────────────────────────────────────────────

export interface AgentDefinition {
  name: string;
  role: string;
  model?: string;
  tools?: string[];
  capabilities?: AgentCapability[];
  status?: 'active' | 'inactive';
}

// ── Routing ──────────────────────────────────────────────────────

export type ResponseTier = 'direct' | 'lightweight' | 'standard' | 'full';

export interface RoutingRule {
  pattern: string | RegExp;
  agents: string[];
  tier?: ResponseTier;
  priority?: number;
}

export interface RoutingDefinition {
  rules: RoutingRule[];
  defaultAgent?: string;
  fallback?: 'coordinator' | 'default-agent';
}

// ── Telemetry ────────────────────────────────────────────────────

export interface TelemetryDefinition {
  enabled?: boolean;
  endpoint?: string;
  serviceName?: string;
}

// ── Governance Hooks ─────────────────────────────────────────────

export interface HooksDefinition {
  allowedWritePaths?: string[];
  blockedCommands?: string[];
  maxAskUser?: number;
  scrubPii?: boolean;
}

// ── Ceremonies ───────────────────────────────────────────────────

export interface CeremonyDefinition {
  name: string;
  schedule?: string;
  participants?: string[];
  agenda?: string;
  action?: 'chat' | 'task';
  message?: string;
}

// ── Models ───────────────────────────────────────────────────────

export interface ModelConfig {
  default: string;
  fallbackChains?: Record<string, string[]>;
}

// ── Sandbox (Git Worktree) ────────────────────────────────────────

export interface SandboxDefinition {
  /** Enable worktree-based sandboxing for agent tasks. Default: true */
  enabled?: boolean;
  /** Max concurrent worktrees. Default: 10 */
  maxWorktrees?: number;
  /** Auto-remove worktrees after PR merge/task done. Default: true */
  autoCleanup?: boolean;
  /** Default base branch. Default: main */
  baseBranch?: string;
  /** Directory for worktrees (relative to repo root). Default: .git-worktrees */
  worktreeDir?: string;
  /** Run pnpm install in new worktrees. Default: false */
  installDeps?: boolean;
  /** Auto-commit changes on task completion. Default: true */
  autoCommit?: boolean;
  /** Auto-create PR on task completion. Default: true */
  autoPR?: boolean;
}

// ── Top-level Config ─────────────────────────────────────────────

export interface SquadSDKConfig {
  version?: string;
  team: TeamDefinition;
  agents: AgentDefinition[];
  routing?: RoutingDefinition;
  ceremonies?: CeremonyDefinition[];
  hooks?: HooksDefinition;
  telemetry?: TelemetryDefinition;
  models?: ModelConfig;
  sandbox?: SandboxDefinition;
}

// ── Builder Functions ────────────────────────────────────────────

export function defineTeam(config: TeamDefinition): TeamDefinition {
  return config;
}

export function defineAgent(config: AgentDefinition): AgentDefinition {
  return config;
}

export function defineRouting(config: RoutingDefinition): RoutingDefinition {
  return config;
}

export function defineTelemetry(config: TelemetryDefinition): TelemetryDefinition {
  return config;
}

export function defineHooks(config: HooksDefinition): HooksDefinition {
  return config;
}

export function defineCeremony(config: CeremonyDefinition): CeremonyDefinition {
  return config;
}

export function defineSandbox(config: SandboxDefinition): SandboxDefinition {
  return config;
}

export function defineSquad(config: SquadSDKConfig): SquadSDKConfig {
  return config;
}
