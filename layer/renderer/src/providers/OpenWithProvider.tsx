import { useEffect } from 'react'

import { Modal } from '~/components/ui/modal/ModalManager'
import { AddTorrentModal } from '~/modules/modals/AddTorrentModal'

// Register open-file and deeplink listeners, then notify main we are ready.
export const OpenWithProvider = () => {
  useEffect(() => {
    const onOpenTorrents = (
      _: unknown,
      payload: {
        files: Array<{ name: string; data: Uint8Array; mime?: string }>
      },
    ) => {
      try {
        const files = (payload?.files || []).map((f) => {
          const blob = new Blob([new Uint8Array(f.data)], {
            type: f.mime || 'application/x-bittorrent',
          })
          return new File([blob], f.name, {
            type: f.mime || 'application/x-bittorrent',
          })
        })
        if (files.length > 0) {
          Modal.present(AddTorrentModal, { initialFiles: files })
        }
      } catch (e) {
        console.error('Failed to open torrent files from main:', e)
      }
    }

    const onMagnet = (
      _: unknown,
      payload: {
        links: string[]
      },
    ) => {
      try {
        const text = (payload?.links || [])
          .map((s) => s?.trim())
          .filter(Boolean)
          .join('\n')
        if (!text) return
        Modal.present(AddTorrentModal, { initialMagnetLinks: text })
      } catch (e) {
        console.error('Failed to open magnet links from main:', e)
      }
    }

    // Register handlers first to avoid race with main's flush
    window.ipcRenderer?.on('file:open-torrents', onOpenTorrents)
    window.ipcRenderer?.on('deeplink:magnet', onMagnet)

    // Now inform main that renderer is ready to receive queued events
    window.ipcRenderer?.send('renderer:ready')

    return () => {
      window.ipcRenderer?.removeListener('file:open-torrents', onOpenTorrents)
      window.ipcRenderer?.removeListener('deeplink:magnet', onMagnet)
    }
  }, [])

  return null
}
