import type { HelperReplica } from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'
import { parseBangumiRss, parseMikanTitle } from '@torrent-vibe/mikan'

import { DEFAULT_POLL_INTERVAL_MS } from './config'
import type { QbClient, QbTorrent } from './qb'
import { extractTorrentInfohash } from './qb'
import { formatEpisodeName, formatSavePath, planEpisodeRenames } from './rename'
import type { HelperEpisode, ReplicaStore } from './store'
import { episodeKey } from './store'

export { DEFAULT_POLL_INTERVAL_MS }
export const BANGUMI_CATEGORY = 'Bangumi'

export function mikanTag(subscriptionId: string): string {
  return `tv-mikan:${subscriptionId}`
}

export interface LoopClock {
  now: () => number
  setInterval: (handler: () => void, ms: number) => () => void
}

export interface LoopDeps {
  store: ReplicaStore
  fetchRss: (url: string) => Promise<string>
  qb: QbClient
  libraryRoot: string
  clock?: LoopClock
  pollIntervalMs?: number
}

export interface BackfillInput {
  bangumiId: string
  subgroupId: string
  episodes: RssEpisode[]
}

const workQueues = new WeakMap<
  object,
  <T>(fn: () => Promise<T>) => Promise<T>
>()

export async function tick(deps: LoopDeps): Promise<void> {
  return enqueue(deps.store, () => runTick(deps))
}

export async function backfill(
  deps: Pick<LoopDeps, 'store' | 'qb' | 'libraryRoot'>,
  input: BackfillInput,
): Promise<{ episodes: HelperEpisode[] }> {
  return enqueue(deps.store, () => runBackfill(deps, input))
}

export function startLoop(deps: LoopDeps): { stop: () => void } {
  const interval = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  let stopped = false

  const run = () => {
    if (!stopped) {
      void tick(deps).catch(() => {})
    }
  }

  run()
  const cancel
    = deps.clock?.setInterval(run, interval) ?? defaultInterval(run, interval)

  return {
    stop() {
      stopped = true
      cancel()
    },
  }
}

async function runTick(deps: LoopDeps): Promise<void> {
  const replicas = await deps.store.load()
  const maps = await deps.store.loadEpisodes()
  const torrents = await deps.qb.listTorrents()
  const presentHashes = hashesOf(torrents)

  for (const replica of replicas) {
    const key = episodeKey(replica.bangumiId, replica.subgroupId)
    let incoming: RssEpisode[] = []
    try {
      incoming = parseBangumiRss(
        await deps.fetchRss(replica.rssUrl),
        rssBase(replica.rssUrl),
      )
    }
    catch {
      incoming = []
    }
    maps[key] = await ingestEpisodes(
      deps,
      replica,
      incoming,
      maps[key] ?? [],
      presentHashes,
    )
  }

  for (const [key, episodes] of Object.entries(maps)) {
    const replica = replicas.find(
      item => episodeKey(item.bangumiId, item.subgroupId) === key,
    )
    maps[key] = await syncCompleted(
      deps,
      replica ?? contextFromMap(key, episodes),
      episodes,
      torrents,
    )
  }

  await deps.store.saveEpisodes(maps)
}

async function runBackfill(
  deps: Pick<LoopDeps, 'store' | 'qb' | 'libraryRoot'>,
  input: BackfillInput,
): Promise<{ episodes: HelperEpisode[] }> {
  const replicas = await deps.store.load()
  const replica = replicas.find(
    item =>
      item.bangumiId === input.bangumiId
      && item.subgroupId === input.subgroupId,
  )
  const key = episodeKey(input.bangumiId, input.subgroupId)
  const ctx = replica ?? syntheticReplica(input)
  const maps = await deps.store.loadEpisodes()
  const torrents = await deps.qb.listTorrents()
  let next = await ingestEpisodes(
    deps,
    ctx,
    input.episodes,
    maps[key] ?? [],
    hashesOf(torrents),
  )
  next = await syncCompleted(deps, ctx, next, torrents)
  maps[key] = next
  await deps.store.saveEpisodes(maps)
  return { episodes: next }
}

function enqueue<T>(store: object, fn: () => Promise<T>): Promise<T> {
  let run = workQueues.get(store)
  if (!run) {
    run = createSerial()
    workQueues.set(store, run)
  }
  return run(fn)
}

function createSerial() {
  let tail: Promise<unknown> = Promise.resolve()
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const next = tail.then(fn, fn)
    tail = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}

