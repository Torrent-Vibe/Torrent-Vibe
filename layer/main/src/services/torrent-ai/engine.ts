import { createHash, randomUUID } from 'node:crypto'

import type {
  TorrentAIEnrichmentResult,
  TorrentAIMetadata,
} from '@torrent-vibe/shared'

import { i18n } from '~/utils/i18n'

import { getLogger } from '../../config/log-config'
import { ConcurrencyGate } from '../../utils/concurrency-gate'
import { AppSettingsStore } from '../app-settings-store'
import { buildBashTool } from './agentTools/bashTool'
import { buildReadSkillTool } from './agentTools/skillTool'
import { buildSubmitMetadataTool } from './agentTools/submitMetadataTool'
import { buildTmdbTools } from './agentTools/tmdbTools'
import { buildWebSearchTool } from './agentTools/webSearchTool'
import { clamp, normalizePayloadShape } from './normalize-payload'
import { renderUserPrompt } from './prompts'
import { resolveAiProviderConfig } from './provider-config'
import type { AiProviderRuntime } from './providers'
import { getProviderById, selectProvider } from './providers'
import type { TorrentAiMetadataPayload } from './schema'
import { TorrentAiMetadataSchema } from './schema'
import { runAnalysisAgent } from './session'
import { loadSkillIndex } from './skills'
import { TmdbClient } from './tmdb-client'
import { TorrentAiDatabase } from './torrent-ai-database'
import { getAiTraceSink } from './trace'
import type {
  AnalyzeTorrentNameOptions,
  ProviderConfig,
  TorrentAiCacheKey,
  TorrentAiEngineContract,
} from './types'

const CACHE_LIMIT = 400

const analysisConcurrencyGate = new ConcurrencyGate(5)

export class TorrentAiEngine implements TorrentAiEngineContract {
  private static instance: TorrentAiEngine | null = null

  static getInstance(): TorrentAiEngine {
    if (!this.instance) {
      this.instance = new TorrentAiEngine()
    }
    return this.instance
  }

  private readonly logger = getLogger('[torrent-ai]')
  private readonly metadataStore = TorrentAiDatabase.getInstance()
  private readonly inFlight = new Map<
    TorrentAiCacheKey,
    Promise<TorrentAIEnrichmentResult>
  >()

  private readonly tmdbClient = new TmdbClient()
  private readonly appSettingsStore = AppSettingsStore.getInstance()
  private constructor() {}

  async analyzeName(
    options: AnalyzeTorrentNameOptions,
  ): Promise<TorrentAIEnrichmentResult> {
    const requestId = Math.random().toString(36).slice(7)

    this.logger.debug('Starting torrent analysis', {
      requestId,
      rawName: options.rawName,
      forceRefresh: options.forceRefresh,
      fileListLength: options.fileList?.length || 0,
    })

    const rawName = options.rawName?.trim()
    if (!rawName) {
      this.logger.warn('Analysis failed: invalid raw name', { requestId })
      return { ok: false, error: 'ai.invalidRawName', transient: false }
    }

    const config = resolveAiProviderConfig()

    const { digest: fileDigest, summary: fileTreeSummary } =
      this.prepareFileListContext(options.fileList)

    if (fileTreeSummary) {
      this.logger.debug('File context prepared', {
        requestId,
        fileDigest,
        summaryLength: fileTreeSummary.length,
      })
    }

    const selection = selectProvider(config)
    const { runtime } = selection

    if (!runtime) {
      const errorKey = selection.error ?? 'ai.providers.unavailable'
      this.logger.error('No AI provider available', {
        requestId,
        triedProviders: selection.triedProviders,
        errorKey,
      })
      return { ok: false, error: errorKey, transient: false }
    }

    const cacheKeys = this.buildCacheKeys(rawName, i18n.language, options.hash)
    const inflightKey = cacheKeys[0]

    if (!options.forceRefresh) {
      const cached = await this.readCachedMetadata(
        rawName,
        i18n.language,
        options.hash,
      )
      if (cached) {
        this.logger.debug('Cache hit, skipping analysis', {
          requestId,
          rawName,
          cacheKeys,
        })
        return {
          ok: true,
          metadata: cached.metadata,
        }
      }

      const pending = this.inFlight.get(inflightKey)
      if (pending) {
        this.logger.debug(
          'Request already in flight - returning existing promise',
          {
            requestId,
          },
        )
        return pending
      }

      this.logger.debug('Cache miss', { requestId, rawName, cacheKeys })
    } else {
      this.logger.debug('Force refresh requested - bypassing cache', {
        requestId,
      })
    }

    const execution = this.performAnalysis(
      {
        rawName,
        language: i18n.language,
        fileTreeSummary,
        hash: options.hash,
      },
      config,
      runtime,
      requestId,
    )
      .then(async (result) => {
        if (result.ok && result.metadata) {
          await this.persistMetadata(cacheKeys, result.metadata)
        }
        return result
      })
      .finally(() => {
        this.inFlight.delete(inflightKey)
      })

    this.inFlight.set(inflightKey, execution)
    return execution
  }

