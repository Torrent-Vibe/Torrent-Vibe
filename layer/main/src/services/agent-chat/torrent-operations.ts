import { randomUUID } from 'node:crypto'

import {
  type AddTorrentOptions,
  extractMagnetMetadata,
  type TorrentFile,
  type TorrentInfo,
} from '@torrent-vibe/qb-client'
import type {
  AgentExecutePlanResult,
  AgentOperationPlan,
  AgentOperationTarget,
  AgentTorrentOperation,
} from '@torrent-vibe/shared'

import { sharedQbSessionPool } from '../../ipc/qb-session-pool'

const PLAN_TTL_MS = 10 * 60 * 1000
const MAX_ADD_SOURCES = 10
const MAX_OPERATION_TARGETS = 50
const MAX_QUERY_RESULTS = 100
const MAX_MEDIA_FILES = 120

export interface AgentTorrentSummary {
  category: string
  downloadLimitBytesPerSecond: number
  downloadSpeed: number
  eta: number
  hash: string
  name: string
  progress: number
  ratio: number
  savePath: string
  seedingTimeLimitMinutes: number
  shareRatioLimit: number
  size: number
  state: string
  tags: string[]
  uploadLimitBytesPerSecond: number
  uploadSpeed: number
}

export interface AgentTorrentFilesSummary {
  files: Array<{ path: string; progress: number; size: number }>
  total: number
}

export interface TorrentQueueGateway {
  add: (
    scopeKey: string | null,
    sources: string[],
    options: Pick<AddTorrentOptions, 'category' | 'savepath' | 'stopped'>,
  ) => Promise<void>
  addTags: (
    scopeKey: string | null,
    hashes: string[],
    tags: string[],
  ) => Promise<void>
  captureScope: (scopeId?: string | null) => string | null
  files: (scopeKey: string | null, hash: string) => Promise<TorrentFile[]>
  list: (scopeKey: string | null, hashes?: string[]) => Promise<TorrentInfo[]>
  move: (
    scopeKey: string | null,
    hashes: string[],
    savePath: string,
  ) => Promise<void>
  pause: (scopeKey: string | null, hashes: string[]) => Promise<void>
  reannounce: (scopeKey: string | null, hashes: string[]) => Promise<void>
  recheck: (scopeKey: string | null, hashes: string[]) => Promise<void>
  remove: (
    scopeKey: string | null,
    hashes: string[],
    deleteFiles: boolean,
  ) => Promise<void>
  removeTags: (
    scopeKey: string | null,
    hashes: string[],
    tags: string[],
  ) => Promise<void>
  rename: (
    scopeKey: string | null,
    hash: string,
    newName: string,
  ) => Promise<void>
  resume: (scopeKey: string | null, hashes: string[]) => Promise<void>
  setCategory: (
    scopeKey: string | null,
    hashes: string[],
    category: string,
  ) => Promise<void>
  setDownloadLimit: (
    scopeKey: string | null,
    hashes: string[],
    limitBytesPerSecond: number,
  ) => Promise<void>
  setShareLimits: (
    scopeKey: string | null,
    hashes: string[],
    shareRatioLimit?: number,
    seedingTimeLimitMinutes?: number,
  ) => Promise<void>
  setUploadLimit: (
    scopeKey: string | null,
    hashes: string[],
    limitBytesPerSecond: number,
  ) => Promise<void>
}

