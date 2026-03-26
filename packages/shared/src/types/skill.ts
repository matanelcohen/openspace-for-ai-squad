/**
 * Skill Manifest & Plugin Architecture
 *
 * Skills are declarative capability bundles that bridge agents and tools.
 * An agent has skills; skills require tools; the registry manages the lifecycle.
 *
 * Plugin lifecycle: discover → validate → load → activate → deactivate
 */

import type { ToolCapabilityTag } from './tool.js';

// ── Skill Manifest (Declarative Definition) ────────────────────

/** Semantic version string (e.g. "1.2.3"). */
export type SemVer = string;

/** Supported manifest format versions. */
export type ManifestVersion = 1;

/**
 * The root schema for a skill manifest file (JSON or YAML).
 *
 * A skill manifest is the single source of truth for what a skill is,
 * what it needs, and what it can do. Manifests are loaded from:
 *   - Built-in skills shipped with the platform
 *   - `.squad/skills/` directory (project-local)
 *   - Remote skill packages (future)
 */
export interface SkillManifest {
  /** Schema version for forward compatibility. */
  manifestVersion: ManifestVersion;

  // ── Metadata ────────────────────────────────────────────────────

  /** Unique skill identifier (kebab-case, e.g. "code-review"). */
  id: string;

  /** Human-readable display name. */
  name: string;

  /** Semantic version of this skill. */
  version: SemVer;

  /** Brief description shown in UI and agent context. */
  description: string;

  /** Author or team that maintains this skill. */
  author?: string;

  /** License identifier (SPDX). */
  license?: string;

  /** URL to documentation or source repository. */
  homepage?: string;

  /** Capability tags for discovery and filtering. */
  tags?: ToolCapabilityTag[];

  /** Icon identifier for UI rendering (e.g. "code", "shield", "database"). */
  icon?: string;

  // ── Tool Declarations ──────────────────────────────────────────

  /** Tools this skill requires to function. */
  tools: SkillToolDeclaration[];

  // ── Prompt Templates ───────────────────────────────────────────

  /** Prompt templates with variable interpolation. */
  prompts: SkillPromptTemplate[];

  // ── Task-Type Matching ─────────────────────────────────────────

  /** Rules that determine when this skill should be activated. */
  triggers: SkillTrigger[];

  // ── Dependencies ───────────────────────────────────────────────

  /** Other skills this skill depends on. */
  dependencies?: SkillDependency[];

  // ── Configuration ──────────────────────────────────────────────

  /** User-configurable parameters with defaults. */
  config?: SkillConfigSchema[];

  // ── Lifecycle Hooks ────────────────────────────────────────────

  /**
   * Optional entry point for imperative lifecycle logic.
   * Relative path to a TypeScript/JavaScript module that exports
   * a `SkillLifecycleHooks` implementation.
   *
   * If omitted, the skill is purely declarative (prompt + tool composition).
   */
  entryPoint?: string;

  // ── Permissions ────────────────────────────────────────────────

  /** Permissions this skill requests from the runtime. */
  permissions?: SkillPermission[];
}

// ── Tool Declarations ────────────────────────────────────────────

/**
 * Declares a tool dependency. The registry resolves these against
 * the ToolRegistry at load time, failing validation if required
 * tools are unavailable.
 */
export interface SkillToolDeclaration {
  /** Tool ID in the Tool Registry (e.g. "git:commit", "file:read"). */
  toolId: string;

  /** Whether the skill can function without this tool. */
  optional?: boolean;

  /** Minimum tool version required (semver range). */
  versionRange?: string;

  /**
   * Why this tool is needed — shown to users during permission consent
   * and helps the AI understand tool purpose in context.
   */
  reason?: string;
}

// ── Prompt Templates ─────────────────────────────────────────────

