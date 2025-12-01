import type { MTeamProviderConfig } from '~/atoms/settings/discover'

import type {
  DiscoverDownloadParams,
  DiscoverItem,
  DiscoverItemDetail,
  DiscoverItemImdbInfo,
} from '../../types'
import type { MTeamDetailResponseBody } from './types'
import {
  createHeaders,
  ensureConfigReady,
  extractImdbId,
  firstNonEmptyString,
  handleErrorResponse,
  isNonEmptyString,
  joinPath,
  normalizeDescription,
  normalizeSynopsis,
  normalizeTags,
  parseDateToIso,
  parseNumber,
} from './utils'

export const getItemDetail = async (
  params: DiscoverDownloadParams,
  config: MTeamProviderConfig,
): Promise<DiscoverItemDetail> => {
  ensureConfigReady(config)

  const endpoint = joinPath(config.baseUrl, '/torrent/detail')
  const body = new URLSearchParams({ id: params.id })
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...createHeaders(config),
    },
    body,
  })

  if (!response.ok) {
    await handleErrorResponse(response)
  }

  const detail = (await response.json()) as MTeamDetailResponseBody
  const { data } = detail
  if (!data) throw new Error('Failed to load details from M-Team')

  const baseItem: DiscoverItem = (params.item as DiscoverItem | undefined) ?? {
    id: String(data.id),
    providerId: 'mteam',
    title:
      firstNonEmptyString(data.title, data.name) ??
      (params.item as DiscoverItem | undefined)?.title ??
      'Unknown title',
  }

  const files = Array.isArray(data.fileList)
    ? data.fileList.map((file) => ({
        name: file.name,
        sizeBytes: parseNumber(file.size),
      }))
    : undefined

  const descriptionSource = firstNonEmptyString(
    data.descr,
    data.description,
    data.smallDescr,
    () => {
      const raw = (params.item as DiscoverItem | undefined)?.raw
      if (raw && typeof raw === 'object' && raw !== null) {
        const value = (raw as { smallDescr?: unknown }).smallDescr
        return typeof value === 'string' ? value : null
      }
      return null
    },
  )

  const description = isNonEmptyString(descriptionSource)
    ? normalizeDescription(descriptionSource)
    : null

  const screenshots = (() => {
    if (Array.isArray(data.screenshotUrls)) return data.screenshotUrls
    if (Array.isArray(data.imageList)) return data.imageList
    return
  })()

  const detailLabels = Array.isArray(data.labelsNew) ? data.labelsNew : []
  const imdbUrl = isNonEmptyString(data.imdb) ? data.imdb.trim() : null
  const imdbIdFromDetail = extractImdbId(imdbUrl)
  const imdbRatingRaw = parseNumber(data.imdbRating)
  const imdbRating = imdbRatingRaw && imdbRatingRaw > 0 ? imdbRatingRaw : null
  const doubanUrl = isNonEmptyString(data.douban) ? data.douban.trim() : null
  const doubanRatingRaw = parseNumber(data.doubanRating)
  const doubanRating =
    doubanRatingRaw && doubanRatingRaw > 0 ? doubanRatingRaw : null
  const rawSynopsis = isNonEmptyString(data.smallDescr) ? data.smallDescr : null
  const synopsisFromDetail = rawSynopsis ? normalizeSynopsis(rawSynopsis) : null

  const extra: Record<string, unknown> = {}
  if (detailLabels.length > 0) extra.labels = detailLabels
  if (isNonEmptyString(data.originFileName)) {
    extra.originFileName = data.originFileName
  }
  if (imdbUrl) {
    extra.imdb = imdbUrl
  }
  if (doubanUrl) {
    extra.douban = doubanUrl
  }
  if (rawSynopsis) {
    extra.smallDescr = rawSynopsis
  }

  if (imdbRating !== null) {
    extra.imdbRating = imdbRating
  }

  if (doubanRating !== null) {
    extra.doubanRating = doubanRating
  }

  if (isNonEmptyString(data.mediainfo)) {
    extra.mediainfo = data.mediainfo
  }

  const extraExists = Object.keys(extra).length > 0

  const categoryLabel =
    detailLabels.length > 0
      ? detailLabels.join(' / ')
      : typeof (data as { category?: unknown }).category === 'number'
        ? String((data as { category?: number }).category)
        : isNonEmptyString((data as { category?: unknown }).category)
          ? String((data as { category?: string }).category)
          : (baseItem.category ?? null)

  const detailTags = normalizeTags(detailLabels)
  const baseTags = Array.isArray(baseItem.tags) ? baseItem.tags : []
  const mergedTagSet = new Set<string>(baseTags)
  for (const tag of detailTags) {
    mergedTagSet.add(tag)
  }
  const mergedTags = Array.from(mergedTagSet)

  const nextSynopsis = synopsisFromDetail ?? baseItem.synopsis ?? null

  const previousExternal = baseItem.external
  let nextExternal: DiscoverItem['external'] | undefined = previousExternal
    ? { ...previousExternal }
    : undefined

  if (imdbUrl) {
    const prevImdb = previousExternal?.imdb
    const imdbInfo = {
      url: imdbUrl,
      id: imdbIdFromDetail ?? prevImdb?.id ?? null,
      rating: imdbRating ?? prevImdb?.rating,
      enrichment: prevImdb?.enrichment ?? null,
      enrichmentStatus:
        prevImdb?.enrichmentStatus ??
        (prevImdb?.enrichment
          ? 'success'
          : imdbIdFromDetail
            ? 'idle'
            : undefined),
      enrichmentError: prevImdb?.enrichmentError,
    } satisfies DiscoverItemImdbInfo

    if (!nextExternal) {
      nextExternal = {}
    }
    nextExternal.imdb = imdbInfo
  }

  if (doubanUrl) {
    const prevDouban = previousExternal?.douban
    if (!nextExternal) {
      nextExternal = {}
    }
    nextExternal.douban = {
      url: doubanUrl,
      rating: doubanRating ?? prevDouban?.rating,
    }
  }

  const normalizedExternal: DiscoverItem['external'] | undefined =
    nextExternal && Object.keys(nextExternal).length > 0
      ? nextExternal
      : undefined

  return {
    ...baseItem,
    title:
      firstNonEmptyString(data.title, data.name) ??
      baseItem.title ??
      'Unknown title',
    sizeBytes: parseNumber(data.size) ?? baseItem.sizeBytes,
    createdAt:
      parseDateToIso((data as { createDate?: unknown }).createDate) ??
      parseDateToIso((data as { createdDate?: unknown }).createdDate) ??
      baseItem.createdAt,
    seeders: parseNumber(data.status?.seeders) ?? baseItem.seeders,
    leechers: parseNumber(data.status?.leechers) ?? baseItem.leechers,
    snatches:
      parseNumber(
        (data.status as { snatches?: number | string } | undefined)?.snatches,
      ) ??
      parseNumber(
        (data.status as { timesCompleted?: number | string } | undefined)
          ?.timesCompleted,
      ) ??
      baseItem.snatches,
    discount: data.status?.discount ?? baseItem.discount,
    discountEndsAt:
      parseDateToIso(data.status?.discountEndTime) ?? baseItem.discountEndsAt,
    description,
    files,
    screenshots,
    category: categoryLabel
      ? String(categoryLabel)
      : (baseItem.category ?? null),
    tags: mergedTags,
    synopsis: nextSynopsis,
    external: normalizedExternal,
    extra: extraExists ? { ...baseItem.extra, ...extra } : baseItem.extra,
    raw: data,
  }
}
