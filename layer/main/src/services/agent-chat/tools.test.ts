import { createEmptyTorrentAIMetadata } from '@torrent-vibe/shared'
import { describe, expect, it, vi } from 'vitest'

import { buildAgentChatTools } from './tools'
import type { AgentTorrentOperations } from './torrent-operations'

const { analyzeName, lookupCached } = vi.hoisted(() => ({
  analyzeName: vi.fn(),
  lookupCached: vi.fn(),
}))

vi.mock('../torrent-ai', () => ({
  TorrentAiEngine: {
    getInstance: () => ({ analyzeName, lookupCached }),
  },
}))

vi.mock('./lookup-tools', () => ({
  buildAgentChatLookupTools: () => [],
}))

const completedTorrent = (hash: string, name: string) => ({
  category: 'TV',
  downloadLimitBytesPerSecond: 0,
  downloadSpeed: 0,
  eta: 0,
  hash,
  name,
  progress: 1,
  ratio: 1,
  savePath: '/downloads',
  seedingTimeLimitMinutes: -2,
  shareRatioLimit: -2,
  size: 100,
  state: 'stoppedUP',
  tags: [],
  uploadLimitBytesPerSecond: 0,
  uploadSpeed: 0,
})

describe('Agent organization preview tool', () => {
  it('uses completed downloads and file trees without creating an operation plan', async () => {
    const query = vi.fn(async () => [
      completedTorrent('a', 'Show.S01E01.1080p'),
      completedTorrent('b', 'Show.S01E02.1080p'),
    ])
    const files = vi.fn(async () => ({
      files: [{ path: 'Show/Show.S01E01.mkv', progress: 1, size: 100 }],
      total: 1,
    }))
    const onPlan = vi.fn()
    lookupCached.mockResolvedValue({
      metadata: {
        ...createEmptyTorrentAIMetadata('Show.S01E01.1080p', 'en'),
        confidence: { overall: 0.9 },
        mediaType: 'tv',
        title: { canonicalTitle: 'Show', seasonNumber: 1 },
      },
      ok: true,
    })

    const tools = buildAgentChatTools({
      context: {
        activeServerId: 'server-a',
        activeServerName: 'Primary',
        locale: 'en',
        selectedTorrentHashes: [],
        visibleTorrentCount: 2,
      },
      onPlan,
      operations: { files, query } as unknown as AgentTorrentOperations,
      scopeKey: 'server-a',
      sessionId: 'session-a',
      userMessages: ['Preview my completed downloads'],
    })
    const tool = tools.find(
      (item) => item.name === 'preview_download_organization',
    )!

    const result = await tool.execute('call-a', { limit: 1 })
    const content = result.content[0]
    const payload = JSON.parse(
      content?.type === 'text' ? content.text : '{}',
    ) as {
      count: number
      hasMore: boolean
      items: Array<{ fileCount: number; metadata: { mediaType: string } }>
      previewOnly: boolean
    }

    expect(query).toHaveBeenCalledWith(
      { completedOnly: true, limit: 2, offset: 0 },
      'server-a',
    )
    expect(files).toHaveBeenCalledWith('a', 'server-a')
    expect(lookupCached).toHaveBeenCalledWith({
      hash: 'a',
      rawName: 'Show.S01E01.1080p',
    })
    expect(analyzeName).not.toHaveBeenCalled()
    expect(payload).toMatchObject({
      count: 1,
      hasMore: true,
      items: [{ fileCount: 1, metadata: { mediaType: 'tv' } }],
      previewOnly: true,
    })
    expect(onPlan).not.toHaveBeenCalled()
  })
})

describe('Agent audit_download_library tool', () => {
  it('calls operations.audit and does not call onPlan', async () => {
    const audit = vi.fn(async () => ({
      byCategory: { Movie: 1 },
      byState: { stoppedUP: 1 },
      hasMore: false,
      helper: [],
      issues: [],
      nextOffset: null,
      observedRoots: ['/downloads/Movie'],
      scanned: 1,
      total: 1,
    }))
    const onPlan = vi.fn()
    const tools = buildAgentChatTools({
      context: {
        activeServerId: 'server-a',
        activeServerName: 'Primary',
        locale: 'en',
        selectedTorrentHashes: [],
        visibleTorrentCount: 3,
      },
      onPlan,
      operations: { audit } as unknown as AgentTorrentOperations,
      scopeKey: 'server-a',
      sessionId: 'session-a',
      userMessages: ['Audit my library'],
    })
    const tool = tools.find((item) => item.name === 'audit_download_library')!

    const result = await tool.execute('call-audit', { limit: 50 })
    const content = result.content[0]
    const payload = JSON.parse(
      content?.type === 'text' ? content.text : '{}',
    ) as { observedRoots: string[] }

    expect(audit).toHaveBeenCalledWith({ limit: 50 }, 'server-a')
    expect(onPlan).not.toHaveBeenCalled()
    expect(payload.observedRoots).toEqual(['/downloads/Movie'])
    expect(tools.some((item) => item.name === 'read_skill')).toBe(true)
  })
})
