import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Components } from 'react-virtuoso'
import { Virtuoso } from 'react-virtuoso'

import { Checkbox } from '~/components/ui/checkbox'
import { useScrollViewElement } from '~/components/ui/scroll-areas/hooks'
import { useIntersectionObserver } from '~/hooks/common'
import { cn } from '~/lib/cn'
import { stopPropagation } from '~/lib/dom'
import { formatBytesSmart } from '~/lib/format'
import type { DiscoverItem } from '~/modules/discover'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { formatDiscountLabel } from './utils'

const formatImdbRating = (value?: number | null) => {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value <= 0) return null
  const fixed = value.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

export const DiscoverResultsList = () => {
  const { t: settingT } = useTranslation('setting')
  const actions = DiscoverModalActions.shared
  const { selection, enrichment } = actions.slices
  const items = useDiscoverModalStore((state) => state.items)
  const selectedIds = useDiscoverModalStore((state) => state.selectedIds)
  const previewId = useDiscoverModalStore((state) => state.previewId)
  const scrollParent = useScrollViewElement()

  const formatDiscount = useCallback(
    (discount?: string | null) =>
      formatDiscountLabel(discount ?? undefined, settingT as any),
    [settingT],
  )

  const loadImdb = useCallback(
    (id: string) => {
      void enrichment.loadImdbEnrichment(id)
    },
    [enrichment],
  )

  const { toggleSelection } = selection

  const renderItem = useCallback(
    (_: number, item: DiscoverItem) => {
      const selected = selectedIds.has(item.id)
      return (
        <DiscoverResultRow
          key={item.id}
          item={item}
          selected={selected}
          isPreviewed={previewId === item.id}
          onToggle={toggleSelection}
          formatDiscount={formatDiscount}
          scrollParent={scrollParent ?? undefined}
          loadImdb={loadImdb}
        />
      )
    },
    [
      formatDiscount,
      loadImdb,
      previewId,
      scrollParent,
      selectedIds,
      toggleSelection,
    ],
  )

  const customScrollParent =
    scrollParent && scrollParent !== document.documentElement
      ? scrollParent
      : undefined

  return (
    <Virtuoso<DiscoverItem>
      data={items}
      itemContent={renderItem}
      computeItemKey={(_, item) => item.id}
      components={discoverVirtuosoComponents}
      customScrollParent={customScrollParent}
    />
  )
}

interface DiscoverResultRowProps {
  item: DiscoverItem
  selected: boolean
  isPreviewed: boolean
  onToggle: (id: string) => void
  formatDiscount: (discount?: string | null) => string
  scrollParent?: Element
  loadImdb: (id: string) => void
}

