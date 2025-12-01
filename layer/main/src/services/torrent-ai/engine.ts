import { createHash } from 'node:crypto'

import type {
  TorrentAIEnrichmentResult,
  TorrentAIMetadata,
} from '@torrent-vibe/shared'
import { API_TOKENS } from '@torrent-vibe/shared'
import { generateText, NoObjectGeneratedError, Output, stepCountIs } from 'ai'

import { i18n } from '~/utils/i18n'

import { getLogger } from '../../config/log-config'
import { ConcurrencyGate } from '../../utils/concurrency-gate'
import { ApiTokenStore } from '../api-token-store'
import { AppSettingsStore } from '../app-settings-store'
import { renderSystemPrompt, renderUserPrompt } from './prompts'
import type { AiProviderRuntime } from './providers'
import { selectProvider } from './providers'
import type { TorrentAiMetadataPayload } from './schema'
import { TorrentAiMetadataSchema } from './schema'
import { TmdbClient } from './tmdb-client'
import { buildAiTools } from './tools'
import { TorrentAiDatabase } from './torrent-ai-database'
import type {
  AnalyzeTorrentNameOptions,
  ProviderConfig,
  TorrentAiCacheKey,
  TorrentAiEngineContract,
} from './types'

const CACHE_LIMIT = 200
const DEFAULT_OPENAI_MODEL = 'gpt-5-nano'
const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto'

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

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
  private readonly tokenStore = ApiTokenStore.getInstance()
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

    const config = this.resolveProviderConfig()

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

    const cacheKey = this.buildCacheKey(
      rawName,
      i18n.language,
      runtime,
      fileDigest,
    )

    if (!options.forceRefresh) {
      const cached = await this.metadataStore.get(cacheKey)
      if (cached) {
        return {
          ok: true,
          metadata: {
            ...cached.metadata,
            generatedAt: cached.metadata.generatedAt,
          },
        }
      }

      const pending = this.inFlight.get(cacheKey)
      if (pending) {
        this.logger.debug(
          'Request already in flight - returning existing promise',
          {
            requestId,
          },
        )
        return pending
      }
    } else {
      this.logger.debug('Force refresh requested - bypassing cache', {
        requestId,
      })
    }

    const execution = this.performAnalysis(
      { rawName, language: i18n.language, fileTreeSummary },
      config,
      runtime,
      requestId,
    )
      .then(async (result) => {
        if (result.ok && result.metadata) {
          await this.metadataStore.set(
            cacheKey,
            {
              metadata: result.metadata,
              createdAt: Date.now(),
            },
            { limit: CACHE_LIMIT },
          )
        }
        return result
      })
      .finally(() => {
        this.inFlight.delete(cacheKey)
      })

    this.inFlight.set(cacheKey, execution)
    return execution
  }

  async clearCache() {
    await this.metadataStore.clear()
    this.inFlight.clear()
  }

  hasConfiguredProvider(): boolean {
    const config = this.resolveProviderConfig()
    const selection = selectProvider(config)
    return Boolean(selection.runtime)
  }

  private resolveProviderConfig(): ProviderConfig {
    const openaiApiKey =
      this.tokenStore.getTokenValue(API_TOKENS.ai.openai.apiKey)?.trim() || null
    const openaiModel =
      this.tokenStore.getTokenValue(API_TOKENS.ai.openai.model)?.trim() ||
      DEFAULT_OPENAI_MODEL
    const openaiBaseUrl =
      this.tokenStore.getTokenValue(API_TOKENS.ai.openai.baseUrl)?.trim() ||
      null
    const openrouterApiKey =
      this.tokenStore.getTokenValue(API_TOKENS.ai.openrouter.apiKey)?.trim() ||
      null
    const openrouterModel =
      this.tokenStore.getTokenValue(API_TOKENS.ai.openrouter.model)?.trim() ||
      DEFAULT_OPENROUTER_MODEL
    const tmdbApiKey =
      this.tokenStore.getTokenValue(API_TOKENS.metadata.tmdb.apiKey)?.trim() ||
      null

    return {
      providers: {
        openai: {
          apiKey: openaiApiKey,
          model: openaiModel,
          baseUrl: openaiBaseUrl,
        },
        openrouter: {
          apiKey: openrouterApiKey,
          model: openrouterModel,
        },
      },
      preferredProviders: this.appSettingsStore.getPreferredAiProviders(),
      tmdbApiKey,
    }
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

      if (entries.length === 0) return { digest: null, summary: null }

      // Compute a stable digest based on the full list (not just capped)
      const h = createHash('sha256')
      for (const item of fileList) {
        const p = String(item.path || '').trim()
        if (!p) continue
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
        if (first) folders.add(first)
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

  private buildCacheKey(
    rawName: string,
    language: string,
    runtime: AiProviderRuntime,
    fileDigest?: string | null,
  ): TorrentAiCacheKey {
    const base = `${language}::${runtime.id}:${runtime.modelId}::${rawName}`
    return fileDigest ? `${base}::ft=${fileDigest}` : base
  }

  private async performAnalysis(
    input: {
      rawName: string
      language: string
      fileTreeSummary?: string | null
    },
    config: ProviderConfig,
    runtime: AiProviderRuntime,
    requestId: string,
  ): Promise<TorrentAIEnrichmentResult> {
    await analysisConcurrencyGate.acquire()

    try {
      this.tmdbClient.setApiKey(config.tmdbApiKey)
      const tools = buildAiTools({
        tmdb: this.tmdbClient.isConfigured()
          ? { client: this.tmdbClient }
          : undefined,
        search: {
          mode: 'headless',
          engines: ['duckduckgo'],
        },
        webExtract: true,
      })

      const systemPrompt = renderSystemPrompt()
      const userPrompt = renderUserPrompt(input.rawName, input.fileTreeSummary)

      this.logger.debug('Prompts generated', {
        requestId,
        userPrompt,
        hasFileContext: !!input.fileTreeSummary,
      })

      const result = await generateText({
        model: runtime.model,
        system: systemPrompt,
        prompt: userPrompt,
        tools,
        stopWhen: stepCountIs(50),
        experimental_output: Output.object({
          schema: TorrentAiMetadataSchema,
        }),
        providerOptions: {
          openai: {
            parallelToolCalls: true,
            reasoning_effort: 'minimal',
          },
        },
      })

      this.logger.debug('AI generation result received', {
        requestId,
        provider: runtime.id,
        model: runtime.modelId,
        output: result.experimental_output,
        text: result.text,
        finishReason: result.finishReason,
        usage: result.usage || null,
        steps: result.steps?.length || 0,
      })

      const payload: TorrentAiMetadataPayload = result.experimental_output
      const metadata = this.mapToMetadata(payload, input, runtime)

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

      return { ok: true, metadata }
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

      if (NoObjectGeneratedError.isInstance(error)) {
        this.logger.warn(
          'NoObjectGeneratedError occurred, attempting recovery',
          {
            ...errorDetails,
            cause: error.cause,
            text: error.text?.slice(0, 500), // Limit text size for logging
            usage: error.usage || null,
            finishReason: error.finishReason,
          },
        )

        const recovered = this.tryRecoverFromNoObjectError(
          error,
          input,
          runtime,
          requestId,
        )
        if (recovered) {
          this.logger.debug(
            'Successfully recovered from NoObjectGeneratedError',
            {
              requestId,
              recoveredMetadata:
                recovered.ok && recovered.metadata
                  ? {
                      normalizedName: recovered.metadata.normalizedName,
                      mediaType: recovered.metadata.mediaType,
                      confidence: recovered.metadata.confidence.overall,
                    }
                  : null,
            },
          )
          return recovered
        }

        this.logger.error('NoObjectGeneratedError recovery failed', {
          ...errorDetails,
          cause: error.cause,
          text: error.text?.slice(0, 500),
          response: error.response,
          usage: error.usage,
          finishReason: error.finishReason,
        })
      }

      this.logger.error('AI analysis failed with error', errorDetails)

      const transient = this.isTransientError(error)
      this.logger.debug('Error classification', {
        requestId,
        isTransient: transient,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      })

      return {
        ok: false,
        error: transient
          ? `${runtime.errorNamespace}.requestFailed`
          : `${runtime.errorNamespace}.unexpectedError`,
        transient,
      }
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
      if (!Array.isArray(value) || value.length === 0) return null
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
    if (!error) return true
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

  private tryRecoverFromNoObjectError(
    error: NoObjectGeneratedError,
    input: { rawName: string; language: string },
    runtime: AiProviderRuntime,
    requestId: string,
  ): TorrentAIEnrichmentResult | null {
    const raw = error.text?.trim()
    if (!raw) {
      this.logger.debug('Recovery failed: no raw text available', { requestId })
      return null
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      const normalized = this.normalizePayloadShape(parsed, input)
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
        raw,
        parseError,
      })
      return null
    }
  }

  private normalizePayloadShape(
    payload: unknown,
    input?: { rawName: string; language: string },
  ): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload
    }

    const draft = structuredClone(payload) as Record<string, unknown>

    // Normalize language and top-level strings
    if (
      (typeof draft.language !== 'string' || !draft.language.trim()) &&
      input?.language
    ) {
      draft.language = input.language
    }
    if (
      (typeof draft.normalizedName !== 'string' || !draft.normalizedName) &&
      input?.rawName
    ) {
      draft.normalizedName = input.rawName
    }

    // Ensure title object exists and has a canonicalTitle
    if (!draft.title || typeof draft.title !== 'object') {
      draft.title = { canonicalTitle: input?.rawName || '' }
    } else {
      const title = draft.title as Record<string, unknown>
      if (typeof title.canonicalTitle !== 'string' || !title.canonicalTitle) {
        title.canonicalTitle = input?.rawName || ''
      }
      // Coerce episodeNumbers to array<number> when possible
      if (
        title.episodeNumbers != null &&
        !Array.isArray(title.episodeNumbers)
      ) {
        const v = title.episodeNumbers as unknown
        if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
          title.episodeNumbers = [v]
        } else {
          title.episodeNumbers = undefined
        }
      }
    }

    // Normalize series shape
    if (draft.series && typeof draft.series === 'object') {
      const series = draft.series as Record<string, unknown>
      if (
        series.episodeNumbers != null &&
        !Array.isArray(series.episodeNumbers)
      ) {
        const v = series.episodeNumbers as unknown
        if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
          series.episodeNumbers = [v]
        } else {
          series.episodeNumbers = undefined
        }
      }
      // Convert tuple-like array to object for episodeRange if needed
      if (Array.isArray(series.episodeRange)) {
        const arr = series.episodeRange as unknown[]
        const from = Number(arr[0])
        const to = Number(arr[1])
        if (
          Number.isInteger(from) &&
          Number.isInteger(to) &&
          from >= 0 &&
          to >= 0
        ) {
          series.episodeRange = { from, to }
        } else {
          series.episodeRange = undefined
        }
      }
    }

    // Normalize confidence field
    if (draft.confidence == null) {
      draft.confidence = { overall: 0.5 }
    } else if (typeof draft.confidence === 'number') {
      draft.confidence = { overall: clamp(draft.confidence) }
    } else if (typeof draft.confidence === 'object') {
      const confidence = draft.confidence as Record<string, unknown>
      if (typeof confidence.overall !== 'number') {
        confidence.overall = 0.5
      } else {
        confidence.overall = clamp(confidence.overall as number)
      }
      draft.confidence = confidence
    }

    return draft
  }
}
