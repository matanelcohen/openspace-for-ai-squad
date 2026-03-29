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
 * Match skills relevant to a task using keyword + domain + role scoring.
 * Mirrors the Squad SDK SkillRegistry.matchSkills() approach.
 */
export function matchSkillsForTask(
  skills: ParsedSkill[],
  taskText: string,
  agentRole: string,
): ParsedSkill[] {
  const lowerTask = taskText.toLowerCase();
  const lowerRole = agentRole.toLowerCase();

  const scored = skills.map((s) => {
    let score = 0;

    // Role match: +0.3
    const roles = s.frontmatter.agentMatch?.roles ?? [];
    if (roles.includes('*') || roles.some((r) => lowerRole.includes(r.toLowerCase()))) {
      score += 0.3;
    }

    // Domain match: +0.3 if task mentions the skill domain
    const domain = (s.frontmatter.domain ?? s.frontmatter.description ?? '').toLowerCase();
    const domainWords = domain.split(/[,\s]+/).filter((w) => w.length > 3);
    for (const word of domainWords) {
      if (lowerTask.includes(word)) {
        score += 0.3;
        break;
      }
    }

    // Content keyword match: +0.2 for each matching keyword (max 0.4)
    const contentWords = (s.frontmatter.name + ' ' + s.frontmatter.description)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    let keywordHits = 0;
    for (const word of contentWords) {
      if (lowerTask.includes(word)) {
        keywordHits++;
        if (keywordHits >= 2) break;
      }
    }
    score += keywordHits * 0.2;

    return { skill: s, score };
  });

  return scored
    .filter((s) => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.skill);
}

/**
 * Build a system prompt fragment with full skill instructions for an agent.
 * Includes the SKILL.md content (not just name/description) so the AI
 * learns HOW to use each tool.
 */
export function buildSkillsPrompt(skills: ParsedSkill[]): string {
  if (skills.length === 0) return '';

  const sections = ['## Your Skills & Capabilities\n'];

  for (const s of skills) {
    const icon = SKILL_ICONS[s.id] ?? '🔧';
    sections.push(`### ${icon} ${s.frontmatter.name}\n`);
    sections.push(`> ${s.frontmatter.description}\n`);
    if (s.content) {
      sections.push(s.content);
    }
    sections.push('');
  }

  return sections.join('\n');
}

// ── Registry seeding ──────────────────────────────────────────────

/**
 * Register built-in skills into the registry.
 * Scans `.squad/skills/` for SKILL.md files and registers each.
 */
export function seedBuiltinSkills(registry: SkillRegistryImpl, squadDir?: string): void {
  const resolvedSquadDir = squadDir ?? resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');

  // Check multiple skill locations: .squad/skills, .copilot/skills, .squad/templates/skills
  const projectDir = resolve(resolvedSquadDir, '..');
  const skillsDirs = [
    join(resolvedSquadDir, 'skills'),
    join(projectDir, '.copilot', 'skills'),
    join(resolvedSquadDir, 'templates', 'skills'),
  ];

  let allSkills: ReturnType<typeof loadSkillsFromDirectory> = [];
  for (const dir of skillsDirs) {
    const skills = loadSkillsFromDirectory(dir);
    allSkills = allSkills.concat(skills);
  }

  // Access the internal entries map via discover simulation
  const entries = (registry as unknown as { entries: Map<string, unknown> }).entries;

  for (const skill of allSkills) {
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
        requires: skill.frontmatter.requires ?? { bins: [], env: [] },
        instructions: skill.content,
      },
      phase: 'loaded' as const,
      hooks: null,
      activeAgents: new Set<string>(),
      lastTransition: Date.now(),
      error: null,
      sourcePath: skill.sourcePath ?? skill.id,
      retryState: null,
      circuitBreaker: null,
    });
  }

  console.log(`[Skills] Seeded ${allSkills.length} skills from ${skillsDirs.filter(d => existsSync(d)).join(', ') || 'none'}`);
}
