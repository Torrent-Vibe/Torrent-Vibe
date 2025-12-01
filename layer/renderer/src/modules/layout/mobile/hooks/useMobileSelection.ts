import { useAtom, useSetAtom } from 'jotai'
import { useCallback, useEffect } from 'react'

import { useTorrentDataStore } from '~/modules/torrent/stores'
import { torrentDataStoreSetters } from '~/modules/torrent/stores/torrent-data-store'
import {
  selectSelectedTorrents,
  selectSelectedTorrentsCount,
} from '~/modules/torrent/stores/torrent-selectors'

import {
  multiSelectModeAtom,
  resetMobileLayoutAtom,
} from '../atoms/mobile-layout'

interface MobileSelectionOptions {
  // Auto-exit multi-select after actions
  autoExitAfterAction?: boolean
  // Maximum number of selected items
  maxSelection?: number
  // Callback when selection changes
  onSelectionChange?: (selectedHashes: string[], count: number) => void
  // Callback when entering/exiting multi-select mode
  onModeChange?: (isMultiSelect: boolean) => void
}

export const useMobileSelection = (options: MobileSelectionOptions = {}) => {
  const {
    autoExitAfterAction = true,
    maxSelection,
    onSelectionChange,
    onModeChange,
  } = options

  // Atoms
  const [multiSelectMode, setMultiSelectMode] = useAtom(multiSelectModeAtom)
  const resetMobileLayout = useSetAtom(resetMobileLayoutAtom)

  // Torrent selection state from store
  const selectedTorrents = useTorrentDataStore(selectSelectedTorrents)
  const selectedCount = useTorrentDataStore(selectSelectedTorrentsCount)

  // Notify when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedTorrents, selectedCount)
  }, [selectedTorrents, selectedCount, onSelectionChange])

  // Notify when mode changes
  useEffect(() => {
    onModeChange?.(multiSelectMode)
  }, [multiSelectMode, onModeChange])

  // Enter multi-select mode
  const enterMultiSelectMode = useCallback(() => {
    setMultiSelectMode(true)
  }, [setMultiSelectMode])

  // Exit multi-select mode and clear selections
  const exitMultiSelectMode = useCallback(() => {
    setMultiSelectMode(false)
    torrentDataStoreSetters.clearSelection()
  }, [setMultiSelectMode])

  // Toggle multi-select mode
  const toggleMultiSelectMode = useCallback(() => {
    if (multiSelectMode) {
      exitMultiSelectMode()
    } else {
      enterMultiSelectMode()
    }
  }, [multiSelectMode, enterMultiSelectMode, exitMultiSelectMode])

  // Select a torrent (in multi-select mode)
  const selectTorrent = useCallback(
    (torrentHash: string) => {
      if (!multiSelectMode) return false

      // Check max selection limit
      if (
        maxSelection &&
        selectedCount >= maxSelection &&
        !selectedTorrents.includes(torrentHash)
      ) {
        return false
      }

      torrentDataStoreSetters.toggleTorrentSelection(torrentHash)
      return true
    },
    [multiSelectMode, maxSelection, selectedCount, selectedTorrents],
  )

  // Select multiple torrents
  const selectTorrents = useCallback(
    (torrentHashes: string[]) => {
      if (!multiSelectMode) return false

      // Check max selection limit
      if (maxSelection) {
        const newSelections = torrentHashes.filter(
          (hash) => !selectedTorrents.includes(hash),
        )
        if (selectedCount + newSelections.length > maxSelection) {
          return false
        }
      }

      torrentHashes.forEach((hash) => {
        if (!selectedTorrents.includes(hash)) {
          torrentDataStoreSetters.toggleTorrentSelection(hash)
        }
      })
      return true
    },
    [multiSelectMode, maxSelection, selectedCount, selectedTorrents],
  )

  // Deselect a torrent
  const deselectTorrent = useCallback(
    (torrentHash: string) => {
      if (!multiSelectMode) return false

      if (selectedTorrents.includes(torrentHash)) {
        torrentDataStoreSetters.toggleTorrentSelection(torrentHash)
      }
      return true
    },
    [multiSelectMode, selectedTorrents],
  )

  // Clear all selections
  const clearSelection = useCallback(() => {
    torrentDataStoreSetters.clearSelection()
  }, [])

  // Select all torrents (within limits)
  const selectAll = useCallback(() => {
    if (!multiSelectMode) return false

    const { sortedTorrents } = useTorrentDataStore.getState()
    const allHashes = sortedTorrents.map((t) => t.hash)

    // Apply max selection limit
    const hashesToSelect = maxSelection
      ? allHashes.slice(0, maxSelection)
      : allHashes

    // Clear current selection and select new ones
    torrentDataStoreSetters.clearSelection()
    hashesToSelect.forEach((hash) => {
      torrentDataStoreSetters.toggleTorrentSelection(hash)
    })

    return true
  }, [multiSelectMode, maxSelection])

  // Handle long press to enter multi-select mode
  const handleLongPress = useCallback(
    (torrentHash: string) => {
      if (!multiSelectMode) {
        // Enter multi-select mode and select the long-pressed item
        enterMultiSelectMode()
        // Add small delay to ensure mode is set before selection
        setTimeout(() => {
          torrentDataStoreSetters.toggleTorrentSelection(torrentHash)
        }, 50)
      }
    },
    [multiSelectMode, enterMultiSelectMode],
  )

  // Handle tap in multi-select mode
  const handleTapInMultiSelect = useCallback(
    (torrentHash: string) => {
      if (multiSelectMode) {
        selectTorrent(torrentHash)
        return true
      }
      return false
    },
    [multiSelectMode, selectTorrent],
  )

  // Perform action and optionally exit multi-select mode
  const performActionAndExit = useCallback(
    async (action: () => Promise<void> | void) => {
      try {
        await action()

        if (autoExitAfterAction && multiSelectMode) {
          exitMultiSelectMode()
        }
      } catch (error) {
        console.error('Action failed:', error)
      }
    },
    [autoExitAfterAction, multiSelectMode, exitMultiSelectMode],
  )

  // Check if torrent is selected
  const isTorrentSelected = useCallback(
    (torrentHash: string) => {
      return selectedTorrents.includes(torrentHash)
    },
    [selectedTorrents],
  )

  // Get selection summary text
  const getSelectionSummary = useCallback(() => {
    if (selectedCount === 0) return 'No items selected'
    if (selectedCount === 1) return '1 item selected'
    return `${selectedCount} items selected`
  }, [selectedCount])

  // Auto-exit multi-select mode when no items are selected
  useEffect(() => {
    if (multiSelectMode && selectedCount === 0) {
      const timer = setTimeout(() => {
        setMultiSelectMode(false)
      }, 2000) // Exit after 2 seconds of no selection

      return () => clearTimeout(timer)
    }
  }, [multiSelectMode, selectedCount, setMultiSelectMode])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (multiSelectMode) {
        resetMobileLayout()
      }
    }
  }, [multiSelectMode, resetMobileLayout])

  return {
    // State
    multiSelectMode,
    selectedTorrents,
    selectedCount,

    // Actions
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleMultiSelectMode,
    selectTorrent,
    selectTorrents,
    deselectTorrent,
    clearSelection,
    selectAll,

    // Gesture handlers
    handleLongPress,
    handleTapInMultiSelect,

    // Utilities
    performActionAndExit,
    isTorrentSelected,
    getSelectionSummary,

    // State checks
    hasSelection: selectedCount > 0,
    isMaxSelected: maxSelection ? selectedCount >= maxSelection : false,
    canSelectMore: maxSelection ? selectedCount < maxSelection : true,
  }
}

