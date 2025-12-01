import { APP_LATEST_RELEASE_URL, AppErrorCode } from '@torrent-vibe/shared'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { UpdateState } from '~/components/ui/update-notification'
import { FloatingUpdatePill } from '~/components/ui/update-notification'
import { useBridgeEvent } from '~/hooks/common'
import { ipcServices } from '~/lib/ipc-client'

export const UpdateContainer = () => {
  const { t } = useTranslation('setting')
  const [updateInfo, setUpdateInfo] = useState<UpdateState | null>(null)

  useBridgeEvent('update:ready', (data) => {
    setUpdateInfo({
      version: data.version,
      isDownloading: false,
    })
  })

  useBridgeEvent('update:progress', (data) => {
    setUpdateInfo((prev) => ({
      ...prev,
      downloadProgress: data.percent,
      isDownloading: true,
      hasError: false,
    }))
  })

  useBridgeEvent('update:error', (data) => {
    if (
      data.code === AppErrorCode.AppVersionTooLow ||
      data.code === AppErrorCode.MainHashMissing
    ) {
      setUpdateInfo({
        hasError: true,
        isDownloading: false,
        errorMessage: t('about.update.versionTooLow'),
        downloadUrl: data.downloadUrl || APP_LATEST_RELEASE_URL,
      })
      return
    }

    setUpdateInfo({
      hasError: true,
      isDownloading: false,
      errorMessage: data.message,
    })
  })

  useBridgeEvent('update:downloaded', (data) => {
    setUpdateInfo({
      version: data.version,
      isDownloading: false,
    })
  })

  const handleInstall = useCallback(() => {
    ipcServices?.app.reload()
  }, [])

  const handleLater = useCallback(() => {
    setUpdateInfo(null)
  }, [])

  const handleRetry = useCallback(() => {
    setUpdateInfo(null)

    ipcServices?.app.checkForUpdate()
  }, [])

  const handleDismiss = useCallback(() => {
    setUpdateInfo(null)
  }, [])

  return (
    <FloatingUpdatePill
      updateState={updateInfo}
      onInstall={handleInstall}
      onLater={handleLater}
      onRetry={handleRetry}
      onDismiss={handleDismiss}
      onOpenUrl={(url) => ipcServices?.app.openUrl(url)}
    />
  )
}
