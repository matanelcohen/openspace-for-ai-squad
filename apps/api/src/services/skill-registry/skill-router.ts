/**
 * Skill Router — matches incoming tasks to skills based on trigger rules.
 *
 * Confidence scoring (configurable per-skill, defaults shown):
 *   task-type exact match → 0.9
 *   label full match      → 0.8
 *   pattern regex match   → 0.7
 *   file glob match       → 0.6
 *   composite AND         → strategy (default: min)
 *   composite OR          → strategy (default: max)
 *
 * Enhanced features:
 *   - Per-skill configurable confidence weights
 *   - Weighted composite trigger strategies (min/max/avg/weighted-avg)
 *   - Fuzzy pattern matching (Levenshtein distance)
 *   - Skill priority tiebreaking
 *   - Learned relevance adjustments via RelevanceStore
 */

import type {
  CompositeTrigger,
  FileTrigger,
  LabelTrigger,
  PatternTrigger,
  SkillConfidenceWeights,
  SkillMatchResult,
  SkillRegistryEntry,
  SkillTaskContext,
  SkillTrigger,
  TaskTypeTrigger,
} from '@openspace/shared';

// ── Default Confidence Constants ─────────────────────────────────

const DEFAULT_CONFIDENCE: Required<SkillConfidenceWeights> = {
  'task-type': 0.9,
  label: 0.8,
  pattern: 0.7,
  file: 0.6,
};

// ── Relevance Store ──────────────────────────────────────────────

/**
 * Stores learned relevance adjustments per skill.
 * These adjustments are applied as additive boosts to confidence scores,
 * enabling the system to learn from past match quality.
 */
export interface RelevanceStore {
  /** Get the relevance adjustment for a skill (default: 0). */
  getAdjustment(skillId: string): number;
  /** Record a relevance adjustment for a skill. */
  setAdjustment(skillId: string, adjustment: number): void;
  /** Incrementally update a skill's adjustment (e.g. +0.05 after a successful match). */
  recordFeedback(skillId: string, delta: number): void;
  /** Get all stored adjustments. */
  getAll(): Map<string, number>;
}

/**
 * In-memory relevance store with clamping.
 * Adjustments are clamped to [-0.3, +0.3] to prevent runaway drift.
 */
export class InMemoryRelevanceStore implements RelevanceStore {
  private adjustments = new Map<string, number>();
  private readonly minAdj: number;
  private readonly maxAdj: number;

  constructor(bounds: { min?: number; max?: number } = {}) {
    this.minAdj = bounds.min ?? -0.3;
    this.maxAdj = bounds.max ?? 0.3;
  }

  getAdjustment(skillId: string): number {
    return this.adjustments.get(skillId) ?? 0;
  }

  setAdjustment(skillId: string, adjustment: number): void {
    this.adjustments.set(skillId, Math.max(this.minAdj, Math.min(this.maxAdj, adjustment)));
  }

  recordFeedback(skillId: string, delta: number): void {
    const current = this.getAdjustment(skillId);
    this.setAdjustment(skillId, current + delta);
  }

  getAll(): Map<string, number> {
    return new Map(this.adjustments);
  }
}

// ── Fuzzy Matching ───────────────────────────────────────────────

/**
 * Compute Levenshtein edit distance between two strings.
 * Uses the iterative matrix approach with O(min(a,b)) space.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) [a, b] = [b, a];

  const aLen = a.length;
  const bLen = b.length;
  let prev: number[] = Array.from({ length: aLen + 1 }, (_, i) => i);
  let curr: number[] = new Array<number>(aLen + 1);

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(curr[i - 1]! + 1, prev[i]! + 1, prev[i - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[aLen]!;
}

/**
 * Check if a term fuzzy-matches any token in the text.
 * Returns the best similarity score (0–1) or 0 if no match meets the threshold.
 */
function fuzzyMatchScore(
  term: string,
  text: string,
  maxDistance: number,
  minSimilarity: number,
): number {
  const lowerTerm = term.toLowerCase();
  const tokens = text.toLowerCase().split(/\s+/);
  let bestScore = 0;

  for (const token of tokens) {
    const distance = levenshteinDistance(lowerTerm, token);
    if (distance > maxDistance) continue;

    const maxLen = Math.max(lowerTerm.length, token.length);
    const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;

    if (similarity >= minSimilarity && similarity > bestScore) {
      bestScore = similarity;
    }
  }

  return bestScore;
}

// ── Confidence Resolution ────────────────────────────────────────