class QbTorrentQueueGateway implements TorrentQueueGateway {
  async add(
    scopeKey: string | null,
    sources: string[],
    options: Pick<AddTorrentOptions, 'category' | 'savepath' | 'stopped'>,
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'requestAddTorrent', [
      { ...options, urls: sources.join('\n') },
    ])
  }

  async addTags(
    scopeKey: string | null,
    hashes: string[],
    tags: string[],
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'addTorrentTags', [
      hashes,
      tags.join(','),
    ])
  }

  captureScope(scopeId?: string | null): string | null {
    if (scopeId === null) {
      return null
    }
    if (scopeId) {
      return sharedQbSessionPool.getByScopeId(scopeId)?.key ?? null
    }
    return sharedQbSessionPool.getActive()?.key ?? null
  }

  async files(scopeKey: string | null, hash: string): Promise<TorrentFile[]> {
    const session = this.getSession(scopeKey)
    return sharedQbSessionPool.invoke(session, 'requestTorrentFiles', [
      hash,
    ]) as Promise<TorrentFile[]>
  }

  private getSession(scopeKey: string | null) {
    const session = scopeKey ? sharedQbSessionPool.getByKey(scopeKey) : null
    if (!session) {
      throw new Error('No active qBittorrent server')
    }
    return session
  }

  async list(
    scopeKey: string | null,
    hashes?: string[],
  ): Promise<TorrentInfo[]> {
    const session = this.getSession(scopeKey)
    return sharedQbSessionPool.invoke(session, 'requestTorrentsInfo', [
      hashes?.length ? { hashes } : undefined,
    ]) as Promise<TorrentInfo[]>
  }

  async move(
    scopeKey: string | null,
    hashes: string[],
    savePath: string,
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'requestSetTorrentLocation', [
      hashes,
      savePath,
    ])
  }

  async pause(scopeKey: string | null, hashes: string[]): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'stopTorrent', [hashes])
  }

  async reannounce(scopeKey: string | null, hashes: string[]): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'reannounceTorrent', [hashes])
  }

  async recheck(scopeKey: string | null, hashes: string[]): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'recheckTorrent', [hashes])
  }

  async remove(
    scopeKey: string | null,
    hashes: string[],
    deleteFiles: boolean,
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'removeTorrent', [
      hashes,
      deleteFiles,
    ])
  }

  async rename(
    scopeKey: string | null,
    hash: string,
    newName: string,
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'requestRenameTorrent', [
      hash,
      newName,
    ])
  }

  async removeTags(
    scopeKey: string | null,
    hashes: string[],
    tags: string[],
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'removeTorrentTags', [
      hashes,
      tags.join(','),
    ])
  }

  async resume(scopeKey: string | null, hashes: string[]): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'startTorrent', [hashes])
  }

  async setCategory(
    scopeKey: string | null,
    hashes: string[],
    category: string,
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'setTorrentCategory', [
      hashes,
      category,
    ])
  }

  async setDownloadLimit(
    scopeKey: string | null,
    hashes: string[],
    limitBytesPerSecond: number,
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'setTorrentDownloadLimit', [
      hashes,
      limitBytesPerSecond,
    ])
  }

  async setShareLimits(
    scopeKey: string | null,
    hashes: string[],
    shareRatioLimit?: number,
    seedingTimeLimitMinutes?: number,
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'requestSetShareLimits', [
      hashes,
      shareRatioLimit,
      seedingTimeLimitMinutes,
    ])
  }

  async setUploadLimit(
    scopeKey: string | null,
    hashes: string[],
    limitBytesPerSecond: number,
  ): Promise<void> {
    const session = this.getSession(scopeKey)
    await sharedQbSessionPool.invoke(session, 'setTorrentUploadLimit', [
      hashes,
      limitBytesPerSecond,
    ])
  }
}

const normalizeHashes = (hashes: string[]): string[] => [
  ...new Set(hashes.map((hash) => hash.trim()).filter(Boolean)),
]

const isStopped = (state: string): boolean => /^(stopped|paused)/i.test(state)

const torrentTags = (torrent: Pick<TorrentInfo, 'tags'>): string[] =>
  (torrent.tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

const sameTags = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.toSorted().every((tag, index) => tag === right.toSorted()[index])

export interface PrepareTorrentOperationInput {
  action: AgentTorrentOperation
  category?: string
  deleteFiles?: boolean
  limitBytesPerSecond?: number
  newName?: string
  savePath?: string
  seedingTimeLimitMinutes?: number
  shareRatioLimit?: number
  tags?: string[]
}

export interface PrepareAddTorrentInput {
  category?: string
  savePath?: string
  sources: string[]
  startPaused?: boolean
}

const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0)!
    return codePoint < 32 || codePoint === 127
  })

const normalizeTorrentName = (value: string | undefined): string => {
  const name = value?.trim() ?? ''
  if (
    !name ||
    name.length > 255 ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    hasControlCharacter(name)
  ) {
    throw new Error(
      'Torrent name must be 1 to 255 characters and cannot contain path separators or control characters',
    )
  }
  return name
}

