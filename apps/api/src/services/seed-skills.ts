/**
 * Seed built-in skills into the SkillRegistry on startup.
 *
 * Reads SKILL.md files from `.squad/skills/` with YAML frontmatter
 * (parsed via gray-matter) and registers each as a built-in skill.
 * Falls back to hardcoded defaults if the skills directory is missing.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import matter from 'gray-matter';

import type { SkillRegistryImpl } from './skill-registry/index.js';

// ── Types ─────────────────────────────────────────────────────────

export interface SkillFrontmatter {
  name: string;
  description: string;
  tags: string[];
  agentMatch: { roles: string[] };
  requires?: { bins?: string[]; env?: string[] };
}

export interface ParsedSkill {
  id: string;
  frontmatter: SkillFrontmatter;
  content: string;
}

// ── Icon map (skill-id → emoji) ───────────────────────────────────

const SKILL_ICONS: Record<string, string> = {
  'file-operations': '📁',
  'bash-execution': '💻',
  'code-review': '🔍',
  'web-search': '🌐',
  'test-runner': '🧪',
  'git-operations': '🔀',
  'database-query': '🗄️',
  'task-delegation': '📋',
};

// ── SKILL.md parsing ──────────────────────────────────────────────

/**
 * Scan `.squad/skills/` for directories containing SKILL.md,
 * parse YAML frontmatter with gray-matter, and return structured skills.
 */
export function loadSkillsFromDirectory(skillsDir: string): ParsedSkill[] {
  if (!existsSync(skillsDir)) return [];

  const skills: ParsedSkill[] = [];

  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const skillFile = join(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    try {
      const raw = readFileSync(skillFile, 'utf-8');
      const { data, content } = matter(raw);

      const fm = data as Partial<SkillFrontmatter>;
      if (!fm.name || !fm.description) {
        console.warn(`[Skills] Skipping ${entry.name}/SKILL.md — missing name or description`);
        continue;
      }

      skills.push({
        id: entry.name,
        frontmatter: {
          name: fm.name,
          description: fm.description,
          tags: fm.tags ?? [],
          agentMatch: fm.agentMatch ?? { roles: ['*'] },
          requires: fm.requires ?? { bins: [], env: [] },
        },
        content: content.trim(),
      });
    } catch (err) {
      console.warn(`[Skills] Failed to parse ${entry.name}/SKILL.md:`, err);
    }
  }

  return skills;
}

/**
 * Get the skills that match a given agent role.
 */
export function getSkillsForRole(skills: ParsedSkill[], role: string): ParsedSkill[] {
  return skills.filter((s) => {
    const roles = s.frontmatter.agentMatch.roles;
    return roles.includes('*') || roles.includes(role);
  });
}

/**
 * Build a system prompt fragment listing available skills for an agent.
 */
export function buildSkillsPrompt(skills: ParsedSkill[]): string {
  if (skills.length === 0) return '';

  const lines = ['## Available Skills', ''];
  for (const s of skills) {
    const icon = SKILL_ICONS[s.id] ?? '🔧';
    lines.push(`- ${icon} **${s.frontmatter.name}**: ${s.frontmatter.description}`);
  }
  return lines.join('\n');
}

// ── Registry seeding ──────────────────────────────────────────────

/**
 * Register built-in skills into the registry.
 * Scans `.squad/skills/` for SKILL.md files and registers each.
 */
export function seedBuiltinSkills(registry: SkillRegistryImpl, squadDir?: string): void {
  const resolvedSquadDir = squadDir ?? resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
  const skillsDir = join(resolvedSquadDir, 'skills');

  const skills = loadSkillsFromDirectory(skillsDir);

  // Access the internal entries map via discover simulation
  const entries = (registry as unknown as { entries: Map<string, unknown> }).entries;

  for (const skill of skills) {
    if (entries.has(skill.id)) continue;

    // Pretty-print the skill name from the directory name
    const displayName =
      skill.frontmatter.name ||
      skill.id
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');

    entries.set(skill.id, {
      manifest: {
        manifestVersion: '1.0' as const,
        id: skill.id,
        name: displayName,
        version: '1.0.0',
        description: skill.frontmatter.description,
        author: 'openspace.ai',
        tags: skill.frontmatter.tags,
        icon: SKILL_ICONS[skill.id] ?? '🔧',
        permissions: [],
        agentMatch: skill.frontmatter.agentMatch,
      },
      phase: 'loaded' as const,
      hooks: null,
      activeAgents: new Set<string>(),
      lastTransition: Date.now(),
      error: null,
      sourcePath: join(skillsDir, skill.id, 'SKILL.md'),
      retryState: null,
      circuitBreaker: null,
    });
  }

  console.log(`[Skills] Seeded ${skills.length} skills from ${skillsDir}`);
}
