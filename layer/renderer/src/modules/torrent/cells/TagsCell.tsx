import { useCallback } from 'react'
import { useShallow } from 'zustand/shallow'

import { useQBMutation } from '~/lib/query/query-hooks'

import { ConfirmDeletePrompt } from '../../prompts/ConfirmDeletePrompt'
import { ModifyTagPrompt } from '../../prompts/ModifyTagPrompt'
import { Tag } from '../components/Tag'
import { useTorrentDataStore } from '../stores'
import { selectTorrentTags } from '../stores/torrent-selectors'

interface TagsCellProps {
  rowIndex: number
}

export const TagsCell = ({ rowIndex }: TagsCellProps) => {
  // Centralized mutations with nested syntax
  const createTagMutation = useQBMutation.tags.create()
  const deleteTagMutation = useQBMutation.tags.delete()
  const addTorrentTagsMutation = useQBMutation.torrents.addTags()
  const removeTorrentTagsMutation = useQBMutation.torrents.removeTags()

  const tags = useTorrentDataStore(
    useShallow(
      useCallback((state) => selectTorrentTags(state, rowIndex), [rowIndex]),
    ),
  )

  const tagList = tags
    ? tags
        .split(',')
        .filter(Boolean)
        .map((t) => t.trim())
    : []

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
        title: 'Delete Tag',
        itemName: tagName,
        itemType: 'tag',
        onConfirm: async () => {
          await deleteTagMutation.mutateAsync([tagName])
        },
      })
    },
    [deleteTagMutation],
  )

  return (
    <div className="flex items-center text-sm px-2 py-3">
      {tagList.length > 0 ? (
        <div className="flex flex-wrap gap-1 max-w-full">
          {tagList.map((tag) => (
            <Tag
              key={tag}
              tag={tag}
              variant="primary"
              type="tag"
              showContextMenu={true}
              onModify={handleModifyTag}
              onDelete={handleDeleteTag}
            />
          ))}
        </div>
      ) : (
        <div className="text-text-tertiary text-xs">No tags</div>
      )}
    </div>
  )
}
