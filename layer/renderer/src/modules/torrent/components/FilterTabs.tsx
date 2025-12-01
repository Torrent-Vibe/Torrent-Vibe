import clsx from 'clsx'
import { m } from 'motion/react'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { MenuItemText, useShowContextMenu } from '~/atoms/context-menu'
import { Prompt } from '~/components/ui/prompts'
import { useQBMutation } from '~/lib/query/query-hooks'
import { Spring } from '~/lib/spring'

import { useCategoriesWithCounts } from '../hooks/use-categories'
import { useTorrentStats } from '../hooks/use-torrent-computed'
import {
  torrentDataStoreSetters,
  useTorrentDataStore,
} from '../stores/torrent-data-store'
import { selectFilterState } from '../stores/torrent-selectors'

type FilterKey =
  | 'all'
  | 'downloading'
  | 'seeding'
  | 'completed'
  | 'paused'
  | 'error'

const TAB_CONFIGS: Array<{
  key: FilterKey
  labelKey: I18nKeys
  icon: string
  color: string
}> = [
  {
    key: 'all',
    labelKey: 'torrent.filters.all',
    icon: 'i-lucide-folder',
    color: 'text-text',
  },
  {
    key: 'downloading',
    labelKey: 'torrent.filters.downloading',
    icon: 'i-lucide-download-cloud',
    color: 'text-blue',
  },
  {
    key: 'seeding',
    labelKey: 'torrent.filters.seeding',
    icon: 'i-lucide-upload-cloud',
    color: 'text-green',
  },
  {
    key: 'completed',
    labelKey: 'torrent.filters.completed',
    icon: 'i-lucide-check-circle',
    color: 'text-green',
  },
  {
    key: 'paused',
    labelKey: 'torrent.filters.paused',
    icon: 'i-lucide-pause-circle',
    color: 'text-orange',
  },
  {
    key: 'error',
    labelKey: 'torrent.filters.error',
    icon: 'i-lucide-x-circle',
    color: 'text-red',
  },
]

const FilterTab = memo(function FilterTab(props: {
  filterKey: FilterKey
  labelKey: I18nKeys
  icon: string
  color: string
  count: number
}) {
  const { t } = useTranslation()

  const isActive = useTorrentDataStore(
    useCallback(
      (s) => {
        const fs = selectFilterState(s)
        return (
          fs === props.filterKey ||
          (typeof fs === 'object' &&
            fs.type === 'multi' &&
            typeof props.filterKey === 'string' &&
            fs.statuses?.includes(props.filterKey))
        )
      },
      [props.filterKey],
    ),
  )

  const isMultiSelected = useTorrentDataStore(
    useCallback(
      (s) => {
        const fs = selectFilterState(s)
        return (
          typeof fs === 'object' &&
          fs.type === 'multi' &&
          typeof props.filterKey === 'string' &&
          fs.statuses?.includes(props.filterKey)
        )
      },
      [props.filterKey],
    ),
  )

  const isEmpty = props.count === 0

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEmpty) return
      if (e.ctrlKey || e.metaKey) {
        if (props.filterKey !== 'all') {
          torrentDataStoreSetters.toggleStatusFilter(props.filterKey)
        } else {
          torrentDataStoreSetters.setFilter('all')
        }
      } else {
        torrentDataStoreSetters.setFilter(props.filterKey)
      }
    },
    [isEmpty, props.filterKey],
  )

  return (
    <m.button
      key={String(props.filterKey)}
      className={clsx(
        'relative px-3 py-2 rounded-lg text-sm font-medium transition-all',
        isActive
          ? 'bg-accent/10 text-accent'
          : isEmpty
            ? 'text-text-tertiary hover:text-text-secondary'
            : 'text-text-secondary hover:text-text hover:bg-fill',
        isEmpty ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
      onClick={handleClick}
      disabled={isEmpty}
      whileHover={!isEmpty ? { scale: 1.02 } : undefined}
      whileTap={!isEmpty ? { scale: 0.98 } : undefined}
      transition={Spring.presets.snappy}
    >
      <div className="flex items-center gap-2">
        <i
          className={`${props.icon} ${isActive ? 'text-accent' : props.color}`}
        />
        <span>{t(props.labelKey)}</span>
        <span
          className={`
                px-1.5 py-0.5 rounded text-xs 
                ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : isEmpty
                      ? 'bg-material-opaque text-text-quaternary'
                      : 'bg-material-opaque text-text-tertiary'
                }
              `}
        >
          {props.count}
        </span>
      </div>

      {isActive && isMultiSelected && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full border border-background" />
      )}
    </m.button>
  )
})

