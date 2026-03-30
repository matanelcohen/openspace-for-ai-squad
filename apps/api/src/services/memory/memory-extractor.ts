/**
 * MemoryExtractor — LLM-based extraction of memories from completed tasks.
 *
 * After a task completes, analyzes the result + progress log to identify
 * reusable memories: decisions made, user preferences, codebase patterns.
 */

import type { ExtractedMemory, MemoryExtractionInput } from '@matanelcohen/openspace-shared';

import type { AIProvider } from '../ai/copilot-provider.js';

// ── Extraction Prompt ────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction system. Your job is to analyze a completed task and extract reusable memories that would help the agent perform better in the future.

Extract ONLY genuinely reusable learnings. Each memory should be a concise, self-contained statement.

Categories:
- "decision": A technical or architectural decision that was made (e.g., "Uses Fastify over Express for the API layer", "Chose SQLite FTS5 for full-text search")
- "preference": A user or team preference that was expressed (e.g., "User prefers TypeScript strict mode", "Team uses pnpm workspaces")
- "pattern": A codebase or workflow pattern that was discovered (e.g., "Services are initialized in app.ts onReady hook", "Tests use vitest with in-memory SQLite")

Rules:
- Return between 0 and 5 memories (only extract what's genuinely useful)
- Each memory content should be 1-2 sentences max
- Don't extract trivial or obvious information
- Don't extract task-specific details that won't generalize
- If nothing worth remembering, return an empty array

Respond with a JSON array of objects, each with "type" and "content" fields.
Example: [{"type": "decision", "content": "Project uses ESM modules with TypeScript bundler resolution"}, {"type": "pattern", "content": "All database services accept a Database instance via constructor injection"}]

Respond ONLY with the JSON array. No markdown, no explanation.`;

// ── MemoryExtractor ─────────────────────────────────────────────

export class MemoryExtractor {
  constructor(private readonly aiProvider: AIProvider) {}

  /**
   * Extract memories from a completed task session.
   * Returns an array of extracted memories (may be empty if nothing noteworthy).
   */
  async extract(input: MemoryExtractionInput): Promise<ExtractedMemory[]> {
    const progressSummary =
      input.progressLog.length > 0
        ? `\n\nProgress log:\n${input.progressLog.slice(-20).join('\n')}`
        : '';

    const userPrompt = [
      `Task: ${input.taskTitle}`,
      `Description: ${input.taskDescription}`,
      `Agent result:\n${input.resultContent.substring(0, 3000)}`,
      progressSummary,
    ].join('\n\n');

    try {
      const result = await this.aiProvider.chatCompletion({
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      return this.parseExtraction(result.content);
    } catch (err) {
      console.warn('[MemoryExtractor] Extraction failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  /** Parse the LLM's JSON response into ExtractedMemory[]. */
  private parseExtraction(raw: string): ExtractedMemory[] {
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned) as unknown;

      if (!Array.isArray(parsed)) return [];

      const validTypes = new Set(['preference', 'pattern', 'decision']);

      return parsed
        .filter(
          (item): item is { type: string; content: string } =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as Record<string, unknown>).type === 'string' &&
            typeof (item as Record<string, unknown>).content === 'string' &&
            validTypes.has((item as Record<string, unknown>).type as string),
        )
        .slice(0, 5)
        .map((item) => ({
          type: item.type as ExtractedMemory['type'],
          content: item.content.substring(0, 500),
        }));
    } catch {
      console.warn('[MemoryExtractor] Failed to parse extraction response');
      return [];
    }
  }
}