function resolveConfidence(
  triggerType: keyof SkillConfidenceWeights,
  overrides?: SkillConfidenceWeights,
): number {
  return overrides?.[triggerType] ?? DEFAULT_CONFIDENCE[triggerType];
}

// ── Trigger Evaluation ───────────────────────────────────────────

function evaluateTaskTypeTrigger(
  trigger: TaskTypeTrigger,
  task: SkillTaskContext,
  weights?: SkillConfidenceWeights,
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
      confidence: resolveConfidence('task-type', weights),
      reason: `task-type match: ${matchedTypes.join(', ')}`,
    };
  }
  return { matches: false, confidence: 0, reason: '' };
}

function evaluateLabelTrigger(
  trigger: LabelTrigger,
  task: SkillTaskContext,
  weights?: SkillConfidenceWeights,
): { matches: boolean; confidence: number; reason: string } {
  const taskLabels = new Set(task.labels.map((l) => l.toLowerCase()));
  const allPresent = trigger.labels.every((l) => taskLabels.has(l.toLowerCase()));

  if (allPresent) {
    return {
      matches: true,
      confidence: resolveConfidence('label', weights),
      reason: `label match: ${trigger.labels.join(', ')}`,
    };
  }
  return { matches: false, confidence: 0, reason: '' };
}

function evaluatePatternTrigger(
  trigger: PatternTrigger,
  task: SkillTaskContext,
  weights?: SkillConfidenceWeights,
): { matches: boolean; confidence: number; reason: string } {
  const reasons: string[] = [];
  const baseConfidence = resolveConfidence('pattern', weights);

  // Regex matching
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

  // Fuzzy matching
  let fuzzyConfidence = 0;
  if (trigger.fuzzy) {
    const { terms, maxDistance = 2, minSimilarity = 0.7 } = trigger.fuzzy;
    const fuzzyReasons: string[] = [];

    for (const term of terms) {
      const titleScore = fuzzyMatchScore(term, task.title, maxDistance, minSimilarity);
      const descScore = fuzzyMatchScore(term, task.description, maxDistance, minSimilarity);
      const bestScore = Math.max(titleScore, descScore);

      if (bestScore > 0) {
        fuzzyReasons.push(`fuzzy "${term}" (similarity: ${bestScore.toFixed(2)})`);
        fuzzyConfidence = Math.max(fuzzyConfidence, bestScore * baseConfidence);
      }
    }

    if (fuzzyReasons.length > 0) {
      reasons.push(...fuzzyReasons);
    }
  }

  if (reasons.length > 0) {
    // Use the higher of regex confidence or fuzzy-scaled confidence
    const finalConfidence = Math.max(baseConfidence, fuzzyConfidence) || baseConfidence;
    return {
      matches: true,
      // If only fuzzy matched (no regex), use the fuzzy confidence; otherwise use base
      confidence: fuzzyConfidence > 0 && reasons.every((r) => r.startsWith('fuzzy'))
        ? fuzzyConfidence
        : finalConfidence,
      reason: reasons.join('; '),
    };
  }
  return { matches: false, confidence: 0, reason: '' };
}

function evaluateFileTrigger(
  trigger: FileTrigger,
  task: SkillTaskContext,
  weights?: SkillConfidenceWeights,
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
      confidence: resolveConfidence('file', weights),
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
  weights?: SkillConfidenceWeights,
): { matches: boolean; confidence: number; reason: string } {
  switch (trigger.type) {
    case 'task-type':
      return evaluateTaskTypeTrigger(trigger, task, weights);
    case 'label':
      return evaluateLabelTrigger(trigger, task, weights);
    case 'pattern':
      return evaluatePatternTrigger(trigger, task, weights);
    case 'file':
      return evaluateFileTrigger(trigger, task, weights);
    case 'composite':
      return evaluateCompositeTrigger(trigger, task, weights);
    default:
      return { matches: false, confidence: 0, reason: '' };
  }
}

/**
 * Aggregate confidence scores using the specified strategy.
 */
function aggregateConfidence(
  scores: number[],
  strategy: 'min' | 'max' | 'avg' | 'weighted-avg',
  weights?: number[],
): number {
  if (scores.length === 0) return 0;

  switch (strategy) {
    case 'min':
      return Math.min(...scores);
    case 'max':
      return Math.max(...scores);
    case 'avg':
      return scores.reduce((sum, s) => sum + s, 0) / scores.length;
    case 'weighted-avg': {
      if (!weights || weights.length !== scores.length) {
        // Fallback to plain avg if weights are missing/mismatched
        return scores.reduce((sum, s) => sum + s, 0) / scores.length;
      }
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      if (totalWeight === 0) return 0;
      return scores.reduce((sum, s, i) => sum + s * weights[i]!, 0) / totalWeight;
    }
    default:
      return Math.min(...scores);
  }
}

