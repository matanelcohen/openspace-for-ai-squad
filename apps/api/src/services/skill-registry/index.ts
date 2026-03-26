/**
 * SkillRegistryImpl — the main runtime implementation of the SkillRegistry interface.
 *
 * Manages the full plugin lifecycle:
 *   discover → validate → load → activate ⇄ deactivate → unload
 *
 * Key design decisions:
 *   - Skills are isolated: hook failures → error phase, agent keeps running
 *   - Events emitted on every phase transition for observability
 *   - Thread-safe activation: multiple agents can share a loaded skill
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type {
  PromptRole,
  RenderedPrompt,
  SkillAgentRef,
  SkillContext,
  SkillDependency,
  SkillFilter,
  SkillLoadSummary,
  SkillManifest,
  SkillMatchResult,
  SkillPhase,
  SkillRegistry,
  SkillRegistryEntry,
  SkillRegistryError,
  SkillRegistryEvent,
  SkillRegistryEventListener,
  SkillRegistryEventType,
  SkillTaskContext,
  SkillValidationResult,
} from '@openspace/shared/src/types/skill.js';

import {
  safeImportEntryPoint,
  safeOnActivate,
  safeOnDeactivate,
  safeOnLoad,
  safeOnUnload,
} from './skill-isolation.js';
import {
  detectCircularDependencies,
  discoverManifests,
  resolveManifest,
  topologicalSortSkills,
  validateSkillManifest,
} from './skill-loader.js';
import { matchTaskToSkills } from './skill-router.js';

// ── Stub implementations for SkillContext members ────────────────

function createStubToolkit(manifest: SkillManifest) {
  const declaredTools = new Set(manifest.tools.map((t) => t.toolId));
  return {
    async invoke(toolId: string, _params: Record<string, unknown>) {
      if (!declaredTools.has(toolId)) {
        return {
          success: false,
          error: `Tool "${toolId}" not declared in manifest`,
          durationMs: 0,
        };
      }
      return { success: true, data: null, durationMs: 0 };
    },
    isAvailable(toolId: string) {
      return declaredTools.has(toolId);
    },
    list() {
      return manifest.tools.map((t) => ({
        toolId: t.toolId,
        name: t.toolId,
        description: t.reason ?? '',
        available: true,
      }));
    },
  };
}

function createStubLogger(_skillId: string) {
  return {
    debug(_msg: string, _data?: Record<string, unknown>) {
      /* noop for now */
    },
    info(_msg: string, _data?: Record<string, unknown>) {
      /* noop for now */
    },
    warn(_msg: string, _data?: Record<string, unknown>) {
      /* noop for now */
    },
    error(_msg: string, _data?: Record<string, unknown>) {
      /* noop for now */
    },
  };
}

function createStubEvents(_skillId: string) {
  return {
    emit() {
      /* noop - events flow through registry */
    },
  };
}

function createStubInterop() {
  return {
    async query() {
      return null;
    },
    isActive() {
      return false;
    },
  };
}

// ── SkillRegistryImpl ────────────────────────────────────────────

export class SkillRegistryImpl implements SkillRegistry {
  private entries = new Map<string, SkillRegistryEntry>();
  private contexts = new Map<string, SkillContext>(); // key: `${skillId}:${agentId}`
  private listeners = new Map<SkillRegistryEventType, Set<SkillRegistryEventListener>>();

  // ── Discovery & Loading ──────────────────────────────────────

  async discover(directories: string[]): Promise<string[]> {
    const discovered = discoverManifests(directories);
    const newIds: string[] = [];

    for (const { manifest, sourcePath } of discovered) {
      if (this.entries.has(manifest.id)) continue;

      const resolved = resolveManifest(manifest, sourcePath, new Map());
      this.entries.set(manifest.id, {
        manifest: resolved,
        phase: 'discovered',
        hooks: null,
        activeAgents: new Set(),
        lastTransition: Date.now(),
      });
      newIds.push(manifest.id);
      this.emit('skill:discovered', manifest.id);
    }

    return newIds;
  }

