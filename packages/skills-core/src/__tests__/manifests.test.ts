import { describe, it, expect } from 'vitest';
import {
  SKILL_IDS,
  loadManifest,
  loadTools,
  loadPrompts,
  loadAllManifests,
  getSkillPath,
} from '../index.js';
import type { SkillManifest } from '@openspace/shared/src/types/skill.js';
import type { Tool } from '@openspace/shared/src/types/tool.js';
import { existsSync } from 'node:fs';

describe('skills-core', () => {
  describe('SKILL_IDS', () => {
    it('exports exactly 3 core skills', () => {
      expect(SKILL_IDS).toEqual(['git-expert', 'test-runner', 'code-reviewer']);
    });
  });

  describe('loadAllManifests', () => {
    it('loads all manifests without errors', () => {
      const manifests = loadAllManifests();
      expect(manifests).toHaveLength(3);
    });
  });

  describe.each(SKILL_IDS)('skill: %s', (skillId) => {
    let manifest: SkillManifest;
    let tools: Tool[];
    let prompts: Record<string, string>;

    beforeAll(() => {
      manifest = loadManifest(skillId);
      tools = loadTools(skillId);
      prompts = loadPrompts(skillId);
    });

    // ── Manifest structure ─────────────────────────────────

    it('has valid manifest version', () => {
      expect(manifest.manifestVersion).toBe(1);
    });

    it('has matching id', () => {
      expect(manifest.id).toBe(skillId);
    });

    it('has required metadata fields', () => {
      expect(manifest.name).toBeTruthy();
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(manifest.description).toBeTruthy();
      expect(manifest.description.length).toBeGreaterThan(10);
    });

    it('has author and license', () => {
      expect(manifest.author).toBe('openspace');
      expect(manifest.license).toBe('MIT');
    });

    it('has valid tags', () => {
      expect(manifest.tags).toBeDefined();
      expect(manifest.tags!.length).toBeGreaterThan(0);
    });

    it('has an icon', () => {
      expect(manifest.icon).toBeTruthy();
    });

    // ── Tool declarations ──────────────────────────────────

    it('declares at least one tool', () => {
      expect(manifest.tools.length).toBeGreaterThan(0);
    });

    it('all tool declarations have toolId and reason', () => {
      for (const tool of manifest.tools) {
        expect(tool.toolId).toMatch(/^[a-z]+:[a-z][\w-]*$/);
        expect(tool.reason).toBeTruthy();
      }
    });

    // ── Tool definition files ──────────────────────────────

    it('has tool definition JSON files', () => {
      expect(tools.length).toBeGreaterThan(0);
    });

    it('all tool definitions have required fields', () => {
      for (const tool of tools) {
        expect(tool.id).toBeTruthy();
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.parameters).toBeInstanceOf(Array);
        expect(tool.outputDescription).toBeTruthy();
        expect(tool.author).toBe('openspace');
      }
    });

    it('tool definitions have valid parameter schemas', () => {
      for (const tool of tools) {
        for (const param of tool.inputSchema.parameters) {
          expect(param.name).toBeTruthy();
          expect(['string', 'number', 'boolean', 'object', 'array']).toContain(param.type);
          expect(param.description).toBeTruthy();
          expect(typeof param.required).toBe('boolean');
        }
      }
    });

    // ── Prompt templates ───────────────────────────────────

    it('has prompt templates', () => {
      expect(Object.keys(prompts).length).toBeGreaterThan(0);
    });

    it('all prompts are non-empty markdown', () => {
      for (const [filename, content] of Object.entries(prompts)) {
        expect(filename).toMatch(/\.md$/);
        expect(content.trim().length).toBeGreaterThan(50);
      }
    });

    it('manifest prompt entries reference existing files', () => {
      for (const prompt of manifest.prompts) {
        if (prompt.content.startsWith('file://prompts/')) {
          const filename = prompt.content.replace('file://prompts/', '');
          expect(prompts[filename]).toBeDefined();
        }
      }
    });

    it('has a system prompt', () => {
      const systemPrompt = manifest.prompts.find((p) => p.role === 'system');
      expect(systemPrompt).toBeDefined();
      expect(systemPrompt!.content).toContain('{{agent.name}}');
    });

    it('prompt variables have descriptions', () => {
      for (const prompt of manifest.prompts) {
        if (prompt.variables) {
          for (const v of prompt.variables) {
            expect(v.name).toBeTruthy();
            expect(v.description).toBeTruthy();
          }
        }
      }
    });

    // ── Triggers ───────────────────────────────────────────

    it('has at least one trigger', () => {
      expect(manifest.triggers.length).toBeGreaterThan(0);
    });

    it('triggers have valid types', () => {
      for (const trigger of manifest.triggers) {
        expect(['task-type', 'label', 'pattern', 'file', 'composite']).toContain(trigger.type);
      }
    });

    // ── Config ─────────────────────────────────────────────

    it('has configuration options', () => {
      expect(manifest.config).toBeDefined();
      expect(manifest.config!.length).toBeGreaterThan(0);
    });

    it('config entries have keys, types, and defaults', () => {
      for (const cfg of manifest.config!) {
        expect(cfg.key).toBeTruthy();
        expect(cfg.type).toBeTruthy();
        expect(cfg.default).toBeDefined();
      }
    });

    // ── Permissions ────────────────────────────────────────

    it('declares permissions', () => {
      expect(manifest.permissions).toBeDefined();
      expect(manifest.permissions!.length).toBeGreaterThan(0);
    });

    // ── Filesystem ─────────────────────────────────────────

    it('skill directory exists', () => {
      expect(existsSync(getSkillPath(skillId))).toBe(true);
    });
  });
});