/**
 * A reusable prompt template with variable interpolation.
 *
 * Variables use `{{varName}}` syntax. They are resolved from:
 *   1. SkillContext.vars (runtime variables)
 *   2. SkillContext.taskContext (current task data)
 *   3. SkillContext.config (user configuration)
 *   4. Built-in variables ({{agent.name}}, {{agent.role}}, {{now}})
 *
 * Supports conditional sections:
 *   {{#if hasTests}}Run the test suite first.{{/if}}
 *
 * Supports iteration:
 *   {{#each files}}  - {{this.path}}: {{this.description}}
 *   {{/each}}
 */
export interface SkillPromptTemplate {
  /** Template identifier (unique within the skill). */
  id: string;

  /** Human-readable label. */
  name: string;

  /** When this template should be used (maps to trigger phases). */
  role: PromptRole;

  /** The template string with {{variable}} interpolation. */
  content: string;

  /**
   * Variables this template expects, with types and defaults.
   * Used for validation and documentation generation.
   */
  variables?: PromptVariable[];

  /** Maximum token budget for the rendered prompt. */
  maxTokens?: number;
}

/** When in the execution flow a prompt is injected. */
export type PromptRole =
  | 'system' // Injected as system context when skill is active
  | 'planning' // Used during task decomposition / planning
  | 'execution' // Used during task execution
  | 'review' // Used during output review / validation
  | 'error' // Used when handling errors or retries
  | 'handoff'; // Used when delegating to another agent/skill

export interface PromptVariable {
  /** Variable name (used in {{name}} syntax). */
  name: string;

  /** Expected type for validation. */
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'object';

  /** Human-readable description. */
  description: string;

  /** Default value if not provided at runtime. */
  default?: unknown;

  /** Whether the variable must be provided. */
  required?: boolean;
}

// ── Task-Type Matching (Triggers) ────────────────────────────────

/**
 * Defines when a skill should be activated. The SkillRegistry
 * evaluates triggers against incoming tasks to find matching skills.
 *
 * Multiple triggers use OR semantics — any match activates the skill.
 */
export type SkillTrigger =
  | TaskTypeTrigger
  | LabelTrigger
  | PatternTrigger
  | FileTrigger
  | CompositeTrigger;

/** Match by task type or category. */
export interface TaskTypeTrigger {
  type: 'task-type';
  /** Task types this skill handles (e.g. "bug-fix", "feature", "refactor"). */
  taskTypes: string[];
}

/** Match by task labels/tags. */
export interface LabelTrigger {
  type: 'label';
  /** All listed labels must be present on the task. */
  labels: string[];
}

/** Match by regex pattern against task title or description. */
export interface PatternTrigger {
  type: 'pattern';
  /** Regex applied to task title. */
  titlePattern?: string;
  /** Regex applied to task description. */
  descriptionPattern?: string;
}

/** Match when task involves specific file patterns. */
export interface FileTrigger {
  type: 'file';
  /** Glob patterns for files the task touches. */
  globs: string[];
}

/** Combine multiple triggers with AND/OR logic. */
export interface CompositeTrigger {
  type: 'composite';
  operator: 'and' | 'or';
  triggers: SkillTrigger[];
}

// ── Dependencies ─────────────────────────────────────────────────

export interface SkillDependency {
  /** Skill ID of the dependency. */
  skillId: string;

  /** Semver range for compatible versions. */
  versionRange?: string;

  /** If true, the skill degrades gracefully without this dependency. */
  optional?: boolean;
}

// ── Configuration Schema ─────────────────────────────────────────

export interface SkillConfigSchema {
  /** Config key (dot-notation supported, e.g. "review.strictness"). */
  key: string;

  /** Display label. */
  label: string;

  /** Value type. */
  type: 'string' | 'number' | 'boolean' | 'string[]';

  /** Human-readable description. */
  description: string;

  /** Default value. */
  default?: unknown;

  /** Allowed values (renders as dropdown). */
  enum?: unknown[];

