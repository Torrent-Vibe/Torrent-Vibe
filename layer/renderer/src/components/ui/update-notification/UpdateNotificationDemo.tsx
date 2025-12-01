import { useState } from 'react'

import { Button } from '../button/Button'
import type { UpdateState } from './FloatingUpdatePill'
import { FloatingUpdatePill } from './FloatingUpdatePill'

export const UpdateNotificationDemo = () => {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)

  const showDownloadingState = () => {
    setUpdateState({
      version: '2.1.0',
      isDownloading: true,
      downloadProgress: 45,
    })
  }

  const showReadyState = () => {
    setUpdateState({
      version: '2.1.0',
      isDownloading: false,
    })
  }

  const showErrorState = () => {
    setUpdateState({
      isDownloading: false,
      hasError: true,
      errorMessage: 'Network connection failed',
    })
  }

  const clearState = () => {
    setUpdateState(null)
  }

  return (
    <div className="fixed bottom-20 right-5 z-50 flex flex-col gap-2 rounded-lg bg-material-medium backdrop-blur p-4 border border-border">
      <h3 className="text-sm font-medium text-text">
        Update Notification Demo
      </h3>
      <div className="flex flex-col gap-2">
        <Button size="sm" onClick={showDownloadingState}>
          Show Downloading
        </Button>
        <Button size="sm" onClick={showReadyState}>
          Show Ready
        </Button>
        <Button size="sm" onClick={showErrorState}>
          Show Error
        </Button>
        <Button size="sm" variant="ghost" onClick={clearState}>
          Clear
        </Button>
      </div>

      <FloatingUpdatePill
        updateState={updateState}
        onInstall={() => console.info('Install clicked')}
        onLater={() => console.info('Later clicked')}
        onRetry={() => console.info('Retry clicked')}
        onDismiss={() => setUpdateState(null)}
      />
    </div>
  )
}
