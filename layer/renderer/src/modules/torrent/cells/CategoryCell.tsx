import { useCallback, useDeferredValue } from 'react'

import { useQBMutation } from '~/lib/query/query-hooks'

import { ConfirmDeletePrompt } from '../../prompts/ConfirmDeletePrompt'
import { ModifyCategoryPrompt } from '../../prompts/ModifyCategoryPrompt'
import { Tag } from '../components/Tag'
import { useTorrentDataStore } from '../stores'

interface CategoryCellProps {
  rowIndex: number
}

const selectTorrentCategory = (state: any, rowIndex: number) => {
  const torrent = state.sortedTorrents[rowIndex]
  return torrent?.category || ''
}

export const CategoryCell = ({ rowIndex }: CategoryCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  // Centralized mutations with nested syntax
  const editCategoryMutation = useQBMutation.categories.edit()
  const deleteCategoryMutation = useQBMutation.categories.delete()

  const category = useTorrentDataStore(
    useCallback(
      (state) => selectTorrentCategory(state, deferredRowIndex),
      [deferredRowIndex],
    ),
  )

  const handleModifyCategory = useCallback(
    async (categoryName: string) => {
      // Get current category data to pre-fill savePath
      const { categories } = useTorrentDataStore.getState()
      const categoryData = categories?.[categoryName]

      ModifyCategoryPrompt.show({
        categoryName,
        currentSavePath: categoryData?.savePath || '',
        onConfirm: async (newSavePath: string) => {
          await editCategoryMutation.mutateAsync({
            name: categoryName,
            savePath: newSavePath,
          })
        },
      })
    },
    [editCategoryMutation],
  )

  const handleDeleteCategory = useCallback(
    async (categoryName: string) => {
      ConfirmDeletePrompt.show({
        title: 'Delete Category',
        itemName: categoryName,
        itemType: 'category',
        onConfirm: async () => {
          await deleteCategoryMutation.mutateAsync(categoryName)
        },
      })
    },
    [deleteCategoryMutation],
  )

  return (
    <div className="flex items-center px-2 py-2 text-sm text-text">
      {category ? (
        <Tag
          tag={category}
          variant="accent"
          type="category"
          showContextMenu
          onModify={handleModifyCategory}
          onDelete={handleDeleteCategory}
        />
      ) : (
        <span className="text-text-tertiary">-</span>
      )}
    </div>
  )
}