async function ingestEpisodes(
  deps: Pick<LoopDeps, 'qb' | 'libraryRoot'>,
  replica: HelperReplica,
  incoming: RssEpisode[],
  current: HelperEpisode[],
  presentHashes: Set<string>,
): Promise<HelperEpisode[]> {
  const episodes = [...current]
  const byId = new Set(episodes.map(item => item.episodeId))
  const byHash = new Set(
    episodes.flatMap(item =>
      item.infohash ? [item.infohash.toLowerCase()] : []),
  )

  for (const item of incoming) {
    if (byId.has(item.episodeId)) {
      continue
    }
    const infohash = extractTorrentInfohash(item.torrentUrl)
    if (infohash && byHash.has(infohash)) {
      continue
    }
    if (infohash && presentHashes.has(infohash)) {
      continue
    }

    const parsed = parseMikanTitle(item.title)
    if (parsed.episode === null) {
      const record = baseEpisode(item, infohash, parsed.season, null)
      record.state = 'needs-manual'
      episodes.push(record)
      remember(byId, byHash, record)
      continue
    }

    const season = parsed.season ?? 1
    try {
      const added = await deps.qb.addTorrent({
        urls: item.torrentUrl,
        savepath: formatSavePath(deps.libraryRoot, replica.title, season),
        category: BANGUMI_CATEGORY,
        tags: mikanTag(replica.id),
        rename: formatEpisodeName(replica.title, season, parsed.episode),
      })
      const hash = added.hash.toLowerCase()
      const record = baseEpisode(item, hash, season, parsed.episode)
      record.state = 'added'
      episodes.push(record)
      remember(byId, byHash, record)
      presentHashes.add(hash)
    }
    catch (error) {
      const record = baseEpisode(item, infohash, season, parsed.episode)
      record.state = 'failed'
      record.lastError = errorMessage(error)
      episodes.push(record)
      remember(byId, byHash, record)
    }
  }

  return episodes
}

async function syncCompleted(
  deps: Pick<LoopDeps, 'qb'>,
  replica: HelperReplica,
  episodes: HelperEpisode[],
  torrents: QbTorrent[],
): Promise<HelperEpisode[]> {
  const next = [...episodes]

  for (let index = 0; index < next.length; index++) {
    const episode = next[index]!
    if (
      episode.state === 'needs-manual'
      || episode.state === 'done'
      || episode.episode === null
      || episode.season === null
    ) {
      continue
    }

    const torrent = torrents.find(
      item =>
        episode.infohash
        && item.hash.toLowerCase() === episode.infohash.toLowerCase(),
    )
    if (!torrent) {
      continue
    }

    if (!isComplete(torrent)) {
      if (episode.state === 'added' || episode.state === 'pending') {
        next[index] = { ...episode, state: 'downloading' }
      }
      continue
    }

    try {
      const files = await deps.qb.listFiles(torrent.hash)
      if (files.length === 0) {
        continue
      }
      const plans = planEpisodeRenames({
        displayName: formatEpisodeName(
          replica.title,
          episode.season,
          episode.episode,
        ),
        files,
      })
      for (const plan of plans) {
        await deps.qb.renameFile(torrent.hash, plan.from, plan.to)
      }
      next[index] = {
        episodeId: episode.episodeId,
        infohash: episode.infohash,
        title: episode.title,
        season: episode.season,
        episode: episode.episode,
        state: 'done',
      }
    }
    catch (error) {
      next[index] = {
        ...episode,
        state: 'failed',
        lastError: errorMessage(error),
      }
    }
  }

  return next
}

function baseEpisode(
  item: RssEpisode,
  infohash: string | undefined,
  season: number | null,
  episode: number | null,
): HelperEpisode {
  const record: HelperEpisode = {
    episodeId: item.episodeId,
    title: item.title,
    season,
    episode,
    state: 'pending',
  }
  if (infohash) {
    record.infohash = infohash
  }
  return record
}

function remember(
  byId: Set<string>,
  byHash: Set<string>,
  record: HelperEpisode,
) {
  byId.add(record.episodeId)
  if (record.infohash) {
    byHash.add(record.infohash.toLowerCase())
  }
}

function hashesOf(torrents: QbTorrent[]): Set<string> {
  return new Set(torrents.map(item => item.hash.toLowerCase()))
}

function isComplete(torrent: QbTorrent): boolean {
  if (torrent.progress >= 1) {
    return true
  }
  return /^(?:uploading|pausedUP|stoppedUP|stalledUP|queuedUP|forcedUP|checkingUP)$/.test(
    torrent.state,
  )
}

function syntheticReplica(input: BackfillInput): HelperReplica {
  return contextFromMap(
    episodeKey(input.bangumiId, input.subgroupId),
    input.episodes.map(item => ({
      episodeId: item.episodeId,
      title: item.title,
      season: null,
      episode: null,
      state: 'pending',
    })),
  )
}

function contextFromMap(
  key: string,
  episodes: Array<{ title: string }>,
): HelperReplica {
  const sep = key.indexOf(':')
  const bangumiId = sep === -1 ? key : key.slice(0, sep)
  const subgroupId = sep === -1 ? '' : key.slice(sep + 1)
  const title
    = episodes.map(item => parseMikanTitle(item.title).title).find(Boolean)
      || bangumiId
  return {
    id: key,
    bangumiId,
    title,
    subgroupId,
    subgroupName: '',
    rssUrl: '',
  }
}

function rssBase(rssUrl: string): string {
  try {
    return new URL(rssUrl).origin
  }
  catch {
    return rssUrl
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function defaultInterval(handler: () => void, ms: number): () => void {
  const id = setInterval(handler, ms)
  return () => clearInterval(id)
}
