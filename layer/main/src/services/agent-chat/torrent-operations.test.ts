import type { TorrentFile, TorrentInfo } from '@torrent-vibe/qb-client'
import { describe, expect, it, vi } from 'vitest'

import {
  AgentTorrentOperations,
  type TorrentQueueGateway,
} from './torrent-operations'

const torrent = (
  hash: string,
  name: string,
  state: TorrentInfo['state'],
  options: {
    category?: string
    downloadLimit?: number
    progress?: number
    savePath?: string
    seedingTimeLimit?: number
    shareRatioLimit?: number
    tags?: string
    uploadLimit?: number
  } = {},
): TorrentInfo =>
  ({
    category: options.category ?? '',
    completion_on: options.progress === 1 ? 200 : 0,
    dl_limit: options.downloadLimit ?? 0,
    dlspeed: 0,
    eta: 0,
    hash,
    name,
    progress: options.progress ?? 0.5,
    ratio: 0,
    ratio_limit: options.shareRatioLimit ?? -2,
    save_path: options.savePath ?? '/downloads',
    seeding_time_limit: options.seedingTimeLimit ?? -2,
    size: 100,
    state,
    tags: options.tags ?? '',
    up_limit: options.uploadLimit ?? 0,
    upspeed: 0,
  }) as TorrentInfo

const createGateway = (initial: TorrentInfo[]) => {
  let activeScope = 'server-a'
  let current = initial
  const add = vi.fn(
    async (
      _scopeKey: string | null,
      _sources: string[],
      _options: {
        category?: string
        savepath?: string
        stopped?: boolean
      },
    ) => {},
  )
  const addTags = vi.fn(
    async (_scopeKey: string | null, _hashes: string[], _tags: string[]) => {},
  )
  const pause = vi.fn(async (_scopeKey: string | null, _hashes: string[]) => {})
  const move = vi.fn(
    async (
      _scopeKey: string | null,
      _hashes: string[],
      _savePath: string,
    ) => {},
  )
  const reannounce = vi.fn(
    async (_scopeKey: string | null, _hashes: string[]) => {},
  )
  const recheck = vi.fn(
    async (_scopeKey: string | null, _hashes: string[]) => {},
  )
  const remove = vi.fn(
    async (
      _scopeKey: string | null,
      _hashes: string[],
      _deleteFiles: boolean,
    ) => {},
  )
  const rename = vi.fn(
    async (_scopeKey: string | null, _hash: string, _newName: string) => {},
  )
  const removeTags = vi.fn(
    async (_scopeKey: string | null, _hashes: string[], _tags: string[]) => {},
  )
  const resume = vi.fn(
    async (_scopeKey: string | null, _hashes: string[]) => {},
  )
  const setCategory = vi.fn(
    async (
      _scopeKey: string | null,
      _hashes: string[],
      _category: string,
    ) => {},
  )
  const setDownloadLimit = vi.fn(
    async (_scopeKey: string | null, _hashes: string[], _limit: number) => {},
  )
  const setShareLimits = vi.fn(
    async (
      _scopeKey: string | null,
      _hashes: string[],
      _shareRatioLimit?: number,
      _seedingTimeLimitMinutes?: number,
    ) => {},
  )
  const setUploadLimit = vi.fn(
    async (_scopeKey: string | null, _hashes: string[], _limit: number) => {},
  )
  const files = vi.fn(
    async (_scopeKey: string | null, hash: string): Promise<TorrentFile[]> => [
      {
        availability: 1,
        index: 0,
        name: `${hash}/episode.mkv`,
        piece_range: [0, 1],
        priority: 1,
        progress: 1,
        size: 100,
      },
    ],
  )
  const gateway: TorrentQueueGateway = {
    add,
    addTags,
    captureScope: () => activeScope,
    files,
    list: vi.fn(async (_scopeKey: string | null, hashes?: string[]) =>
      hashes?.length
        ? current.filter((item) => hashes.includes(item.hash))
        : current,
    ),
    move,
    pause,
    reannounce,
    recheck,
    remove,
    rename,
    removeTags,
    resume,
    setCategory,
    setDownloadLimit,
    setShareLimits,
    setUploadLimit,
  }
  return {
    add,
    addTags,
    gateway,
    files,
    move,
    pause,
    reannounce,
    recheck,
    remove,
    rename,
    removeTags,
    resume,
    setCategory,
    setDownloadLimit,
    setShareLimits,
    setUploadLimit,
    setActiveScope: (scope: string) => {
      activeScope = scope
    },
    setCurrent: (next: TorrentInfo[]) => {
      current = next
    },
  }
}

