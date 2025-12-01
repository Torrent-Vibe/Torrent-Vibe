import * as React from 'react'

import {
  commonHotkeys,
  HotkeyScope,
  ScopeActivationStrategy,
  useFocusScope,
  useHotkey,
} from '~/modules/hotkey'

import { torrentDataStoreSetters } from '../stores'

/**
 * Custom hook to manage torrent table hotkeys and focus scope
 * Handles table-specific keyboard shortcuts like select all and deselect all
 */
export function useTorrentTableHotkeys() {
  // Focus scope for table area (active only when focused)
  const [, setTableScopeRef, tableScopeRef] = useFocusScope<HTMLDivElement>(
    HotkeyScope.TABLE,
    {
      parentScope: HotkeyScope.APP,
      priority: 20,
      strategy: ScopeActivationStrategy.ADDITIVE,
      autoActivate: false,
    },
  )

  // Register select all within TABLE scope
  useHotkey(
    commonHotkeys.SELECT_ALL,
    () => {
      torrentDataStoreSetters.selectAllTorrents()
    },
    {
      scope: HotkeyScope.TABLE,
      description: 'Select all torrents',
      category: 'selection',
      waitFor: React.useCallback(() => !!tableScopeRef, [tableScopeRef]),
    },
  )

  // Register deselect all within TABLE scope
  useHotkey(
    commonHotkeys.DESELECT_ALL,
    () => {
      torrentDataStoreSetters.clearSelection()
    },
    {
      scope: HotkeyScope.TABLE,
      description: 'Deselect all torrents',
      category: 'selection',
      waitFor: React.useCallback(() => !!tableScopeRef, [tableScopeRef]),
    },
  )

  return {
    setTableScopeRef,
  }
}
