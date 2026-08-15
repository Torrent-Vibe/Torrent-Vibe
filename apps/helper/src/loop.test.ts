import type { HelperReplica } from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'
import { describe, expect, it, vi } from 'vitest'

import { backfill, DEFAULT_POLL_INTERVAL_MS, startLoop, tick } from './loop'
import type { AddTorrentRequest, QbClient, QbFile, QbTorrent } from './qb'
import type { HelperEpisode, ReplicaStore } from './store'
import { episodeKey } from './store'

const MAP_KEY = episodeKey('3141', '583')

const HASH_28 = 'a15a8861ff6e0b10ce5aca24f7dcafa23d1aa25c'
const HASH_27 = '238eeb554bcd07b86335c8f8d402a69c11b15789'
const HASH_PACK = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const HASH_S2 = 'cccccccccccccccccccccccccccccccccccccccc'

function replica(
  partial: Pick<HelperReplica, 'id'> & Partial<HelperReplica> = { id: 'sub-1' },
): HelperReplica {
  return {
    bangumiId: '3141',
    title: '葬送的芙莉莲',
    subgroupId: '583',
    subgroupName: 'ANi',
    rssUrl: 'https://mikan.example/RSS/Bangumi?bangumiId=3141&subgroupid=583',
    ...partial,
  }
}

function rssItem(xml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel>${xml}</channel></rss>`
}

function rssEpisodeXml(input: { title: string, hash: string }): string {
  return `<item><title>${input.title}</title><link>https://mikan.example/Home/Episode/${input.hash}</link><enclosure type="application/x-bittorrent" url="https://mikan.example/Download/20240322/${input.hash}.torrent" /></item>`
}

function rssEpisode(input: { title: string, hash: string }): RssEpisode {
  return {
    episodeId: input.hash,
    title: input.title,
    torrentUrl: `https://mikan.example/Download/20240322/${input.hash}.torrent`,
  }
}

function memoryStore(
  initialReplicas: HelperReplica[] = [],
  initialEpisodes: Record<string, HelperEpisode[]> = {},
): ReplicaStore {
  let replicas = [...initialReplicas]
  let episodes = Object.fromEntries(
    Object.entries(initialEpisodes).map(([id, list]) => [id, [...list]]),
  )
  return {
    async load() {
      return [...replicas]
    },
    async save(next) {
      replicas = [...next]
    },
    async loadEpisodes() {
      return Object.fromEntries(
        Object.entries(episodes).map(([id, list]) => [id, [...list]]),
      )
    },
    async saveEpisodes(next) {
      episodes = Object.fromEntries(
        Object.entries(next).map(([id, list]) => [id, [...list]]),
      )
    },
  }
}

function fakeQb(initial: QbTorrent[] = []) {
  const torrents: QbTorrent[] = initial.map(item => ({ ...item }))
  const files = new Map<string, QbFile[]>()
  const added: AddTorrentRequest[] = []
  const renames: Array<{ hash: string, oldPath: string, newPath: string }> = []
  let renameError: Error | undefined

  const client: QbClient = {
    async listTorrents() {
      return torrents.map(item => ({ ...item }))
    },
    async addTorrent(request) {
      added.push(request)
      const hash
        = request.urls.match(/([a-fA-F0-9]{40})\.torrent/)?.[1]?.toLowerCase()
          ?? `hash-${added.length}`
      torrents.push({
        hash,
        name: request.rename,
        progress: 0,
        state: 'downloading',
        category: request.category,
        tags: request.tags,
      })
      return { hash }
    },
    async listFiles(hash) {
      return (files.get(hash.toLowerCase()) ?? []).map(file => ({ ...file }))
    },
    async renameFile(hash, oldPath, newPath) {
      if (renameError) {
        throw renameError
      }
      renames.push({ hash: hash.toLowerCase(), oldPath, newPath })
      const list = files.get(hash.toLowerCase()) ?? []
      const file = list.find(item => item.name === oldPath)
      if (file) {
        file.name = newPath
      }
    },
  }

  return {
    client,
    added,
    renames,
    torrents,
    setFiles(hash: string, next: QbFile[]) {
      files.set(
        hash.toLowerCase(),
        next.map(file => ({ ...file })),
      )
    },
    complete(hash: string) {
      const torrent = torrents.find(
        item => item.hash.toLowerCase() === hash.toLowerCase(),
      )
      if (torrent) {
        torrent.progress = 1
        torrent.state = 'uploading'
      }
    },
    failRename(error = new Error('rename failed')) {
      renameError = error
    },
    allowRename() {
      renameError = undefined
    },
  }
}

