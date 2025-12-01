import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { Button } from '~/components/ui/button'
import {
  HoverCard,
  HoverCardArrow,
  HoverCardContent,
  HoverCardTrigger,
} from '~/components/ui/hover-card'
import { getAiIntegrationEnabled } from '~/lib/ai-integration'
import { stopPropagation } from '~/lib/dom'
import { ipcServices } from '~/lib/ipc-client'
import { TorrentAiActions, useTorrentAiStore } from '~/modules/torrent-ai'
import { selectTorrentAiEntry } from '~/modules/torrent-ai/selectors'

interface TorrentAiMetadataRowProps {
  hash: string
  rawName: string
  isInViewport?: boolean
}

const MEDIA_TYPE_LABEL_KEYS: Record<string, I18nKeys> = {
  movie: 'torrent.ai.mediaType.movie',
  tv: 'torrent.ai.mediaType.tv',
  anime: 'torrent.ai.mediaType.anime',
  music: 'torrent.ai.mediaType.music',
  other: 'torrent.ai.mediaType.other',
}

const formatConfidence = (value: number | null | undefined): string => {
  if (value == null) return ''
  const percentage = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return `${percentage}%`
}

type TechnicalInsight = {
  resolution?: string | null
  videoCodec?: string | null
  audio?: string[] | null
  source?: string | null
  edition?: string | null
  otherTags?: string[] | null
}

const buildTechnicalBadges = (technical: TechnicalInsight) => {
  const badges: string[] = []
  if (technical.resolution) badges.push(technical.resolution)
  if (technical.source) badges.push(technical.source)
  if (technical.videoCodec) badges.push(technical.videoCodec)
  if (technical.audio && technical.audio.length > 0) {
    badges.push(technical.audio[0])
  }
  if (technical.edition) badges.push(technical.edition)
  if (technical.otherTags && technical.otherTags.length > 0) {
    badges.push(...technical.otherTags.slice(0, 2))
  }
  return badges
}

const ERROR_MESSAGE_KEY: Record<string, I18nKeys> = {
  'ai.notSupported': 'torrent.ai.status.error.notSupported',
  'ai.openai.missingApiKey': 'torrent.ai.status.error.missingApiKey',
  'ai.openai.requestFailed': 'torrent.ai.status.error.requestFailed',
  'ai.openai.invalidResponse': 'torrent.ai.status.error.invalidResponse',
  'ai.openai.unexpectedError': 'torrent.ai.status.error.unexpected',
  'ai.openrouter.missingApiKey': 'torrent.ai.status.error.missingApiKey',
  'ai.openrouter.requestFailed': 'torrent.ai.status.error.requestFailed',
  'ai.openrouter.invalidResponse': 'torrent.ai.status.error.invalidResponse',
  'ai.openrouter.unexpectedError': 'torrent.ai.status.error.unexpected',
  'ai.providers.unavailable': 'torrent.ai.status.error.missingProvider',
  'ai.providers.requestFailed': 'torrent.ai.status.error.requestFailed',
} as const

const NON_RETRYABLE_ERRORS = new Set([
  'ai.notSupported',
  'ai.openai.missingApiKey',
  'ai.openrouter.missingApiKey',
  'ai.providers.unavailable',
])