function evaluateCompositeTrigger(
  trigger: CompositeTrigger,
  task: SkillTaskContext,
  weights?: SkillConfidenceWeights,
): { matches: boolean; confidence: number; reason: string } {
  const results = trigger.triggers.map((t) => evaluateTrigger(t, task, weights));

  if (trigger.operator === 'and') {
    const allMatch = results.every((r) => r.matches);
    if (!allMatch) return { matches: false, confidence: 0, reason: '' };

    const scores = results.map((r) => r.confidence);
    const strategy = trigger.strategy ?? 'min';
    return {
      matches: true,
      confidence: aggregateConfidence(scores, strategy, trigger.weights),
      reason: results.map((r) => r.reason).join(' AND '),
    };
  }

  // OR
  const matching = results.filter((r) => r.matches);
  if (matching.length === 0) return { matches: false, confidence: 0, reason: '' };

  const strategy = trigger.strategy ?? 'max';
  if (strategy === 'max') {
    const best = matching.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
    return {
      matches: true,
      confidence: Math.max(...matching.map((r) => r.confidence)),
      reason: best.reason,
    };
  }

  // For non-default OR strategies, use all matching scores
  const scores = matching.map((r) => r.confidence);
  // Filter weights to only include matching triggers
  const matchingWeights = trigger.weights
    ? results.map((r, i) => (r.matches ? trigger.weights![i] : 0)).filter((_, i) => results[i].matches)
    : undefined;

  return {
    matches: true,
    confidence: aggregateConfidence(scores, strategy, matchingWeights),
    reason: matching.map((r) => r.reason).join(' OR '),
  };
}

// ── Skill Router ─────────────────────────────────────────────────

/** Options for configuring the skill router. */
export interface SkillRouterOptions {
  /** Optional relevance store for learned adjustments. */
  relevanceStore?: RelevanceStore;
  /** Override global default confidence weights. */
  defaultWeights?: SkillConfidenceWeights;
}

/**
 * Match a task against all registered skills.
 * Returns matches sorted by confidence (highest first), with priority tiebreaking.
 */
export function matchTaskToSkills(
  entries: SkillRegistryEntry[],
  task: SkillTaskContext,
  options?: SkillRouterOptions,
): SkillMatchResult[] {
  const results: SkillMatchResult[] = [];
  const relevanceStore = options?.relevanceStore;

  // Merge global overrides with per-skill defaults
  const globalWeights = options?.defaultWeights;

  for (const entry of entries) {
    // Only match skills that are loaded, active, or deactivated
    if (!['loaded', 'active', 'deactivated'].includes(entry.phase)) continue;

    // Build effective weights: global overrides < per-skill overrides
    const effectiveWeights: SkillConfidenceWeights = {
      ...globalWeights,
      ...entry.manifest.confidenceWeights,
    };

    const triggerResults = entry.manifest.triggers.map((t) =>
      evaluateTrigger(t, task, effectiveWeights),
    );
    // Multiple triggers use OR semantics — any match activates
    const matching = triggerResults.filter((r) => r.matches);

    if (matching.length > 0) {
      const best = matching.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
      const matchedTriggers = entry.manifest.triggers.filter(
        (_, i) => triggerResults[i].matches,
      );

      const rawConfidence = best.confidence;
      let finalConfidence = rawConfidence;
      let relevanceAdjustment = 0;

      // Apply learned relevance adjustment
      if (relevanceStore) {
        relevanceAdjustment = relevanceStore.getAdjustment(entry.manifest.id);
        finalConfidence = Math.max(0, Math.min(1, rawConfidence + relevanceAdjustment));
      }

      results.push({
        skillId: entry.manifest.id,
        matches: true,
        confidence: finalConfidence,
        reason: matching.map((m) => m.reason).join('; '),
        matchedTriggers,
        priority: entry.manifest.priority ?? 0,
        ...(relevanceAdjustment !== 0
          ? { relevanceAdjustment, rawConfidence }
          : {}),
      });
    }
  }

  // Sort by confidence descending, then by priority descending for tiebreaking
  results.sort((a, b) => {
    const confDiff = b.confidence - a.confidence;
    if (Math.abs(confDiff) > 1e-9) return confDiff;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });

  return results;
}
