import type { FC } from 'react'
import * as React from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/shallow'

import {
  MENU_ITEM_SEPARATOR,
  MenuItemText,
  useShowContextMenu,
} from '~/atoms/context-menu'
import { Modal } from '~/components/ui/modal'
import { Prompt } from '~/components/ui/prompts'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip/Tooltip'
import { getI18n } from '~/i18n'
import { cn } from '~/lib/cn'
import { CategorySelectPrompt } from '~/modules/dialogs/CategorySelectPrompt'
import { TagsSelectPrompt } from '~/modules/dialogs/TagsSelectPrompt'
import { ShareRatioLimitModal } from '~/modules/modals/ShareRatioLimitModal'
import { DeleteTorrentPrompt } from '~/modules/prompts/DeleteTorrentPrompt'
import {
  openTorrentContent,
  openTorrentSaveLocation,
  revealTorrentContent,
} from '~/modules/torrent/utils/path-actions'

import { NameCell } from '../cells/NameCell'
// Move MemoCell component here from the main file
import { CELL_RENDERERS } from '../cells/StaticCellRenderers'
import { useTorrentSelection } from '../hooks/use-torrent-selection'
import type { TorrentTableVirtualizer } from '../hooks/use-torrent-table-virtualization'
import { TorrentActions, useTorrentDataStore } from '../stores'
import { useTorrentTableSelectors } from '../stores/torrent-table-store'
import type { TorrentTableConfig } from '../TorrentTableList'

const MemoCell: React.FC<{ columnId: string; rowIndex: number }> = React.memo(
  ({ columnId, rowIndex }) => {
    const Renderer = CELL_RENDERERS[columnId as keyof typeof CELL_RENDERERS] as
      | ((p: { rowIndex: number }) => React.ReactNode)
      | undefined

    if (!Renderer) return null
    return (
      <div className={'relative'}>
        <Renderer rowIndex={rowIndex} />
      </div>
    )
  },
)

interface TableBodyProps extends TorrentTableConfig {
  rowVirtualizer: TorrentTableVirtualizer['rowVirtualizer']
  viewportHeight: number
  headerHeight: number
}

export const TableBody: React.FC<TableBodyProps> = (props) => {
  const {
    getRowHeight,
    visibleColumnIds,
    gridTemplateColumns,
    columnOffsets,
    rowVirtualizer,
    viewportHeight,
    headerHeight,
  } = props

  const { selectAndShowDetail } = useTorrentSelection()

  const handleRowClick = React.useCallback(
    (rowIndex: number) => {
      const { sortedTorrents } = useTorrentDataStore.getState()
      const torrent = sortedTorrents[rowIndex]
      if (torrent) selectAndShowDetail(torrent.hash)
    },
    [selectAndShowDetail],
  )

  return (
    <div
      className="relative w-full"
      style={{
        height: rowVirtualizer.getTotalSize(),
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const rowIndex = virtualRow.index
        const rowHeight = getRowHeight(rowIndex)
        const rowTop = virtualRow.start
        const rowBottom = rowTop + rowHeight
        const rawScrollTop = Math.max(
          0,
          Number(rowVirtualizer.scrollOffset || 0),
        )
        const viewportTop = Math.max(0, rawScrollTop - headerHeight)
        const viewportBottom = viewportTop + viewportHeight
        const isStrictInViewport =
          rowBottom > viewportTop && rowTop < viewportBottom
        const isOdd = virtualRow.index % 2 === 0
        return (
          <ActiveCellWrapper
            rowIndex={rowIndex}
            key={virtualRow.key}
            data-index={virtualRow.index}
            role="row"
            className="grid border-b group border-border hover:!bg-accent-10 top-0 left-0 min-w-full absolute data-[odd=true]:bg-background-secondary"
            data-odd={isOdd}
            style={{
              gridTemplateColumns,
              transform: `translateY(${rowTop}px)`,
              height: rowHeight,
            }}
            ref={rowVirtualizer.measureElement}
            onClick={() => handleRowClick(rowIndex)}
          >
            {visibleColumnIds.map((cid: string) => {
              const isSticky = cid === 'name' || cid === 'select'
              const left = isSticky ? (columnOffsets[cid] ?? 0) : undefined

              return isSticky ? (
                <div
                  key={`${cid}-${rowIndex}`}
                  className={cn(
                    'group-data-[odd=true]:bg-background-secondary bg-background group-hover:!bg-accent-10 backdrop-blur-xl group-data-[selected=true]:bg-transparent',

                    "before:content-[''] before:absolute before:bottom-0 before:left-0 before:w-full before:h-px before:bg-border",
                  )}
                  style={
                    isSticky
                      ? {
                          position: 'sticky',
                          left,
                          zIndex: 4,
                        }
                      : undefined
                  }
                >
                  {cid === 'name' ? (
                    <NameCell
                      rowIndex={rowIndex}
                      isInViewport={isStrictInViewport}
                    />
                  ) : (
                    <MemoCell columnId={cid} rowIndex={rowIndex} />
                  )}
                </div>
              ) : (
                <MemoCell
                  key={`${cid}-${rowIndex}`}
                  columnId={cid}
                  rowIndex={rowIndex}
                />
              )
            })}
          </ActiveCellWrapper>
        )
      })}
    </div>
  )
}