const DiscoverResultRow = ({
  item,
  selected,
  isPreviewed,
  onToggle,
  formatDiscount,
  scrollParent,
  loadImdb,
}: DiscoverResultRowProps) => {
  const { t: settingT } = useTranslation('setting')
  const { t: appT } = useTranslation('app')
  const imdbInfo = item.external?.imdb
  const imdbRating = formatImdbRating(
    imdbInfo?.rating ?? imdbInfo?.enrichment?.rating ?? null,
  )
  const imdbStatus = imdbInfo?.enrichmentStatus
  const imdbVotes = imdbInfo?.enrichment?.votes ?? null
  const imdbYear = imdbInfo?.enrichment?.year ?? null
  const imdbType = imdbInfo?.enrichment?.type ?? null
  const imdbRuntime = imdbInfo?.enrichment?.runtimeMinutes ?? null
  const imdbLanguages = imdbInfo?.enrichment?.languages ?? []
  const imdbCountries = imdbInfo?.enrichment?.countries ?? []
  const imdbErrorKey = imdbInfo?.enrichmentError ?? null
  const imdbErrorMessage = useMemo(() => {
    if (!imdbErrorKey) return null
    if (imdbErrorKey === 'missingToken') {
      return settingT('discover.modal.imdbMissingToken')
    }
    return imdbErrorKey
  }, [imdbErrorKey, settingT])
  const posterUrl = imdbInfo?.enrichment?.posterUrl
  const tags = useMemo(() => (item.tags ?? []).slice(0, 6), [item.tags])

  const { ref, inView } = useIntersectionObserver<HTMLButtonElement>({
    root: scrollParent ?? null,
    threshold: 0.25,
    freezeOnceVisible: true,
  })

  useEffect(() => {
    if (!imdbInfo?.id) return
    if (!inView) return
    loadImdb(item.id)
  }, [imdbInfo?.id, inView, item.id, loadImdb])

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onToggle(item.id)}
      className={cn(
        'flex w-full items-start gap-3 px-5 py-3 text-left transition-colors border border-transparent',
        selected ? 'bg-accent/10 shadow-sm' : 'hover:bg-fill-secondary/40',
        isPreviewed && 'border-accent',
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => {
          if (Boolean(checked) !== selected) {
            onToggle(item.id)
          }
        }}
        onClick={stopPropagation}
        className="mt-0.5"
      />
      {posterUrl && (
        <img
          src={posterUrl}
          alt={`${item.title} poster`}
          loading="lazy"
          className="h-20 w-14 flex-shrink-0 rounded-md object-cover shadow-sm"
        />
      )}
      <div className="grid flex-1 gap-2">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-base text-text truncate">
                {item.title}
              </span>
              {item.category && (
                <span className="rounded-full bg-fill-secondary px-2 py-0.5 text-xs text-text-tertiary">
                  {item.category}
                </span>
              )}
            </div>
            {item.synopsis && (
              <p className="text-xs text-text-tertiary line-clamp-2">
                {item.synopsis}
              </p>
            )}
          </div>
          {imdbInfo?.id && (
            <div className="ml-auto flex flex-col items-end gap-1 text-xs text-text-secondary">
              <div className="inline-flex items-center gap-2">
                <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-500">
                  IMDb
                </span>
                {imdbRating ? (
                  <span className="font-medium text-text">{imdbRating}</span>
                ) : imdbStatus === 'loading' ? (
                  <i className="i-mingcute-loading-3-line animate-spin text-amber-500" />
                ) : (
                  <span className="text-text-tertiary">—</span>
                )}
                {imdbStatus === 'error' && (
                  <i
                    className="i-mingcute-warning-line text-amber-600"
                    title={imdbErrorMessage ?? undefined}
                  />
                )}
              </div>
              {(imdbYear || imdbType) && (
                <span className="text-[11px] text-text-tertiary">
                  {imdbYear ?? '—'}
                  {imdbType ? ` · ${imdbType}` : ''}
                </span>
              )}
              {imdbVotes !== null && imdbVotes > 0 && (
                <span className="text-[11px] text-text-tertiary">
                  {appT('discover.modal.detailVotes')}:{' '}
                  {imdbVotes.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 text-[11px] text-text-tertiary">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-fill-secondary/70 px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <i className="i-mingcute-database-2-line" />
            <span>
              {item.sizeBytes ? formatBytesSmart(item.sizeBytes) : '—'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="i-mingcute-time-line" />
            <span>
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="i-mingcute-upload-2-line text-green" />
            <span>{item.seeders ?? 0}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="i-mingcute-download-2-line text-blue" />
            <span>{item.leechers ?? 0}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="i-lucide-dollar-sign" />
            <span>{formatDiscount(item.discount)}</span>
          </span>
          {imdbRuntime && imdbRuntime > 0 && (
            <span className="inline-flex items-center gap-1">
              <i className="i-mingcute-movie-line" />
              <span>{imdbRuntime} min</span>
            </span>
          )}
          {imdbLanguages.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <i className="i-mingcute-translate-2-line" />
              <span>{imdbLanguages.slice(0, 2).join(', ')}</span>
            </span>
          )}
          {imdbCountries.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <i className="i-mingcute-earth-2-line" />
              <span>{imdbCountries.slice(0, 2).join(', ')}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

const DiscoverResultsListContainer: Components<DiscoverItem>['List'] = ({
  ref,
  style,
  ...props
}) => {
  const { className, ...rest } = props as { className?: string }
  return (
    <div
      ref={ref as any}
      style={style}
      className={cn('divide-y divide-border', className)}
      {...(rest as any)}
    />
  )
}

const discoverVirtuosoComponents: Components<DiscoverItem> = {
  List: DiscoverResultsListContainer,
}