export const FilterTabs = () => {
  const { t } = useTranslation()
  const stats = useTorrentStats()
  const { categories } = useCategoriesWithCounts()
  const showContextMenu = useShowContextMenu()

  // Centralized mutations with nested syntax
  const createCategoryMutation = useQBMutation.categories.create()
  const deleteCategoryMutation = useQBMutation.categories.delete()

  const handleAddCategory = useCallback(async () => {
    const result = await Prompt.input({
      title: t('torrent.categories.addDialog.title'),
      description: t('torrent.categories.addDialog.description'),
      placeholder: t('torrent.categories.addDialog.placeholder'),
      onConfirmText: t('torrent.categories.addDialog.create'),
      onCancelText: t('common.cancel'),
    })

    if (result && result.trim()) {
      try {
        await createCategoryMutation.mutateAsync({
          name: result.trim(),
          savePath: '', // Default empty save path, can be modified later
        })
      } catch (error) {
        console.error('Failed to create category:', error)
      }
    }
  }, [createCategoryMutation, t])

  const handleRemoveUnusedCategories = useCallback(async () => {
    const unusedCategories = categories.filter((cat) => cat.count === 0)

    if (unusedCategories.length === 0) {
      Prompt.prompt({
        title: t('torrent.categories.noUnusedTitle'),
        description: t('torrent.categories.noUnusedDescription'),
        onConfirmText: 'OK',
      })
      return
    }

    const categoryNames = unusedCategories.map((cat) => cat.name).join(', ')

    return new Promise<void>((resolve) => {
      Prompt.prompt({
        title: t('torrent.categories.removeDialog.title'),
        description: t('torrent.categories.removeDialog.description', {
          categoryNames,
        }),
        variant: 'danger',
        onConfirmText: t('torrent.categories.removeDialog.remove'),
        onCancelText: t('common.cancel'),
        onConfirm: async () => {
          try {
            // Remove categories one by one since API might not support multiple at once
            for (const category of unusedCategories) {
              await deleteCategoryMutation.mutateAsync(category.name)
            }
          } catch (error) {
            console.error('Failed to remove unused categories:', error)
          }
          resolve()
        },
        onCancel: () => {
          resolve()
        },
      })
    })
  }, [categories, deleteCategoryMutation, t])

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const menuItems = [
        new MenuItemText({
          label: t('torrent.categories.add'),
          icon: <i className="i-mingcute-add-line" />,
          click: handleAddCategory,
        }),
        new MenuItemText({
          label: t('torrent.categories.removeUnused'),
          icon: <i className="i-mingcute-delete-line" />,
          click: handleRemoveUnusedCategories,
          disabled: categories.filter((cat) => cat.count === 0).length === 0,
        }),
      ]

      await showContextMenu(menuItems, e)
    },
    [
      handleAddCategory,
      handleRemoveUnusedCategories,
      categories,
      showContextMenu,
      t,
    ],
  )

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({
      all: stats.total,
      downloading: stats.downloading,
      seeding: stats.seeding,
      completed: stats.completed,
      paused: stats.paused,
      error: stats.error,
    }),
    [stats],
  )

  return (
    <div
      className="flex items-center gap-1 h-[50px]"
      onContextMenu={handleContextMenu}
    >
      {TAB_CONFIGS.map((cfg) => (
        <FilterTab
          key={cfg.key}
          filterKey={cfg.key}
          labelKey={cfg.labelKey}
          icon={cfg.icon}
          color={cfg.color}
          count={counts[cfg.key]}
        />
      ))}
    </div>
  )
}
