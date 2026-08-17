import { useTranslation } from 'react-i18next'

import { clsxm } from '~/lib/cn'
import type { TorrentInfo } from '~/types/torrent'

interface HeaderCellProps {
  align?: 'left' | 'center' | 'right'
  cellClassName?: string
  columnKey: keyof TorrentInfo | 'select'
  label: I18nKeys
  onSort?: (key: keyof TorrentInfo, direction: 'asc' | 'desc') => void
  sortable?: boolean
  sortDirection?: 'asc' | 'desc'
  sortKey?: keyof TorrentInfo
}

export const HeaderCell = ({
  label,
  sortable = false,
  onSort,
  sortKey,
  sortDirection,
  columnKey,
  align = 'left',
  cellClassName,
}: HeaderCellProps) => {
  const { t } = useTranslation()
  const handleSort = () => {
    if (!onSort || !sortable || columnKey === 'select') return

    const newDirection =
      sortKey === columnKey && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(columnKey as keyof TorrentInfo, newDirection)
  }

  const getSortIcon = () => {
    if (!sortable || columnKey === 'select') return null

    if (sortKey !== columnKey) {
      return null
    }
    return sortDirection === 'asc' ? (
      <i className="i-mingcute-arrow-up-line !text-accent shrink-0" />
    ) : (
      <i className="i-mingcute-arrow-down-line !text-accent shrink-0" />
    )
  }

  const alignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[align]

  return (
    <div
      className={clsxm(
        'flex items-center px-2 py-2 absolute inset-0 justify-center border-border border-r last:border-r-0',
        cellClassName,
      )}
    >
      {sortable && onSort ? (
        <button
          className={`flex items-center w-full ${alignmentClass} gap-2 text-sm font-semibold text-text-secondary hover:text-accent transition-colors`}
          type="button"
          onClick={handleSort}
        >
          <span>{t(label)}</span>
          {getSortIcon()}
        </button>
      ) : (
        <span className="text-sm font-semibold text-text-secondary">
          {t(label)}
        </span>
      )}
    </div>
  )
}
