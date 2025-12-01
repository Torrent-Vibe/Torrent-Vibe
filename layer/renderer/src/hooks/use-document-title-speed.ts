import { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { formatSpeed } from '~/lib/format'
import { useTorrentDataStore } from '~/modules/torrent/stores/torrent-data-store'

/**
 * Hook that updates the document title with current download and upload speeds
 * Only runs in web environment (not Electron)
 */
export const useDocumentTitleSpeed = () => {
  // Subscribe to server state for transfer speeds
  const serverState = useTorrentDataStore(
    useShallow(
      useCallback((state) => {
        return state.serverState
      }, []),
    ),
  )

  useEffect(() => {
    // Only update title in web environment, not in Electron
    if (ELECTRON) return

    if (!serverState) {
      // Reset title if no server state
      document.title = 'Torrent Vibe'
      return
    }

    const { dl_info_speed: downloadSpeed = 0, up_info_speed: uploadSpeed = 0 } =
      serverState

    // Format speeds
    const formattedDownload = formatSpeed(downloadSpeed)
    const formattedUpload = formatSpeed(uploadSpeed)

    // Update document title with transfer speeds
    // Format: "↓ 1.2 MB/s ↑ 345 KB/s - qBittorrent WebUI"
    let titlePrefix = ''
    if (downloadSpeed > 0 || uploadSpeed > 0) {
      const parts: string[] = []
      if (downloadSpeed > 0) {
        parts.push(`↓ ${formattedDownload}`)
      }
      if (uploadSpeed > 0) {
        parts.push(`↑ ${formattedUpload}`)
      }
      titlePrefix = `${parts.join(' ')} - `
    }

    document.title = `${titlePrefix}Torrent Vibe`
  }, [serverState])
}
