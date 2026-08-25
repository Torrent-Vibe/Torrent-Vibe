import type sqlite3Type from 'sqlite3'
import type { Database as SqliteDatabase } from 'sqlite3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AGENT_CHAT_CONVERSATIONS_TABLE_NAME } from '../database'
import { close, exec } from '../database/sqlite-utils'
import { AgentChatConversationDatabase } from './conversation-database'

const sqlite3 = require('sqlite3') as typeof sqlite3Type

vi.mock('../database', () => ({
  AGENT_CHAT_CONVERSATIONS_TABLE_NAME: 'agent_chat_conversations',
  AppDatabase: {
    getInstance: () => {
      throw new Error('The test must inject its database')
    },
  },
}))

describe('AgentChatConversationDatabase', () => {
  let appDatabase: {
    getSqlite: () => SqliteDatabase
    waitUntilReady: () => Promise<void>
  }
  let database: AgentChatConversationDatabase
  let sqlite: SqliteDatabase

  beforeAll(async () => {
    sqlite = new sqlite3.Database(':memory:')
    await exec(
      sqlite,
      `CREATE TABLE ${AGENT_CHAT_CONVERSATIONS_TABLE_NAME} (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        messages TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    )
    appDatabase = {
      getSqlite: () => sqlite,
      waitUntilReady: () => Promise.resolve(),
    }
    database = new AgentChatConversationDatabase(appDatabase)
  })

  afterAll(async () => close(sqlite))

  it('restores a projected conversation after the service is recreated', async () => {
    await database.save({
      createdAt: 1,
      id: 'conversation-1',
      messages: [
        {
          activities: [],
          content: 'Inspect the selected torrent',
          context: {
            activeServerId: 'server-1',
            activeServerName: 'Primary',
            locale: 'en',
            selectedTorrentHashes: ['hash-1'],
            visibleTorrentCount: 12,
          },
          createdAt: 1,
          id: 'message-1',
          metadata: null,
          plans: [],
          reasoning: '',
          role: 'user',
          status: 'complete',
        },
      ],
      title: 'Inspect selected torrent',
    })

    const restored = await new AgentChatConversationDatabase(appDatabase).get(
      'conversation-1',
    )

    expect(restored).toMatchObject({
      id: 'conversation-1',
      messageCount: 1,
      messages: [
        {
          content: 'Inspect the selected torrent',
          context: {
            activeServerId: 'server-1',
            selectedTorrentHashes: ['hash-1'],
          },
        },
      ],
      title: 'Inspect selected torrent',
    })
  })
})
