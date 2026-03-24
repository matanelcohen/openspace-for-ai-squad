/**
 * Task Breakdown Service — uses copilot-sdk to analyze a backlog task
 * and generate sub-tasks with appropriate agent assignments.
 *
 * Triggered automatically when a new backlog task is created.
 * Sub-tasks are created with status 'pending-approval'.
 */

import type { Task, TaskPriority } from '@openspace/shared';

import type { AIProvider } from '../ai/copilot-provider.js';

export interface SubTaskSuggestion {
  title: string;
  description: string;
  assignee: string;
  priority: TaskPriority;
  labels: string[];
}

interface BreakdownResult {
  parentTaskId: string;
  subtasks: SubTaskSuggestion[];
}

const AGENT_EXPERTISE: Record<string, string> = {
  leela: 'architecture, scope decisions, code review, project management, technical direction',
  fry: 'frontend, UI components, React, Next.js, CSS, Tailwind, user experience, design',
  bender: 'backend, API, database, WebSocket, server, infrastructure, DevOps, integration',
  zoidberg: 'testing, QA, test coverage, E2E tests, unit tests, integration tests, quality',
};

export async function breakdownTask(task: Task, aiProvider: AIProvider): Promise<BreakdownResult> {
  const agentList = Object.entries(AGENT_EXPERTISE)
    .map(([id, expertise]) => `- ${id}: ${expertise}`)
    .join('\n');

  const result = await aiProvider.chatCompletion({
    systemPrompt:
      `You are Leela, the Lead of a software engineering squad. ` +
      `Your job is to break down a task into actionable sub-tasks and assign each to the right agent.\n\n` +
      `Available agents:\n${agentList}\n\n` +
      `Rules:\n` +
      `- Create 2-5 sub-tasks that together fully implement the parent task\n` +
      `- Each sub-task should be independently actionable\n` +
      `- Assign to the most appropriate agent based on expertise\n` +
      `- Set priority: P0 (critical), P1 (high), P2 (medium), P3 (low)\n` +
      `- Add relevant labels\n\n` +
      `Respond with ONLY valid JSON array:\n` +
      `[{"title":"...","description":"...","assignee":"agent_id","priority":"P2","labels":["label1"]}]`,
    messages: [
      {
        role: 'user',
        content: `Break down this task:\n\nTitle: ${task.title}\nDescription: ${task.description || '(no description)'}\nPriority: ${task.priority}`,
      },
    ],
  });

  let subtasks: SubTaskSuggestion[];
  try {
    const jsonMatch = result.content.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? '[]') as Array<{
      title: string;
      description?: string;
      assignee?: string;
      priority?: string;
      labels?: string[];
    }>;

    const validAgents = new Set(Object.keys(AGENT_EXPERTISE));
    const validPriorities = new Set(['P0', 'P1', 'P2', 'P3']);

    subtasks = parsed
      .filter((s) => s.title && typeof s.title === 'string')
      .map((s) => ({
        title: s.title,
        description: s.description ?? '',
        assignee: validAgents.has(s.assignee ?? '') ? s.assignee! : 'leela',
        priority: validPriorities.has(s.priority ?? '')
          ? (s.priority as TaskPriority)
          : task.priority,
        labels: Array.isArray(s.labels) ? s.labels.filter((l) => typeof l === 'string') : [],
      }));
  } catch {
    subtasks = [
      {
        title: `Implement: ${task.title}`,
        description: task.description,
        assignee: 'leela',
        priority: task.priority,
        labels: ['auto-generated'],
      },
    ];
  }

  return { parentTaskId: task.id, subtasks };
}
