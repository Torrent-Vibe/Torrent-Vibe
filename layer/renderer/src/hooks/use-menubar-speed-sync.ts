import { useEffect, useRef } from 'react'

import { ipcServices } from '~/lib/ipc-client'
import { useGlobalSpeeds } from '~/modules/torrent/hooks/use-torrent-computed'
import { useTorrentDataStore } from '~/modules/torrent/stores/torrent-data-store'
import type { TorrentState } from '~/types/torrent'

const SYNC_INTERVAL = 1000

// Check at runtime, not module load time
const checkIsEnabled = () => {
  const isElectron = typeof ELECTRON !== 'undefined' && ELECTRON
  const isMac = window.platform === 'darwin'
  return isElectron && isMac
}

// States that indicate a torrent is actively downloading
const DOWNLOADING_STATES = new Set<TorrentState>([
  'downloading',
  'stalledDL',
  'forcedDL',
  'ForcedMetaDL',
  'metaDL',
  'queuedDL',
  'checkingDL',
  'allocating',
])

// Calculate overall progress for all downloading torrents
const useOverallDownloadProgress = (): number => {
  return useTorrentDataStore((state) => {
    const downloadingTorrents = state.torrents.filter((t) =>
      DOWNLOADING_STATES.has(t.state),
    )

    if (downloadingTorrents.length === 0) {
      return -1 // No active downloads
    }

    const totalSize = downloadingTorrents.reduce((sum, t) => sum + t.size, 0)
    const totalCompleted = downloadingTorrents.reduce(
      (sum, t) => sum + t.completed,
      0,
    )

    if (totalSize === 0) {
      return 0
    }

    return (totalCompleted / totalSize) * 100
  })
}

export function useMenubarSpeedSync() {
  const { downloadSpeed, uploadSpeed } = useGlobalSpeeds()
  const progress = useOverallDownloadProgress()
  const lastSentRef = useRef({ download: -1, upload: -1, progress: -2 })
  const initializedRef = useRef(false)

  const isEnabled = checkIsEnabled()

  useEffect(() => {
    if (!isEnabled) return

    if (!initializedRef.current) {
      ipcServices?.menubarSpeed?.initialize?.()
      initializedRef.current = true
    }

    return () => {
      if (initializedRef.current) {
        ipcServices?.menubarSpeed?.stop?.()
        initializedRef.current = false
      }
    }
  }, [isEnabled])

  useEffect(() => {
    if (!isEnabled) return

    const last = lastSentRef.current
    if (
      last.download === downloadSpeed &&
      last.upload === uploadSpeed &&
      last.progress === progress
    ) {
      return
    }

    lastSentRef.current = {
      download: downloadSpeed,
      upload: uploadSpeed,
      progress,
    }
    ipcServices?.menubarSpeed?.updateSpeed?.({
      download: downloadSpeed,
      upload: uploadSpeed,
      progress,
    })
  }, [isEnabled, downloadSpeed, uploadSpeed, progress])

  useEffect(() => {
    if (!isEnabled) return

    const interval = setInterval(() => {
      const { download, upload, progress: prog } = lastSentRef.current
      if (download >= 0 && upload >= 0) {
        ipcServices?.menubarSpeed?.updateSpeed?.({
          download,
          upload,
          progress: prog,
        })
      }
    }, SYNC_INTERVAL)

    return () => clearInterval(interval)
  }, [isEnabled])
}
