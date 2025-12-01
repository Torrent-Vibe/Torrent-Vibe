import type { DiscoverItem } from '../../types'
import type { MTeamSearchItem, Status } from './types'
import {
  extractImdbId,
  isNonEmptyString,
  normalizeSynopsis,
  normalizeTags,
  parseDateToIso,
  parseNumber,
} from './utils'

export const mapSearchItemToDiscoverItem = (
  item: MTeamSearchItem,
): DiscoverItem => {
  const stats: Partial<Status> = item.status ?? {}
  const tags = normalizeTags(item.labelsNew)
  const snatches = parseNumber(stats.timesCompleted)
  const categoryLabel =
    tags.length > 0
      ? tags.join(' / ')
      : item.category
        ? String(item.category)
        : null
  const synopsis = isNonEmptyString(item.smallDescr)
    ? normalizeSynopsis(item.smallDescr)
    : null

  const imdbUrl = isNonEmptyString(item.imdb) ? item.imdb.trim() : null
  const imdbId = extractImdbId(imdbUrl)
  const imdbRatingRaw = parseNumber(item.imdbRating)
  const imdbRating = imdbRatingRaw && imdbRatingRaw > 0 ? imdbRatingRaw : null

  const doubanUrl = isNonEmptyString(item.douban) ? item.douban.trim() : null
  const doubanRatingRaw = parseNumber(item.doubanRating)
  const doubanRating =
    doubanRatingRaw && doubanRatingRaw > 0 ? doubanRatingRaw : null

  const external: DiscoverItem['external'] = {}
  if (imdbUrl) {
    external.imdb = {
      url: imdbUrl,
      id: imdbId,
      rating: imdbRating ?? undefined,
      enrichment: null,
      enrichmentStatus: imdbId ? 'idle' : undefined,
    }
  }
  if (doubanUrl) {
    external.douban = {
      url: doubanUrl,
      rating: doubanRating ?? undefined,
    }
  }

  return {
    id: String(item.id),
    providerId: 'mteam',
    title: item.name ?? 'Unknown title',
    sizeBytes: parseNumber(item.size),
    createdAt: parseDateToIso(item.createdDate),
    seeders: parseNumber(stats.seeders),
    leechers: parseNumber(stats.leechers),
    snatches,
    discount: stats.discount ?? null,
    discountEndsAt: parseDateToIso(stats.discountEndTime),
    category: categoryLabel,
    tags,
    synopsis,
    external: Object.keys(external).length > 0 ? external : undefined,
    raw: item,
  }
}