  /** Validation constraints. */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// ── Permissions ──────────────────────────────────────────────────

export type SkillPermission =
  | 'fs:read' // Read files from the project
  | 'fs:write' // Write/modify project files
  | 'net:outbound' // Make outbound HTTP requests
  | 'exec:shell' // Execute shell commands
  | 'agent:delegate' // Delegate tasks to other agents
  | 'secret:read'; // Access secrets from the secure store

// ── Skill Lifecycle Hooks ────────────────────────────────────────

/**
 * Optional imperative hooks for skills that need runtime logic
 * beyond declarative prompt + tool composition.
 *
 * Exported from the module at `SkillManifest.entryPoint`.
 */
export interface SkillLifecycleHooks {
  /**
   * Called once when the skill is loaded into the registry.
   * Use for one-time setup (e.g., compiling templates, caching data).
   */
  onLoad?(ctx: SkillContext): Promise<void>;

  /**
   * Called each time the skill is activated for a task.
   * Return additional context to merge into SkillContext.vars.
   */
  onActivate?(ctx: SkillContext): Promise<Record<string, unknown> | void>;

  /**
   * Called when the skill is deactivated (task complete or error).
   * Use for cleanup.
   */
  onDeactivate?(ctx: SkillContext): Promise<void>;

  /**
   * Called when the skill is unloaded from the registry.
   * Use for teardown (e.g., closing connections).
   */
  onUnload?(): Promise<void>;

  /**
   * Custom prompt renderer. If provided, overrides the default
   * template interpolation engine for this skill's prompts.
   */
  renderPrompt?(templateId: string, ctx: SkillContext): Promise<string>;

  /**
   * Custom trigger evaluator. If provided, overrides the default
   * trigger matching logic for this skill.
   */
  matchTask?(task: SkillTaskContext): Promise<SkillMatchResult>;
}

// ── Skill Context (Runtime) ──────────────────────────────────────

/**
 * Runtime context provided to an active skill.
 * Passed to lifecycle hooks, prompt renderers, and custom handlers.
 *
 * Designed to be a self-contained "world view" so skills don't need
 * to reach into global state.
 */
export interface SkillContext {
  /** The resolved skill manifest. */
  skill: ResolvedSkillManifest;

  /** The agent this skill is currently executing for. */
  agent: SkillAgentRef;

  /** Current task context (if activated for a specific task). */
  taskContext: SkillTaskContext | null;

  /** User-provided configuration values (merged with defaults). */
  config: Record<string, unknown>;

  /** Runtime variables — mutable scratchpad for skill state. */
  vars: Record<string, unknown>;

  /** Tool invocation interface (scoped to declared tools). */
  tools: SkillToolkit;

  /** Inter-skill communication. */
  skills: SkillInterop;

  /** Structured logging scoped to this skill. */
  logger: SkillLogger;

  /** Emit events for observability and UI updates. */
  events: SkillEventEmitter;
}

/** Minimal agent reference available to skills. */
export interface SkillAgentRef {
  id: string;
  name: string;
  role: string;
  expertise: string[];
}

/** Task information available to skills. */
export interface SkillTaskContext {
  id: string;
  title: string;
  description: string;
  labels: string[];
  priority: string;
  /** Files associated with the task (from git diff, PR, etc). */
  files?: string[];
  /** Arbitrary task metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Scoped tool invocation interface. Only tools declared in the
 * manifest are accessible. Undeclared tools throw PermissionError.
 */
export interface SkillToolkit {
  /** Invoke a declared tool by ID. */
  invoke(toolId: string, params: Record<string, unknown>): Promise<SkillToolResult>;

  /** Check if a declared tool is available. */
  isAvailable(toolId: string): boolean;

  /** List all tools available to this skill. */
  list(): SkillToolInfo[];
}

export interface SkillToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export interface SkillToolInfo {
  toolId: string;
  name: string;
  description: string;
  available: boolean;
}

/** Communication between skills within the same agent. */
export interface SkillInterop {
  /** Request data from another active skill. */
  query(skillId: string, request: Record<string, unknown>): Promise<unknown>;

