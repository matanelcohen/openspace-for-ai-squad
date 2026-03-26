/**
 * Built-in HTTP API call tool adapter.
 */

import { BaseToolProvider } from '../plugin-interface.js';
import type { ToolDescriptor } from '../types.js';

const DEFAULT_API_TIMEOUT_MS = 30_000;

export class ApiAdapter extends BaseToolProvider {
  readonly name = 'api';

  constructor() {
    super();
    this.tools = [this.httpRequestTool()];
  }

  async execute(toolId: string, params: Record<string, unknown>): Promise<unknown> {
    this.getDescriptorOrThrow(toolId);

    switch (toolId) {
      case 'api-http-request': {
        const url = params.url as string;
        const method = ((params.method as string) ?? 'GET').toUpperCase();
        const headers = (params.headers as Record<string, string>) ?? {};
        const body = params.body;
        const timeout = (params.timeout as number) ?? DEFAULT_API_TIMEOUT_MS;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: body != null ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          const contentType = response.headers.get('content-type') ?? '';
          const responseBody = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
          };
        } finally {
          clearTimeout(timer);
        }
      }
      default:
        throw new Error(`Unknown api tool: ${toolId}`);
    }
  }

  // ── Tool descriptors ───────────────────────────────────────────

  private httpRequestTool(): ToolDescriptor {
    return {
      id: 'api-http-request',
      name: 'HTTP Request',
      description: 'Make an HTTP request to an API endpoint',
      version: '1.0.0',
      category: 'api',
      timeout: DEFAULT_API_TIMEOUT_MS,
      parameters: [
        { name: 'url', type: 'string', description: 'Request URL', required: true },
        {
          name: 'method',
          type: 'string',
          description: 'HTTP method',
          required: false,
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        },
        { name: 'headers', type: 'object', description: 'Request headers', required: false },
        { name: 'body', type: 'object', description: 'Request body (JSON)', required: false },
        { name: 'timeout', type: 'number', description: 'Timeout in ms', required: false },
      ],
    };
  }
}
