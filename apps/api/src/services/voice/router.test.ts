/**
 * Tests for VoiceRouter (P4-3).
 *
 * Covers direct agent mention routing, broadcast detection,
 * keyword-based domain matching, LLM fallback, and defaults.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LLMRouter } from './router.js';
import { DEFAULT_AGENT_PROFILES, VoiceRouter } from './router.js';

describe('VoiceRouter', () => {
  let router: VoiceRouter;

  beforeEach(() => {
    router = new VoiceRouter();
  });

  // ── Direct agent mention ───────────────────────────────────────

  describe('direct agent mention', () => {
    it('routes to Bender when name is mentioned', async () => {
      const result = await router.route('Bender, create an auth endpoint');
      expect(result.agents).toEqual(['bender']);
      expect(result.reason).toContain('Direct mention');
      expect(result.isBroadcast).toBe(false);
    });

    it('routes to Leela when name is mentioned', async () => {
      const result = await router.route('Leela, what is the priority for today?');
      expect(result.agents).toContain('leela');
    });

    it('routes to Fry when name is mentioned', async () => {
      const result = await router.route('Fry, the login page needs work');
      expect(result.agents).toContain('fry');
    });

    it('routes to Zoidberg when name is mentioned', async () => {
      const result = await router.route('Zoidberg, run the tests please');
      expect(result.agents).toContain('zoidberg');
    });

    it('routes to multiple agents when multiple are mentioned', async () => {
      const result = await router.route('Bender and Fry, coordinate on this');
      expect(result.agents).toContain('bender');
      expect(result.agents).toContain('fry');
    });

    it('is case-insensitive for agent names', async () => {
      const result = await router.route('bender, do something');
      expect(result.agents).toEqual(['bender']);
    });
  });

  // ── Broadcast routing ──────────────────────────────────────────

  describe('broadcast routing', () => {
    it('broadcasts when "team" is mentioned', async () => {
      const result = await router.route('Hey team, what is going on?');
      expect(result.isBroadcast).toBe(true);
      expect(result.agents).toHaveLength(DEFAULT_AGENT_PROFILES.length);
    });

    it('broadcasts when "everyone" is mentioned', async () => {
      const result = await router.route('Good morning everyone');
      expect(result.isBroadcast).toBe(true);
    });

    it('broadcasts when "squad" is mentioned', async () => {
      const result = await router.route('Hey squad, status update please');
      expect(result.isBroadcast).toBe(true);
    });

    it('broadcasts on standup-like phrases', async () => {
      const result = await router.route('Morning standup, who wants to go first?');
      expect(result.isBroadcast).toBe(true);
    });
  });

  // ── Keyword-based routing ──────────────────────────────────────

  describe('keyword-based routing', () => {
    it('routes API questions to Bender', async () => {
      const result = await router.route('The API endpoint is returning errors');
      expect(result.agents).toContain('bender');
    });

    it('routes UI questions to Fry', async () => {
      const result = await router.route('The button component needs a new style');
      expect(result.agents).toContain('fry');
    });

    it('routes test questions to Zoidberg', async () => {
      const result = await router.route('We need better test coverage for that module');
      expect(result.agents).toContain('zoidberg');
    });

    it('routes planning questions to Leela', async () => {
      const result = await router.route('We need to reprioritize the plan');
      expect(result.agents).toContain('leela');
    });

    it('routes database questions to Bender', async () => {
      const result = await router.route('The database migration needs updating');
      expect(result.agents).toContain('bender');
    });
  });

  // ── LLM router fallback ────────────────────────────────────────

  describe('LLM router fallback', () => {
    it('uses LLM router when pattern matching fails', async () => {
      const llmRouter: LLMRouter = {
        route: vi.fn().mockResolvedValue({
          agentIds: ['bender'],
          reason: 'LLM determined backend topic',
        }),
      };
      const routerWithLLM = new VoiceRouter({ llmRouter });
      const result = await routerWithLLM.route('Something very abstract and unusual');
      expect(result.agents).toEqual(['bender']);
      expect(result.reason).toContain('LLM determined');
    });

    it('falls through to default when LLM router errors', async () => {
      const llmRouter: LLMRouter = {
        route: vi.fn().mockRejectedValue(new Error('LLM failure')),
      };
      const routerWithLLM = new VoiceRouter({ llmRouter });
      const result = await routerWithLLM.route('Something very abstract and unusual');
      expect(result.agents).toEqual(['leela']);
    });

    it('falls through to default when LLM returns empty agents', async () => {
      const llmRouter: LLMRouter = {
        route: vi.fn().mockResolvedValue({ agentIds: [], reason: 'Unsure' }),
      };
      const routerWithLLM = new VoiceRouter({ llmRouter });
      const result = await routerWithLLM.route('Something very abstract');
      expect(result.agents).toEqual(['leela']);
    });
  });

  // ── Default behavior ───────────────────────────────────────────

  describe('defaults', () => {
    it('defaults to Leela when no match', async () => {
      const result = await router.route('I have a random thought about cats');
      expect(result.agents).toEqual(['leela']);
      expect(result.reason).toContain('defaulting to lead');
    });

    it('defaults to Leela for empty transcript', async () => {
      const result = await router.route('');
      expect(result.agents).toEqual(['leela']);
    });

    it('preserves the original transcript in the result', async () => {
      const result = await router.route('Hello there');
      expect(result.transcript).toBe('Hello there');
    });
  });

  // ── Agent profiles ─────────────────────────────────────────────

  describe('agent profiles', () => {
    it('returns all agent profiles', () => {
      expect(router.getAgentProfiles()).toHaveLength(DEFAULT_AGENT_PROFILES.length);
    });

    it('gets a specific agent profile', () => {
      const profile = router.getAgentProfile('bender');
      expect(profile).toBeTruthy();
      expect(profile!.role).toBe('Backend');
    });

    it('returns undefined for unknown agent', () => {
      expect(router.getAgentProfile('unknown')).toBeUndefined();
    });

    it('supports custom agent profiles', async () => {
      const customRouter = new VoiceRouter({
        agents: [{ id: 'custom', name: 'Custom', role: 'DevOps', keywords: ['deploy', 'infra'] }],
      });
      const result = await customRouter.route('Custom, deploy to staging');
      expect(result.agents).toEqual(['custom']);
    });
  });
});
