import type {
  AgentChatConversation,
  AgentChatConversationSummary,
  AgentChatPersistedMessage,
  AgentChatSaveConversationRequest,
} from '@torrent-vibe/shared'

import { getLogger } from '../../config/log-config'
import { AGENT_CHAT_CONVERSATIONS_TABLE_NAME, AppDatabase } from '../database'
import type { SqliteDatabase } from '../database/sqlite-utils'
import { all, get, run } from '../database/sqlite-utils'

const MAX_CONVERSATIONS = 100
const MAX_MESSAGES = 200
const MAX_PAYLOAD_LENGTH = 2_000_000
const logger = getLogger('[agent-chat-db]')

type ConversationRow = {
  createdAt: number
  id: string
  messageCount: number
  messages: string
  title: string
  updatedAt: number
}

const fallbackTitle = (messages: AgentChatPersistedMessage[]): string => {
  const firstUserMessage = messages.find(
    (message) => message.role === 'user' && message.content.trim(),
  )
  return (
    firstUserMessage?.content.replaceAll(/\s+/g, ' ').trim().slice(0, 60) ||
    'New conversation'
  )
}

export class AgentChatConversationDatabase {
  private static instance: AgentChatConversationDatabase | null = null

  static getInstance(): AgentChatConversationDatabase {
    this.instance ??= new AgentChatConversationDatabase()
    return this.instance
  }

  private readonly ready: Promise<void>
  private readonly sqlite: SqliteDatabase

  constructor(
    appDatabase: Pick<
      AppDatabase,
      'getSqlite' | 'waitUntilReady'
    > = AppDatabase.getInstance(),
  ) {
    this.sqlite = appDatabase.getSqlite()
    this.ready = appDatabase.waitUntilReady()
  }

  async list(): Promise<AgentChatConversationSummary[]> {
    await this.ready
    return all<AgentChatConversationSummary>(
      this.sqlite,
      `SELECT id, title, message_count as messageCount,
              created_at as createdAt, updated_at as updatedAt
       FROM ${AGENT_CHAT_CONVERSATIONS_TABLE_NAME}
       ORDER BY updated_at DESC
       LIMIT ?`,
      [MAX_CONVERSATIONS],
    )
  }

  async get(id: string): Promise<AgentChatConversation | null> {
    await this.ready
    const row = await get<ConversationRow>(
      this.sqlite,
      `SELECT id, title, messages, message_count as messageCount,
              created_at as createdAt, updated_at as updatedAt
       FROM ${AGENT_CHAT_CONVERSATIONS_TABLE_NAME}
       WHERE id = ?
       LIMIT 1`,
      [id],
    )
    if (!row) {
      return null
    }

    try {
      const messages = JSON.parse(row.messages)
      if (!Array.isArray(messages)) {
        throw new TypeError('Conversation messages must be an array')
      }
      return { ...row, messages: messages as AgentChatPersistedMessage[] }
    } catch (error) {
      logger.warn('Deleting invalid agent conversation', { id, error })
      await this.delete(id)
      return null
    }
  }

  async save(
    input: AgentChatSaveConversationRequest,
  ): Promise<AgentChatConversationSummary> {
    await this.ready
    const messages = input.messages.slice(-MAX_MESSAGES)
    const serialized = JSON.stringify(messages)
    if (serialized.length > MAX_PAYLOAD_LENGTH) {
      throw new RangeError('Agent conversation is too large to persist')
    }

    const now = Date.now()
    const createdAt = Number.isFinite(input.createdAt)
      ? Math.floor(input.createdAt)
      : now
    const title = input.title.trim().slice(0, 80) || fallbackTitle(messages)
    const summary = {
      createdAt,
      id: input.id,
      messageCount: messages.length,
      title,
      updatedAt: now,
    }

    await run(
      this.sqlite,
      `INSERT INTO ${AGENT_CHAT_CONVERSATIONS_TABLE_NAME} (
        id, title, messages, message_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        messages = excluded.messages,
        message_count = excluded.message_count,
        updated_at = excluded.updated_at`,
      [
        summary.id,
        summary.title,
        serialized,
        summary.messageCount,
        summary.createdAt,
        summary.updatedAt,
      ],
    )
    await run(
      this.sqlite,
      `DELETE FROM ${AGENT_CHAT_CONVERSATIONS_TABLE_NAME}
       WHERE id IN (
         SELECT id FROM ${AGENT_CHAT_CONVERSATIONS_TABLE_NAME}
         ORDER BY updated_at DESC
         LIMIT -1 OFFSET ?
       )`,
      [MAX_CONVERSATIONS],
    )
    return summary
  }

  async delete(id: string): Promise<void> {
    await this.ready
    await run(
      this.sqlite,
      `DELETE FROM ${AGENT_CHAT_CONVERSATIONS_TABLE_NAME} WHERE id = ?`,
      [id],
    )
  }
}