const ActiveCellWrapper: FC<
  React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > & { children: React.ReactNode; rowIndex: number }
> = ({ children, rowIndex, className, ...rest }) => {
  const isSelected = useTorrentTableSelectors.useRowActiveByIndex(rowIndex)
  const showContextMenu = useShowContextMenu()

  // Check if this torrent is in sticky filter state
  const stickyStatus = useTorrentDataStore(
    useShallow((state) => {
      const torrent = state.sortedTorrents[rowIndex]
      if (!torrent) return { isSticky: false, remainingTime: 0 }

      const now = Date.now()
      const stickyEntry = state.stickyFilterEntries.find(
        (entry) => entry.hash === torrent.hash,
      )

      if (!stickyEntry) return { isSticky: false, remainingTime: 0 }

      const elapsed = now - stickyEntry.operationTime
      const remainingTime = Math.max(0, 60000 - elapsed) // 1 minute

      return {
        isSticky: remainingTime > 0,
        remainingTime,
      }
    }),
  )

  const handleContextMenu = React.useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const { sortedTorrents, selectedTorrents } =
        useTorrentDataStore.getState()
      const currentTorrent = sortedTorrents[rowIndex]
      const torrents = [...new Set([currentTorrent.hash, ...selectedTorrents])]

      const { t } = getI18n()
      if (!currentTorrent) return

      const items = [
        ...(ELECTRON
          ? ([
              new MenuItemText({
                label: t('contextMenu.openContent'),
                icon: <i className="i-lucide-external-link" />,
                click: () => {
                  void openTorrentContent(currentTorrent)
                },
              }),
              new MenuItemText({
                label: t('contextMenu.revealContent'),
                icon: <i className="i-lucide-eye" />,
                click: () => {
                  void revealTorrentContent(currentTorrent)
                },
              }),
              new MenuItemText({
                label: t('contextMenu.openSaveLocation'),
                icon: <i className="i-lucide-folder-open" />,
                click: () => {
                  void openTorrentSaveLocation(currentTorrent)
                },
              }),
              MENU_ITEM_SEPARATOR,
            ] as const)
          : []),
        new MenuItemText({
          label: t('contextMenu.resume'),
          icon: <i className="i-lucide-play" />,
          click: () => TorrentActions.shared.resumeTorrents(torrents),
        }),
        new MenuItemText({
          label: t('contextMenu.forceResume'),
          icon: <i className="i-lucide-fast-forward" />,
          click: () => TorrentActions.shared.forceResumeTorrents(torrents),
        }),
        new MenuItemText({
          label: t('contextMenu.pause'),
          icon: <i className="i-lucide-pause" />,
          click: () => TorrentActions.shared.pauseTorrents(torrents),
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.delete'),
          icon: <i className="i-lucide-trash-2" />,
          click: () =>
            DeleteTorrentPrompt.show({
              torrentName:
                torrents.length > 1
                  ? t('torrent.multipleSelection')
                  : currentTorrent.name,
              onConfirm: (deleteFiles) =>
                TorrentActions.shared.deleteTorrents(torrents, deleteFiles),
            }),
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.changeSaveLocation'),
          icon: <i className="i-lucide-folder-open" />,
          click: async () => {
            const defaultValue = currentTorrent.save_path || ''
            const newLocation = await Prompt.input({
              title: t('prompts.changeSaveLocation.title'),
              description: t('prompts.changeSaveLocation.description'),
              defaultValue,
              placeholder: t('prompts.changeSaveLocation.placeholder'),
            })
            if (newLocation) {
              TorrentActions.shared.setTorrentLocation(torrents, newLocation)
            }
          },
        }),
        new MenuItemText({
          label: t('contextMenu.rename'),
          icon: <i className="i-lucide-edit-3" />,
          click: async () => {
            const newName = await Prompt.input({
              title: t('prompts.renameTorrent.title'),
              description: t('prompts.renameTorrent.description'),
              defaultValue: currentTorrent.name || '',
              placeholder: t('prompts.renameTorrent.placeholder'),
            })
            if (newName && newName !== currentTorrent.name) {
              TorrentActions.shared.renameTorrent(currentTorrent.hash, newName)
            }
          },
        }),
        new MenuItemText({
          label: t('contextMenu.renameFile'),
          icon: <i className="i-lucide-file-text" />,
          click: () => {
            Prompt.prompt({
              title: t('prompts.renameFile.title'),
              description: t('prompts.renameFile.description'),
              content: t('prompts.renameFile.content'),
              onConfirmText: t('prompts.renameFile.confirmText'),
            })
          },
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.sequentialDownload'),
          icon: <i className="i-lucide-list-ordered" />,
          checked: currentTorrent.seq_dl,
          click: () => TorrentActions.shared.toggleSequentialDownload(torrents),
        }),
        new MenuItemText({
          label: t('contextMenu.firstLastPiecePriority'),
          icon: <i className="i-lucide-arrow-up-down" />,
          checked: currentTorrent.f_l_piece_prio,
          click: () =>
            TorrentActions.shared.toggleFirstLastPiecePriority(torrents),
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.category'),
          icon: <i className="i-lucide-folder" />,
          click: () => {
            CategorySelectPrompt.show({
              currentCategory:
                torrents.length > 1
                  ? t('torrent.multipleCategories')
                  : currentTorrent.category || '',
              onConfirm: async (category: string) => {
                await TorrentActions.shared.setTorrentCategory(
                  torrents,
                  category || undefined,
                )
                toast.success(getI18n().t('messages.categoryUpdated'))
              },
            })
          },
        }),
        new MenuItemText({
          label: t('contextMenu.tags'),
          icon: <i className="i-lucide-tag" />,
          click: () => {
            const currentTags = Array.isArray(currentTorrent.tags)
              ? currentTorrent.tags
              : (currentTorrent.tags || '').split(', ').filter(Boolean)

            TagsSelectPrompt.show({
              currentTags,
              onConfirm: (tags: string[]) => {
                const tagsToAdd = tags.filter(
                  (tag) => !currentTags.includes(tag),
                )
                const tagsToRemove = currentTags.filter(
                  (tag) => !tags.includes(tag),
                )

                // Remove tags first, then add new ones
                if (tagsToRemove.length > 0) {
                  TorrentActions.shared.removeTorrentTags(
                    torrents,
                    tagsToRemove,
                  )
                }
                if (tagsToAdd.length > 0) {
                  TorrentActions.shared.addTorrentTags(torrents, tagsToAdd)
                }
              },
            })
          },
        }),
        new MenuItemText({
          label: t('contextMenu.automaticTorrentManagement'),
          icon: <i className="i-lucide-settings" />,
          checked: currentTorrent.auto_tmm,
          click: () => {
            Prompt.prompt({
              title: t('prompts.automaticTorrentManagement.title'),
              description: t('prompts.automaticTorrentManagement.description'),
              content: t('prompts.automaticTorrentManagement.content'),
              onConfirmText: t('prompts.automaticTorrentManagement.enableText'),
              onCancelText: t('prompts.automaticTorrentManagement.disableText'),
              onConfirm: () =>
                TorrentActions.shared.setAutoManagement(torrents, true),
              onCancel: () =>
                TorrentActions.shared.setAutoManagement(torrents, false),
            })
          },
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.limitDownloadSpeed'),
          icon: <i className="i-lucide-cloud-download" />,
          click: async () => {
            const limit = await Prompt.input({
              title: t('prompts.setDownloadSpeedLimit.title'),
              description: t('prompts.setDownloadSpeedLimit.description'),
              defaultValue: currentTorrent.dl_limit?.toString() || '-1',
              placeholder: t('prompts.setDownloadSpeedLimit.placeholder'),
            })
            if (limit !== null) {
              const limitValue = Number.parseInt(limit, 10)
              if (!Number.isNaN(limitValue)) {
                TorrentActions.shared.setTorrentDownloadLimit(
                  torrents,
                  limitValue,
                )
              }
            }
          },
        }),
        new MenuItemText({
          label: t('contextMenu.limitUploadSpeed'),
          icon: <i className="i-lucide-upload-cloud" />,
          click: async () => {
            const limit = await Prompt.input({
              title: t('prompts.setUploadSpeedLimit.title'),
              description: t('prompts.setUploadSpeedLimit.description'),
              defaultValue: currentTorrent.up_limit?.toString() || '-1',
              placeholder: t('prompts.setUploadSpeedLimit.placeholder'),
            })
            if (limit !== null) {
              const limitValue = Number.parseInt(limit, 10)
              if (!Number.isNaN(limitValue)) {
                TorrentActions.shared.setTorrentUploadLimit(
                  torrents,
                  limitValue,
                )
              }
            }
          },
        }),
        new MenuItemText({
          label: t('contextMenu.limitShareRatio'),
          icon: <i className="i-lucide-percent" />,
          click: () => {
            Modal.present(ShareRatioLimitModal, {
              currentRatio: currentTorrent.ratio_limit,
              currentSeedingTime: currentTorrent.seeding_time_limit,
              currentInactiveSeedingTime: -1, // Not available in TorrentInfo type
              onConfirm: (settings) => {
                TorrentActions.shared.setShareLimits(
                  torrents,
                  settings.ratioLimit,
                  settings.seedingTimeLimit,
                  settings.inactiveSeedingTimeLimit,
                )
              },
            })
          },
        }),
        new MenuItemText({
          label: t('contextMenu.superSeedingMode'),
          icon: <i className="i-lucide-zap" />,
          checked: currentTorrent.super_seeding,
          click: () => {
            Prompt.prompt({
              title: t('prompts.superSeedingMode.title'),
              description: t('prompts.superSeedingMode.description'),
              content: t('prompts.superSeedingMode.content'),
              onConfirmText: t('prompts.superSeedingMode.enableText'),
              onCancelText: t('prompts.superSeedingMode.disableText'),
              onConfirm: () =>
                TorrentActions.shared.setSuperSeeding(torrents, true),
              onCancel: () =>
                TorrentActions.shared.setSuperSeeding(torrents, false),
            })
          },
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.forceRecheck'),
          icon: <i className="i-lucide-refresh-cw" />,
          click: () => TorrentActions.shared.recheckTorrents(torrents),
        }),
        new MenuItemText({
          label: t('contextMenu.forceReannounce'),
          icon: <i className="i-lucide-megaphone" />,
          click: () => TorrentActions.shared.reannounceTorrents(torrents),
        }),
        MENU_ITEM_SEPARATOR,
        new MenuItemText({
          label: t('contextMenu.copy'),
          icon: <i className="i-lucide-copy" />,
          submenu: [
            new MenuItemText({
              label: t('contextMenu.copyMagnetLink'),
              icon: <i className="i-lucide-magnet" />,
              click: () => {
                TorrentActions.shared.copyMagnetLink(currentTorrent.hash)
                toast.success(getI18n().t('messages.magnetCopied'))
              },
            }),
            new MenuItemText({
              label: t('contextMenu.copyName'),
              icon: <i className="i-lucide-type" />,
              click: () => {
                navigator.clipboard?.writeText(currentTorrent.name || '')
                toast.success(getI18n().t('messages.nameCopied'))
              },
            }),
          ],
        }),
      ]

      await showContextMenu(items, e)
    },
    [rowIndex, showContextMenu],
  )
  return (
    <div
      onContextMenu={handleContextMenu}
      data-selected={isSelected}
      className={cn(
        'relative group/actice-cell',
        isSelected && '!bg-accent/10',
        stickyStatus.isSticky && 'bg-orange/5 border-l-2 border-l-orange/50',
        className,
      )}
      {...rest}
    >
      {children}
      {/* Sticky indicator */}
      {stickyStatus.isSticky && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute z-10 top-1 left-1 flex items-center gap-1 cursor-help">
              <div className="size-2 rounded-full bg-orange animate-pulse" />
              <span className="text-xs text-orange font-medium opacity-75">
                {Math.ceil(stickyStatus.remainingTime / 1000)}s
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <div className="max-w-xs">
              {getI18n().t('torrent.stickyFilter.tooltip', {
                seconds: Math.ceil(stickyStatus.remainingTime / 1000),
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
