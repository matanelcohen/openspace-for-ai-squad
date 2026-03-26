/**
 * Skill Router — matches incoming tasks to skills based on trigger rules.
 *
 * Confidence scoring per architecture doc:
 *   task-type exact match → 0.9
 *   label full match      → 0.8
 *   pattern regex match   → 0.7
 *   file glob match       → 0.6
 *   composite AND         → min(scores)
 *   composite OR          → max(scores)
 */

import type {
  SkillTrigger,
  SkillTaskContext,
  SkillMatchResult,
  SkillRegistryEntry,
  TaskTypeTrigger,
  LabelTrigger,
  PatternTrigger,
  FileTrigger,
  CompositeTrigger,
} from '@openspace/shared/src/types/skill.js';

// ── Confidence Constants ─────────────────────────────────────────

const CONFIDENCE = {
  TASK_TYPE: 0.9,
  LABEL: 0.8,
  PATTERN: 0.7,
  FILE: 0.6,
} as const;

// ── Trigger Evaluation ───────────────────────────────────────────

function evaluateTaskTypeTrigger(
  trigger: TaskTypeTrigger,
  task: SkillTaskContext,
): { matches: boolean; confidence: number; reason: string } {
  const taskLabels = task.labels.map((l) => l.toLowerCase());
  const taskType = task.metadata?.taskType as string | undefined;
  const matchedTypes: string[] = [];

  for (const tt of trigger.taskTypes) {
    const lower = tt.toLowerCase();
    if (taskType?.toLowerCase() === lower || taskLabels.includes(lower)) {
      matchedTypes.push(tt);
    }
  }

  if (matchedTypes.length > 0) {
    return {
      matches: true,
      confidence: CONFIDENCE.TASK_TYPE,
      reason: `task-type match: ${matchedTypes.join(', ')}`,
    };
  }
  return { matches: false, confidence: 0, reason: '' };
}

function evaluateLabelTrigger(
  trigger: LabelTrigger,
  task: SkillTaskContext,
): { matches: boolean; confidence: number; reason: string } {
  const taskLabels = new Set(task.labels.map((l) => l.toLowerCase()));
  const allPresent = trigger.labels.every((l) => taskLabels.has(l.toLowerCase()));

  if (allPresent) {
    return {
      matches: true,
      confidence: CONFIDENCE.LABEL,
      reason: `label match: ${trigger.labels.join(', ')}`,
    };
  }
  return { matches: false, confidence: 0, reason: '' };
}

function evaluatePatternTrigger(
  trigger: PatternTrigger,
  task: SkillTaskContext,
): { matches: boolean; confidence: number; reason: string } {
  const reasons: string[] = [];

  if (trigger.titlePattern) {
    try {
      const re = new RegExp(trigger.titlePattern, 'i');
      if (re.test(task.title)) {
        reasons.push(`title matched /${trigger.titlePattern}/`);
      }
    } catch {
      // invalid regex — skip
    }
  }

  if (trigger.descriptionPattern) {
    try {
      const re = new RegExp(trigger.descriptionPattern, 'i');
      if (re.test(task.description)) {
        reasons.push(`description matched /${trigger.descriptionPattern}/`);
      }
    } catch {
      // invalid regex — skip
    }
  }

  // Also support the `field`+`pattern` form used in some manifests
  const field = (trigger as Record<string, unknown>).field as string | undefined;
  const pattern = (trigger as Record<string, unknown>).pattern as string | undefined;
  const flags = (trigger as Record<string, unknown>).flags as string | undefined;
  if (field && pattern) {
    try {
      const re = new RegExp(pattern, flags ?? 'i');
      const value = field === 'title' ? task.title : field === 'description' ? task.description : '';
      if (re.test(value)) {
        reasons.push(`${field} matched /${pattern}/`);
      }
    } catch {
      // invalid regex — skip
    }
  }

  if (reasons.length > 0) {
    return {
      matches: true,
      confidence: CONFIDENCE.PATTERN,
      reason: reasons.join('; '),
    };
  }
  return { matches: false, confidence: 0, reason: '' };
}

function evaluateFileTrigger(
  trigger: FileTrigger,
  task: SkillTaskContext,
): { matches: boolean; confidence: number; reason: string } {
  if (!task.files || task.files.length === 0) {
    return { matches: false, confidence: 0, reason: '' };
  }

  const matchedGlobs: string[] = [];
  for (const glob of trigger.globs) {
    const pattern = globToRegex(glob);
    for (const file of task.files) {
      if (pattern.test(file)) {
        matchedGlobs.push(glob);
        break;
      }
    }
  }

  if (matchedGlobs.length > 0) {
    return {
      matches: true,
      confidence: CONFIDENCE.FILE,
      reason: `file match: ${matchedGlobs.join(', ')}`,
    };
  }
  return { matches: false, confidence: 0, reason: '' };
}

/**
 * Convert a simple glob pattern to a regex.
 * Supports * and ** wildcards.
 */
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function evaluateTrigger(
  trigger: SkillTrigger,
  task: SkillTaskContext,
): { matches: boolean; confidence: number; reason: string } {
  switch (trigger.type) {
    case 'task-type':
      return evaluateTaskTypeTrigger(trigger, task);
    case 'label':
      return evaluateLabelTrigger(trigger, task);
    case 'pattern':
      return evaluatePatternTrigger(trigger, task);
    case 'file':
      return evaluateFileTrigger(trigger, task);
    case 'composite':
      return evaluateCompositeTrigger(trigger, task);
    default:
      return { matches: false, confidence: 0, reason: '' };
  }
}

function evaluateCompositeTrigger(
  trigger: CompositeTrigger,
  task: SkillTaskContext,
): { matches: boolean; confidence: number; reason: string } {
  const results = trigger.triggers.map((t) => evaluateTrigger(t, task));

  if (trigger.operator === 'and') {
    const allMatch = results.every((r) => r.matches);
    if (!allMatch) return { matches: false, confidence: 0, reason: '' };
    return {
      matches: true,
      confidence: Math.min(...results.map((r) => r.confidence)),
      reason: results.map((r) => r.reason).join(' AND '),
    };
  }

  // OR
  const matching = results.filter((r) => r.matches);
  if (matching.length === 0) return { matches: false, confidence: 0, reason: '' };
  const best = matching.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
  return {
    matches: true,
    confidence: Math.max(...matching.map((r) => r.confidence)),
    reason: best.reason,
  };
}

// ── Skill Router ─────────────────────────────────────────────────

/**
 * Match a task against all registered skills.
 * Returns matches sorted by confidence (highest first).
 */
export function matchTaskToSkills(
  entries: SkillRegistryEntry[],
  task: SkillTaskContext,
): SkillMatchResult[] {
  const results: SkillMatchResult[] = [];

  for (const entry of entries) {
    // Only match skills that are loaded, active, or deactivated
    if (!['loaded', 'active', 'deactivated'].includes(entry.phase)) continue;

    const triggerResults = entry.manifest.triggers.map((t) => evaluateTrigger(t, task));
    // Multiple triggers use OR semantics — any match activates
    const matching = triggerResults.filter((r) => r.matches);

    if (matching.length > 0) {
      const best = matching.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
      const matchedTriggers = entry.manifest.triggers.filter(
        (_, i) => triggerResults[i].matches,
      );

      results.push({
        skillId: entry.manifest.id,
        matches: true,
        confidence: best.confidence,
        reason: matching.map((m) => m.reason).join('; '),
        matchedTriggers,
      });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
