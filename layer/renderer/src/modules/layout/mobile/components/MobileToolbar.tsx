import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { MenuItemText, useShowContextMenu } from '~/atoms/context-menu'
import { Button } from '~/components/ui/button/Button'
import { Prompt } from '~/components/ui/prompts'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select/Select'
import { getI18n } from '~/i18n'
import { cn } from '~/lib/cn'
import { useQBMutation } from '~/lib/query/query-hooks'
import { useCategoriesWithCounts } from '~/modules/torrent/hooks/use-categories'
import { useTagsWithCounts } from '~/modules/torrent/hooks/use-tags'
import { useTorrentStats } from '~/modules/torrent/hooks/use-torrent-computed'
import {
  torrentDataStoreSetters,
  useTorrentDataStore,
} from '~/modules/torrent/stores/torrent-data-store'
import {
  selectFilterState,
  selectSortState,
} from '~/modules/torrent/stores/torrent-selectors'
import type { TorrentFilterState } from '~/modules/torrent/types/store'
import type { TorrentInfo } from '~/types/torrent'

import { OverflowMenuButton } from './MobileToolbarOverflowMenu'

interface FilterStat {
  key: TorrentFilterState
  label: string
  count: number
  icon: string
  color: string
}

interface MobileToolbarProps {
  className?: string
  compact?: boolean
}

type FilterSelectValue =
  | 'all'
  | 'downloading'
  | 'seeding'
  | 'completed'
  | 'paused'
  | 'error'
  | `category:${string}`
  | `tag:${string}`

