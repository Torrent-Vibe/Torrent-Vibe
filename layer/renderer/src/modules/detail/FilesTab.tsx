import clsx from 'clsx'
import { m } from 'motion/react'
import type { MouseEvent } from 'react'
import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { Components } from 'react-virtuoso'
import { Virtuoso } from 'react-virtuoso'

import { MenuItemText, useShowContextMenu } from '~/atoms/context-menu'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select/Select'
import { useMobile } from '~/hooks/common'
import { formatBytes } from '~/lib/format'
import { Spring } from '~/lib/spring'
import { runTorrentRelativePathAction } from '~/modules/torrent/utils/path-actions'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'
import type { TorrentFile, TorrentInfo } from '~/types/torrent'

import type { FileTreeNode } from '../layout/utils/file-tree'
import {
  buildFileTree,
  calculateFolderStats,
  getSelectedFileIndices,
  mergeExpansionState,
  setAllExpanded,
  toggleNodeExpansion,
  toggleNodeSelection,
} from '../layout/utils/file-tree'

interface FilesTabProps {
  files?: TorrentFile[]
  torrentHash?: string
  torrent?: TorrentInfo
  isLoading?: boolean
}

interface FileRowProps {
  node: FileTreeNode
  depth: number
  onToggleSelection: (path: string, selected: boolean) => void
  onToggleExpansion: (path: string) => void
  onSetFilePriority: (fileIndex: number, priority: 0 | 1 | 6 | 7) => void
  canOpenPaths: boolean
  onOpenNode?: (node: FileTreeNode) => void
  onRevealNode?: (node: FileTreeNode) => void
}