const normalizeSavePath = (value: string | undefined): string => {
  const savePath = value?.trim() ?? ''
  const isAbsolute =
    savePath.startsWith('/') ||
    savePath.startsWith('\\\\') ||
    /^[A-Za-z]:[\\/]/u.test(savePath)
  if (
    !savePath ||
    savePath.length > 4096 ||
    !isAbsolute ||
    hasControlCharacter(savePath)
  ) {
    throw new Error(
      'Save path must be an absolute POSIX, Windows, or UNC path of at most 4096 characters without control characters',
    )
  }
  return savePath
}

const normalizeOptionalCategory = (value: string | undefined) => {
  const category = value?.trim()
  if (!category) {
    return undefined
  }
  if (category.length > 100 || hasControlCharacter(category)) {
    throw new Error(
      'Category must be at most 100 characters without control characters',
    )
  }
  return category
}

const normalizeOptionalSavePath = (value: string | undefined) =>
  value?.trim() ? normalizeSavePath(value) : undefined

const normalizeAddSources = (
  values: string[],
  userMessages: string[],
): string[] => {
  const sources = [...new Set(values.map((value) => value.trim()))]
  if (sources.length === 0 || sources.length > MAX_ADD_SOURCES) {
    throw new Error(`Provide 1 to ${MAX_ADD_SOURCES} torrent sources`)
  }

  for (const source of sources) {
    if (
      source.length > 4096 ||
      hasControlCharacter(source) ||
      !userMessages.some((message) => message.includes(source))
    ) {
      throw new Error(
        'Torrent sources must be copied exactly from a user message and contain no control characters',
      )
    }

    let parsed: URL
    try {
      parsed = new URL(source)
    } catch {
      throw new Error('Torrent sources must be magnet, HTTP, or HTTPS URLs')
    }

    if (parsed.protocol === 'magnet:') {
      if (!extractMagnetMetadata(source)) {
        throw new Error('Magnet sources require a valid BitTorrent info hash')
      }
    } else if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error(
        'Torrent URLs must use HTTP or HTTPS and cannot contain credentials',
      )
    }
  }

  return sources
}

const addSourceTarget = (
  source: string,
  index: number,
): AgentOperationTarget => {
  const magnet = extractMagnetMetadata(source)
  if (magnet) {
    const displayName = magnet.displayName?.trim().slice(0, 160)
    return {
      hash: magnet.infoHash,
      name:
        displayName && !hasControlCharacter(displayName)
          ? displayName
          : `Magnet ${magnet.infoHash.slice(0, 12)}`,
      outcome: 'pending',
      state: 'not_added',
    }
  }

  const url = new URL(source)
  return {
    hash: `url:${index}`,
    name: `${url.hostname}${url.pathname}`.slice(0, 160),
    outcome: 'pending',
    state: 'not_added',
  }
}

const normalizeSpeedLimit = (value: number | undefined): number => {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      'Speed limit must be a non-negative integer in bytes per second; use 0 for unlimited',
    )
  }
  return value
}

const normalizeShareRatioLimit = (value: number | undefined): number => {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    (value !== -2 && value !== -1 && value < 0)
  ) {
    throw new Error(
      'Share ratio limit must be -2 for global, -1 for unlimited, or a non-negative number',
    )
  }
  return value
}

const normalizeSeedingTimeLimit = (value: number | undefined): number => {
  if (
    value === undefined ||
    !Number.isSafeInteger(value) ||
    (value !== -2 && value !== -1 && value < 0)
  ) {
    throw new Error(
      'Seeding time limit must be -2 for global, -1 for unlimited, or a non-negative integer in minutes',
    )
  }
  return value
}

