/**
 * Multi-Agent Voice Router (P4-3)  Routes user speech to appropriate agents.
 *
 * When a user speaks, the Coordinator decides which agent(s) should respond
 * based on: agent name mentioned, topic domain, or "team" for broadcast.
 * Supports multiple agents responding in sequence.
 */

import { EventEmitter } from 'node:events';

//  Types 

export interface AgentRoutingProfile {
  /** Agent ID (e.g., 'leela', 'bender'). */
  id: string;
  /** Agent name for mention detection. */
  name: string;
  /** Agent role/domain. */
  role: string;
  /** Keywords that route to this agent. */
  keywords: string[];
}

export interface RoutingDecision {
  /** The agents selected to respond, in order. */
  agents: string[];
  /** Why these agents were selected. */
  reason: string;
  /** Whether this is a broadcast (all agents). */
  isBroadcast: boolean;
  /** The original transcribed text. */
  transcript: string;
}

export interface RouterConfig {
  /** Known agents with routing profiles. */
  agents?: AgentRoutingProfile[];
  /** Optional LLM-based routing function (for advanced intent classification). */
  llmRouter?: LLMRouter;
}

/** LLM-based routing provider for advanced classification. */
export interface LLMRouter {
  route(
    transcript: string,
    agents: AgentRoutingProfile[],
    context: string[],
  ): Promise<{ agentIds: string[]; reason: string }>;
}

//  Default Agent Profiles 

export const DEFAULT_AGENT_PROFILES: AgentRoutingProfile[] = [
  {
    id: 'leela',
    name: 'Leela',
    role: 'Lead',
    keywords: ['status', 'plan', 'priority', 'assign', 'team', 'overview', 'standup', 'lead', 'coordinate', 'schedule'],
  },
  {
    id: 'bender',
    name: 'Bender',
    role: 'Backend',
    keywords: ['api', 'backend', 'server', 'database', 'endpoint', 'auth', 'migration', 'deploy', 'schema', 'sql'],
  },
  {
    id: 'fry',
    name: 'Fry',
    role: 'Frontend',
    keywords: ['ui', 'frontend', 'component', 'page', 'css', 'style', 'layout', 'button', 'form', 'react', 'design'],
  },
  {
    id: 'zoidberg',
    name: 'Zoidberg',
    role: 'QA',
    keywords: ['test', 'bug', 'quality', 'coverage', 'e2e', 'regression', 'fix', 'broken', 'failing', 'debug'],
  },
];

//  Broadcast keywords ─

const BROADCAST_KEYWORDS = [
  'everyone', 'team', 'squad', 'all', 'morning', 'standup',
  'hey squad', 'hey team', 'good morning',
];

//  Voice Router 

export class VoiceRouter extends EventEmitter {
  private readonly agents: AgentRoutingProfile[];
  private readonly llmRouter: LLMRouter | null;

  constructor(config: RouterConfig = {}) {
    super();
    this.agents = config.agents ?? DEFAULT_AGENT_PROFILES;
    this.llmRouter = config.llmRouter ?? null;
  }

  /**
   * Route a transcribed utterance to the appropriate agent(s).
   *
   * Priority:
   * 1. Direct agent mention ("Bender, create an endpoint")
   * 2. Broadcast keywords ("Hey team, what's the status?")
   * 3. Keyword-based domain matching
   * 4. LLM router (if available)
   * 5. Default to Leela (coordinator/lead)
   */
  async route(transcript: string, context: string[] = []): Promise<RoutingDecision> {
    const lower = transcript.toLowerCase().trim();

    if (!lower) {
      return {
        agents: ['leela'],
        reason: 'Empty transcript, defaulting to lead',
        isBroadcast: false,
        transcript,
      };
    }

    // 1. Check for direct agent mention
    const mentioned = this.findMentionedAgents(lower);
    if (mentioned.length > 0) {
      return {
        agents: mentioned,
        reason: `Direct mention: ${mentioned.join(', ')}`,
        isBroadcast: false,
        transcript,
      };
    }

    // 2. Check for broadcast keywords
    if (this.isBroadcast(lower)) {
      return {
        agents: this.agents.map((a) => a.id),
        reason: 'Broadcast addressed to the whole team',
        isBroadcast: true,
        transcript,
      };
    }

    // 3. Keyword-based domain matching
    const keywordMatches = this.matchByKeywords(lower);
    if (keywordMatches.length > 0) {
      return {
        agents: keywordMatches,
        reason: `Keyword match: domain expertise (${keywordMatches.join(', ')})`,
        isBroadcast: false,
        transcript,
      };
    }

    // 4. LLM router (if available)
    if (this.llmRouter) {
      try {
        const llmResult = await this.llmRouter.route(transcript, this.agents, context);
        if (llmResult.agentIds.length > 0) {
          return {
            agents: llmResult.agentIds,
            reason: llmResult.reason,
            isBroadcast: false,
            transcript,
          };
        }
      } catch {
        // Fall through to default
      }
    }

    // 5. Default to Leela
    return {
      agents: ['leela'],
      reason: 'No specific agent matched, defaulting to lead',
      isBroadcast: false,
      transcript,
    };
  }

  /** Find agents explicitly mentioned by name in the transcript. */
  private findMentionedAgents(lower: string): string[] {
    const mentioned: string[] = [];
    for (const agent of this.agents) {
      const namePattern = new RegExp(`\\b${agent.name.toLowerCase()}\\b`);
      if (namePattern.test(lower)) {
        mentioned.push(agent.id);
      }
    }
    return mentioned;
  }

  /** Check if the transcript is addressed to the whole team. */
  private isBroadcast(lower: string): boolean {
    return BROADCAST_KEYWORDS.some((kw) => lower.includes(kw));
  }

  /** Match agents by keyword overlap with the transcript. */
  private matchByKeywords(lower: string): string[] {
    const scores: Array<{ id: string; score: number }> = [];

    for (const agent of this.agents) {
      let score = 0;
      for (const kw of agent.keywords) {
        if (lower.includes(kw)) {
          score++;
        }
      }
      if (score > 0) {
        scores.push({ id: agent.id, score });
      }
    }

    // Sort by score descending, return agents with top scores
    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0) return [];

    // Return the top-scoring agent(s). If top two have same score, include both.
    const topScore = scores[0].score;
    return scores.filter((s) => s.score === topScore).map((s) => s.id);
  }

  /** Get all registered agent profiles. */
  getAgentProfiles(): AgentRoutingProfile[] {
    return [...this.agents];
  }

  /** Get a specific agent profile. */
  getAgentProfile(agentId: string): AgentRoutingProfile | undefined {
    return this.agents.find((a) => a.id === agentId);
  }
}