  async validate(skillId: string): Promise<SkillValidationResult> {
    const entry = this.entries.get(skillId);
    if (!entry) {
      return {
        valid: false,
        errors: [
          { path: '/', message: `Skill "${skillId}" not found in registry`, code: 'NOT_FOUND' },
        ],
        warnings: [],
      };
    }

    // Strip ResolvedSkillManifest-only fields before schema validation
    // (discover() pre-resolves, but Ajv uses additionalProperties: false)
    const {
      sourcePath,
      resolvedDependencies: _rd,
      toolAvailability: _ta,
      compiledPrompts: _cp,
      ...rawManifest
    } = entry.manifest;

    const knownIds = new Set([...this.entries.keys()].filter((id) => id !== skillId));
    const result = validateSkillManifest(rawManifest as SkillManifest, sourcePath, knownIds);

    if (result.valid) {
      this.transition(skillId, 'validated');
    } else {
      this.transitionToError(
        skillId,
        'discovered',
        'MANIFEST_VALIDATION_ERROR',
        result.errors.map((e) => e.message).join('; '),
      );
    }

    return result;
  }

  async load(skillId: string): Promise<void> {
    const entry = this.entries.get(skillId);
    if (!entry) throw new Error(`Skill "${skillId}" not found`);
    if (entry.phase !== 'validated') {
      throw new Error(
        `Skill "${skillId}" must be validated before loading (current: ${entry.phase})`,
      );
    }

    // Check for circular dependencies
    const depsMap = new Map<string, SkillDependency[]>();
    for (const [id, e] of this.entries) {
      if (e.manifest.dependencies) {
        depsMap.set(id, e.manifest.dependencies);
      }
    }
    const cycle = detectCircularDependencies(skillId, depsMap);
    if (cycle) {
      this.transitionToError(
        skillId,
        'validated',
        'CIRCULAR_DEPENDENCY',
        `Circular dependency: ${cycle.join(' → ')}`,
      );
      throw new Error(`Circular dependency detected: ${cycle.join(' → ')}`);
    }

    // Check required dependencies exist
    if (entry.manifest.dependencies) {
      for (const dep of entry.manifest.dependencies) {
        const depEntry = this.entries.get(dep.skillId);
        if (!depEntry && !dep.optional) {
          this.transitionToError(
            skillId,
            'validated',
            'DEPENDENCY_NOT_FOUND',
            `Required dependency "${dep.skillId}" not found`,
          );
          throw new Error(`Required dependency "${dep.skillId}" not found for skill "${skillId}"`);
        }
      }
    }

    // Re-resolve with loaded manifests
    const loadedManifests = new Map<string, SkillManifest>();
    for (const [id, e] of this.entries) {
      loadedManifests.set(id, e.manifest);
    }
    entry.manifest = resolveManifest(entry.manifest, entry.manifest.sourcePath, loadedManifests);

    // Import entry point if specified
    if (entry.manifest.entryPoint) {
      const entryPath = resolve(dirname(entry.manifest.sourcePath), entry.manifest.entryPoint);
      if (!existsSync(entryPath)) {
        this.transitionToError(
          skillId,
          'validated',
          'ENTRY_POINT_NOT_FOUND',
          `Entry point not found: ${entryPath}`,
        );
        throw new Error(`Entry point not found: ${entryPath}`);
      }

      const importResult = await safeImportEntryPoint(entryPath);
      if (!importResult.success) {
        this.transitionToError(
          skillId,
          'validated',
          'ENTRY_POINT_LOAD_ERROR',
          importResult.error?.message ?? 'Failed to import entry point',
        );
        throw new Error(
          `Failed to import entry point for "${skillId}": ${importResult.error?.message}`,
        );
      }
      entry.hooks = importResult.result ?? null;

      // Call onLoad hook
      if (entry.hooks) {
        const ctx = this.createContext(entry, {
          id: 'system',
          name: 'System',
          role: 'runtime',
          expertise: [],
        });
        const loadResult = await safeOnLoad(entry.hooks, ctx);
        if (!loadResult.success) {
          this.transitionToError(
            skillId,
            'validated',
            'LIFECYCLE_HOOK_ERROR',
            `onLoad failed: ${loadResult.error?.message}`,
          );
          throw new Error(`onLoad hook failed for "${skillId}": ${loadResult.error?.message}`);
        }
      }
    }

    this.transition(skillId, 'loaded');
  }