const normalizeOperation = (
  input: PrepareTorrentOperationInput,
): PrepareTorrentOperationInput => {
  if (input.action === 'remove_torrent') {
    if (typeof input.deleteFiles !== 'boolean') {
      throw new Error('Remove plans require an explicit deleteFiles choice')
    }
    return { action: input.action, deleteFiles: input.deleteFiles }
  }
  if (input.action === 'rename_torrent') {
    return {
      action: input.action,
      newName: normalizeTorrentName(input.newName),
    }
  }
  if (input.action === 'move_torrent') {
    return {
      action: input.action,
      savePath: normalizeSavePath(input.savePath),
    }
  }
  if (input.action === 'set_category') {
    const category = input.category?.trim()
    if (!category || category.length > 100) {
      throw new Error('Category must be between 1 and 100 characters')
    }
    return { action: input.action, category }
  }
  if (input.action === 'add_tags' || input.action === 'remove_tags') {
    const tags = [...new Set((input.tags ?? []).map((tag) => tag.trim()))]
    if (
      tags.length === 0 ||
      tags.length > 20 ||
      tags.some((tag) => !tag || tag.length > 100 || tag.includes(','))
    ) {
      throw new Error(
        'Provide 1 to 20 tags; each tag must be at most 100 characters and cannot contain commas',
      )
    }
    return { action: input.action, tags }
  }
  if (
    input.action === 'set_download_limit' ||
    input.action === 'set_upload_limit'
  ) {
    return {
      action: input.action,
      limitBytesPerSecond: normalizeSpeedLimit(input.limitBytesPerSecond),
    }
  }
  if (input.action === 'set_share_limits') {
    if (
      input.shareRatioLimit === undefined &&
      input.seedingTimeLimitMinutes === undefined
    ) {
      throw new Error('Provide at least one share limit')
    }
    return {
      action: input.action,
      ...(input.shareRatioLimit === undefined
        ? {}
        : {
            shareRatioLimit: normalizeShareRatioLimit(input.shareRatioLimit),
          }),
      ...(input.seedingTimeLimitMinutes === undefined
        ? {}
        : {
            seedingTimeLimitMinutes: normalizeSeedingTimeLimit(
              input.seedingTimeLimitMinutes,
            ),
          }),
    }
  }
  return { action: input.action }
}

const isChecking = (state: string): boolean =>
  /^(checking|queuedforchecking)/i.test(state)

const needsAction = (
  torrent: TorrentInfo,
  operation: PrepareTorrentOperationInput,
): boolean => {
  if (operation.action === 'pause' || operation.action === 'resume') {
    return operation.action === 'resume'
      ? isStopped(torrent.state)
      : !isStopped(torrent.state)
  }
  if (operation.action === 'rename_torrent') {
    return torrent.name !== operation.newName
  }
  if (operation.action === 'move_torrent') {
    return torrent.save_path !== operation.savePath
  }
  if (operation.action === 'remove_torrent') {
    return true
  }
  if (operation.action === 'set_category') {
    return torrent.category !== operation.category
  }
  if (operation.action === 'set_download_limit') {
    return torrent.dl_limit !== operation.limitBytesPerSecond
  }
  if (operation.action === 'set_upload_limit') {
    return torrent.up_limit !== operation.limitBytesPerSecond
  }
  if (operation.action === 'set_share_limits') {
    return (
      (operation.shareRatioLimit !== undefined &&
        torrent.ratio_limit !== operation.shareRatioLimit) ||
      (operation.seedingTimeLimitMinutes !== undefined &&
        torrent.seeding_time_limit !== operation.seedingTimeLimitMinutes)
    )
  }
  if (operation.action === 'recheck') {
    return !isChecking(torrent.state)
  }
  if (operation.action === 'reannounce') {
    return true
  }
  const currentTags = new Set(torrentTags(torrent))
  return operation.action === 'add_tags'
    ? operation.tags!.some((tag) => !currentTags.has(tag))
    : operation.tags!.some((tag) => currentTags.has(tag))
}

export const projectTorrent = (torrent: TorrentInfo): AgentTorrentSummary => ({
  category: torrent.category || '',
  downloadLimitBytesPerSecond: torrent.dl_limit,
  downloadSpeed: torrent.dlspeed || 0,
  eta: torrent.eta,
  hash: torrent.hash,
  name: torrent.name,
  progress: torrent.progress,
  ratio: torrent.ratio,
  savePath: torrent.save_path,
  seedingTimeLimitMinutes: torrent.seeding_time_limit,
  shareRatioLimit: torrent.ratio_limit,
  size: torrent.size,
  state: torrent.state,
  tags: torrentTags(torrent),
  uploadLimitBytesPerSecond: torrent.up_limit,
  uploadSpeed: torrent.upspeed || 0,
})

