import type { AgentChatMessageMetadata } from '@torrent-vibe/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentChatActions } from './actions'
import { agentChatStore } from './store'

const ipcMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  saveConversation: vi.fn().mockResolvedValue(null),
  sendMessage: vi.fn(),
}))
const storeMocks = vi.hoisted(() => ({
  multiServer: {
    activeServerId: 'server-a',
    servers: { 'server-a': { name: 'Home NAS' } } as Record<
      string,
      { name: string }
    >,
  },
  torrent: {
    filterState: 'downloading',
    searchQuery: 'ubuntu',
    selectedTorrents: ['hash-a', 'hash-b'],
    sortedTorrents: [{ hash: 'hash-a' }, { hash: 'hash-b' }],
  },
  torrentTable: { activeTorrentHash: null as string | null },
}))

vi.mock('~/i18n', () => ({
  getI18n: () => ({ language: 'en', t: () => 'New chat' }),
}))
vi.mock('~/lib/ipc-client', () => ({
  ipcServices: { agentChat: ipcMocks },
}))
vi.mock('~/modules/multi-server/stores/multi-server-store', () => ({
  useMultiServerStore: { getState: () => storeMocks.multiServer },
}))
vi.mock('~/modules/torrent/stores/torrent-actions', () => ({
  TorrentActions: { shared: {} },
}))
vi.mock('~/modules/torrent/stores/torrent-data-store', () => ({
  useTorrentDataStore: { getState: () => storeMocks.torrent },
}))
vi.mock('~/modules/torrent/stores/torrent-table-store', () => ({
  useTorrentTableStore: { getState: () => storeMocks.torrentTable },
}))

const metadata: AgentChatMessageMetadata = {
  durationMs: 500,
  generationMs: 400,
  model: 'test-model',
  provider: 'test-provider',
  startedAt: 1,
  tokensPerSecond: 25,
  usage: {
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0.001,
    inputTokens: 10,
    outputTokens: 10,
    reasoningTokens: 0,
    totalTokens: 20,
  },
}

describe('AgentChatActions stream reconciliation', () => {
  afterEach(() => vi.useRealTimers())

  beforeEach(() => {
    vi.clearAllMocks()
    storeMocks.multiServer.activeServerId = 'server-a'
    storeMocks.multiServer.servers = { 'server-a': { name: 'Home NAS' } }
    storeMocks.torrent.filterState = 'downloading'
    storeMocks.torrent.searchQuery = 'ubuntu'
    storeMocks.torrent.selectedTorrents = ['hash-a', 'hash-b']
    storeMocks.torrent.sortedTorrents = [{ hash: 'hash-a' }, { hash: 'hash-b' }]
    storeMocks.torrentTable.activeTorrentHash = null
    agentChatStore.reset()
    agentChatStore.setState((state) => {
      state.activeRunId = 'run'
      state.isRunning = true
      state.sessionId = 'session'
      state.messages = [
        {
          activities: [],
          content: '',
          createdAt: 1,
          id: 'assistant',
          lastSequence: 0,
          metadata: null,
          plans: [],
          reasoning: '',
          role: 'assistant',
          runId: 'run',
          status: 'streaming',
        },
      ]
    })
  })

  it('appends ordered deltas and reconciles the final response', () => {
    const base = { runId: 'run', sessionId: 'session' }
    AgentChatActions.shared.handleStreamEvent({
      ...base,
      contentIndex: 0,
      delta: 'Hel',
      sequence: 1,
      turn: 0,
      type: 'text-delta',
    })
    AgentChatActions.shared.handleStreamEvent({
      ...base,
      contentIndex: 0,
      delta: 'ignored',
      sequence: 1,
      turn: 0,
      type: 'text-delta',
    })
    AgentChatActions.shared.handleStreamEvent({
      ...base,
      contentIndex: 0,
      delta: 'lo',
      sequence: 2,
      turn: 0,
      type: 'text-delta',
    })
    AgentChatActions.shared.handleStreamEvent({
      ...base,
      response: {
        activities: [],
        message: 'Hello',
        metadata,
        plans: [],
      },
      sequence: 3,
      type: 'run-end',
    })

    const state = agentChatStore.getState()
    expect(state.messages[0]).toMatchObject({
      content: 'Hello',
      metadata,
      status: 'complete',
    })
    expect(state).toMatchObject({ activeRunId: null, isRunning: false })
  })

  it('runs the dev message demo without sending an AI request', async () => {
    vi.useFakeTimers()

    const demo = AgentChatActions.shared.loadDemo()
    await vi.dynamicImportSettled()
    await vi.runAllTimersAsync()
    await demo

    expect(ipcMocks.sendMessage).not.toHaveBeenCalled()
    expect(agentChatStore.getState()).toMatchObject({
      activeRunId: null,
      isDemo: true,
      isRunning: false,
      messages: [
        { role: 'user' },
        {
          content: expect.stringContaining('队列概览'),
          metadata: expect.objectContaining({ provider: 'local-dev' }),
          role: 'assistant',
          status: 'complete',
        },
      ],
    })
  })

  it('keeps an Ask Agent scope stable while live selection changes', () => {
    agentChatStore.reset()
    agentChatStore.setState((state) => {
      state.historyLoaded = true
    })

    AgentChatActions.shared.openPanel(['hash-a', 'hash-b', 'hash-a'])
    storeMocks.multiServer.activeServerId = 'server-b'
    storeMocks.multiServer.servers = { 'server-b': { name: 'Remote NAS' } }
    storeMocks.torrent.filterState = 'all'
    storeMocks.torrent.searchQuery = ''
    storeMocks.torrent.selectedTorrents = ['hash-c']

    expect(agentChatStore.getState().draftContext).toMatchObject({
      activeServerId: 'server-a',
      activeServerName: 'Home NAS',
      filter: { search: 'ubuntu', statuses: ['downloading'] },
      selectedTorrentHashes: ['hash-a', 'hash-b'],
    })
  })

  it('clears draft context after removing the last composer attachment', () => {
    agentChatStore.reset()
    storeMocks.torrent.filterState = 'all'
    storeMocks.torrent.searchQuery = ''
    AgentChatActions.shared.openPanel(['hash-a'])
    expect(
      agentChatStore.getState().draftContext?.selectedTorrentHashes,
    ).toEqual(['hash-a'])
    AgentChatActions.shared.removeDraftContextPart('selection')
    expect(agentChatStore.getState().draftContext).toBeNull()
  })
})
