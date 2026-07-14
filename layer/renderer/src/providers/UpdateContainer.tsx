import { useCallback, useState } from 'react'

import type { UpdateState } from '~/components/ui/update-notification'
import { FloatingUpdatePill } from '~/components/ui/update-notification'
import { useBridgeEvent } from '~/hooks/common'
import { ipcServices } from '~/lib/ipc-client'

export const UpdateContainer = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateState | null>(null)

  useBridgeEvent('updater:status', (status) => {
    switch (status.kind) {
      case 'available': {
        setUpdateInfo({ version: status.version })
        break
      }
      case 'error': {
        setUpdateInfo({ hasError: true, errorMessage: status.message })
        break
      }
      default: {
        setUpdateInfo(null)
      }
    }
  })

  const handleInstall = useCallback(() => {
    ipcServices?.updater.installAndRestart()
  }, [])

  const handleLater = useCallback(() => {
    setUpdateInfo(null)
  }, [])

  const handleRetry = useCallback(() => {
    setUpdateInfo(null)

    ipcServices?.updater.check()
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
    />
  )
}
