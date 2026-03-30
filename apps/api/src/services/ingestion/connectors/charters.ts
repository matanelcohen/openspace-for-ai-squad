/**
 * Agent Charters connector — reads charter.md files from .squad/agents/.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SourceType } from '@matanelcohen/openspace-shared';

import type { ConnectorOptions, SourceConnector, SourceDocument } from './types.js';

export interface ChartersConnectorConfig {
  squadDir: string;
}

export class ChartersConnector implements SourceConnector {
  readonly sourceType: SourceType = 'agent_charter';
  private readonly agentsDir: string;

  constructor(config: ChartersConnectorConfig) {
    this.agentsDir = join(config.squadDir, 'agents');
  }

  async fetchSources(_options?: ConnectorOptions): Promise<SourceDocument[]> {
    if (!existsSync(this.agentsDir)) return [];

    const documents: SourceDocument[] = [];
    const dirs = readdirSync(this.agentsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

    for (const dir of dirs) {
      const charterPath = join(this.agentsDir, dir.name, 'charter.md');
      if (!existsSync(charterPath)) continue;

      try {
        const content = readFileSync(charterPath, 'utf-8');
        documents.push({
          sourceId: `charter-${dir.name}`,
          sourceType: 'agent_charter',
          content,
          metadata: {
            sourceType: 'agent_charter' as const,
            sourceId: `charter-${dir.name}`,
            squadPath: `agents/${dir.name}/charter.md`,
            filePath: charterPath,
            agentIds: [dir.name],
            author: dir.name,
            createdAt: null,
            updatedAt: null,
            tags: ['charter'],
            status: null,
            priority: null,
            headingPath: null,
            threadId: null,
            sessionId: null,
          },
        });
      } catch { /* skip */ }
    }

    return documents;
  }
}