  async discoverAndLoadAll(directories: string[]): Promise<SkillLoadSummary> {
    const discovered = await this.discover(directories);
    let validated = 0;
    let loaded = 0;
    const errors: Array<{ skillId: string; error: SkillRegistryError }> = [];

    // Validate all
    for (const id of discovered) {
      const result = await this.validate(id);
      if (result.valid) validated++;
    }

    // Topological sort for dependency order
    const depsMap = new Map<string, SkillDependency[]>();
    const validIds = discovered.filter((id) => this.entries.get(id)?.phase === 'validated');
    for (const id of validIds) {
      const entry = this.entries.get(id)!;
      if (entry.manifest.dependencies) {
        depsMap.set(id, entry.manifest.dependencies);
      }
    }
    const loadOrder = topologicalSortSkills(validIds, depsMap);

    // Load in order
    for (const id of loadOrder) {
      try {
        await this.load(id);
        loaded++;
      } catch (err) {
        const entry = this.entries.get(id);
        if (entry?.error) {
          errors.push({ skillId: id, error: entry.error });
        } else {
          errors.push({
            skillId: id,
            error: {
              phase: 'validated',
              code: 'LIFECYCLE_HOOK_ERROR',
              message: (err as Error).message,
            },
          });
        }
      }
    }

    return { discovered: discovered.length, validated, loaded, errors };
  }

  // ── Activation ───────────────────────────────────────────────

  async activate(
    skillId: string,
    agentId: string,
    taskContext?: SkillTaskContext,
  ): Promise<SkillContext> {
    const entry = this.entries.get(skillId);
    if (!entry) throw new Error(`Skill "${skillId}" not found`);
    if (!['loaded', 'deactivated', 'active'].includes(entry.phase)) {
      throw new Error(
        `Skill "${skillId}" must be loaded before activation (current: ${entry.phase})`,
      );
    }

    const agent: SkillAgentRef = { id: agentId, name: agentId, role: 'agent', expertise: [] };
    const ctx = this.createContext(entry, agent, taskContext ?? null);

    // Call onActivate hook
    const activateResult = await safeOnActivate(entry.hooks, ctx);
    if (!activateResult.success) {
      this.transitionToError(
        skillId,
        entry.phase,
        'LIFECYCLE_HOOK_ERROR',
        `onActivate failed: ${activateResult.error?.message}`,
      );
      throw new Error(`onActivate failed for "${skillId}": ${activateResult.error?.message}`);
    }

    // Merge any vars returned by onActivate
    if (activateResult.result && typeof activateResult.result === 'object') {
      Object.assign(ctx.vars, activateResult.result);
    }

    entry.activeAgents.add(agentId);
    this.transition(skillId, 'active');

    const key = `${skillId}:${agentId}`;
    this.contexts.set(key, ctx);

    this.emit('skill:activated', skillId, agentId);
    return ctx;
  }

  async deactivate(skillId: string, agentId: string): Promise<void> {
    const entry = this.entries.get(skillId);
    if (!entry) throw new Error(`Skill "${skillId}" not found`);

    const key = `${skillId}:${agentId}`;
    const ctx = this.contexts.get(key);

    if (ctx) {
      await safeOnDeactivate(entry.hooks, ctx);
      this.contexts.delete(key);
    }

    entry.activeAgents.delete(agentId);

    if (entry.activeAgents.size === 0) {
      this.transition(skillId, 'deactivated');
    }

    this.emit('skill:deactivated', skillId, agentId);
  }

  // ── Task Matching ────────────────────────────────────────────

  async matchTask(task: SkillTaskContext): Promise<SkillMatchResult[]> {
    return matchTaskToSkills([...this.entries.values()], task);
  }

  async getActivePrompts(agentId: string, role: PromptRole): Promise<RenderedPrompt[]> {
    const prompts: RenderedPrompt[] = [];

    for (const [key, ctx] of this.contexts) {
      if (!key.endsWith(`:${agentId}`)) continue;

      for (const template of ctx.skill.prompts) {
        if (template.role !== role) continue;

        prompts.push({
          skillId: ctx.skill.id,
          templateId: template.id,
          role: template.role,
          content: template.content, // basic rendering — full template engine is future work
          tokenEstimate: Math.ceil(template.content.length / 4),
        });
      }
    }

    return prompts;
  }

