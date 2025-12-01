import { AnimatePresence, m } from 'motion/react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MenuItemText, useShowContextMenu } from '~/atoms/context-menu'
import { Button } from '~/components/ui/button/Button'
import { useQBMutation } from '~/lib/query/query-hooks'
import { Spring } from '~/lib/spring'

import { ConfirmDeletePrompt } from '../../prompts/ConfirmDeletePrompt'
import { ModifyCategoryPrompt } from '../../prompts/ModifyCategoryPrompt'
import { ModifyTagPrompt } from '../../prompts/ModifyTagPrompt'
import { useCategoriesWithCounts } from '../hooks/use-categories'
import { useTagsWithCounts } from '../hooks/use-tags'
import {
  torrentDataStoreSetters,
  useTorrentDataStore,
} from '../stores/torrent-data-store'
import { selectFilterState } from '../stores/torrent-selectors'
import type { TorrentFilterState } from '../types/store'

export const AdvancedFilters = () => {
  const { t } = useTranslation()
  const { categories } = useCategoriesWithCounts()
  const { tags } = useTagsWithCounts()
  const filterState = useTorrentDataStore(selectFilterState)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const showContextMenuHandler = useShowContextMenu()

  // Centralized mutations with nested syntax
  const editCategoryMutation = useQBMutation.categories.edit()
  const deleteCategoryMutation = useQBMutation.categories.delete()
  const deleteTagMutation = useQBMutation.tags.delete()
  const createTagMutation = useQBMutation.tags.create()
  const addTorrentTagsMutation = useQBMutation.torrents.addTags()
  const removeTorrentTagsMutation = useQBMutation.torrents.removeTags()

  const setFilter = (filter: TorrentFilterState) => {
    torrentDataStoreSetters.setFilter(filter)
  }

  const toggleCategoryFilter = (category: string) => {
    torrentDataStoreSetters.toggleCategoryFilter(category)
  }

  const toggleTagFilter = (tag: string) => {
    torrentDataStoreSetters.toggleTagFilter(tag)
  }

  const handleModifyCategory = useCallback(
    async (categoryName: string) => {
      const category = categories.find((cat) => cat.name === categoryName)
      ModifyCategoryPrompt.show({
        categoryName,
        currentSavePath: category?.savePath || '',
        onConfirm: async (newSavePath: string) => {
          await editCategoryMutation.mutateAsync({
            name: categoryName,
            savePath: newSavePath,
          })
        },
      })
    },
    [categories, editCategoryMutation, t],
  )

  const handleDeleteCategory = useCallback(
    async (categoryName: string) => {
      ConfirmDeletePrompt.show({
        title: t('torrent.advanced.deleteCategory.title'),
        itemName: categoryName,
        itemType: 'category',
        onConfirm: async () => {
          await deleteCategoryMutation.mutateAsync(categoryName)
        },
      })
    },
    [deleteCategoryMutation, t],
  )

  const handleModifyTag = useCallback(
    async (tagName: string) => {
      ModifyTagPrompt.show({
        tagName,
        onConfirm: async (newTagName: string) => {
          if (newTagName.trim() === tagName.trim()) return // No change

          // Since qBittorrent doesn't support renaming tags directly,
          // we need to create the new tag and update all torrents that use the old tag
          const { torrents } = useTorrentDataStore.getState()
          const torrentsWithTag = torrents.filter((torrent) =>
            torrent.tags
              .split(',')
              .map((t) => t.trim())
              .includes(tagName),
          )

          // Create new tag
          await createTagMutation.mutateAsync([newTagName.trim()])

          // Add new tag to all torrents that had the old tag
          if (torrentsWithTag.length > 0) {
            const hashes = torrentsWithTag.map((t) => t.hash)
            await addTorrentTagsMutation.mutateAsync({
              hashes,
              tags: [newTagName.trim()],
            })
            // Remove old tag from these torrents
            await removeTorrentTagsMutation.mutateAsync({
              hashes,
              tags: [tagName],
            })
          }

          // Delete old tag
          await deleteTagMutation.mutateAsync([tagName])
        },
      })
    },
    [
      createTagMutation,
      addTorrentTagsMutation,
      removeTorrentTagsMutation,
      deleteTagMutation,
    ],
  )

  const handleDeleteTag = useCallback(
    async (tagName: string) => {
      ConfirmDeletePrompt.show({
        title: t('torrent.advanced.deleteTag.title'),
        itemName: tagName,
        itemType: 'tag',
        onConfirm: async () => {
          await deleteTagMutation.mutateAsync([tagName])
        },
      })
    },
    [deleteTagMutation, t],
  )

  const handleCategoryContextMenu = useCallback(
    async (e: React.MouseEvent, categoryName: string) => {
      const menuItems = [
        new MenuItemText({
          label: t('torrent.advanced.modifyCategory'),
          icon: <i className="i-mingcute-edit-line" />,
          click: () => handleModifyCategory(categoryName),
        }),
        new MenuItemText({
          label: t('torrent.advanced.delete'),
          icon: <i className="i-mingcute-delete-line" />,
          click: () => handleDeleteCategory(categoryName),
        }),
      ]

      await showContextMenuHandler(menuItems, e)
    },
    [showContextMenuHandler, handleModifyCategory, handleDeleteCategory, t],
  )

  const handleTagContextMenu = useCallback(
    async (e: React.MouseEvent, tagName: string) => {
      const menuItems = [
        new MenuItemText({
          label: t('torrent.advanced.modifyTag'),
          icon: <i className="i-mingcute-edit-line" />,
          click: () => handleModifyTag(tagName),
        }),
        new MenuItemText({
          label: t('torrent.advanced.delete'),
          icon: <i className="i-mingcute-delete-line" />,
          click: () => handleDeleteTag(tagName),
        }),
      ]

      await showContextMenuHandler(menuItems, e)
    },
    [showContextMenuHandler, handleModifyTag, handleDeleteTag, t],
  )

  if (categories.length === 0 && tags.length === 0) {
    return null
  }

  return (
    <>
      {/* Advanced filters toggle */}
      <Button
        variant="ghost"
        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        className="ml-2 text-xs px-2 h-[30px]"
      >
        <i
          className={`mr-1.5 transition-transform ${showAdvancedFilters ? 'i-mingcute-up-line' : 'i-mingcute-down-line'}`}
        />
        <span>
          {showAdvancedFilters
            ? t('torrent.advanced.less')
            : t('torrent.advanced.more')}
        </span>
      </Button>

      {/* Advanced filters section */}
      <AnimatePresence
        initial={false}
        onExitComplete={() => {
          window.dispatchEvent(new Event('resize'))
        }}
      >
        {showAdvancedFilters && (
          <m.div
            key="advanced-filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={Spring.presets.smooth}
            className="overflow-hidden col-span-full"
            onAnimationComplete={() => {
              window.dispatchEvent(new Event('resize'))
            }}
          >
            <div className="pt-3 border-t relative border-border/50 flex flex-col gap-3">
              {/* Categories */}
              {categories.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5">
                    <i className="i-lucide-shapes" />
                    {t('torrent.advanced.categories')}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {categories.map((category) => {
                      const isActive =
                        (typeof filterState === 'object' &&
                          filterState.type === 'category' &&
                          filterState.value === category.name) ||
                        (typeof filterState === 'object' &&
                          filterState.type === 'multi' &&
                          filterState.categories?.includes(category.name))
                      const isEmpty = category.count === 0

                      return (
                        <div key={category.name} className="relative">
                          <button
                            type="button"
                            className={`
                            px-2 py-1 rounded text-xs font-medium transition-all border border-transparent
                            ${
                              isActive
                                ? 'bg-accent/15 text-accent border-accent/30'
                                : isEmpty
                                  ? 'text-text-quaternary bg-fill/50 cursor-not-allowed'
                                  : 'text-text-tertiary bg-fill hover:bg-fill-tertiary hover:text-text-secondary'
                            }
                          `}
                            onClick={(e) => {
                              if (isEmpty) return

                              // Direct click now preserves current status and combines with category
                              // Use Ctrl/Cmd for multi-select within categories
                              if (e.ctrlKey || e.metaKey) {
                                toggleCategoryFilter(category.name)
                              } else {
                                // If this category is already active, toggle it off
                                if (
                                  isActive &&
                                  typeof filterState === 'object' &&
                                  ((filterState.type === 'category' &&
                                    filterState.value === category.name) ||
                                    (filterState.type === 'multi' &&
                                      filterState.categories?.includes(
                                        category.name,
                                      )))
                                ) {
                                  toggleCategoryFilter(category.name)
                                } else {
                                  // Add this category while preserving current filters
                                  toggleCategoryFilter(category.name)
                                }
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              handleCategoryContextMenu(e, category.name)
                            }}
                            disabled={isEmpty}
                          >
                            <span>{category.name}</span>
                            <span className="ml-1 opacity-70">
                              ({category.count})
                            </span>
                          </button>

                          {/* Multi-select indicator */}
                          {isActive &&
                            typeof filterState === 'object' &&
                            filterState.type === 'multi' &&
                            filterState.categories?.includes(category.name) && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full border border-background" />
                            )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5">
                    <i className="i-mingcute-hashtag-line" />
                    {t('torrent.advanced.tags')}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => {
                      const isActive =
                        (typeof filterState === 'object' &&
                          filterState.type === 'tag' &&
                          filterState.value === tag.name) ||
                        (typeof filterState === 'object' &&
                          filterState.type === 'multi' &&
                          filterState.tags?.includes(tag.name))
                      const isEmpty = tag.count === 0

                      return (
                        <div key={tag.name} className="relative">
                          <m.button
                            className={`
                            px-2 py-1 rounded text-xs font-medium transition-all
                            ${
                              isActive
                                ? 'bg-accent/15 text-accent border border-accent/30'
                                : isEmpty
                                  ? 'text-text-quaternary bg-fill cursor-not-allowed'
                                  : 'text-text-tertiary bg-fill-secondary hover:bg-fill hover:text-text-secondary'
                            }
                          `}
                            onClick={(e) => {
                              if (isEmpty) return

                              // Direct click now preserves current status and combines with tag
                              // Use Ctrl/Cmd for multi-select within tags
                              if (e.ctrlKey || e.metaKey) {
                                toggleTagFilter(tag.name)
                              } else {
                                // If this tag is already active, toggle it off
                                if (
                                  isActive &&
                                  typeof filterState === 'object' &&
                                  ((filterState.type === 'tag' &&
                                    filterState.value === tag.name) ||
                                    (filterState.type === 'multi' &&
                                      filterState.tags?.includes(tag.name)))
                                ) {
                                  toggleTagFilter(tag.name)
                                } else {
                                  // Add this tag while preserving current filters
                                  toggleTagFilter(tag.name)
                                }
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              handleTagContextMenu(e, tag.name)
                            }}
                            disabled={isEmpty}
                            whileHover={!isEmpty ? { scale: 1.05 } : undefined}
                            whileTap={!isEmpty ? { scale: 0.95 } : undefined}
                            transition={Spring.presets.snappy}
                          >
                            <span>#{tag.name}</span>
                            <span className="ml-1 opacity-70">
                              ({tag.count})
                            </span>
                          </m.button>

                          {/* Multi-select indicator */}
                          {isActive &&
                            typeof filterState === 'object' &&
                            filterState.type === 'multi' &&
                            filterState.tags?.includes(tag.name) && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full border border-background" />
                            )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Clear filters */}
              {(typeof filterState === 'object' || filterState !== 'all') && (
                <div className="absolute top-1 right-0">
                  <Button
                    variant="ghost"
                    onClick={() => setFilter('all')}
                    className="text-xs text-text-tertiary hover:text-text"
                  >
                    <i className="i-mingcute-close-line mr-1" />
                    {t('torrent.advanced.clearFilters')}
                    {/* Show count of active filters in multi-select mode */}
                    {typeof filterState === 'object' &&
                      filterState.type === 'multi' && (
                        <span className="ml-1 px-1.5 py-0.5 bg-accent/20 text-accent rounded text-xs">
                          {(filterState.statuses?.length || 0) +
                            (filterState.categories?.length || 0) +
                            (filterState.tags?.length || 0)}
                        </span>
                      )}
                  </Button>
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
