import { useEffect, useRef } from 'react'

import { ipcServices } from '~/lib/ipc-client'
import { useGlobalSpeeds } from '~/modules/torrent/hooks/use-torrent-computed'

const SYNC_INTERVAL = 1000

// Check at runtime, not module load time
const checkIsEnabled = () => {
  const isElectron = typeof ELECTRON !== 'undefined' && ELECTRON
  const isMac = window.platform === 'darwin'
  return isElectron && isMac
}

export function useMenubarSpeedSync() {
  const { downloadSpeed, uploadSpeed } = useGlobalSpeeds()
  const lastSentRef = useRef({ download: -1, upload: -1 })
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
    if (last.download === downloadSpeed && last.upload === uploadSpeed) {
      return
    }

    lastSentRef.current = { download: downloadSpeed, upload: uploadSpeed }
    ipcServices?.menubarSpeed?.updateSpeed?.({
      download: downloadSpeed,
      upload: uploadSpeed,
    })
  }, [isEnabled, downloadSpeed, uploadSpeed])

  useEffect(() => {
    if (!isEnabled) return

    const interval = setInterval(() => {
      const { download, upload } = lastSentRef.current
      if (download >= 0 && upload >= 0) {
        ipcServices?.menubarSpeed?.updateSpeed?.({ download, upload })
      }
    }, SYNC_INTERVAL)

    return () => clearInterval(interval)
  }, [isEnabled])
}
