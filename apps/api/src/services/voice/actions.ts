/**
 * Voice Action Execution (P4-6)  Parse voice intents and execute squad operations.
 *
 * Parses voice intents like "create task X", "assign Y to Z", "what's the status",
 * and maps them to existing REST API operations.
 * Returns confirmation text for TTS to speak back.
 */

//  Types ─

export type ActionType =
  | 'create_task'
  | 'assign_task'
  | 'update_status'
  | 'prioritize'
  | 'query_status'
  | 'query_decisions'
  | 'unknown';

export interface ParsedIntent {
  /** What action was detected. */
  action: ActionType;
  /** Confidence score 0-1. */
  confidence: number;
  /** Extracted parameters. */
  params: Record<string, string>;
  /** Original transcript. */
  transcript: string;
}

export interface ActionResult {
  /** Whether the action succeeded. */
  success: boolean;
  /** Human-readable confirmation text (for TTS). */
  message: string;
  /** The parsed intent that triggered this action. */
  intent: ParsedIntent;
  /** Any data returned from the operation. */
  data?: Record<string, unknown>;
}

/** Abstraction for executing squad API operations. Facilitates testing. */
export interface ActionExecutor {
  createTask(title: string, assignee?: string, priority?: string): Promise<{ id: string; title: string }>;
  assignTask(taskId: string, assignee: string): Promise<{ id: string; assignee: string }>;
  updateTaskStatus(taskId: string, status: string): Promise<{ id: string; status: string }>;
  prioritizeTask(taskId: string, priority: string): Promise<{ id: string; priority: string }>;
  queryStatus(agentId?: string): Promise<Array<{ id: string; title: string; status: string; assignee: string }>>;
  queryDecisions(query?: string): Promise<Array<{ title: string; by: string; summary: string }>>;
}

/** LLM-based intent parser for advanced understanding. */
export interface LLMIntentParser {
  parse(transcript: string, context: string[]): Promise<ParsedIntent>;
}

//  Intent patterns 

