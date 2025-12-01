import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { formatBytesSmart } from '~/lib/format'
import type {
  DiscoverItemDetail,
  DiscoverPreviewDescriptionRenderer,
} from '~/modules/discover'

import { formatDiscountLabel } from './utils'

export interface PreviewStat {
  id: string
  icon: string
  label: string
  value: string
}

export interface PreviewLink {
  id: string
  href: string
  label: string
  rating: string | null
}

export interface PreviewFileItem {
  name: string
  sizeLabel: string
}

export interface PreviewScreenshot {
  url: string
  alt: string
}

export interface PreviewHeroData {
  title: string
  subtitle?: string | null
  tags: string[]
  tagsLabel?: string
  stats: PreviewStat[]
}

export interface PreviewModel {
  hero: PreviewHeroData
  originFileName?: string | null
  links: PreviewLink[]
  screenshots: PreviewScreenshot[]
  description?: string | null
  descriptionRenderer: DiscoverPreviewDescriptionRenderer
  files: PreviewFileItem[]
  filesOverflowLabel?: string | null
  mediainfo?: string | null
}

export interface BuildPreviewModelOptions {
  descriptionRenderer?: DiscoverPreviewDescriptionRenderer
}

const formatRating = (value: number | null) => {
  if (value === null || Number.isNaN(value) || value <= 0) return null
  const fixed = value.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

const normalizeLink = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const useBuildPreviewModel = () => {
  const { t: settingT } = useTranslation('setting')
  const { t } = useTranslation('app')

  return useCallback(
    (detail: DiscoverItemDetail, options?: BuildPreviewModelOptions) => {
      const extra = (detail.extra ?? {}) as Record<string, unknown>

      const subtitle = (() => {
        if (typeof detail.synopsis === 'string' && detail.synopsis.trim()) {
          return detail.synopsis.trim()
        }
        const legacy = extra['smallDescr']
        if (typeof legacy === 'string' && legacy.trim()) {
          return legacy.trim()
        }
        return null
      })()

      const tagSet = new Set<string>()
      if (Array.isArray(detail.tags)) {
        for (const tag of detail.tags) {
          if (typeof tag === 'string' && tag.trim()) {
            tagSet.add(tag.trim())
          }
        }
      }
      if (Array.isArray(extra['labels'])) {
        for (const label of extra['labels'] as unknown[]) {
          if (typeof label === 'string' && label.trim()) {
            tagSet.add(label.trim())
          }
        }
      }
      if (tagSet.size === 0 && detail.category) {
        tagSet.add(detail.category)
      }
      const tags = Array.from(tagSet)

      const stats: PreviewStat[] = [
        {
          id: 'size',
          icon: 'i-lucide-database',
          label: t('discover.modal.detailSize'),
          value: detail.sizeBytes ? formatBytesSmart(detail.sizeBytes) : '—',
        },
        {
          id: 'created',
          icon: 'i-lucide-clock',
          label: t('discover.modal.detailAdded'),
          value: detail.createdAt
            ? new Date(detail.createdAt).toLocaleString()
            : '—',
        },
        {
          id: 'seeders',
          icon: 'i-lucide-arrow-up text-green',
          label: t('discover.modal.detailSeedersLabel'),
          value: (detail.seeders ?? 0).toLocaleString(),
        },
        {
          id: 'leechers',
          icon: 'i-lucide-arrow-down text-blue',
          label: t('discover.modal.detailLeechersLabel'),
          value: (detail.leechers ?? 0).toLocaleString(),
        },
      ]

      const imdbRuntime = detail.external?.imdb?.enrichment?.runtimeMinutes
      if (imdbRuntime && imdbRuntime > 0) {
        stats.push({
          id: 'runtime',
          icon: 'i-lucide-timer-reset',
          label: t('discover.modal.detailRuntime'),
          value: `${imdbRuntime} min`,
        })
      }

      const imdbVotes = detail.external?.imdb?.enrichment?.votes
      if (imdbVotes && imdbVotes > 0) {
        stats.push({
          id: 'votes',
          icon: 'i-lucide-users',
          label: t('discover.modal.detailVotes'),
          value: imdbVotes.toLocaleString(),
        })
      }

      if (detail.snatches !== null && detail.snatches !== undefined) {
        stats.push({
          id: 'snatches',
          icon: 'i-lucide-sparkles text-amber-500',
          label: t('discover.modal.detailSnatches'),
          value: detail.snatches.toLocaleString(),
        })
      }

      const discountLabel = formatDiscountLabel(
        detail.discount ?? undefined,
        settingT as any,
      )
      if (discountLabel && discountLabel !== '—') {
        stats.push({
          id: 'discount',
          icon: 'i-lucide-percent text-accent',
          label: t('discover.modal.detailDiscount'),
          value: discountLabel,
        })
      }

      const links: PreviewLink[] = []
      const imdbInfo = detail.external?.imdb
      const imdbUrl =
        normalizeLink(imdbInfo?.url) ?? normalizeLink(extra['imdb'])
      if (imdbUrl) {
        const imdbRating =
          imdbInfo?.rating ??
          imdbInfo?.enrichment?.rating ??
          (typeof extra['imdbRating'] === 'number'
            ? (extra['imdbRating'] as number)
            : null)
        links.push({
          id: 'imdb',
          href: imdbUrl,
          label: t('discover.modal.detailImdb'),
          rating: formatRating(imdbRating ?? null),
        })
      }

      const doubanInfo = detail.external?.douban
      const doubanUrl =
        normalizeLink(doubanInfo?.url) ?? normalizeLink(extra['douban'])
      if (doubanUrl) {
        const doubanRating =
          doubanInfo?.rating ??
          (typeof extra['doubanRating'] === 'number'
            ? (extra['doubanRating'] as number)
            : null)
        links.push({
          id: 'douban',
          href: doubanUrl,
          label: t('discover.modal.detailDouban'),
          rating: formatRating(doubanRating ?? null),
        })
      }

      const screenshots = Array.isArray(detail.screenshots)
        ? detail.screenshots
            .filter(
              (url): url is string =>
                typeof url === 'string' && url.trim().length > 0,
            )
            .map((url, index) => ({
              url,
              alt: t('discover.modal.detailScreenshotAlt', {
                index: index + 1,
              }),
            }))
        : []

      const files = Array.isArray(detail.files)
        ? detail.files.map((file) => ({
            name: file.name,
            sizeLabel:
              file.sizeBytes !== null && file.sizeBytes !== undefined
                ? formatBytesSmart(file.sizeBytes)
                : '—',
          }))
        : []

      const filesOverflowLabel =
        files.length > 10
          ? t('discover.modal.detailFilesSuffix', { count: files.length - 10 })
          : null

      const originFileName =
        typeof extra['originFileName'] === 'string'
          ? extra['originFileName'].trim() || null
          : null

      const mediainfo =
        typeof extra['mediainfo'] === 'string'
          ? extra['mediainfo'].trim() || null
          : null

      const description =
        typeof detail.description === 'string'
          ? detail.description.trim() || null
          : null

      const descriptionRenderer = options?.descriptionRenderer ?? 'markdown'

      return {
        hero: {
          title: detail.title,
          subtitle,
          tags,
          tagsLabel:
            tags.length > 0 ? t('discover.modal.detailTags') : undefined,
          stats,
        },
        originFileName,
        links,
        screenshots,
        description,
        descriptionRenderer,
        files,
        filesOverflowLabel,
        mediainfo,
      }
    },
    [settingT, t],
  )
}