  /** Check if a skill is currently active. */
  isActive(skillId: string): boolean;
}

export interface SkillLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export type SkillEventType =
  | 'skill:activated'
  | 'skill:deactivated'
  | 'skill:error'
  | 'skill:tool-invoked'
  | 'skill:prompt-rendered'
  | 'skill:config-changed';

export interface SkillEvent {
  type: SkillEventType;
  skillId: string;
  timestamp: number;
  data?: unknown;
}

export interface SkillEventEmitter {
  emit(type: SkillEventType, data?: unknown): void;
}

// ── Skill Match Result ───────────────────────────────────────────

export interface SkillMatchResult {
  /** Whether the skill matches the task. */
  matches: boolean;
  /** Confidence score (0–1). Higher = better match. */
  confidence: number;
  /** Human-readable reason for the match (for debugging / UI). */
  reason?: string;
}

// ── Resolved Skill Manifest ──────────────────────────────────────

/**
 * A SkillManifest after validation and resolution.
 * All dependencies are resolved, tools are verified, and templates are compiled.
 */
export interface ResolvedSkillManifest extends SkillManifest {
  /** Absolute path to the manifest source. */
  sourcePath: string;

  /** Resolved dependency graph (skill IDs → resolved versions). */
  resolvedDependencies: Record<string, SemVer>;

  /** Which declared tools are actually available. */
  toolAvailability: Record<string, boolean>;

  /** Compiled prompt templates (implementation-specific). */
  compiledPrompts?: Record<string, unknown>;
}

// ── Skill Registry ───────────────────────────────────────────────

/** Lifecycle phase of a registered skill. */
export type SkillPhase =
  | 'discovered' // Found on disk / remote, not yet validated
  | 'validated' // Manifest parsed and schema-validated
  | 'loaded' // Dependencies resolved, tools checked, hooks imported
  | 'active' // Currently in use by one or more agents
  | 'deactivated' // Was active, now idle (can be re-activated)
  | 'error'; // Failed at any phase

export interface SkillRegistryEntry {
  /** The resolved manifest. */
  manifest: ResolvedSkillManifest;

  /** Current lifecycle phase. */
  phase: SkillPhase;

  /** Imported lifecycle hooks (if entryPoint was specified). */
  hooks: SkillLifecycleHooks | null;

  /** Agent IDs that currently have this skill active. */
  activeAgents: Set<string>;

  /** Timestamp of last phase transition. */
  lastTransition: number;

  /** Error details if phase is 'error'. */
  error?: SkillRegistryError;
}

export interface SkillRegistryError {
  phase: SkillPhase;
  code: SkillErrorCode;
  message: string;
  details?: unknown;
}

export type SkillErrorCode =
  | 'MANIFEST_PARSE_ERROR'
  | 'MANIFEST_VALIDATION_ERROR'
  | 'DEPENDENCY_NOT_FOUND'
  | 'DEPENDENCY_VERSION_MISMATCH'
  | 'TOOL_NOT_AVAILABLE'
  | 'ENTRY_POINT_NOT_FOUND'
  | 'ENTRY_POINT_LOAD_ERROR'
  | 'LIFECYCLE_HOOK_ERROR'
  | 'PERMISSION_DENIED'
  | 'CIRCULAR_DEPENDENCY';

// ── Registry Events ──────────────────────────────────────────────

export type SkillRegistryEventType =
  | 'skill:discovered'
  | 'skill:validated'
  | 'skill:loaded'
  | 'skill:activated'
  | 'skill:deactivated'
  | 'skill:unloaded'
  | 'skill:error';

export interface SkillRegistryEvent {
  type: SkillRegistryEventType;
  skillId: string;
  agentId?: string;
  timestamp: number;
  data?: unknown;
}

export type SkillRegistryEventListener = (event: SkillRegistryEvent) => void;

// ── Skill Registry Interface ─────────────────────────────────────

/**
 * The SkillRegistry manages the full plugin lifecycle:
 *
 *   discover → validate → load → activate ⇄ deactivate
 *                                    ↓
 *                                  unload
 *
 * Responsibilities:
 *   - Scan directories for skill manifests
 *   - Validate manifests against the schema
 *   - Resolve dependencies (skills + tools)
 *   - Import lifecycle hooks from entry points
 *   - Activate/deactivate skills for specific agents
 *   - Match incoming tasks to registered skills
 *   - Provide scoped SkillContext to active skills
 */
export interface SkillRegistry {
  // ── Discovery & Loading ──────────────────────────────────────