  // ── Querying ─────────────────────────────────────────────────

  get(skillId: string): SkillRegistryEntry | undefined {
    return this.entries.get(skillId);
  }

  list(filter?: SkillFilter): SkillRegistryEntry[] {
    let results = [...this.entries.values()];

    if (filter?.phase) {
      results = results.filter((e) => e.phase === filter.phase);
    }
    if (filter?.tags && filter.tags.length > 0) {
      const tagSet = new Set(filter.tags);
      results = results.filter((e) => e.manifest.tags?.some((t) => tagSet.has(t)));
    }
    if (filter?.agentId) {
      results = results.filter((e) => e.activeAgents.has(filter.agentId!));
    }

    return results;
  }

  getContext(skillId: string, agentId: string): SkillContext | undefined {
    return this.contexts.get(`${skillId}:${agentId}`);
  }

  // ── Lifecycle Management ─────────────────────────────────────

  async unload(skillId: string): Promise<void> {
    const entry = this.entries.get(skillId);
    if (!entry) throw new Error(`Skill "${skillId}" not found`);
    if (entry.activeAgents.size > 0) {
      throw new Error(
        `Cannot unload "${skillId}": still active for ${entry.activeAgents.size} agent(s)`,
      );
    }

    await safeOnUnload(entry.hooks);
    this.entries.delete(skillId);
    this.emit('skill:unloaded', skillId);
  }

  async reload(skillId: string): Promise<void> {
    const entry = this.entries.get(skillId);
    if (!entry) throw new Error(`Skill "${skillId}" not found`);

    const sourcePath = entry.manifest.sourcePath;
    const dir = dirname(dirname(sourcePath)); // go up from skill.json to parent dir

    // Deactivate all agents first
    for (const agentId of [...entry.activeAgents]) {
      await this.deactivate(skillId, agentId);
    }

    await this.unload(skillId);
    await this.discover([dir]);
    const validation = await this.validate(skillId);
    if (validation.valid) {
      await this.load(skillId);
    }
  }

  // ── Events ───────────────────────────────────────────────────

  on(event: SkillRegistryEventType, listener: SkillRegistryEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: SkillRegistryEventType, listener: SkillRegistryEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  // ── Internal helpers ─────────────────────────────────────────

  private emit(type: SkillRegistryEventType, skillId: string, agentId?: string): void {
    const event: SkillRegistryEvent = {
      type,
      skillId,
      agentId,
      timestamp: Date.now(),
    };
    this.listeners.get(type)?.forEach((l) => {
      try {
        l(event);
      } catch {
        /* listener errors don't propagate */
      }
    });
  }

  private transition(skillId: string, phase: SkillPhase): void {
    const entry = this.entries.get(skillId);
    if (entry) {
      entry.phase = phase;
      entry.lastTransition = Date.now();
      delete entry.error;
    }
  }

  private transitionToError(
    skillId: string,
    fromPhase: SkillPhase,
    code: SkillRegistryError['code'],
    message: string,
  ): void {
    const entry = this.entries.get(skillId);
    if (entry) {
      entry.phase = 'error';
      entry.lastTransition = Date.now();
      entry.error = { phase: fromPhase, code, message };
      this.emit('skill:error', skillId);
    }
  }

  private createContext(
    entry: SkillRegistryEntry,
    agent: SkillAgentRef,
    taskContext?: SkillTaskContext | null,
  ): SkillContext {
    const config: Record<string, unknown> = {};
    if (entry.manifest.config) {
      for (const cfg of entry.manifest.config) {
        if (cfg.default !== undefined) {
          config[cfg.key] = cfg.default;
        }
      }
    }

    return {
      skill: entry.manifest,
      agent,
      taskContext: taskContext ?? null,
      config,
      vars: {},
      tools: createStubToolkit(entry.manifest),
      skills: createStubInterop(),
      logger: createStubLogger(entry.manifest.id),
      events: createStubEvents(entry.manifest.id),
    };
  }
}