export const MobileToolbar = ({
  className,
  compact = false,
}: MobileToolbarProps) => {
  const stats = useTorrentStats()
  const { categories } = useCategoriesWithCounts()
  const { t } = useTranslation()
  const { tags } = useTagsWithCounts()
  const filterState = useTorrentDataStore(selectFilterState)
  const sortState = useTorrentDataStore(selectSortState)
  const showContextMenuHandler = useShowContextMenu()

  // Mutations for category/tag management
  const createCategoryMutation = useQBMutation.categories.create()
  const createTagMutation = useQBMutation.tags.create()

  const setFilter = (filter: TorrentFilterState) => {
    torrentDataStoreSetters.setFilter(filter)
  }

  // Convert current filter state to select value
  const currentSelectValue: FilterSelectValue = useMemo(() => {
    if (typeof filterState === 'string') {
      return filterState as FilterSelectValue
    }
    if (filterState.type === 'category') {
      return `category:${filterState.value}` as FilterSelectValue
    }
    if (filterState.type === 'tag') {
      return `tag:${filterState.value}` as FilterSelectValue
    }
    return 'all'
  }, [filterState])

  // Status filter stats
  const statusFilters: FilterStat[] = useMemo(
    () => [
      {
        key: 'all',
        label: 'All Torrents',
        count: stats.total,
        icon: 'i-mingcute-folder-line',
        color: 'text-text',
      },
      {
        key: 'downloading',
        label: 'Downloading',
        count: stats.downloading,
        icon: 'i-mingcute-download-line',
        color: 'text-blue',
      },
      {
        key: 'seeding',
        label: 'Seeding',
        count: stats.seeding,
        icon: 'i-mingcute-upload-line',
        color: 'text-green',
      },
      {
        key: 'completed',
        label: 'Completed',
        count: stats.completed,
        icon: 'i-mingcute-check-circle-line',
        color: 'text-green',
      },
      {
        key: 'paused',
        label: 'Paused',
        count: stats.paused,
        icon: 'i-mingcute-pause-circle-line',
        color: 'text-orange',
      },
      {
        key: 'error',
        label: 'Error',
        count: stats.error,
        icon: 'i-mingcute-close-circle-line',
        color: 'text-red',
      },
    ],
    [stats],
  )

  // Get display text for current filter
  const currentFilterDisplay = useMemo(() => {
    if (typeof filterState === 'string') {
      const statusFilter = statusFilters.find((f) => f.key === filterState)
      return statusFilter
        ? `${statusFilter.label} (${statusFilter.count})`
        : 'All Torrents'
    }
    if (filterState.type === 'category') {
      const category = categories.find((c) => c.name === filterState.value)
      return `${filterState.value} (${category?.count || 0})`
    }
    if (filterState.type === 'tag') {
      const tag = tags.find((t) => t.name === filterState.value)
      return `#${filterState.value} (${tag?.count || 0})`
    }
    return 'All Torrents'
  }, [filterState, statusFilters, categories, tags])

  const handleFilterChange = (value: FilterSelectValue) => {
    if (value.startsWith('category:')) {
      const categoryName = value.replace('category:', '')
      setFilter({ type: 'category', value: categoryName })
    } else if (value.startsWith('tag:')) {
      const tagName = value.replace('tag:', '')
      setFilter({ type: 'tag', value: tagName })
    } else {
      setFilter(value as TorrentFilterState)
    }
  }

  const handleAddCategory = useCallback(async () => {
    const result = await Prompt.input({
      title: 'Add Category',
      description: 'Create a new category for organizing your torrents',
      placeholder: 'Enter category name...',
      onConfirmText: 'Create',
      onCancelText: 'Cancel',
    })

    if (result && result.trim()) {
      try {
        await createCategoryMutation.mutateAsync({
          name: result.trim(),
          savePath: '',
        })
      } catch (error) {
        console.error(`${getI18n().t('messages.torrentsAddFailed')}:`, error)
      }
    }
  }, [createCategoryMutation])

  const handleAddTag = useCallback(async () => {
    const result = await Prompt.input({
      title: 'Add Tag',
      description: 'Create a new tag for organizing your torrents',
      placeholder: 'Enter tag name...',
      onConfirmText: 'Create',
      onCancelText: 'Cancel',
    })

    if (result && result.trim()) {
      try {
        await createTagMutation.mutateAsync([result.trim()])
      } catch (error) {
        console.error(`${getI18n().t('messages.torrentsAddFailed')}:`, error)
      }
    }
  }, [createTagMutation])

  // Sort handling - separated field and direction
  const handleSortFieldChange = useCallback(
    (sortKey: string) => {
      torrentDataStoreSetters.setSorting(
        sortKey as keyof TorrentInfo,
        sortState.sortDirection,
      )
    },
    [sortState.sortDirection],
  )

  const handleSortDirectionToggle = useCallback(() => {
    const newDirection = sortState.sortDirection === 'asc' ? 'desc' : 'asc'
    torrentDataStoreSetters.setSorting(sortState.sortKey, newDirection)
  }, [sortState.sortKey, sortState.sortDirection])

  const handleToolbarContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const menuItems = [
        new MenuItemText({
          label: t('contextMenu.addCategory'),
          icon: <i className="i-mingcute-folder-add-line" />,
          click: handleAddCategory,
        }),
        new MenuItemText({
          label: t('contextMenu.addTag'),
          icon: <i className="i-mingcute-hashtag-line" />,
          click: handleAddTag,
        }),
      ]

      await showContextMenuHandler(menuItems, e)
    },
    [showContextMenuHandler, handleAddCategory, handleAddTag],
  )

  return (
    <div
      className={cn(
        'border-b border-border',
        compact ? 'px-2 py-1' : 'px-2 py-2',
        className,
      )}
      onContextMenu={handleToolbarContextMenu}
    >
      <div className="flex items-center gap-1">
        {/* Filter Dropdown - Takes most space */}
        <div className="flex-1 min-w-0">
          <Select value={currentSelectValue} onValueChange={handleFilterChange}>
            <SelectTrigger
              className={cn(
                'w-full text-left border-0 shadow-none',
                compact ? 'h-7 text-xs px-2' : 'h-9 text-sm',
              )}
            >
              <SelectValue>
                <div className="flex items-center gap-1.5 min-w-0">
                  <i
                    className={cn(
                      'i-mingcute-filter-line ml-2 text-text-secondary shrink-0',
                      compact ? 'text-xs' : 'text-sm',
                    )}
                  />
                  <span
                    className={cn(
                      'truncate font-medium pl-1',
                      compact ? 'text-xs' : 'text-sm',
                    )}
                  >
                    {currentFilterDisplay}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="item-aligned">
              {/* Status Filters */}
              <SelectGroup>
                <SelectLabel>Status</SelectLabel>
                {statusFilters.map((filter) => (
                  <SelectItem
                    key={filter.key as string}
                    value={filter.key as string}
                    disabled={filter.count === 0 && filter.key !== 'all'}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <i className={cn(filter.icon, filter.color)} />
                        <span>{filter.label}</span>
                      </div>
                      <span className="text-xs text-text-secondary ml-2">
                        {filter.count}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>

              {/* Categories */}
              {categories.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Categories</SelectLabel>
                    {categories.map((category) => (
                      <SelectItem
                        key={category.name}
                        value={`category:${category.name}`}
                        disabled={category.count === 0}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <i className="i-mingcute-folder-line text-blue" />
                            <span>{category.name}</span>
                          </div>
                          <span className="text-xs text-text-secondary ml-2">
                            {category.count}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Tags</SelectLabel>
                    {tags.map((tag) => (
                      <SelectItem
                        key={tag.name}
                        value={`tag:${tag.name}`}
                        disabled={tag.count === 0}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <i className="i-mingcute-hashtag-line text-green" />
                            <span>#{tag.name}</span>
                          </div>
                          <span className="text-xs text-text-secondary ml-2">
                            {tag.count}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Overflow Menu Button - Contains sorting and other options */}
        <OverflowMenuButton
          compact={compact}
          sortState={sortState}
          onSortFieldChange={handleSortFieldChange}
          onSortDirectionToggle={handleSortDirectionToggle}
        />

        {/* Clear Filter Button - Only show when filter is active */}
        {(typeof filterState === 'object' || filterState !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('all')}
            className={cn(
              'shrink-0 text-text-tertiary hover:text-text',
              compact ? 'px-1.5 py-1 h-7' : 'px-2 py-1.5 h-9',
            )}
            title="Clear filter"
          >
            <i
              className={cn(
                'i-mingcute-close-line',
                compact ? 'text-xs' : 'text-sm',
              )}
            />
          </Button>
        )}
      </div>
    </div>
  )
}

// Simplified mobile toolbar for when space is very limited
export const MobileCompactToolbar = ({ className }: { className?: string }) => {
  const stats = useTorrentStats()
  const filterState = useTorrentDataStore(selectFilterState)

  const activeFilter = useMemo(() => {
    switch (filterState) {
      case 'downloading': {
        return {
          label: 'Downloading',
          count: stats.downloading,
          icon: 'i-mingcute-download-2-line',
          color: 'text-blue',
        }
      }
      case 'seeding': {
        return {
          label: 'Seeding',
          count: stats.seeding,
          icon: 'i-mingcute-upload-2-line',
          color: 'text-green',
        }
      }
      case 'completed': {
        return {
          label: 'Completed',
          count: stats.completed,
          icon: 'i-mingcute-check-circle-line',
          color: 'text-green',
        }
      }
      case 'paused': {
        return {
          label: 'Paused',
          count: stats.paused,
          icon: 'i-mingcute-pause-circle-line',
          color: 'text-orange',
        }
      }
      case 'error': {
        return {
          label: 'Error',
          count: stats.error,
          icon: 'i-mingcute-close-circle-line',
          color: 'text-red',
        }
      }
      default: {
        return {
          label: 'All Torrents',
          count:
            stats.downloading +
            stats.seeding +
            stats.paused +
            stats.completed +
            stats.error,
          icon: 'i-mingcute-folder-line',
          color: 'text-text-secondary',
        }
      }
    }
  }, [filterState, stats])

  return (
    <div
      className={cn(
        'flex items-center justify-center px-4 py-2 bg-background border-b border-border',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <i className={cn(activeFilter.icon, activeFilter.color)} />
        <span className="font-medium text-text">{activeFilter.label}</span>
        {activeFilter.count > 0 && (
          <span className="px-2 py-0.5 bg-material-medium rounded-full text-xs font-mono text-text-secondary">
            {activeFilter.count}
          </span>
        )}
      </div>
    </div>
  )
}
