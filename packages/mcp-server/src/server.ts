import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const PACKAGE_VERSION = '0.0.1';

/**
 * Create and configure the openspace MCP server with all tools and resources.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'openspace-mcp',
    version: PACKAGE_VERSION,
  });

  // ── Tools ─────────────────────────────────────────────────────────────

  server.tool(
    'list_agents',
    'List all squad agents with their status, role, and current task',
    {},
    async () => {
      const res = await fetch(`${getApiBase()}/api/agents`);
      const agents = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(agents, null, 2) }] };
    },
  );

  server.tool(
    'get_agent',
    'Get detailed information about a specific agent',
    { agentId: z.string().describe('Agent identifier (e.g. leela, fry, bender, zoidberg)') },
    async ({ agentId }) => {
      const res = await fetch(`${getApiBase()}/api/agents/${agentId}`);
      const agent = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }] };
    },
  );

  server.tool(
    'list_tasks',
    'List squad tasks, optionally filtered by status or assignee',
    {
      status: z
        .string()
        .optional()
        .describe('Filter by status (backlog, in-progress, done, blocked)'),
      assignee: z.string().optional().describe('Filter by assigned agent'),
    },
    async ({ status, assignee }) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (assignee) params.set('assignee', assignee);
      const res = await fetch(`${getApiBase()}/api/tasks?${params}`);
      const tasks = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    },
  );

  server.tool(
    'get_task',
    'Get detailed information about a specific task',
    { taskId: z.string().describe('Task identifier') },
    async ({ taskId }) => {
      const res = await fetch(`${getApiBase()}/api/tasks/${taskId}`);
      const task = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    'create_task',
    'Create a new task and assign it to an agent',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description (markdown)'),
      assignee: z.string().optional().describe('Agent to assign the task to'),
      priority: z.string().optional().describe('Priority: P0, P1, P2, P3'),
    },
    async ({ title, description, assignee, priority }) => {
      const res = await fetch(`${getApiBase()}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, assignee, priority }),
      });
      const task = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    'update_task',
    'Update an existing task (full update — title, description, assignee, priority, status, labels)',
    {
      taskId: z.string().describe('Task identifier'),
      title: z.string().optional().describe('New task title'),
      description: z.string().optional().describe('New task description (markdown)'),
      assignee: z.string().optional().describe('Agent to reassign the task to'),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('New priority level'),
      status: z
        .enum(['pending-approval', 'backlog', 'in-progress', 'in-review', 'done', 'blocked'])
        .optional()
        .describe('New task status'),
      labels: z.array(z.string()).optional().describe('Labels to set on the task'),
    },
    async ({ taskId, ...fields }) => {
      const res = await fetch(`${getApiBase()}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const result = await res.json();
      if (!res.ok)
        return {
          content: [{ type: 'text', text: `Error: ${JSON.stringify(result)}` }],
          isError: true,
        };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'update_task_status',
    'Update only the status of a task (shortcut for status-only changes)',
    {
      taskId: z.string().describe('Task identifier'),
      status: z.string().describe('New status: backlog, in-progress, done, blocked'),
    },
    async ({ taskId, status }) => {
      const res = await fetch(`${getApiBase()}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok)
        return {
          content: [{ type: 'text', text: `Error: ${JSON.stringify(result)}` }],
          isError: true,
        };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'delete_task',
    'Delete a task by ID',
    {
      taskId: z.string().describe('Task identifier'),
    },
    async ({ taskId }) => {
      const res = await fetch(`${getApiBase()}/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({ error: res.statusText }));
        return {
          content: [{ type: 'text', text: `Error: ${JSON.stringify(result)}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text', text: `Task ${taskId} deleted successfully.` }] };
    },
  );

  server.tool(
    'approve_task',
    'Approve a pending-approval task — moves it to backlog and enqueues for the assigned agent',
    {
      taskId: z.string().describe('Task identifier (must be in pending-approval status)'),
    },
    async ({ taskId }) => {
      const res = await fetch(`${getApiBase()}/api/tasks/${taskId}/approve`, {
        method: 'PATCH',
      });
      const result = await res.json();
      if (!res.ok)
        return {
          content: [{ type: 'text', text: `Error: ${JSON.stringify(result)}` }],
          isError: true,
        };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'reject_task',
    'Reject a pending-approval task — deletes it from the task board',
    {
      taskId: z.string().describe('Task identifier (must be in pending-approval status)'),
    },
    async ({ taskId }) => {
      const res = await fetch(`${getApiBase()}/api/tasks/${taskId}/reject`, {
        method: 'PATCH',
      });
      if (res.status === 204) {
        return { content: [{ type: 'text', text: `Task ${taskId} rejected and removed.` }] };
      }
      const result = await res.json().catch(() => ({ error: res.statusText }));
      if (!res.ok)
        return {
          content: [{ type: 'text', text: `Error: ${JSON.stringify(result)}` }],
          isError: true,
        };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_decisions',
    'List squad decisions, optionally search by keyword',
    {
      query: z.string().optional().describe('Full-text search query'),
    },
    async ({ query }) => {
      const endpoint = query
        ? `${getApiBase()}/api/decisions/search?q=${encodeURIComponent(query)}`
        : `${getApiBase()}/api/decisions`;
      const res = await fetch(endpoint);
      const decisions = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(decisions, null, 2) }] };
    },
  );

  server.tool(
    'send_chat_message',
    'Send a chat message to the squad or a specific agent',
    {
      message: z.string().describe('Message content'),
      agent: z.string().optional().describe('Target agent (omit for team-wide)'),
    },
    async ({ message, agent }) => {
      const res = await fetch(`${getApiBase()}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message, agent }),
      });
      const result = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_chat_history',
    'Retrieve chat message history with optional filtering by agent or thread',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max messages to return (default 50, max 200)'),
      offset: z.number().int().min(0).optional().describe('Number of messages to skip'),
      agent: z.string().optional().describe('Filter messages involving this agent'),
      threadId: z.string().optional().describe('Filter by thread ID'),
    },
    async ({ limit, offset, agent, threadId }) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      if (agent) params.set('agent', agent);
      if (threadId) params.set('threadId', threadId);
      const res = await fetch(`${getApiBase()}/api/chat/messages?${params}`);
      const result = await res.json();
      if (!res.ok)
        return {
          content: [{ type: 'text', text: `Error: ${JSON.stringify(result)}` }],
          isError: true,
        };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_agent_status',
    'Get real-time agent work status — active tasks, queue lengths, and queued task details',
    {},
    async () => {
      const res = await fetch(`${getApiBase()}/api/agents/status`);
      const result = await res.json();
      if (!res.ok)
        return {
          content: [{ type: 'text', text: `Error: ${JSON.stringify(result)}` }],
          isError: true,
        };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_activity_feed',
    'Get recent activity events (agent actions, task changes, decisions) — newest first',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max events to return (default 50, max 200)'),
      offset: z.number().int().min(0).optional().describe('Number of events to skip'),
    },
    async ({ limit, offset }) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      const res = await fetch(`${getApiBase()}/api/activity?${params}`);
      const result = await res.json();
      if (!res.ok)
        return {
          content: [{ type: 'text', text: `Error: ${JSON.stringify(result)}` }],
          isError: true,
        };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_squad_status',
    'Get a high-level overview of the squad: agents, active tasks, recent activity',
    {},
    async () => {
      const res = await fetch(`${getApiBase()}/api/squad`);
      const squad = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(squad, null, 2) }] };
    },
  );

  // ── Resources ─────────────────────────────────────────────────────────

  server.resource(
    'squad-overview',
    'openspace://squad',
    { description: 'Current squad overview — agents, tasks, status' },
    async () => {
      const res = await fetch(`${getApiBase()}/api/squad`);
      const squad = await res.json();
      return {
        contents: [
          {
            uri: 'openspace://squad',
            text: JSON.stringify(squad, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.resource(
    'agent-roster',
    'openspace://agents',
    { description: 'Full agent roster with roles and capabilities' },
    async () => {
      const res = await fetch(`${getApiBase()}/api/agents`);
      const agents = await res.json();
      return {
        contents: [
          {
            uri: 'openspace://agents',
            text: JSON.stringify(agents, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.resource(
    'task-board',
    'openspace://tasks',
    { description: 'Current task board with all tasks and statuses' },
    async () => {
      const res = await fetch(`${getApiBase()}/api/tasks`);
      const tasks = await res.json();
      return {
        contents: [
          {
            uri: 'openspace://tasks',
            text: JSON.stringify(tasks, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.resource(
    'decision-log',
    'openspace://decisions',
    { description: 'Squad decision log' },
    async () => {
      const res = await fetch(`${getApiBase()}/api/decisions`);
      const decisions = await res.json();
      return {
        contents: [
          {
            uri: 'openspace://decisions',
            text: JSON.stringify(decisions, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  return server;
}

function getApiBase(): string {
  return process.env.OPENSPACE_API_URL ?? 'http://localhost:3001';
}
