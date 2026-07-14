import { useState } from 'react'

import { Button } from '../button/Button'
import type { UpdateState } from './FloatingUpdatePill'
import { FloatingUpdatePill } from './FloatingUpdatePill'

export const UpdateNotificationDemo = () => {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)

  const showReadyState = () => {
    setUpdateState({
      version: '2.1.0',
    })
  }

  const showErrorState = () => {
    setUpdateState({
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
        onInstall={() => console.warn('Install clicked')}
        onLater={() => console.warn('Later clicked')}
        onRetry={() => console.warn('Retry clicked')}
        onDismiss={() => setUpdateState(null)}
      />
    </div>
  )
}
