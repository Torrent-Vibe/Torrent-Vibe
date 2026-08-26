import type { AgentChatContext } from '@torrent-vibe/shared'
import { useTranslation } from 'react-i18next'

import { useTorrentDataStore } from '~/modules/torrent/stores/torrent-data-store'

import { AgentChatActions } from '../actions'

const actions = AgentChatActions.shared

const ContextChip = ({
  icon,
  label,
  onRemove,
}: {
  icon: string
  label: string
  onRemove?: () => void
}) => {
  const { t } = useTranslation()
  const className =
    'inline-flex h-6 max-w-56 shrink-0 items-center gap-1.5 rounded-md bg-fill-secondary px-2 text-[11px] text-text-secondary'
  const content = (
    <>
      <i className={`${icon} shrink-0 text-text-tertiary`} />
      <span className="truncate">{label}</span>
      {onRemove ? <i className="i-mingcute-close-line shrink-0" /> : null}
    </>
  )

  return onRemove ? (
    <button
      aria-label={t('agent.context.remove', { label })}
      className={`${className} transition-colors hover:bg-fill-tertiary hover:text-text`}
      title={t('agent.context.remove', { label })}
      type="button"
      onClick={onRemove}
    >
      {content}
    </button>
  ) : (
    <span className={className} title={label}>
      {content}
    </span>
  )
}

export const AgentContextChips = ({
  context,
  label,
  multiServer = false,
  removable = false,
  variant = 'snapshot',
}: {
  context: AgentChatContext
  label: string
  multiServer?: boolean
  removable?: boolean
  variant?: 'composer' | 'snapshot'
}) => {
  const { t, i18n } = useTranslation()
  const selectedName = useTorrentDataStore((state) => {
    const hash = context.selectedTorrentHashes[0]
    return hash ? (state.torrentsByHash[hash]?.name ?? null) : null
  })
  const filter = context.filter
  const filterLabel = [
    ...(filter?.statuses ?? []).map((status) => {
      const key = `torrent.filters.${status}`
      return i18n.exists(key) ? String(t(key as never)) : status
    }),
    ...(filter?.categories ?? []),
    ...(filter?.tags ?? []).map((tag) => `#${tag}`),
  ].join(' · ')
  const serverLabel = context.activeServerName || t('agent.context.noServer')
  const showServer =
    variant === 'snapshot' ||
    (multiServer &&
      (!context.activeServerId ||
        context.selectedTorrentHashes.length > 0 ||
        Boolean(filterLabel) ||
        Boolean(context.filter?.search)))
  const selectedCount = context.selectedTorrentHashes.length
  const selectedLabel = selectedName
    ? selectedCount > 1
      ? t('agent.context.selectedNamed', {
          count: selectedCount - 1,
          name: selectedName,
        })
      : selectedName
    : t('agent.context.selected', { count: selectedCount })

  return (
    <div
      aria-label={label}
      className="flex min-w-0 flex-nowrap items-center gap-1.5"
      data-agent-context={variant}
    >
      {showServer ? (
        <ContextChip
          icon="i-mingcute-server-line"
          label={serverLabel}
          onRemove={
            removable && context.activeServerId
              ? () => actions.removeDraftContextPart('server')
              : undefined
          }
        />
      ) : null}
      {selectedCount > 0 ? (
        <ContextChip
          icon="i-mingcute-check-circle-line"
          label={selectedLabel}
          onRemove={
            removable
              ? () => actions.removeDraftContextPart('selection')
              : undefined
          }
        />
      ) : null}
      {filterLabel ? (
        <ContextChip
          icon="i-mingcute-filter-2-line"
          label={filterLabel}
          onRemove={
            removable
              ? () => actions.removeDraftContextPart('filter')
              : undefined
          }
        />
      ) : null}
      {filter?.search ? (
        <ContextChip
          icon="i-mingcute-search-2-line"
          label={`“${filter.search}”`}
          onRemove={
            removable
              ? () => actions.removeDraftContextPart('search')
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
