import { memo, useCallback, useDeferredValue } from 'react'
import { useShallow } from 'zustand/shallow'

import { Checkbox } from '~/components/ui/checkbox'
import { useTypeScriptHappyCallback } from '~/hooks/common/useTypescriptHappyCallback'

import { useTorrentTableInteractions } from '../hooks/use-torrent-table-interactions'
import { useTorrentDataStore } from '../stores'
import {
  selectHeaderCheckboxState,
  selectTorrentSelectionData,
} from '../stores/torrent-selectors'

interface CheckboxCellProps {
  rowIndex: number
}

export const CheckboxCell = ({ rowIndex }: CheckboxCellProps) => {
  const deferredRowIndex = useDeferredValue(rowIndex)

  const { handleSelectionChange } = useTorrentTableInteractions()
  // Use granular selector for just the selection data we need
  const selectionData = useTorrentDataStore(
    useShallow(
      useCallback(
        (state) => selectTorrentSelectionData(state, deferredRowIndex),
        [deferredRowIndex],
      ),
    ),
  )

  return (
    <div
      className={'flex items-center absolute inset-x-0 top-4 justify-center'}
    >
      <Checkbox
        className="border border-border"
        checked={selectionData.isSelected}
        onCheckedChange={(checked) => {
          if (typeof checked === 'boolean') {
            handleSelectionChange(selectionData.hash, checked)
          }
        }}
      />
    </div>
  )
}

export const HeaderCheckboxCell = memo(() => {
  const { handleSelectAll } = useTorrentTableInteractions()

  const { isAllSelected, isIndeterminate } = useTorrentDataStore(
    useShallow(selectHeaderCheckboxState),
  )

  return (
    <div className="flex items-center justify-center absolute inset-0">
      <Checkbox
        className="border border-border"
        checked={isAllSelected}
        indeterminate={isIndeterminate}
        onCheckedChange={useTypeScriptHappyCallback(
          (checked) => {
            if (typeof checked === 'boolean') {
              const { sortedTorrents } = useTorrentDataStore.getState()
              handleSelectAll(sortedTorrents, checked)
            }
          },
          [handleSelectAll],
        )}
      />
    </div>
  )
})