export const TorrentAiMetadataRow = ({
  hash,
  rawName,
  isInViewport,
}: TorrentAiMetadataRowProps) => {
  const { t, i18n } = useTranslation('app')
  const language = i18n.language || 'zh-CN'
  const trimmedName = rawName?.trim() ?? ''
  const isElectron = typeof ELECTRON !== 'undefined' && ELECTRON
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)

  // Check AI availability (user toggle + OpenAI API key configured) via IPC
  useEffect(() => {
    let mounted = true
    if (!isElectron) {
      setAiAvailable(false)
      return () => {
        mounted = false
      }
    }

    ;(async () => {
      try {
        const userEnabled = getAiIntegrationEnabled()
        const available = userEnabled
          ? await ipcServices?.torrentAi.isAvailable()
          : false
        if (!mounted) return
        setAiAvailable(Boolean(available))
      } catch {
        if (!mounted) return
        setAiAvailable(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [isElectron])

  const entry = useTorrentAiStore(
    useShallow((state) => selectTorrentAiEntry(state, hash) ?? null),
  )

  const requestMetadata = useCallback(
    (force = false) => {
      if (!hash || !trimmedName) return
      void TorrentAiActions.shared.ensureMetadata({
        hash,
        rawName: trimmedName,
        force,
      })
    },
    [hash, trimmedName],
  )

  useEffect(() => {
    if (!isElectron) return
    if (aiAvailable !== true) return
    if (isInViewport !== true) return
    if (!hash || !trimmedName) return
    if (!entry) {
      requestMetadata()
      return
    }

    if (entry.status === 'loading' || entry.status === 'error') return

    const metadataMatches =
      entry.status === 'ready' &&
      entry.metadata &&
      entry.language === language &&
      entry.rawName === trimmedName

    if (metadataMatches) {
      return
    }

    requestMetadata()
  }, [
    hash,
    trimmedName,
    language,
    entry,
    requestMetadata,
    isElectron,
    aiAvailable,
    isInViewport,
  ])
  const technicalBadges = useMemo(
    () => buildTechnicalBadges(entry?.metadata?.technical ?? {}),
    [entry?.metadata?.technical],
  )
  if (!isElectron || aiAvailable !== true) {
    return null
  }

  if (!entry) return null

  if (entry.status === 'error') {
    // Hide UI when AI is not enabled or not supported
    if (entry.error && NON_RETRYABLE_ERRORS.has(entry.error)) {
      return null
    }
    const messageKey =
      entry.error && entry.error in ERROR_MESSAGE_KEY
        ? ERROR_MESSAGE_KEY[entry.error as keyof typeof ERROR_MESSAGE_KEY]
        : 'torrent.ai.status.error.default'
    const errorLabel = t(messageKey)

    const isRetryable = entry.error
      ? !NON_RETRYABLE_ERRORS.has(entry.error)
      : true

    const handleRetry = () => {
      requestMetadata(true)
    }

    return (
      <HoverCard openDelay={150} closeDelay={120}>
        <HoverCardTrigger asChild>
          <span
            className="inline-flex h-5 items-center gap-1 rounded-full border border-red/20 px-1.5 text-[10px] leading-none text-red/60"
            aria-label={t('torrent.ai.status.error.default')}
          >
            <i
              className="i-mingcute-warning-line text-[12px]"
              aria-hidden="true"
            />
            <span>AI</span>
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          onClick={stopPropagation}
          align="start"
          sideOffset={12}
          className="gap-2 justify-between flex items-center"
        >
          <div className="flex items-start gap-2 text-sm text-red">
            <i className="i-mingcute-warning-line mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-medium">{errorLabel}</div>
            </div>
          </div>
          {isRetryable ? (
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2"
              type="button"
              onClick={handleRetry}
            >
              {t('torrent.ai.actions.retry')}
            </Button>
          ) : null}

          <HoverCardArrow />
        </HoverCardContent>
      </HoverCard>
    )
  }

  if (entry.status === 'loading') {
    return (
      <span className="inline-flex h-5 items-center gap-1 text-[10px] text-text-tertiary">
        <i
          className="i-mingcute-loading-3-line animate-spin text-[12px]"
          aria-hidden="true"
        />
        <span className="sr-only">{t('torrent.ai.status.loading')}</span>
      </span>
    )
  }

  if (entry.status !== 'ready' || !entry.metadata) {
    return null
  }

  const { metadata } = entry
  const localizedTitle =
    metadata.title.localizedTitle || metadata.title.canonicalTitle
  const { canonicalTitle } = metadata.title
  const { seasonNumber } = metadata.title
  const { episodeNumbers } = metadata.title
  const episodeRange: { from: number; to: number } | null = (() => {
    if (!episodeNumbers || episodeNumbers.length < 2) return null
    const sorted = [...episodeNumbers].sort((a, b) => a - b)
    const first = sorted[0]
    const last = sorted.at(-1)!
    const isContiguous = last - first + 1 === sorted.length
    return isContiguous ? { from: first, to: last } : null
  })()
  const showOriginalTitle =
    metadata.title.originalTitle &&
    metadata.title.originalTitle !== localizedTitle &&
    metadata.title.originalTitle !== canonicalTitle

  const keywords = metadata.keywords ?? []
  const explanations = metadata.explanations ?? []
  const mayBeTitle = metadata.mayBeTitle?.trim()
  const confidenceLabel = formatConfidence(metadata.confidence?.overall ?? null)
  const mediaTypeKey =
    MEDIA_TYPE_LABEL_KEYS[metadata.mediaType] ?? MEDIA_TYPE_LABEL_KEYS.other
  const mediaTypeLabel = t(mediaTypeKey)
  const infoButtonLabel = t('torrent.ai.actions.openDetails')
  const previewUrl =
    metadata.previewImageUrl ??
    metadata.tmdb?.posterUrl ??
    metadata.tmdb?.backdropUrl ??
    null

  const originalTitleLabel =
    showOriginalTitle && metadata.title.originalTitle
      ? t('torrent.ai.labels.originalTitle', {
          title: metadata.title.originalTitle,
        })
      : null

  const tmdbTitleLabel =
    metadata.tmdb?.title && metadata.tmdb.title !== localizedTitle
      ? t('torrent.ai.labels.tmdbTitle', {
          title: metadata.tmdb.title,
        })
      : null

  const releaseLabel = metadata.tmdb?.releaseDate
    ? t('torrent.ai.labels.releaseDate', {
        date: metadata.tmdb.releaseDate,
      })
    : null

  const ratingLabel =
    typeof metadata.tmdb?.rating === 'number'
      ? t('torrent.ai.labels.rating', {
          rating: metadata.tmdb.rating.toFixed(1),
        })
      : null

  const votesLabel = metadata.tmdb?.votes
    ? t('torrent.ai.labels.votes', { count: metadata.tmdb.votes })
    : null

  return (
    <HoverCard openDelay={150} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex h-5 items-center gap-1 rounded-full border border-border/50 bg-material-opaque px-1.5 text-[10px] leading-none text-text-tertiary hover:text-text"
          aria-label={infoButtonLabel}
        >
          {mayBeTitle ? (
            <i className="i-lucide-flame text-[12px]" aria-hidden="true" />
          ) : (
            <i
              className="i-lucide-file-question-mark text-[12px]"
              aria-hidden="true"
            />
          )}
          {mayBeTitle ? (
            <span className="max-w-[200px] truncate">{mayBeTitle}</span>
          ) : confidenceLabel ? (
            <span>{confidenceLabel}</span>
          ) : null}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        sideOffset={12}
        className="flex flex-col gap-3"
        onClick={stopPropagation}
      >
        <div className="flex gap-3 justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-text">
              {localizedTitle}
            </div>
            {seasonNumber != null ||
            (episodeNumbers && episodeNumbers.length > 0) ||
            episodeRange ? (
              <div className="text-xs text-text-tertiary">
                {(() => {
                  const s =
                    seasonNumber != null
                      ? `S${String(seasonNumber).padStart(2, '0')}`
                      : null
                  const e = episodeRange
                    ? `E${String(episodeRange.from).padStart(2, '0')}-E${String(episodeRange.to).padStart(2, '0')}`
                    : episodeNumbers && episodeNumbers.length > 0
                      ? episodeNumbers
                          .slice(0, 3)
                          .map((n) => `E${String(n).padStart(2, '0')}`)
                          .join(', ') + (episodeNumbers.length > 3 ? '…' : '')
                      : null
                  return [s, e].filter(Boolean).join(' ')
                })()}
              </div>
            ) : null}
            {originalTitleLabel ? (
              <div className="text-xs text-text-tertiary">
                {originalTitleLabel}
              </div>
            ) : null}
            {tmdbTitleLabel ? (
              <div className="text-xs text-text-tertiary">{tmdbTitleLabel}</div>
            ) : null}
          </div>
          <div className="flex flex-row items-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 self-start"
              type="button"
              title={t('torrent.ai.actions.forceRefresh')}
              aria-label={t('torrent.ai.actions.forceRefresh')}
              onClick={() => requestMetadata(true)}
            >
              <i
                className="i-mingcute-refresh-3-line text-[12px]"
                aria-hidden="true"
              />
              <span className="ml-1 text-[10px]">
                {t('torrent.ai.actions.refresh')}
              </span>
            </Button>
            {previewUrl ? (
              <div className="overflow-hidden rounded bg-material-opaque h-18">
                <img
                  src={previewUrl}
                  alt={localizedTitle}
                  className="h-18 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : null}
          </div>
        </div>

        {technicalBadges.slice(0, 5).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {technicalBadges.slice(0, 5).map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center rounded bg-material-opaque px-1.5 py-0.5 text-[10px] text-text-tertiary"
              >
                {badge}
              </span>
            ))}
            {metadata.mediaType !== 'other' ? (
              <span className="inline-flex items-center rounded bg-material-opaque px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-tertiary">
                {mediaTypeLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 6).map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center rounded-full bg-material-opaque px-2 py-0.5 text-[10px] text-text-tertiary"
              >
                {t('torrent.ai.labels.keyword', { keyword })}
              </span>
            ))}
          </div>
        ) : null}

        {metadata.tmdb ? (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            {ratingLabel ? (
              <span className="inline-flex items-center gap-1">
                <i
                  className="i-mingcute-star-line text-accent"
                  aria-hidden="true"
                />
                <span>{ratingLabel}</span>
                {votesLabel ? <span> · {votesLabel}</span> : null}
              </span>
            ) : null}
            {releaseLabel ? <span>{releaseLabel}</span> : null}
          </div>
        ) : null}

        {metadata.synopsis ? (
          <p className="text-xs leading-relaxed text-text-secondary whitespace-pre-line line-clamp-5">
            {metadata.synopsis}
          </p>
        ) : null}

        {explanations.length > 0 ? (
          <div className="space-y-1">
            {explanations.slice(0, 2).map((ex) => (
              <div
                key={`${ex.heading}::${ex.body ?? ''}`}
                className="space-y-0.5"
              >
                <div className="text-xs font-medium text-text">
                  {ex.heading}
                </div>
                {ex.body ? (
                  <p className="text-xs leading-relaxed text-text-secondary whitespace-pre-line line-clamp-4">
                    {ex.body}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {!!metadata.model && !!metadata.provider && (
          <div className="text-[10px] -mt-1 text-right text-text-secondary">
            This metadata is generated by {metadata.provider}/{metadata.model}
          </div>
        )}
        <HoverCardArrow />
      </HoverCardContent>
    </HoverCard>
  )
}