const FileRow = memo(
  ({
    node,
    depth,
    onToggleSelection,
    onToggleExpansion,
    onSetFilePriority,
    canOpenPaths,
    onOpenNode,
    onRevealNode,
  }: FileRowProps) => {
    const { t } = useTranslation()
    const showContextMenu = useShowContextMenu()
    const stats = useMemo(() => calculateFolderStats(node), [node])
    const isFolder = node.type === 'folder'

    const handleCheckboxChange = useCallback(() => {
      onToggleSelection(node.fullPath, !node.isSelected)
    }, [node.fullPath, node.isSelected, onToggleSelection])

    const handleExpansionToggle = useCallback(() => {
      if (isFolder) {
        onToggleExpansion(node.fullPath)
      }
    }, [isFolder, node.fullPath, onToggleExpansion])

    const handlePriorityChange = useCallback(
      (priority: 0 | 1 | 6 | 7) => {
        if (node.index !== undefined) {
          onSetFilePriority(node.index, priority)
        }
      },
      [node.index, onSetFilePriority],
    )

    const handleContextMenu = useCallback(
      async (event: MouseEvent<HTMLDivElement>) => {
        if (!canOpenPaths || !onOpenNode || !onRevealNode) return

        event.preventDefault()

        const items = [
          new MenuItemText({
            label:
              node.type === 'file'
                ? t('contextMenu.openFile')
                : t('contextMenu.openFolder'),
            icon: (
              <i
                className={
                  node.type === 'file'
                    ? 'i-lucide-external-link'
                    : 'i-lucide-folder-open'
                }
              />
            ),
            click: () => {
              void onOpenNode(node)
            },
          }),
          new MenuItemText({
            label: t('contextMenu.revealContent'),
            icon: <i className="i-lucide-eye" />,
            click: () => {
              void onRevealNode(node)
            },
          }),
        ]

        await showContextMenu(items, event)
      },
      [canOpenPaths, node, onOpenNode, onRevealNode, showContextMenu, t],
    )

    const progressPercentage = isFolder
      ? stats.totalSize > 0
        ? (stats.completedSize / stats.totalSize) * 100
        : 0
      : (node.progress || 0) * 100

    const priorityLabel = isFolder
      ? `${stats.selectedFiles}/${stats.totalFiles}`
      : (() => {
          switch (node.priority) {
            case 0: {
              return 'Skip'
            }
            case 1: {
              return 'Normal'
            }
            case 6: {
              return 'High'
            }
            case 7: {
              return 'Max'
            }
            default: {
              return 'Normal'
            }
          }
        })()

    return (
      <>
        <m.div
          className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-2 px-1.5 py-1.5 hover:bg-fill-secondary/30 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={Spring.smooth(0.25)}
          onContextMenu={handleContextMenu}
        >
          {/* Expand */}
          <div className="w-4 flex items-center justify-center">
            {isFolder ? (
              <button
                type="button"
                onClick={handleExpansionToggle}
                className="text-text-secondary hover:text-accent transition-colors"
              >
                <i
                  className={
                    node.isExpanded
                      ? 'i-mingcute-down-line text-xs'
                      : 'i-mingcute-right-line text-xs'
                  }
                />
              </button>
            ) : (
              <span className="inline-block w-4" />
            )}
          </div>

          {/* Checkbox */}
          <Checkbox
            checked={!!node.isSelected}
            indeterminate={!!node.isPartiallySelected}
            onCheckedChange={handleCheckboxChange}
            aria-label={node.name}
            className="size-4"
          />

          {/* Name + progress inline */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center rounded bg-fill-tertiary">
              <i
                className={
                  isFolder
                    ? 'i-mingcute-folder-2-line text-accent text-sm'
                    : 'i-mingcute-file-line text-accent text-sm'
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-sm font-medium"
                title={node.fullPath}
              >
                {node.name}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="relative h-1.5 w-28 overflow-hidden rounded bg-fill">
                  <div
                    className="absolute inset-y-0 left-0 bg-accent"
                    style={{ width: `${progressPercentage.toFixed(1)}%` }}
                  />
                </div>
                <span className="text-xs text-text-secondary">
                  {progressPercentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Size */}
          <div className="text-xs text-text-secondary tabular-nums">
            {formatBytes(isFolder ? stats.totalSize : node.size || 0)}
          </div>

          {/* Priority */}
          <div className="text-xs">
            {isFolder ? (
              <span className="text-text-secondary">{priorityLabel}</span>
            ) : (
              <Select
                value={String(node.priority ?? 1)}
                onValueChange={(value) =>
                  handlePriorityChange(Number(value) as 0 | 1 | 6 | 7)
                }
              >
                <SelectTrigger size="sm" className="min-w-[92px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Skip</SelectItem>
                  <SelectItem value="1">Normal</SelectItem>
                  <SelectItem value="6">High</SelectItem>
                  <SelectItem value="7">Max</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </m.div>

        {/* Children are rendered via virtualization (flatRows) */}
      </>
    )
  },
)

export const FilesTab = ({
  files,
  torrentHash,
  torrent,
  isLoading,
}: FilesTabProps) => {
  const [fileTreeState, setFileTree] = useState<FileTreeNode[]>([])
  // Low priority update
  const fileTree = useDeferredValue(fileTreeState)

  // Build tree when files change
  const tree = useMemo(() => {
    if (!files?.length) return []
    return buildFileTree(files)
  }, [files])

  // Update local tree state when built tree changes (preserve expansion state)
  // Use effect for side-effectful state updates
  useMemo(() => {
    startTransition(() => {
      setFileTree((prev) => mergeExpansionState(prev, tree))
    })
  }, [tree])

  const handleToggleSelection = useCallback(
    async (path: string, selected: boolean) => {
      let snapshot: FileTreeNode[] = []
      startTransition(() => {
        setFileTree((prev) => {
          snapshot = toggleNodeSelection(prev, path, selected)
          return snapshot
        })
      })

      if (!torrentHash) return
      const selectedIndices = getSelectedFileIndices(snapshot)
      const unselectedIndices =
        files
          ?.filter((_, index) => !selectedIndices.includes(index))
          .map((_, index) => index) || []

      try {
        if (selectedIndices.length > 0) {
          await QBittorrentClient.shared.requestSetFilePriority(
            torrentHash,
            selectedIndices,
            1,
          )
        }
        if (unselectedIndices.length > 0) {
          await QBittorrentClient.shared.requestSetFilePriority(
            torrentHash,
            unselectedIndices,
            0,
          )
        }
      } catch (error) {
        console.error('Failed to sync selection to server:', error)
      }
    },
    [torrentHash, files],
  )

  const handleToggleExpansion = useCallback((path: string) => {
    setFileTree((prev) => toggleNodeExpansion(prev, path))
  }, [])

  const handleExpandAll = useCallback(() => {
    setFileTree((prev) => setAllExpanded(prev, true))
  }, [])

  const handleCollapseAll = useCallback(() => {
    setFileTree((prev) => setAllExpanded(prev, false))
  }, [])

  const handleSetFilePriority = useCallback(
    async (fileIndex: number, priority: 0 | 1 | 6 | 7) => {
      if (!torrentHash) return

      try {
        await QBittorrentClient.shared.requestSetFilePriority(
          torrentHash,
          [fileIndex],
          priority,
        )
      } catch (error) {
        console.error('Failed to set file priority:', error)
      }
    },
    [torrentHash],
  )

  const selectedCount = useMemo(() => {
    return getSelectedFileIndices(fileTree).length
  }, [fileTree])

  const totalCount = files?.length || 0

  const isMobile = useMobile()
  const canOpenPaths = Boolean(ELECTRON && torrent)

  const handleOpenNode = useCallback(
    (node: FileTreeNode) => {
      if (!torrent || !ELECTRON) return

      const action = node.type === 'folder' ? 'open-folder' : 'open'
      void runTorrentRelativePathAction(torrent, node.fullPath, action)
    },
    [torrent],
  )

  const handleRevealNode = useCallback(
    (node: FileTreeNode) => {
      if (!torrent || !ELECTRON) return

      void runTorrentRelativePathAction(torrent, node.fullPath, 'reveal')
    },
    [torrent],
  )

  // Flatten visible tree for virtualization
  const flatRows = useMemo(() => {
    const out: Array<{ node: FileTreeNode; depth: number }> = []
    const walk = (nodes: FileTreeNode[], depth: number) => {
      for (const n of nodes) {
        out.push({ node: n, depth })
        if (n.type === 'folder' && n.isExpanded && n.children?.length) {
          walk(n.children, depth + 1)
        }
      }
    }
    walk(fileTree, 0)
    return out
  }, [fileTree])

  const itemContent = useCallback(
    (_, row: RowData) => (
      <FileRow
        key={row.node.fullPath}
        node={row.node}
        depth={row.depth}
        onToggleSelection={handleToggleSelection}
        onToggleExpansion={handleToggleExpansion}
        onSetFilePriority={handleSetFilePriority}
        canOpenPaths={canOpenPaths}
        onOpenNode={handleOpenNode}
        onRevealNode={handleRevealNode}
      />
    ),
    [
      canOpenPaths,
      handleOpenNode,
      handleRevealNode,
      handleSetFilePriority,
      handleToggleExpansion,
      handleToggleSelection,
    ],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <m.div
          className="size-6 border-3 border-accent border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  if (!files?.length) {
    return (
      <div className="text-sm text-text-secondary text-center p-6">
        <i className="i-mingcute-folder-line text-2xl text-accent mb-2 block" />
        No files available
      </div>
    )
  }

  return (
    <div className="space-y-2.5 @container flex flex-col flex-1 min-h-0 min-w-0">
      {/* Toolbar */}
      <div className="flex items-center w-full justify-between px-1.5">
        <div className="flex items-center gap-3 justify-between w-full">
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExpandAll}
              className="text-xs px-3 py-2 rounded-lg"
            >
              <i className="i-lucide-unfold-vertical" />
              <span className="ml-1 hidden @[320px]:inline"> Expand All </span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCollapseAll}
              className="text-xs px-3 py-2 rounded-lg"
            >
              <i className="i-lucide-fold-vertical" />
              <span className="ml-1 hidden @[320px]:inline">
                {' '}
                Collapse All{' '}
              </span>
            </Button>
          </div>

          <span className="text-xs text-text-secondary">
            {selectedCount} / {totalCount} selected
          </span>
        </div>
      </div>

      {/* File Tree */}
      <div
        className={clsx(
          !isMobile ? 'h-[60vh] -mx-4 -mb-4' : 'h-0 grow -mx-4 -mb-4',
        )}
      >
        <Virtuoso<{ node: FileTreeNode; depth: number }>
          style={{ height: '100%' }}
          data={flatRows}
          components={{ Scroller: FilesScroller, Item: FilesItem }}
          itemContent={itemContent}
        />
      </div>
    </div>
  )
}

// Keep custom components stable across renders
type RowData = { node: FileTreeNode; depth: number }
const FilesScroller: Components<RowData>['Scroller'] = ({
  ref,
  style,
  ...props
}) => {
  return (
    <div
      ref={ref as any}
      style={style}
      className={clsx((props as any).className, 'px-4 pb-4 [&>div]:left-0')}
      {...(props as any)}
    />
  )
}

const FilesItem: Components<RowData>['Item'] = ({ ...props }) => (
  <div className={'mb-0.5 last:mb-0'} {...props} />
)