  async lookupCached(options: {
    rawName: string
    hash?: string
  }): Promise<TorrentAIEnrichmentResult> {
    const rawName = options.rawName?.trim()
    if (!rawName) {
      return { ok: false, error: 'ai.invalidRawName', transient: false }
    }

    const cached = await this.readCachedMetadata(
      rawName,
      i18n.language,
      options.hash,
    )
    if (!cached) {
      return { ok: false, error: 'ai.cache.miss', transient: false }
    }

    return {
      ok: true,
      metadata: cached.metadata,
    }
  }

  async clearCache() {
    await this.metadataStore.clear()
    this.inFlight.clear()
  }

  hasConfiguredProvider(): boolean {
    const config = resolveAiProviderConfig()
    const selection = selectProvider(config)
    return Boolean(selection.runtime)
  }

  private prepareFileListContext(
    fileList?: Array<{ path: string; size?: number }> | null,
  ): { digest: string | null; summary: string | null } {
    if (!fileList || fileList.length === 0) {
      return { digest: null, summary: null }
    }

    try {
      // Normalize and cap the list to avoid oversized prompts
      const MAX_ENTRIES = 120
      const entries = fileList
        .map((item) => ({
          path: String(item.path || '').trim(),
          size: item.size,
        }))
        .filter((it) => it.path)
        .slice(0, MAX_ENTRIES)

      if (entries.length === 0) {
        return { digest: null, summary: null }
      }

      // Compute a stable digest based on the full list (not just capped)
      const h = createHash('sha256')
      for (const item of fileList) {
        const p = String(item.path || '').trim()
        if (!p) {
          continue
        }
        h.update(p)
        if (typeof item.size === 'number') {
          h.update(`:${item.size}`)
        }
        h.update('\n')
      }
      const digest = h.digest('hex').slice(0, 16)

      // Build a compact human-readable summary
      const totalFiles = fileList.length
      const totalSize = fileList.reduce((acc, cur) => acc + (cur.size || 0), 0)
      const folders = new Set<string>()
      for (const e of entries) {
        const first = e.path.split('/')[0]
        if (first) {
          folders.add(first)
        }
      }
      const topFolders = Array.from(folders).slice(0, 8)

      const lines: string[] = [
        `Total files: ${totalFiles}`,
        `Total size: ${this.formatBytes(totalSize)}`,
      ]
      if (topFolders.length > 0) {
        lines.push(
          `Top-level folders (${topFolders.length}): ${topFolders.join(', ')}`,
        )
      }
      // List a few representative files
      const sampleFiles = entries
        .filter((e) => !e.path.includes('/')) // top-level files
        .slice(0, 5)
        .map((e) =>
          typeof e.size === 'number'
            ? `${e.path} (${this.formatBytes(e.size)})`
            : e.path,
        )

      if (sampleFiles.length > 0) {
        lines.push('Top-level files:', ...sampleFiles.map((s) => `- ${s}`))
      }

      // Also include a few deep files to show structure
      const deepFiles = entries
        .filter((e) => e.path.includes('/'))
        .slice(0, 10)
        .map((e) =>
          typeof e.size === 'number'
            ? `${e.path} (${this.formatBytes(e.size)})`
            : e.path,
        )
      if (deepFiles.length > 0) {
        lines.push('Sample nested files:', ...deepFiles.map((s) => `- ${s}`))
      }

      const summary = lines.join('\n')
      return { digest, summary }
    } catch {
      return { digest: null, summary: null }
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let idx = 0
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024
      idx += 1
    }
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[idx]}`
  }

  private buildCacheKeys(
    rawName: string,
    language: string,
    hash?: string | null,
  ): TorrentAiCacheKey[] {
    const keys: TorrentAiCacheKey[] = []
    const normalizedHash = hash?.trim()
    if (normalizedHash) {
      keys.push(`${language}::hash:${normalizedHash}`)
    }
    keys.push(`${language}::name:${rawName}`)
    return keys
  }

  private async readCachedMetadata(
    rawName: string,
    language: string,
    hash?: string | null,
  ) {
    const keys = this.buildCacheKeys(rawName, language, hash)
    for (const key of keys) {
      const cached = await this.metadataStore.get(key)
      if (cached) {
        return cached
      }
    }
    const legacy = await this.metadataStore.findLatestByRawName(rawName)
    if (legacy) {
      await this.persistMetadata(keys, legacy.metadata)
    }
    return legacy
  }

  private async persistMetadata(
    keys: TorrentAiCacheKey[],
    metadata: TorrentAIMetadata,
  ) {
    const value = {
      metadata,
      createdAt: Date.now(),
    }
    for (const [index, key] of keys.entries()) {
      await this.metadataStore.set(
        key,
        value,
        index === keys.length - 1 ? { limit: CACHE_LIMIT } : undefined,
      )
    }
  }

  private async performAnalysis(
    input: {
      rawName: string
      language: string
      fileTreeSummary?: string | null
      hash?: string
    },
    config: ProviderConfig,
    runtime: AiProviderRuntime,
    requestId: string,
  ): Promise<TorrentAIEnrichmentResult> {
    await analysisConcurrencyGate.acquire()
    const sessionId = randomUUID()
    const runId = sessionId.replaceAll('-', '').slice(0, 8)
    const sink = getAiTraceSink()
    const startedAt = Date.now()
    sink.emit({
      type: 'run_start',
      runId,
      ts: startedAt,
      sessionId,
      rawName: input.rawName,
      ...(input.hash ? { hash: input.hash } : {}),
      provider: runtime.id,
      model: runtime.modelId,
    })
    const finishRun = (result: TorrentAIEnrichmentResult) => {
      sink.emit({
        type: 'run_end',
        runId,
        ts: Date.now(),
        ok: result.ok,
        durationMs: Date.now() - startedAt,
        ...(result.error ? { error: result.error } : {}),
        ...(result.metadata?.mediaType
          ? { mediaType: result.metadata.mediaType }
          : {}),
        ...(result.metadata?.confidence.overall == null
          ? {}
          : { confidence: result.metadata.confidence.overall }),
      })
      return result
    }

    try {
      this.tmdbClient.setApiKey(config.tmdbApiKey)
      const skillIndex = loadSkillIndex()
      const tools = [
        buildReadSkillTool(skillIndex),
        buildBashTool(),
        buildSubmitMetadataTool(),
        ...(this.tmdbClient.isConfigured()
          ? buildTmdbTools(this.tmdbClient)
          : []),
      ]
      if (this.appSettingsStore.getSearchProvider() === 'codex') {
        const codexRuntime = getProviderById('codex')?.resolve(config) ?? null
        if (codexRuntime) {
          tools.push(
            buildWebSearchTool({
              resolveCodex: () => codexRuntime,
              sessionId,
            }),
          )
        }
      }

      const userPrompt = renderUserPrompt(input.rawName, input.fileTreeSummary)

      this.logger.debug('Prompts generated', {
        requestId,
        userPrompt,
        hasFileContext: !!input.fileTreeSummary,
      })

      const result = await runAnalysisAgent({
        runtime,
        userPrompt,
        fileTreeSummary: input.fileTreeSummary,
        tools,
        sessionId,
        runId,
      })

      this.logger.debug('AI generation result received', {
        requestId,
        provider: runtime.id,
        model: runtime.modelId,
        text: result.text,
        hasToolPayload: result.payload != null,
        errorMessage: result.errorMessage,
      })

      if (result.errorMessage && result.payload == null && !result.text) {
        return finishRun({
          ok: false,
          error: `${runtime.errorNamespace}.requestFailed`,
          transient: this.isTransientError(new Error(result.errorMessage)),
        })
      }

      const recovered = this.parseMetadataPayload(
        result.payload ?? result.text,
        input,
        runtime,
        requestId,
      )
      if (!recovered) {
        return finishRun({
          ok: false,
          error: `${runtime.errorNamespace}.unexpectedError`,
          transient: false,
        })
      }

      const metadata = recovered.ok ? recovered.metadata : null
      if (!metadata) {
        return finishRun(recovered)
      }

      this.logger.debug('Metadata mapping completed', {
        requestId,
        provider: runtime.id,
        model: runtime.modelId,
        normalizedName: metadata.normalizedName,
        mediaType: metadata.mediaType,
        confidence: metadata.confidence.overall,
        hasTmdbData: !!metadata.tmdb,
        hasKeywords: !!metadata.keywords?.length,
      })

      return finishRun({ ok: true, metadata })
    } catch (error) {
      const errorDetails = {
        requestId,
        rawName: input.rawName,
        provider: runtime.id,
        model: runtime.modelId,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      }

      this.logger.error('AI analysis failed with error', errorDetails)

      const transient = this.isTransientError(error)
      this.logger.debug('Error classification', {
        requestId,
        isTransient: transient,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      })

      return finishRun({
        ok: false,
        error: transient
          ? `${runtime.errorNamespace}.requestFailed`
          : `${runtime.errorNamespace}.unexpectedError`,
        transient,
      })
    } finally {
      analysisConcurrencyGate.release()
    }
  }

  private mapToMetadata(
    payload: TorrentAiMetadataPayload,
    input: { rawName: string; language: string },
    runtime: AiProviderRuntime,
  ): TorrentAIMetadata {
    const normalizedName = payload.normalizedName?.trim()
      ? payload.normalizedName.trim()
      : input.rawName

    const technical = payload.technical ?? {}

    const ensureArray = (value: string[] | null | undefined) => {
      if (!Array.isArray(value) || value.length === 0) {
        return null
      }
      const normalized = value.map((entry) => entry?.trim()).filter(Boolean)
      return normalized.length > 0 ? Array.from(new Set(normalized)) : null
    }

    const fallbackPreview =
      payload.previewImageUrl?.trim() ||
      payload.tmdb?.posterUrl?.trim() ||
      payload.tmdb?.backdropUrl?.trim() ||
      null

    const metadata: TorrentAIMetadata = {
      rawName: input.rawName,
      normalizedName,
      language: payload.language?.trim() || input.language,
      mediaType: payload.mediaType ?? 'other',
      title: {
        canonicalTitle: payload.title.canonicalTitle.trim(),
        localizedTitle: payload.title.localizedTitle?.trim() || null,
        originalTitle: payload.title.originalTitle?.trim() || null,
        releaseYear: payload.title.releaseYear ?? null,
        seasonNumber: payload.title.seasonNumber ?? null,
        episodeNumbers: payload.title.episodeNumbers ?? null,
        episodeTitle: payload.title.episodeTitle?.trim() || null,
        extraInfo: ensureArray(payload.title.extraInfo),
        languageOfLocalizedTitle:
          payload.title.languageOfLocalizedTitle?.trim() || null,
      },
      series: {
        seasonNumber:
          payload.series?.seasonNumber ?? payload.title.seasonNumber ?? null,
        episodeNumbers:
          payload.series?.episodeNumbers ??
          payload.title.episodeNumbers ??
          null,
        episodeRange: payload.series?.episodeRange ?? null,
        totalEpisodesInSeason: payload.series?.totalEpisodesInSeason ?? null,
      },
      technical: {
        resolution: technical.resolution?.trim() || null,
        videoCodec: technical.videoCodec?.trim() || null,
        audio: ensureArray(technical.audio ?? null),
        source: technical.source?.trim() || null,
        edition: technical.edition?.trim() || null,
        otherTags: ensureArray(technical.otherTags ?? null),
      },
      tmdb: payload.tmdb ?? null,
      synopsis: payload.synopsis?.trim() || null,
      keywords: ensureArray(payload.keywords ?? null),
      explanations: payload.explanations ?? null,
      previewImageUrl: fallbackPreview,
      confidence: {
        overall: clamp(payload.confidence?.overall ?? 0.5),
        title:
          payload.confidence?.title != null
            ? clamp(payload.confidence.title)
            : null,
        tmdbMatch:
          payload.confidence?.tmdbMatch != null
            ? clamp(payload.confidence.tmdbMatch)
            : null,
        synopsis:
          payload.confidence?.synopsis != null
            ? clamp(payload.confidence.synopsis)
            : null,
      },
      mayBeTitle: payload.mayBeTitle?.trim() || null,
      provider: runtime.id,
      model: runtime.modelId,
      generatedAt: new Date().toISOString(),
    }

    if (!metadata.title.localizedTitle && metadata.title.originalTitle) {
      metadata.title.localizedTitle = metadata.title.originalTitle
    }

    return metadata
  }

  private isTransientError(error: unknown): boolean {
    if (!error) {
      return true
    }
    if (error instanceof Error) {
      const message = error.message || ''
      if (
        message.includes('429') ||
        message.includes('timeout') ||
        message.includes('ETIMEDOUT') ||
        message.includes('ECONNRESET')
      ) {
        return true
      }
    }
    return false
  }

  private parseMetadataPayload(
    rawInput: unknown,
    input: { rawName: string; language: string },
    runtime: AiProviderRuntime,
    requestId: string,
  ): TorrentAIEnrichmentResult | null {
    try {
      const parsed =
        typeof rawInput === 'string'
          ? rawInput.trim()
            ? JSON.parse(rawInput)
            : null
          : rawInput
      if (parsed == null) {
        this.logger.debug('Recovery failed: no payload available', {
          requestId,
        })
        return null
      }
      const normalized = normalizePayloadShape(parsed, input)
      const result = TorrentAiMetadataSchema.safeParse(normalized)
      if (!result.success) {
        this.logger.warn('Schema validation failed during recovery', {
          requestId,
          rawName: input.rawName,
          issuesCount: result.error.issues.length,
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        })
        return null
      }

      const metadata = this.mapToMetadata(result.data, input, runtime)
      return { ok: true, metadata }
    } catch (parseError) {
      this.logger.warn('Recovery parse failed', {
        requestId,
        rawName: input.rawName,
        raw: rawInput,
        parseError,
      })
      return null
    }
  }
}
