import * as React from 'react'
import { useTranslation } from 'react-i18next'

import {
  MENU_ITEM_SEPARATOR,
  MenuItemText,
  useShowContextMenu,
} from '~/atoms/context-menu'

import { getAllColumns } from '../constants'
import {
  getTorrentTableActions,
  useTorrentTableSelectors,
} from '../stores/torrent-table-store'

export interface TorrentTableColumnMenu {
  openColumnsMenu: (e: React.MouseEvent) => void
}

export const useTorrentTableColumnMenu = (): TorrentTableColumnMenu => {
  const { t } = useTranslation()
  const columnVisibility = useTorrentTableSelectors.useColumnVisibility()
  const actions = getTorrentTableActions()

  const showContextMenu = useShowContextMenu()

  // Column chooser menu
  const openColumnsMenu = React.useCallback(
    (e: React.MouseEvent) => {
      const allColumns = getAllColumns()
      const items = [
        ...allColumns
          .filter((c) => c.id !== 'select' && c.enableHiding !== false)
          .map((c) => {
            const columnId = c.id as string
            // Map column IDs to translation keys
            const columnKeyMap: Record<string, string> = {
              name: t('torrent.columns.name'),
              size: t('torrent.columns.size'),
              progress: t('torrent.columns.progress'),
              dlspeed: t('torrent.columns.downloadSpeed'),
              upspeed: t('torrent.columns.uploadSpeed'),
              eta: t('torrent.columns.eta'),
              ratio: t('torrent.columns.ratio'),
              state: t('torrent.columns.status'),
              priority: t('torrent.columns.priority'),
              tracker: t('torrent.columns.tracker'),
              category: t('torrent.columns.category'),
              tags: t('torrent.columns.tags'),
              num_seeds: t('torrent.columns.seeds'),
              num_leechs: t('torrent.columns.peers'),
              downloaded: t('torrent.columns.downloaded'),
              uploaded: t('torrent.columns.uploaded'),
              amount_left: t('torrent.columns.remaining'),
              time_active: t('torrent.columns.activeTime'),
              seeding_time: t('torrent.columns.seedingTime'),
              added_on: t('torrent.columns.addedOn'),
              completion_on: t('torrent.columns.completedOn'),
              last_activity: t('torrent.columns.lastActivity'),
              save_path: t('torrent.columns.savePath'),
            }
            const label = columnKeyMap[columnId] || columnId
            return new MenuItemText({
              label,
              checked: columnVisibility[columnId] !== false,
              click: () => {
                actions.updateColumnVisibility((prev) => {
                  const next = { ...prev }
                  const willHide = next[columnId] !== false
                  // Prevent hiding last visible column (besides select and non-hideable columns)
                  const numVisible = allColumns.filter(
                    (x) =>
                      x.id !== 'select' &&
                      x.enableHiding !== false &&
                      next[x.id as string] !== false,
                  ).length
                  if (willHide && numVisible <= 1) return prev
                  next[columnId] = willHide ? false : true
                  // sync array form
                  const visible = allColumns
                    .filter((x) => x.id !== 'select')
                    .map((x) => x.id as string)
                    .filter((k) => next[k] !== false)
                  actions.setVisibleColumns(visible)
                  return next
                })
              },
            })
          }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: 'Reset columns',
          click: actions.resetToDefaults,
          icon: React.createElement('i', {
            className: 'i-lucide-rotate-ccw',
          }),
        }),
      ]
      showContextMenu(items, e)
    },
    [columnVisibility, showContextMenu, actions, t],
  )

  return {
    openColumnsMenu,
  }
}