interface IntentPattern {
  action: ActionType;
  patterns: RegExp[];
  extractParams: (match: RegExpMatchArray, transcript: string) => Record<string, string>;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    action: 'create_task',
    patterns: [
      /create\s+(?:a\s+)?task\s+(?:for\s+|called\s+|named\s+)?(?:["']?)(.+?)(?:["']?)(?:\s+and\s+assign\s+(?:it\s+)?to\s+(\w+))?$/i,
      /(?:add|make|new)\s+(?:a\s+)?task\s*:?\s*(?:["']?)(.+?)(?:["']?)$/i,
      /(\w+),?\s+create\s+(?:a(?:n)?\s+)?(.+?)(?:\s+endpoint|\s+page|\s+component|\s+feature|\s+task)?$/i,
    ],
    extractParams: (match, transcript) => {
      const params: Record<string, string> = {};
      // Check if the first capture is an agent name
      if (match[2] && /^(leela|bender|fry|zoidberg)$/i.test(match[1])) {
        params.assignee = match[1].toLowerCase();
        params.title = match[2].trim();
      } else {
        params.title = (match[1] ?? '').trim();
        if (match[2]) params.assignee = match[2].toLowerCase();
      }
      return params;
    },
  },
  {
    action: 'assign_task',
    patterns: [
      /assign\s+(?:the\s+)?(?:task\s+)?(?:["']?)(.+?)(?:["']?)\s+to\s+(\w+)/i,
      /(\w+),?\s+(?:take|handle|work\s+on)\s+(?:the\s+)?(.+)/i,
    ],
    extractParams: (match) => ({
      title: (match[1] ?? '').trim(),
      assignee: (match[2] ?? '').toLowerCase(),
    }),
  },
  {
    action: 'update_status',
    patterns: [
      /(?:mark|set|move)\s+(?:the\s+)?(?:task\s+)?(?:["']?)(.+?)(?:["']?)\s+(?:as|to)\s+(done|complete|completed|in.?progress|blocked|backlog|in.?review)/i,
    ],
    extractParams: (match) => ({
      title: (match[1] ?? '').trim(),
      status: (match[2] ?? '').toLowerCase().replace(/\s+/g, '-'),
    }),
  },
  {
    action: 'prioritize',
    patterns: [
      /prioritize\s+(?:the\s+)?(?:["']?)(.+?)(?:["']?)\s+(?:above|over|before)\s+(?:["']?)(.+?)(?:["']?)$/i,
      /(?:set|change|update)\s+(?:the\s+)?priority\s+(?:of\s+)?(?:["']?)(.+?)(?:["']?)\s+to\s+(P[0-3]|critical|high|medium|low)/i,
    ],
    extractParams: (match) => ({
      title: (match[1] ?? '').trim(),
      target: (match[2] ?? '').trim(),
    }),
  },
  {
    action: 'query_status',
    patterns: [
      /what(?:'s|\s+is)\s+the\s+status/i,
      /status\s+(?:update|report|check)/i,
      /how(?:'s|\s+is)\s+(?:everything|the\s+project|the\s+team|things)/i,
      /give\s+(?:me\s+)?(?:a\s+)?(?:status|update|overview)/i,
    ],
    extractParams: (_, transcript) => {
      const agentMatch = transcript.match(/\b(leela|bender|fry|zoidberg)\b/i);
      return agentMatch ? { agentId: agentMatch[1].toLowerCase() } : {};
    },
  },
  {
    action: 'query_decisions',
    patterns: [
      /what\s+decisions?\s+(?:were|have\s+been)\s+made/i,
      /(?:show|list|read)\s+(?:me\s+)?(?:the\s+)?decisions?/i,
      /(?:any\s+)?(?:new\s+)?decisions?\s+(?:today|recently|this\s+week)/i,
    ],
    extractParams: (_, transcript) => {
      const queryMatch = transcript.match(/(?:about|regarding|on)\s+(.+)/i);
      return queryMatch ? { query: queryMatch[1].trim() } : {};
    },
  },
];

//  Voice Action Service ─

export class VoiceActionService {
  private readonly executor: ActionExecutor;
  private readonly llmParser: LLMIntentParser | null;

  constructor(executor: ActionExecutor, llmParser?: LLMIntentParser) {
    this.executor = executor;
    this.llmParser = llmParser ?? null;
  }

  /**
   * Parse a transcript and detect the user's intent.
   * Uses pattern matching first, then LLM fallback if available.
   */
  async parseIntent(transcript: string, context: string[] = []): Promise<ParsedIntent> {
    const lower = transcript.toLowerCase().trim();
    if (!lower) {
      return { action: 'unknown', confidence: 0, params: {}, transcript };
    }

    // Pattern-based intent detection
    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = transcript.match(regex);
        if (match) {
          return {
            action: pattern.action,
            confidence: 0.85,
            params: pattern.extractParams(match, transcript),
            transcript,
          };
        }
      }
    }

    // LLM fallback
    if (this.llmParser) {
      try {
        return await this.llmParser.parse(transcript, context);
      } catch {
        // Fall through to unknown
      }
    }

    return { action: 'unknown', confidence: 0, params: {}, transcript };
  }

  /**
   * Execute an action based on a parsed intent.
   * Returns a confirmation message suitable for TTS.
   */
  async executeAction(intent: ParsedIntent): Promise<ActionResult> {
    try {
      switch (intent.action) {
        case 'create_task':
          return await this.handleCreateTask(intent);
        case 'assign_task':
          return await this.handleAssignTask(intent);
        case 'update_status':
          return await this.handleUpdateStatus(intent);
        case 'prioritize':
          return await this.handlePrioritize(intent);
        case 'query_status':
          return await this.handleQueryStatus(intent);
        case 'query_decisions':
          return await this.handleQueryDecisions(intent);
        default:
          return {
            success: false,
            message: "I'm not sure what action to take. Could you rephrase that?",
            intent,
          };
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: +""+Sorry, I ran into an error: +""+,
        intent,
      };
    }
  }

  /**
   * Parse and execute in one step. Convenience method.
   */
  async processVoiceCommand(
    transcript: string,
    context: string[] = [],
  ): Promise<ActionResult> {
    const intent = await this.parseIntent(transcript, context);

    if (intent.action === 'unknown') {
      return {
        success: false,
        message: "I didn't detect a specific action in that. Could you be more specific?",
        intent,
      };
    }

    return this.executeAction(intent);
  }

  //  Action handlers ─

  private async handleCreateTask(intent: ParsedIntent): Promise<ActionResult> {
    const title = intent.params.title;
    if (!title) {
      return {
        success: false,
        message: "I couldn't determine the task name. Could you say it again?",
        intent,
      };
    }

    const result = await this.executor.createTask(
      title,
      intent.params.assignee,
      intent.params.priority,
    );

    const assigneeMsg = intent.params.assignee
      ? +""+ and assigned it to +""+
      : '';

    return {
      success: true,
      message: +""+Done  I've created the task "".+""+,
      intent,
      data: result as unknown as Record<string, unknown>,
    };
  }

  private async handleAssignTask(intent: ParsedIntent): Promise<ActionResult> {
    const { title, assignee } = intent.params;
    if (!title || !assignee) {
      return {
        success: false,
        message: "I need both a task name and who to assign it to.",
        intent,
      };
    }

    const result = await this.executor.assignTask(title, assignee);
    return {
      success: true,
      message: +""+Done  I've assigned "" to .+""+,
      intent,
      data: result as unknown as Record<string, unknown>,
    };
  }

  private async handleUpdateStatus(intent: ParsedIntent): Promise<ActionResult> {
    const { title, status } = intent.params;
    if (!title || !status) {
      return {
        success: false,
        message: "I need both a task name and the new status.",
        intent,
      };
    }

    // Normalize status
    const normalizedStatus = this.normalizeStatus(status);
    const result = await this.executor.updateTaskStatus(title, normalizedStatus);
    return {
      success: true,
      message: +""+Done  "" is now marked as .+""+,
      intent,
      data: result as unknown as Record<string, unknown>,
    };
  }

  private async handlePrioritize(intent: ParsedIntent): Promise<ActionResult> {
    const { title, target } = intent.params;
    if (!title) {
      return {
        success: false,
        message: "I need to know which task to prioritize.",
        intent,
      };
    }

    const result = await this.executor.prioritizeTask(title, target ?? 'P1');
    return {
      success: true,
      message: +""+Done  I've updated the priority of "".+""+,
      intent,
      data: result as unknown as Record<string, unknown>,
    };
  }

  private async handleQueryStatus(intent: ParsedIntent): Promise<ActionResult> {
    const tasks = await this.executor.queryStatus(intent.params.agentId);

    if (tasks.length === 0) {
      return {
        success: true,
        message: 'No active tasks found right now.',
        intent,
      };
    }

    const summary = tasks
      .slice(0, 5)
      .map((t) => +""+${t.title} is +""+ + (t.assignee ? +""+, assigned to +""+ : ''))
      .join('. ');

    return {
      success: true,
      message: +""+Here's the current status: .+""+,
      intent,
      data: { tasks } as unknown as Record<string, unknown>,
    };
  }

  private async handleQueryDecisions(intent: ParsedIntent): Promise<ActionResult> {
    const decisions = await this.executor.queryDecisions(intent.params.query);

    if (decisions.length === 0) {
      return {
        success: true,
        message: 'No decisions found matching that criteria.',
        intent,
      };
    }

    const summary = decisions
      .slice(0, 3)
      .map((d) => +""+${d.title}, decided by +""+)
      .join('. ');

    return {
      success: true,
      message: +""+Here are the recent decisions: .+""+,
      intent,
      data: { decisions } as unknown as Record<string, unknown>,
    };
  }

  private normalizeStatus(raw: string): string {
    const map: Record<string, string> = {
      done: 'done',
      complete: 'done',
      completed: 'done',
      'in-progress': 'in-progress',
      inprogress: 'in-progress',
      'in progress': 'in-progress',
      blocked: 'blocked',
      backlog: 'backlog',
      'in-review': 'in-review',
      inreview: 'in-review',
      'in review': 'in-review',
    };
    return map[raw.toLowerCase()] ?? raw;
  }
}
