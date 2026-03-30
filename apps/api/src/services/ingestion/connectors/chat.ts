/**
 * Chat connector — reads chat messages from the SQLite database.
 *
 * Groups messages by channel/thread for context-rich ingestion.
 */

import type { SourceType } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

import type { ConnectorOptions, SourceConnector, SourceDocument } from './types.js';

interface ChatRow {
  id: string;
  content: string;
  sender: string;
  recipient: string;
  timestamp: string;
  workspace_id: string;
}

export interface ChatConnectorConfig {
  db: Database.Database;
  workspaceId?: string;
}

export class ChatConnector implements SourceConnector {
  readonly sourceType: SourceType = 'chat_thread';
  private readonly db: Database.Database;
  private readonly workspaceId: string;

  constructor(config: ChatConnectorConfig) {
    this.db = config.db;
    this.workspaceId = config.workspaceId ?? '';
  }

  async fetchSources(options?: ConnectorOptions): Promise<SourceDocument[]> {
    // Group messages by channel (recipient)
    const channels = this.db
      .prepare<[string], { recipient: string; cnt: number }>(
        `SELECT recipient, COUNT(*) as cnt FROM chat_messages 
         WHERE workspace_id = ? GROUP BY recipient ORDER BY cnt DESC`,
      )
      .all(this.workspaceId);

    const documents: SourceDocument[] = [];

    for (const channel of channels) {
      let query = `SELECT id, content, sender, recipient, timestamp, workspace_id 
                   FROM chat_messages WHERE workspace_id = ? AND recipient = ? 
                   ORDER BY timestamp DESC`;
      const params: (string | number)[] = [this.workspaceId, channel.recipient];

      if (options?.limit) {
        query += ` LIMIT ?`;
        params.push(options.limit);
      } else {
        query += ` LIMIT 100`;
      }

      const messages = this.db.prepare(query).all(...params) as ChatRow[];
      if (messages.length === 0) continue;

      // Format as a conversation thread
      const lines = messages.reverse().map(
        (m) => `[${m.timestamp}] ${m.sender}: ${m.content}`,
      );

      documents.push({
        sourceId: `chat-${channel.recipient}`,
        sourceType: 'chat_thread',
        content: `# Chat: ${channel.recipient}\n\n${lines.join('\n')}`,
        metadata: {
          sourceType: 'chat_thread' as const,
          sourceId: `chat-${channel.recipient}`,
          squadPath: null,
          filePath: null,
          agentIds: [],
          author: null,
          createdAt: messages[0]?.timestamp ?? new Date().toISOString(),
          updatedAt: messages[messages.length - 1]?.timestamp ?? new Date().toISOString(),
          tags: [],
          status: null,
          priority: null,
          headingPath: null,
          threadId: channel.recipient,
          sessionId: null,
        },
      });
    }

    return documents;
  }
}