describe('AgentTorrentOperations', () => {
  it('keeps a reviewed plan on its captured server and executes it once', async () => {
    const fake = createGateway([
      torrent('a', 'Ubuntu ISO', 'downloading'),
      torrent('b', 'Fedora ISO', 'stalledDL'),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)

    const plan = await operations.prepare({ action: 'pause' }, ['a', 'b'])

    expect(fake.pause).not.toHaveBeenCalled()
    expect(plan.status).toBe('pending')
    expect(plan.targets.map((target) => target.hash)).toEqual(['a', 'b'])

    fake.setActiveScope('server-b')
    const first = await operations.execute(plan.id)
    const repeated = await operations.execute(plan.id)

    expect(first.ok).toBe(true)
    expect(repeated.ok).toBe(true)
    expect(fake.pause).toHaveBeenCalledTimes(1)
    expect(fake.pause).toHaveBeenCalledWith('server-a', ['a', 'b'])
  })

  it('rejects a stale plan without executing it', async () => {
    const fake = createGateway([torrent('a', 'Ubuntu ISO', 'downloading')])
    const operations = new AgentTorrentOperations(fake.gateway)
    const plan = await operations.prepare({ action: 'pause' }, ['a'])

    fake.setCurrent([torrent('a', 'Ubuntu ISO', 'stoppedDL')])
    const result = await operations.execute(plan.id)

    expect(result.ok).toBe(false)
    expect(result.plan?.status).toBe('failed')
    expect(result.error).toContain('changed')
    expect(fake.pause).not.toHaveBeenCalled()
  })

  it('filters live queue results and respects the requested limit', async () => {
    const fake = createGateway([
      torrent('a', 'Ubuntu Desktop', 'downloading'),
      torrent('b', 'Ubuntu Server', 'stalledDL'),
      torrent('c', 'Fedora', 'downloading'),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)

    const result = await operations.query({
      query: 'ubuntu',
      states: ['downloading', 'stalledDL'],
      limit: 1,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Ubuntu Desktop')
  })

  it('pages completed downloads and exposes a bounded file-tree summary', async () => {
    const fake = createGateway([
      torrent('a', 'Finished A', 'stoppedUP', { progress: 1 }),
      torrent('b', 'Still downloading', 'downloading'),
      torrent('c', 'Finished C', 'uploading', { progress: 1 }),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)

    const page = await operations.query({
      completedOnly: true,
      limit: 1,
      offset: 1,
    })
    const fileTree = await operations.files('a')

    expect(page.map((item) => item.name)).toEqual(['Finished C'])
    expect(fileTree).toEqual({
      files: [
        {
          path: 'a/episode.mkv',
          progress: 1,
          size: 100,
        },
      ],
      total: 1,
    })
    expect(fake.files).toHaveBeenCalledWith('server-a', 'a')
  })

  it('previews and executes category and tag changes with per-target outcomes', async () => {
    const fake = createGateway([
      torrent('a', 'Show A', 'stoppedUP', { tags: 'keep,old' }),
      torrent('b', 'Show B', 'stoppedUP', {
        category: 'Anime',
        tags: 'keep',
      }),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)

    const categoryPlan = await operations.prepare(
      { action: 'set_category', category: 'Anime' },
      ['a', 'b'],
    )

    expect(fake.setCategory).not.toHaveBeenCalled()
    expect(categoryPlan.targets.map((target) => target.outcome)).toEqual([
      'pending',
      'skipped',
    ])
    const categoryResult = await operations.execute(categoryPlan.id)
    expect(categoryResult.ok).toBe(true)
    expect(
      categoryResult.plan?.targets.map((target) => target.outcome),
    ).toEqual(['changed', 'skipped'])
    expect(fake.setCategory).toHaveBeenCalledWith('server-a', ['a'], 'Anime')

    fake.setCurrent([
      torrent('a', 'Show A', 'stoppedUP', { tags: 'keep,old' }),
      torrent('b', 'Show B', 'stoppedUP', { tags: 'keep' }),
    ])
    const addTagsPlan = await operations.prepare(
      { action: 'add_tags', tags: ['keep', 'favorite'] },
      ['a', 'b'],
    )
    const addTagsResult = await operations.execute(addTagsPlan.id)
    expect(addTagsResult.ok).toBe(true)
    expect(fake.addTags).toHaveBeenCalledTimes(2)
    expect(fake.addTags).toHaveBeenCalledWith(
      'server-a',
      ['a'],
      ['keep', 'favorite'],
    )

    const removeTagsPlan = await operations.prepare(
      { action: 'remove_tags', tags: ['old'] },
      ['a', 'b'],
    )
    const removeTagsResult = await operations.execute(removeTagsPlan.id)
    expect(removeTagsResult.ok).toBe(true)
    expect(
      removeTagsResult.plan?.targets.map((target) => target.outcome),
    ).toEqual(['changed', 'skipped'])
    expect(fake.removeTags).toHaveBeenCalledWith('server-a', ['a'], ['old'])
  })

  it('rejects the whole plan when a previewed no-op target changes', async () => {
    const fake = createGateway([
      torrent('a', 'Show A', 'stoppedUP'),
      torrent('b', 'Show B', 'stoppedUP', { category: 'Anime' }),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)
    const plan = await operations.prepare(
      { action: 'set_category', category: 'Anime' },
      ['a', 'b'],
    )

    fake.setCurrent([
      torrent('a', 'Show A', 'stoppedUP'),
      torrent('b', 'Show B', 'stoppedUP', { category: 'Other' }),
    ])
    const result = await operations.execute(plan.id)

    expect(result.ok).toBe(false)
    expect(result.plan?.targets.map((target) => target.outcome)).toEqual([
      'skipped',
      'failed',
    ])
    expect(fake.setCategory).not.toHaveBeenCalled()
  })

  it('reports partial tag failures without hiding successful targets', async () => {
    const fake = createGateway([
      torrent('a', 'Show A', 'stoppedUP'),
      torrent('b', 'Show B', 'stoppedUP'),
    ])
    fake.addTags.mockImplementation(async (_scopeKey, hashes) => {
      if (hashes[0] === 'b') {
        throw new Error('Tag update rejected')
      }
    })
    const operations = new AgentTorrentOperations(fake.gateway)
    const plan = await operations.prepare(
      { action: 'add_tags', tags: ['favorite'] },
      ['a', 'b'],
    )

    const result = await operations.execute(plan.id)

    expect(result.ok).toBe(false)
    expect(result.plan?.status).toBe('partially_failed')
    expect(result.plan?.targets.map((target) => target.outcome)).toEqual([
      'changed',
      'failed',
    ])
  })

  it('previews limits and executes maintenance commands per target', async () => {
    const fake = createGateway([
      torrent('a', 'Show A', 'stalledDL', {
        downloadLimit: 0,
        seedingTimeLimit: -2,
        shareRatioLimit: -2,
        uploadLimit: 1024,
      }),
      torrent('b', 'Show B', 'checkingDL', {
        downloadLimit: 2048,
        seedingTimeLimit: 60,
        shareRatioLimit: 1,
        uploadLimit: 1024,
      }),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)

    const downloadPlan = await operations.prepare(
      { action: 'set_download_limit', limitBytesPerSecond: 2048 },
      ['a', 'b'],
    )
    expect(downloadPlan.targets.map((target) => target.outcome)).toEqual([
      'pending',
      'skipped',
    ])
    await operations.execute(downloadPlan.id)
    expect(fake.setDownloadLimit).toHaveBeenCalledWith('server-a', ['a'], 2048)

    const uploadPlan = await operations.prepare(
      { action: 'set_upload_limit', limitBytesPerSecond: 0 },
      ['a', 'b'],
    )
    await operations.execute(uploadPlan.id)
    expect(fake.setUploadLimit).toHaveBeenCalledTimes(2)

    const sharePlan = await operations.prepare(
      {
        action: 'set_share_limits',
        seedingTimeLimitMinutes: 60,
        shareRatioLimit: 1,
      },
      ['a', 'b'],
    )
    await operations.execute(sharePlan.id)
    expect(fake.setShareLimits).toHaveBeenCalledWith('server-a', ['a'], 1, 60)

    const recheckPlan = await operations.prepare({ action: 'recheck' }, [
      'a',
      'b',
    ])
    expect(recheckPlan.targets.map((target) => target.outcome)).toEqual([
      'pending',
      'skipped',
    ])
    await operations.execute(recheckPlan.id)
    expect(fake.recheck).toHaveBeenCalledWith('server-a', ['a'])

    const reannouncePlan = await operations.prepare({ action: 'reannounce' }, [
      'a',
      'b',
    ])
    await operations.execute(reannouncePlan.id)
    expect(fake.reannounce).toHaveBeenCalledTimes(2)
  })

  it('previews and executes qBittorrent-owned rename and save-location changes', async () => {
    const fake = createGateway([
      torrent('a', 'Show A', 'stoppedUP', { savePath: '/downloads' }),
      torrent('b', 'Show B', 'stoppedUP', { savePath: '/library/anime' }),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)

    const renamePlan = await operations.prepare(
      { action: 'rename_torrent', newName: 'Show A Renamed' },
      ['a'],
    )
    expect(renamePlan.targets[0]).toMatchObject({
      name: 'Show A',
      outcome: 'pending',
      savePath: '/downloads',
    })
    await operations.execute(renamePlan.id)
    expect(fake.rename).toHaveBeenCalledWith('server-a', 'a', 'Show A Renamed')

    const movePlan = await operations.prepare(
      { action: 'move_torrent', savePath: '/library/anime' },
      ['a', 'b'],
    )
    expect(movePlan.targets.map((target) => target.outcome)).toEqual([
      'pending',
      'skipped',
    ])
    await operations.execute(movePlan.id)
    expect(fake.move).toHaveBeenCalledWith('server-a', ['a'], '/library/anime')
  })

  it('keeps removal side-effect free and requires final confirmation for file deletion', async () => {
    const fake = createGateway([
      torrent('a', 'Keep Data', 'stoppedUP', { savePath: '/downloads/a' }),
      torrent('b', 'Delete Data', 'stoppedUP', { savePath: '/downloads/b' }),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)

    const keepFilesPlan = await operations.prepare(
      { action: 'remove_torrent', deleteFiles: false },
      ['a'],
    )
    expect(fake.remove).not.toHaveBeenCalled()
    await operations.execute(keepFilesPlan.id)
    expect(fake.remove).toHaveBeenCalledWith('server-a', ['a'], false)

    const deleteFilesPlan = await operations.prepare(
      { action: 'remove_torrent', deleteFiles: true },
      ['b'],
    )
    const unconfirmed = await operations.execute(deleteFilesPlan.id)
    expect(unconfirmed).toMatchObject({
      ok: false,
      plan: { status: 'pending' },
    })
    expect(fake.remove).toHaveBeenCalledTimes(1)

    const confirmed = await operations.execute(deleteFilesPlan.id, true)
    expect(confirmed.ok).toBe(true)
    expect(fake.remove).toHaveBeenLastCalledWith('server-a', ['b'], true)
  })

  it('previews user-provided torrent sources and adds them only after confirmation', async () => {
    const fake = createGateway([])
    const operations = new AgentTorrentOperations(fake.gateway)
    const magnet =
      'magnet:?xt=urn:btih:1111111111111111111111111111111111111111&dn=Codex%20Fixture'
    const torrentUrl =
      'https://example.com/releases/codex-fixture.torrent?signature=test'
    const message = `Add ${magnet} and ${torrentUrl}`

    const plan = await operations.prepareAdd(
      {
        category: 'Tests',
        savePath: '/downloads/tests',
        sources: [magnet, torrentUrl],
        startPaused: true,
      },
      [message],
      undefined,
      'Primary Server',
    )

    expect(fake.add).not.toHaveBeenCalled()
    expect(plan).toMatchObject({
      action: 'add_torrent',
      category: 'Tests',
      savePath: '/downloads/tests',
      serverName: 'Primary Server',
      startPaused: true,
      status: 'pending',
    })
    expect(plan.targets.map((target) => target.name)).toEqual([
      'Codex Fixture',
      'example.com/releases/codex-fixture.torrent',
    ])
    expect(JSON.stringify(plan)).not.toContain('signature=test')

    const first = await operations.execute(plan.id)
    const repeated = await operations.execute(plan.id)

    expect(first.ok).toBe(true)
    expect(repeated.ok).toBe(true)
    expect(fake.add).toHaveBeenCalledTimes(1)
    expect(fake.add).toHaveBeenCalledWith('server-a', [magnet, torrentUrl], {
      category: 'Tests',
      savepath: '/downloads/tests',
      stopped: true,
    })
  })

  it('skips a magnet that appears after its add plan was reviewed', async () => {
    const fake = createGateway([])
    const operations = new AgentTorrentOperations(fake.gateway)
    const hash = '2222222222222222222222222222222222222222'
    const magnet = `magnet:?xt=urn:btih:${hash}&dn=Existing`
    const plan = await operations.prepareAdd({ sources: [magnet] }, [magnet])

    fake.setCurrent([torrent(hash, 'Existing', 'stoppedDL')])
    const result = await operations.execute(plan.id)

    expect(result).toMatchObject({
      ok: true,
      plan: { status: 'succeeded', targets: [{ outcome: 'skipped' }] },
    })
    expect(fake.add).not.toHaveBeenCalled()
  })

  it('rejects unsafe rename and move inputs before reading the queue', async () => {
    const fake = createGateway([
      torrent('a', 'Show A', 'stoppedUP'),
      torrent('b', 'Show B', 'stoppedUP'),
    ])
    const operations = new AgentTorrentOperations(fake.gateway)

    await expect(
      operations.prepare({ action: 'rename_torrent', newName: '../Show A' }, [
        'a',
      ]),
    ).rejects.toThrow('Torrent name')
    await expect(
      operations.prepare(
        { action: 'move_torrent', savePath: 'relative/path' },
        ['a'],
      ),
    ).rejects.toThrow('Save path')
    await expect(
      operations.prepare({ action: 'rename_torrent', newName: 'Shared name' }, [
        'a',
        'b',
      ]),
    ).rejects.toThrow('exactly one')
    await expect(
      operations.prepare({ action: 'remove_torrent' }, ['a']),
    ).rejects.toThrow('deleteFiles')
    await expect(
      operations.prepareAdd({ sources: ['https://example.com/file.torrent'] }, [
        'No link here',
      ]),
    ).rejects.toThrow('user message')
    await expect(
      operations.prepareAdd(
        { sources: ['https://user:secret@example.com/file.torrent'] },
        ['https://user:secret@example.com/file.torrent'],
      ),
    ).rejects.toThrow('credentials')
    expect(fake.gateway.list).not.toHaveBeenCalled()
  })

  it('rejects a rename plan when the reviewed name changes', async () => {
    const fake = createGateway([torrent('a', 'Show A', 'stoppedUP')])
    const operations = new AgentTorrentOperations(fake.gateway)
    const plan = await operations.prepare(
      { action: 'rename_torrent', newName: 'Show A Renamed' },
      ['a'],
    )

    fake.setCurrent([torrent('a', 'Show A Edited Elsewhere', 'stoppedUP')])
    const result = await operations.execute(plan.id)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('changed')
    expect(fake.rename).not.toHaveBeenCalled()
  })

  it('rejects invalid limit plans before reading or changing the queue', async () => {
    const fake = createGateway([torrent('a', 'Show A', 'stalledDL')])
    const operations = new AgentTorrentOperations(fake.gateway)

    await expect(
      operations.prepare(
        { action: 'set_download_limit', limitBytesPerSecond: -2 },
        ['a'],
      ),
    ).rejects.toThrow('Speed limit')
    await expect(
      operations.prepare({ action: 'set_share_limits' }, ['a']),
    ).rejects.toThrow('at least one share limit')
    expect(fake.gateway.list).not.toHaveBeenCalled()
  })
})
