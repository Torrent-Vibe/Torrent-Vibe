import { useCallback, useDeferredValue } from 'react'
import { useShallow } from 'zustand/shallow'

import { useQBMutation } from '~/lib/query/query-hooks'

import { TorrentStateIcon } from '../../../components/ui/torrent-state-icon'
import { ConfirmDeletePrompt } from '../../prompts/ConfirmDeletePrompt'
import { ModifyTagPrompt } from '../../prompts/ModifyTagPrompt'
import { Tag } from '../components/Tag'
import { TorrentAiMetadataRow } from '../components/TorrentAiMetadataRow'
import { useTorrentDataStore } from '../stores'
import {
  selectTorrentName,
  selectTorrentProgress,
} from '../stores/torrent-selectors'

interface NameCellProps {
  rowIndex: number
  isInViewport?: boolean
}

export const NameCell = ({ rowIndex, isInViewport }: NameCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  // Centralized mutations with nested syntax
  const createTagMutation = useQBMutation.tags.create()
  const deleteTagMutation = useQBMutation.tags.delete()
  const addTorrentTagsMutation = useQBMutation.torrents.addTags()
  const removeTorrentTagsMutation = useQBMutation.torrents.removeTags()

  // Use granular selectors for just the name and progress data we need
  const nameData = useTorrentDataStore(
    useShallow(
      useCallback(
        (state) => selectTorrentName(state, deferredRowIndex),
        [deferredRowIndex],
      ),
    ),
  )

  const { progress, state } = useTorrentDataStore(
    useShallow(
      useCallback(
        (state) => selectTorrentProgress(state, deferredRowIndex),
        [deferredRowIndex],
      ),
    ),
  )

  // Process tags for display
  const tagList = nameData.tags
    ? nameData.tags
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

  if (!nameData.name) {
    return (
      <div className={'absolute inset-0'}>
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex-shrink-0">
            <TorrentStateIcon
              state="unknown"
              className="text-lg text-text-tertiary"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-tertiary">
              Loading...
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex items-center gap-3 px-4 py-2">
      <div className="flex-shrink-0 pt-0.5">
        <TorrentStateIcon
          state={state}
          progress={progress}
          className="text-lg"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-sm font-medium text-text truncate">
          {nameData.name || 'Untitled'}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary min-w-0">
          <span className="truncate text-text-secondary">
            {nameData.category || 'Uncategorized'}
          </span>
          {tagList.length > 0 && (
            <div className="flex gap-1 overflow-hidden">
              {tagList.slice(0, 2).map((tag) => (
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
              {tagList.length > 2 && (
                <Tag
                  tag={`+${tagList.length - 2}`}
                  variant="tertiary"
                  className="cursor-default"
                  title={tagList.slice(2).join(', ')}
                />
              )}
            </div>
          )}

          <div className="ml-auto shrink-0 h-0 -translate-y-3 translate-x-2">
            <TorrentAiMetadataRow
              hash={nameData.hash}
              rawName={nameData.name}
              isInViewport={isInViewport}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