export class AgentTorrentOperations {
  private readonly plans = new Map<
    string,
    {
      addSources?: string[]
      plan: AgentOperationPlan
      scopeKey: string | null
    }
  >()

  constructor(
    private readonly gateway: TorrentQueueGateway = new QbTorrentQueueGateway(),
  ) {}

  captureScope(scopeId?: string | null): string | null {
    return this.gateway.captureScope(scopeId)
  }

  async query(
    input: {
      completedOnly?: boolean
      hashes?: string[]
      limit?: number
      offset?: number
      query?: string
      states?: string[]
    },
    scopeKey = this.captureScope(),
  ): Promise<AgentTorrentSummary[]> {
    const hashes = normalizeHashes(input.hashes ?? [])
    const torrents = await this.gateway.list(
      scopeKey,
      hashes.length ? hashes : undefined,
    )
    const query = input.query?.trim().toLocaleLowerCase()
    const states = new Set(
      (input.states ?? []).map((state) => state.trim().toLocaleLowerCase()),
    )
    const limit = Math.min(
      Math.max(1, Math.floor(input.limit ?? 30)),
      MAX_QUERY_RESULTS,
    )
    const offset = Math.max(0, Math.floor(input.offset ?? 0))

    return torrents
      .filter((torrent) => {
        if (input.completedOnly && torrent.progress < 1) {
          return false
        }
        if (query) {
          const haystack =
            `${torrent.name} ${torrent.category} ${torrent.tags}`.toLocaleLowerCase()
          if (!haystack.includes(query)) {
            return false
          }
        }
        return (
          states.size === 0 || states.has(torrent.state.toLocaleLowerCase())
        )
      })
      .toSorted((left, right) => right.completion_on - left.completion_on)
      .slice(offset, offset + limit)
      .map(projectTorrent)
  }

  async files(
    hash: string,
    scopeKey = this.captureScope(),
  ): Promise<AgentTorrentFilesSummary> {
    const files = await this.gateway.files(scopeKey, hash)
    return {
      files: files.slice(0, MAX_MEDIA_FILES).map((file) => ({
        path: file.name,
        progress: file.progress,
        size: file.size,
      })),
      total: files.length,
    }
  }

  async prepare(
    operationInput: PrepareTorrentOperationInput,
    requestedHashes: string[],
    scopeKey = this.captureScope(),
  ): Promise<AgentOperationPlan> {
    this.expirePlans()
    const operation = normalizeOperation(operationInput)
    const hashes = normalizeHashes(requestedHashes)
    if (hashes.length === 0) {
      throw new Error('No torrent targets were provided')
    }
    if (hashes.length > MAX_OPERATION_TARGETS) {
      throw new Error(
        `A single operation plan supports at most ${MAX_OPERATION_TARGETS} torrents`,
      )
    }
    if (operation.action === 'rename_torrent' && hashes.length !== 1) {
      throw new Error('Rename plans require exactly one torrent target')
    }

    const torrents = await this.gateway.list(scopeKey, hashes)
    const torrentsByHash = new Map(
      torrents.map((torrent) => [torrent.hash.toLocaleLowerCase(), torrent]),
    )
    const missing = hashes.filter(
      (hash) => !torrentsByHash.has(hash.toLocaleLowerCase()),
    )
    if (missing.length > 0) {
      throw new Error(`${missing.length} torrent target(s) no longer exist`)
    }

    const targets: AgentOperationTarget[] = hashes.map((hash) => {
      const torrent = torrentsByHash.get(hash.toLocaleLowerCase())!
      return {
        category: torrent.category || '',
        downloadLimitBytesPerSecond: torrent.dl_limit,
        hash: torrent.hash,
        name: torrent.name,
        outcome: needsAction(torrent, operation) ? 'pending' : 'skipped',
        savePath: torrent.save_path,
        seedingTimeLimitMinutes: torrent.seeding_time_limit,
        shareRatioLimit: torrent.ratio_limit,
        state: torrent.state,
        tags: torrentTags(torrent),
        uploadLimitBytesPerSecond: torrent.up_limit,
      }
    })
    if (!targets.some((target) => target.outcome === 'pending')) {
      throw new Error('The selected torrents already match this change')
    }

    const now = Date.now()
    const plan: AgentOperationPlan = {
      action: operation.action,
      ...(operation.category ? { category: operation.category } : {}),
      createdAt: now,
      ...(operation.deleteFiles === undefined
        ? {}
        : { deleteFiles: operation.deleteFiles }),
      expiresAt: now + PLAN_TTL_MS,
      id: randomUUID(),
      ...(operation.limitBytesPerSecond === undefined
        ? {}
        : { limitBytesPerSecond: operation.limitBytesPerSecond }),
      ...(operation.newName ? { newName: operation.newName } : {}),
      ...(operation.savePath ? { savePath: operation.savePath } : {}),
      ...(operation.seedingTimeLimitMinutes === undefined
        ? {}
        : {
            seedingTimeLimitMinutes: operation.seedingTimeLimitMinutes,
          }),
      ...(operation.shareRatioLimit === undefined
        ? {}
        : { shareRatioLimit: operation.shareRatioLimit }),
      status: 'pending',
      ...(operation.tags ? { tags: operation.tags } : {}),
      targets,
    }
    this.plans.set(plan.id, { plan, scopeKey })
    return structuredClone(plan)
  }