// Specialized hook for mobile torrent actions in multi-select mode
export const useMobileTorrentActions = () => {
  const {
    selectedTorrents,
    selectedCount,
    performActionAndExit,
    exitMultiSelectMode,
  } = useMobileSelection()

  const resumeSelectedTorrents = useCallback(async () => {
    if (selectedTorrents.length === 0) return

    await performActionAndExit(async () => {
      // TODO: Implement resume action - will need to integrate with existing torrent actions
    })
  }, [selectedTorrents, performActionAndExit])

  const pauseSelectedTorrents = useCallback(async () => {
    if (selectedTorrents.length === 0) return

    await performActionAndExit(async () => {
      // TODO: Implement pause action - will need to integrate with existing torrent actions
    })
  }, [selectedTorrents, performActionAndExit])

  const deleteSelectedTorrents = useCallback(async () => {
    if (selectedTorrents.length === 0) return

    await performActionAndExit(async () => {
      // TODO: Implement delete action - will need to integrate with existing torrent actions
    })
  }, [selectedTorrents, performActionAndExit])

  return {
    selectedTorrents,
    selectedCount,
    resumeSelectedTorrents,
    pauseSelectedTorrents,
    deleteSelectedTorrents,
    exitMultiSelectMode,
    hasSelection: selectedCount > 0,
  }
}

// Hook for mobile selection toolbar (shows when items are selected)
export const useMobileSelectionToolbar = () => {
  const {
    multiSelectMode,
    selectedCount,
    clearSelection,
    selectAll,
    exitMultiSelectMode,
    getSelectionSummary,
  } = useMobileSelection()

  const {
    resumeSelectedTorrents,
    pauseSelectedTorrents,
    deleteSelectedTorrents,
  } = useMobileTorrentActions()

  const showToolbar = multiSelectMode && selectedCount > 0

  const toolbarActions = [
    {
      id: 'resume',
      label: 'Resume',
      icon: 'i-mingcute-play-fill',
      action: resumeSelectedTorrents,
      color: 'text-green',
    },
    {
      id: 'pause',
      label: 'Pause',
      icon: 'i-mingcute-pause-fill',
      action: pauseSelectedTorrents,
      color: 'text-orange',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'i-mingcute-delete-2-line',
      action: deleteSelectedTorrents,
      color: 'text-red',
    },
  ]

  return {
    showToolbar,
    selectedCount,
    selectionSummary: getSelectionSummary(),
    toolbarActions,
    clearSelection,
    selectAll,
    exitMultiSelectMode,
  }
}
export const useMobileSelectionWithActions = () => {
  const selection = useMobileSelection()
  const resumeSelectedTorrents = useCallback(async () => {
    // TODO: Implementation
  }, [])
  const pauseSelectedTorrents = useCallback(async () => {
    // TODO: Implementation
  }, [])
  return { ...selection, resumeSelectedTorrents, pauseSelectedTorrents }
}
