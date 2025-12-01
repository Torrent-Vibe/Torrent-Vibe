import { commonHotkeys, useHotkey } from '~/modules/hotkey'
import { presentAddTorrentModal } from '~/modules/modals/AddTorrentModal/utils'
import { presentSettingsModal } from '~/modules/modals/SettingsModal'

/**
 * Register global application hotkeys used across the desktop layout.
 */
export const useRegisterAppHotkeys = (): void => {
  // Refresh application
  useHotkey(
    commonHotkeys.REFRESH,
    () => {
      window.location.reload()
    },
    {
      scope: 'app',
      description: 'Refresh application',
      category: 'navigation',
    },
  )

  // Open settings
  useHotkey(
    commonHotkeys.SETTINGS,
    () => {
      presentSettingsModal({ tab: 'appearance' })
    },
    {
      scope: 'app',
      description: 'Open settings',
      category: 'navigation',
    },
  )

  // Add new torrent
  useHotkey(
    commonHotkeys.NEW_ITEM,
    () => {
      presentAddTorrentModal()
    },
    {
      scope: 'app',
      description: 'Add new torrent',
      category: 'actions',
    },
  )

  // Focus search input
  useHotkey(
    commonHotkeys.SEARCH,
    () => {
      const searchInput = document.querySelector<HTMLInputElement>(
        '[data-layout-id="torrent-search-input"] input',
      )

      if (searchInput) {
        searchInput.focus()
      }
    },
    {
      scope: 'app',
      description: 'Focus search',
      category: 'navigation',
    },
  )
}