  /**
   * Scan one or more directories for skill manifests.
   * Transitions discovered skills to 'discovered' phase.
   * Returns IDs of newly discovered skills.
   */
  discover(directories: string[]): Promise<string[]>;

  /**
   * Validate a discovered skill's manifest against the schema.
   * Transitions to 'validated' or 'error'.
   */
  validate(skillId: string): Promise<SkillValidationResult>;

  /**
   * Resolve dependencies, check tool availability, import hooks.
   * Transitions to 'loaded' or 'error'.
   * Prerequisite: skill must be 'validated'.
   */
  load(skillId: string): Promise<void>;

  /**
   * Convenience: discover + validate + load for all skills in directories.
   */
  discoverAndLoadAll(directories: string[]): Promise<SkillLoadSummary>;

  // ── Activation ───────────────────────────────────────────────

  /**
   * Activate a skill for a specific agent.
   * Creates a SkillContext and calls onActivate hook.
   * Prerequisite: skill must be 'loaded' or 'deactivated'.
   */
  activate(skillId: string, agentId: string, taskContext?: SkillTaskContext): Promise<SkillContext>;

  /**
   * Deactivate a skill for a specific agent.
   * Calls onDeactivate hook and cleans up context.
   */
  deactivate(skillId: string, agentId: string): Promise<void>;

  // ── Task Matching ────────────────────────────────────────────

  /**
   * Find skills that match a given task, ranked by confidence.
   * Only considers skills in 'loaded', 'active', or 'deactivated' phase.
   */
  matchTask(task: SkillTaskContext): Promise<SkillMatchResult[]>;

  /**
   * Get rendered prompts for all active skills for an agent.
   * Merges prompts by role, respecting token budgets.
   */
  getActivePrompts(agentId: string, role: PromptRole): Promise<RenderedPrompt[]>;

  // ── Querying ─────────────────────────────────────────────────

  /** Get a skill by ID. */
  get(skillId: string): SkillRegistryEntry | undefined;

  /** List all registered skills, optionally filtered. */
  list(filter?: SkillFilter): SkillRegistryEntry[];

  /** Get the active context for a skill + agent pair. */
  getContext(skillId: string, agentId: string): SkillContext | undefined;

  // ── Lifecycle Management ─────────────────────────────────────

  /**
   * Unload a skill entirely (calls onUnload hook, removes from registry).
   * Skill must be deactivated for all agents first.
   */
  unload(skillId: string): Promise<void>;

  /**
   * Reload a skill (unload + discover + validate + load).
   * Useful for development hot-reload.
   */
  reload(skillId: string): Promise<void>;

  // ── Events ───────────────────────────────────────────────────

  on(event: SkillRegistryEventType, listener: SkillRegistryEventListener): void;
  off(event: SkillRegistryEventType, listener: SkillRegistryEventListener): void;
}

// ── Supporting Types ─────────────────────────────────────────────

export interface SkillValidationResult {
  valid: boolean;
  errors: SkillValidationError[];
  warnings: SkillValidationWarning[];
}

export interface SkillValidationError {
  path: string;
  message: string;
  code: string;
}

export interface SkillValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export interface SkillLoadSummary {
  discovered: number;
  validated: number;
  loaded: number;
  errors: Array<{ skillId: string; error: SkillRegistryError }>;
}

export interface RenderedPrompt {
  skillId: string;
  templateId: string;
  role: PromptRole;
  content: string;
  tokenEstimate: number;
}

export interface SkillFilter {
  phase?: SkillPhase;
  tags?: ToolCapabilityTag[];
  agentId?: string;
}

// ── Skill Match Result (extended for registry) ───────────────────

export interface SkillMatchResult {
  skillId: string;
  matches: boolean;
  confidence: number;
  reason?: string;
  /** Which trigger(s) matched. */
  matchedTriggers?: SkillTrigger[];
}