  async prepareAdd(
    input: PrepareAddTorrentInput,
    userMessages: string[],
    scopeKey = this.captureScope(),
    serverName?: string | null,
  ): Promise<AgentOperationPlan> {
    this.expirePlans()
    const sources = normalizeAddSources(input.sources, userMessages)
    const category = normalizeOptionalCategory(input.category)
    const savePath = normalizeOptionalSavePath(input.savePath)
    const startPaused = input.startPaused === true
    const targets = sources.map(addSourceTarget)
    const magnetHashes = targets
      .map((target) => target.hash)
      .filter((hash) => !hash.startsWith('url:'))

    if (magnetHashes.length > 0) {
      const existing = await this.gateway.list(scopeKey, magnetHashes)
      const existingHashes = new Set(
        existing.map((torrent) => torrent.hash.toLocaleLowerCase()),
      )
      for (const target of targets) {
        if (existingHashes.has(target.hash.toLocaleLowerCase())) {
          target.outcome = 'skipped'
        }
      }
    }
    if (!targets.some((target) => target.outcome === 'pending')) {
      throw new Error('The provided magnets already exist in the queue')
    }

    const now = Date.now()
    const plan: AgentOperationPlan = {
      action: 'add_torrent',
      ...(category ? { category } : {}),
      createdAt: now,
      expiresAt: now + PLAN_TTL_MS,
      id: randomUUID(),
      ...(savePath ? { savePath } : {}),
      ...(serverName ? { serverName } : {}),
      startPaused,
      status: 'pending',
      targets,
    }
    this.plans.set(plan.id, { addSources: sources, plan, scopeKey })
    return structuredClone(plan)
  }

  getPlan(planId: string): AgentOperationPlan | null {
    this.expirePlans()
    const stored = this.plans.get(planId)
    return stored ? structuredClone(stored.plan) : null
  }