async function episodesOf(store: ReplicaStore, id = MAP_KEY) {
  return (await store.loadEpisodes())[id] ?? []
}

describe('helper loop', () => {
  it('adds a new RSS episode with category, tag, season path, and display name', async () => {
    const store = memoryStore([replica()])
    const qb = fakeQb()
    await tick({
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () =>
        rssItem(
          rssEpisodeXml({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        ),
    })

    expect(qb.added).toEqual([
      {
        urls: `https://mikan.example/Download/20240322/${HASH_28}.torrent`,
        savepath: '/library/葬送的芙莉莲/Season 01',
        category: 'Bangumi',
        tags: 'tv-mikan:sub-1',
        rename: '葬送的芙莉莲 - S01E28',
      },
    ])
    expect(await episodesOf(store)).toEqual([
      {
        episodeId: HASH_28,
        infohash: HASH_28,
        title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
        season: 1,
        episode: 28,
        state: 'added',
      },
    ])
  })

  it('skips an episodeId already in the replica map', async () => {
    const store = memoryStore([replica()])
    const qb = fakeQb()
    const deps = {
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () =>
        rssItem(
          rssEpisodeXml({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        ),
    }

    await tick(deps)
    await tick(deps)

    expect(qb.added).toHaveLength(1)
    expect(await episodesOf(store)).toHaveLength(1)
  })

  it('skips when the infohash is already in the replica map', async () => {
    const store = memoryStore([replica()], {
      [MAP_KEY]: [
        {
          episodeId: 'other-episode',
          infohash: HASH_28,
          title: 'already tracked',
          season: 1,
          episode: 1,
          state: 'done',
        },
      ],
    })
    const qb = fakeQb()
    await tick({
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () =>
        rssItem(
          rssEpisodeXml({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        ),
    })

    expect(qb.added).toHaveLength(0)
    expect(await episodesOf(store)).toHaveLength(1)
  })

  it('skips when the infohash is already in qBit', async () => {
    const store = memoryStore([replica()])
    const qb = fakeQb([
      {
        hash: HASH_28,
        name: 'manual import',
        progress: 1,
        state: 'uploading',
      },
    ])
    await tick({
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () =>
        rssItem(
          rssEpisodeXml({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        ),
    })

    expect(qb.added).toHaveLength(0)
    expect(await episodesOf(store)).toEqual([])
  })

  it('marks needs-manual and does not add when the episode number is missing', async () => {
    const store = memoryStore([replica()])
    const qb = fakeQb()
    await tick({
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () =>
        rssItem(
          rssEpisodeXml({
            title:
              '[喵萌奶茶屋&LoliHouse] 葬送的芙莉莲 / Sousou no Frieren [01-28 修正合集][WebRip 1080p HEVC-10bit AAC][简繁日内封字幕][Fin]',
            hash: HASH_PACK,
          }),
        ),
    })

    expect(qb.added).toHaveLength(0)
    expect(await episodesOf(store)).toEqual([
      {
        episodeId: HASH_PACK,
        infohash: HASH_PACK,
        title:
          '[喵萌奶茶屋&LoliHouse] 葬送的芙莉莲 / Sousou no Frieren [01-28 修正合集][WebRip 1080p HEVC-10bit AAC][简繁日内封字幕][Fin]',
        season: null,
        episode: null,
        state: 'needs-manual',
      },
    ])
  })

  it('uses the parsed season when the title includes SxxExx', async () => {
    const store = memoryStore([replica({ id: 'sub-2', title: 'Example Show' })])
    const qb = fakeQb()
    await tick({
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () =>
        rssItem(
          rssEpisodeXml({
            title: '[LoliHouse] Example Show S02E07 [WebRip 1080p]',
            hash: HASH_S2,
          }),
        ),
    })

    expect(qb.added[0]).toMatchObject({
      savepath: '/library/Example Show/Season 02',
      rename: 'Example Show - S02E07',
    })
    expect((await episodesOf(store))[0]).toMatchObject({
      season: 2,
      episode: 7,
      state: 'added',
    })
  })

  it('renames the video and matching sub on completion and skips Sample', async () => {
    const store = memoryStore([replica()])
    const qb = fakeQb()
    qb.setFiles(HASH_28, [
      { name: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4', size: 700_000_000 },
      { name: '[ANi] 葬送的芙莉莲 - 28 [1080P].cht.ass', size: 40_000 },
      { name: 'Sample/[ANi] 葬送的芙莉莲 - 28 Sample.mp4', size: 12_000_000 },
    ])
    const deps = {
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () =>
        rssItem(
          rssEpisodeXml({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        ),
    }

    await tick(deps)
    qb.complete(HASH_28)
    await tick(deps)

    expect(qb.renames).toEqual([
      {
        hash: HASH_28,
        oldPath: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4',
        newPath: '葬送的芙莉莲 - S01E28.mp4',
      },
      {
        hash: HASH_28,
        oldPath: '[ANi] 葬送的芙莉莲 - 28 [1080P].cht.ass',
        newPath: '葬送的芙莉莲 - S01E28.cht.ass',
      },
    ])
    expect((await episodesOf(store))[0]?.state).toBe('done')
  })

  it('marks a failed rename, keeps the torrent, and retries next tick', async () => {
    const store = memoryStore([replica()])
    const qb = fakeQb()
    qb.setFiles(HASH_28, [
      { name: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4', size: 700_000_000 },
    ])
    const deps = {
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () =>
        rssItem(
          rssEpisodeXml({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        ),
    }

    await tick(deps)
    qb.complete(HASH_28)
    qb.failRename()
    await tick(deps)

    expect((await episodesOf(store))[0]).toMatchObject({
      state: 'failed',
      lastError: 'rename failed',
    })
    expect(qb.torrents).toHaveLength(1)

    qb.allowRename()
    await tick(deps)

    expect(qb.renames).toEqual([
      {
        hash: HASH_28,
        oldPath: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4',
        newPath: '葬送的芙莉莲 - S01E28.mp4',
      },
    ])
    const retried = (await episodesOf(store))[0]
    expect(retried?.state).toBe('done')
    expect(retried?.lastError).toBeUndefined()
  })

  it('backfills with the same dedupe, needs-manual, and add rules', async () => {
    const store = memoryStore([replica()], {
      [MAP_KEY]: [
        {
          episodeId: HASH_28,
          infohash: HASH_28,
          title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
          season: 1,
          episode: 28,
          state: 'done',
        },
      ],
    })
    const qb = fakeQb([
      {
        hash: HASH_27,
        name: 'manual',
        progress: 1,
        state: 'uploading',
      },
    ])

    const result = await backfill(
      { store, qb: qb.client, libraryRoot: '/library' },
      {
        bangumiId: '3141',
        subgroupId: '583',
        episodes: [
          rssEpisode({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
          rssEpisode({
            title: '[ANi] 葬送的芙莉莲 - 27 [1080P]',
            hash: HASH_27,
          }),
          rssEpisode({
            title: '[ANi] 葬送的芙莉莲 [1080P]',
            hash: HASH_PACK,
          }),
          rssEpisode({
            title: '[LoliHouse] Example Show S02E07 [WebRip 1080p]',
            hash: HASH_S2,
          }),
        ],
      },
    )

    expect(qb.added).toEqual([
      {
        urls: `https://mikan.example/Download/20240322/${HASH_S2}.torrent`,
        savepath: '/library/葬送的芙莉莲/Season 02',
        category: 'Bangumi',
        tags: 'tv-mikan:sub-1',
        rename: '葬送的芙莉莲 - S02E07',
      },
    ])
    const episodes = await episodesOf(store)
    expect(episodes.map(item => [item.episodeId, item.state])).toEqual([
      [HASH_28, 'done'],
      [HASH_PACK, 'needs-manual'],
      [HASH_S2, 'added'],
    ])
    expect(result.episodes.map(item => item.episodeId)).toEqual([
      HASH_28,
      HASH_PACK,
      HASH_S2,
    ])
  })

  it('polls immediately and then every 10 minutes by default', async () => {
    const fetchRss = vi.fn(async () => rssItem(''))
    const timers: Array<{ ms: number, fn: () => void }> = []
    const handle = startLoop({
      store: memoryStore([replica()]),
      qb: fakeQb().client,
      libraryRoot: '/library',
      fetchRss,
      clock: {
        now: () => 0,
        setInterval(handler, ms) {
          timers.push({ ms, fn: handler })
          return () => {}
        },
      },
    })

    await vi.waitFor(() => {
      expect(fetchRss).toHaveBeenCalledTimes(1)
    })
    expect(timers).toEqual([
      { ms: DEFAULT_POLL_INTERVAL_MS, fn: expect.any(Function) },
    ])
    expect(DEFAULT_POLL_INTERVAL_MS).toBe(10 * 60 * 1000)

    timers[0]!.fn()
    await vi.waitFor(() => {
      expect(fetchRss).toHaveBeenCalledTimes(2)
    })
    handle.stop()
  })

  it('renames a subscription-less backfill on a later tick', async () => {
    const store = memoryStore()
    const qb = fakeQb()
    qb.setFiles(HASH_28, [
      { name: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4', size: 700_000_000 },
    ])

    await backfill(
      { store, qb: qb.client, libraryRoot: '/library' },
      {
        bangumiId: '3141',
        subgroupId: '583',
        episodes: [
          rssEpisode({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        ],
      },
    )
    expect(await store.load()).toEqual([])
    expect(qb.added).toHaveLength(1)

    qb.complete(HASH_28)
    await tick({
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () => rssItem(''),
    })

    expect(qb.renames).toEqual([
      {
        hash: HASH_28,
        oldPath: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4',
        newPath: '葬送的芙莉莲 - S01E28.mp4',
      },
    ])
    const episodes = Object.values(await store.loadEpisodes()).flat()
    expect(episodes[0]?.state).toBe('done')
    expect(await store.load()).toEqual([])
  })

  it('renames a subscription-less backfill after a later subscribe', async () => {
    const store = memoryStore()
    const qb = fakeQb()
    qb.setFiles(HASH_28, [
      { name: '[ANi] 葬送的芙莉莲 - 28 [1080P].mp4', size: 700_000_000 },
    ])

    await backfill(
      { store, qb: qb.client, libraryRoot: '/library' },
      {
        bangumiId: '3141',
        subgroupId: '583',
        episodes: [
          rssEpisode({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        ],
      },
    )
    await store.save([replica({ id: 'real-sub' })])
    qb.complete(HASH_28)
    await tick({
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () => rssItem(''),
    })

    expect(qb.renames).toHaveLength(1)
    expect(qb.added).toHaveLength(1)
    const episodes = Object.values(await store.loadEpisodes()).flat()
    expect(episodes[0]?.state).toBe('done')
  })

  it('serializes overlapping tick and backfill so neither episode map is dropped', async () => {
    const store = memoryStore([replica()])
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const qb = fakeQb()
    const ticking = tick({
      store,
      qb: qb.client,
      libraryRoot: '/library',
      fetchRss: async () => {
        await gate
        return rssItem(
          rssEpisodeXml({
            title: '[ANi] 葬送的芙莉莲 - 28 [1080P]',
            hash: HASH_28,
          }),
        )
      },
    })
    const filling = backfill(
      { store, qb: qb.client, libraryRoot: '/library' },
      {
        bangumiId: '3141',
        subgroupId: '583',
        episodes: [
          rssEpisode({
            title: '[ANi] 葬送的芙莉莲 - 27 [1080P]',
            hash: HASH_27,
          }),
        ],
      },
    )

    release()
    await Promise.all([ticking, filling])

    const episodes = Object.values(await store.loadEpisodes()).flat()
    expect(new Set(episodes.map(item => item.episodeId))).toEqual(
      new Set([HASH_28, HASH_27]),
    )
  })
})