  async execute(
    planId: string,
    destructiveConfirmed = false,
  ): Promise<AgentExecutePlanResult> {
    this.expirePlans()
    const stored = this.plans.get(planId)
    if (!stored) {
      return { ok: false, plan: null, error: 'Operation plan not found' }
    }
    const { plan, scopeKey } = stored
    if (plan.status === 'succeeded') {
      return { ok: true, plan: structuredClone(plan) }
    }
    if (plan.status !== 'pending') {
      return {
        ok: false,
        plan: structuredClone(plan),
        error: plan.error || `Operation plan is ${plan.status}`,
      }
    }
    if (
      plan.action === 'remove_torrent' &&
      plan.deleteFiles &&
      !destructiveConfirmed
    ) {
      return {
        ok: false,
        plan: structuredClone(plan),
        error: 'Final confirmation is required before deleting files',
      }
    }
    if (plan.action === 'add_torrent') {
      const addSources = stored.addSources
      if (!addSources || addSources.length !== plan.targets.length) {
        plan.status = 'failed'
        plan.error = 'Torrent sources are unavailable'
        return { ok: false, plan: structuredClone(plan), error: plan.error }
      }

      const pendingMagnetHashes = plan.targets
        .filter(
          (target) =>
            target.outcome === 'pending' && !target.hash.startsWith('url:'),
        )
        .map((target) => target.hash)
      if (pendingMagnetHashes.length > 0) {
        try {
          const existing = await this.gateway.list(
            scopeKey,
            pendingMagnetHashes,
          )
          const existingHashes = new Set(
            existing.map((torrent) => torrent.hash.toLocaleLowerCase()),
          )
          for (const target of plan.targets) {
            if (existingHashes.has(target.hash.toLocaleLowerCase())) {
              target.outcome = 'skipped'
            }
          }
        } catch (error) {
          plan.status = 'failed'
          plan.error = error instanceof Error ? error.message : String(error)
          for (const target of plan.targets) {
            if (target.outcome === 'pending') {
              target.outcome = 'failed'
              target.error = plan.error
            }
          }
          return { ok: false, plan: structuredClone(plan), error: plan.error }
        }
      }

      const pendingSources = addSources.filter(
        (_, index) => plan.targets[index]?.outcome === 'pending',
      )
      if (pendingSources.length === 0) {
        plan.status = 'succeeded'
        return { ok: true, plan: structuredClone(plan) }
      }

      plan.status = 'executing'
      try {
        await this.gateway.add(scopeKey, pendingSources, {
          ...(plan.category ? { category: plan.category } : {}),
          ...(plan.savePath ? { savepath: plan.savePath } : {}),
          stopped: plan.startPaused === true,
        })
        for (const target of plan.targets) {
          if (target.outcome === 'pending') {
            target.outcome = 'changed'
          }
        }
        plan.status = 'succeeded'
        return { ok: true, plan: structuredClone(plan) }
      } catch (error) {
        plan.status = 'failed'
        plan.error = error instanceof Error ? error.message : String(error)
        for (const target of plan.targets) {
          if (target.outcome === 'pending') {
            target.outcome = 'failed'
            target.error = plan.error
          }
        }
        return { ok: false, plan: structuredClone(plan), error: plan.error }
      }
    }

    const pendingTargets = plan.targets.filter(
      (target) => target.outcome === 'pending',
    )
    let current: TorrentInfo[]
    try {
      current = await this.gateway.list(
        scopeKey,
        plan.targets.map((target) => target.hash),
      )
    } catch (error) {
      plan.status = 'failed'
      plan.error = error instanceof Error ? error.message : String(error)
      for (const target of pendingTargets) {
        target.outcome = 'failed'
        target.error = plan.error
      }
      return { ok: false, plan: structuredClone(plan), error: plan.error }
    }
    const currentByHash = new Map(
      current.map((torrent) => [torrent.hash.toLocaleLowerCase(), torrent]),
    )
    const drifted = plan.targets.filter((target) => {
      const torrent = currentByHash.get(target.hash.toLocaleLowerCase())
      if (!torrent) {
        return true
      }
      if (plan.action === 'pause' || plan.action === 'resume') {
        return torrent.state !== target.state
      }
      if (plan.action === 'rename_torrent') {
        return torrent.name !== target.name
      }
      if (plan.action === 'move_torrent') {
        return torrent.save_path !== target.savePath
      }
      if (plan.action === 'remove_torrent') {
        return torrent.save_path !== target.savePath
      }
      if (plan.action === 'set_category') {
        return (torrent.category || '') !== target.category
      }
      if (plan.action === 'set_download_limit') {
        return torrent.dl_limit !== target.downloadLimitBytesPerSecond
      }
      if (plan.action === 'set_upload_limit') {
        return torrent.up_limit !== target.uploadLimitBytesPerSecond
      }
      if (plan.action === 'set_share_limits') {
        return (
          torrent.ratio_limit !== target.shareRatioLimit ||
          torrent.seeding_time_limit !== target.seedingTimeLimitMinutes
        )
      }
      if (plan.action === 'recheck' || plan.action === 'reannounce') {
        return torrent.state !== target.state
      }
      return !sameTags(torrentTags(torrent), target.tags ?? [])
    })
    if (drifted.length > 0) {
      plan.status = 'failed'
      plan.error = `${drifted.length} target(s) changed since this plan was created`
      const driftedHashes = new Set(drifted.map((target) => target.hash))
      for (const target of plan.targets) {
        if (driftedHashes.has(target.hash)) {
          target.outcome = 'failed'
          target.error = 'Target changed since this plan was created'
        } else if (target.outcome === 'pending') {
          target.outcome = 'skipped'
          target.error = 'Skipped because this plan became stale'
        }
      }
      return { ok: false, plan: structuredClone(plan), error: plan.error }
    }

    plan.status = 'executing'
    if (plan.action === 'pause' || plan.action === 'resume') {
      const hashes = pendingTargets.map((target) => target.hash)
      try {
        if (plan.action === 'pause') {
          await this.gateway.pause(scopeKey, hashes)
        } else {
          await this.gateway.resume(scopeKey, hashes)
        }
        for (const target of pendingTargets) {
          target.outcome = 'changed'
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        for (const target of pendingTargets) {
          target.outcome = 'failed'
          target.error = message
        }
      }
    } else {
      for (const target of pendingTargets) {
        try {
          if (plan.action === 'set_category') {
            await this.gateway.setCategory(
              scopeKey,
              [target.hash],
              plan.category!,
            )
          } else if (plan.action === 'add_tags') {
            await this.gateway.addTags(scopeKey, [target.hash], plan.tags!)
          } else if (plan.action === 'remove_tags') {
            await this.gateway.removeTags(scopeKey, [target.hash], plan.tags!)
          } else if (plan.action === 'set_download_limit') {
            await this.gateway.setDownloadLimit(
              scopeKey,
              [target.hash],
              plan.limitBytesPerSecond!,
            )
          } else if (plan.action === 'set_upload_limit') {
            await this.gateway.setUploadLimit(
              scopeKey,
              [target.hash],
              plan.limitBytesPerSecond!,
            )
          } else if (plan.action === 'set_share_limits') {
            await this.gateway.setShareLimits(
              scopeKey,
              [target.hash],
              plan.shareRatioLimit,
              plan.seedingTimeLimitMinutes,
            )
          } else if (plan.action === 'rename_torrent') {
            await this.gateway.rename(scopeKey, target.hash, plan.newName!)
          } else if (plan.action === 'move_torrent') {
            await this.gateway.move(scopeKey, [target.hash], plan.savePath!)
          } else if (plan.action === 'remove_torrent') {
            await this.gateway.remove(
              scopeKey,
              [target.hash],
              plan.deleteFiles!,
            )
          } else if (plan.action === 'recheck') {
            await this.gateway.recheck(scopeKey, [target.hash])
          } else {
            await this.gateway.reannounce(scopeKey, [target.hash])
          }
          target.outcome = 'changed'
        } catch (error) {
          target.outcome = 'failed'
          target.error = error instanceof Error ? error.message : String(error)
        }
      }
    }

    const changedCount = plan.targets.filter(
      (target) => target.outcome === 'changed',
    ).length
    const failedCount = plan.targets.filter(
      (target) => target.outcome === 'failed',
    ).length
    if (failedCount === 0) {
      plan.status = 'succeeded'
      return { ok: true, plan: structuredClone(plan) }
    }

    plan.status = changedCount > 0 ? 'partially_failed' : 'failed'
    plan.error = `${failedCount} target(s) failed`
    return {
      ok: false,
      plan: structuredClone(plan),
      error: plan.error,
    }
  }

  private expirePlans(): void {
    const now = Date.now()
    for (const { plan } of this.plans.values()) {
      if (plan.status === 'pending' && plan.expiresAt <= now) {
        plan.status = 'expired'
      }
    }
  }
}

export const agentTorrentOperations = new AgentTorrentOperations()
