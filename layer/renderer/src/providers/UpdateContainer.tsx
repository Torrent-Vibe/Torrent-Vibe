import type { BridgeEventData } from '@torrent-vibe/main'
import { APP_LATEST_RELEASE_URL } from '@torrent-vibe/shared'
import { useCallback, useEffect, useState } from 'react'

import type { UpdateCardState } from '~/components/ui/update-notification'
import { FloatingUpdatePill } from '~/components/ui/update-notification'
import { useBridgeEvent } from '~/hooks/common'
import { ipcServices } from '~/lib/ipc-client'

type UpdaterStatus = BridgeEventData<'updater:status'>

const toCardState = (
  status: UpdaterStatus,
  installing: boolean,
): UpdateCardState | null => {
  switch (status.kind) {
    case 'available': {
      return installing
        ? { kind: 'preparing' }
        : { kind: 'available', version: status.version }
    }
    case 'downloading': {
      return installing
        ? {
            kind: 'downloading',
            version: status.version,
            percent: status.percent,
          }
        : { kind: 'available', version: status.version }
    }
    case 'ready': {
      return installing
        ? { kind: 'preparing' }
        : { kind: 'ready', version: status.version }
    }
    case 'error': {
      return { kind: 'error', message: status.message }
    }
    default: {
      return null
    }
  }
}

export const UpdateContainer = () => {
  const [status, setStatus] = useState<UpdaterStatus>({ kind: 'unknown' })
  const [installing, setInstalling] = useState(false)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  useBridgeEvent('updater:status', (next) => {
    if (next.kind === 'error') {
      setInstalling(false)
    }
    setStatus(next)
  })

  useEffect(() => {
    ipcServices?.updater.getStatus().then(setStatus)
  }, [])

  const cardState = toCardState(status, installing)
  const visibleState =
    cardState && JSON.stringify(cardState) !== dismissedKey ? cardState : null

  const handleInstall = useCallback(() => {
    setInstalling(true)
    ipcServices?.updater.installAndRestart()
  }, [])

  const handleDismiss = useCallback(() => {
    if (cardState) {
      setDismissedKey(JSON.stringify(cardState))
    }
  }, [cardState])

  const handleShowReleaseNotes = useCallback(() => {
    window.open(
      status.kind === 'available' ? status.htmlUrl : APP_LATEST_RELEASE_URL,
      '_blank',
    )
  }, [status])

  return (
    <FloatingUpdatePill
      state={visibleState}
      onDismiss={handleDismiss}
      onInstall={handleInstall}
      onShowReleaseNotes={handleShowReleaseNotes}
    />
  )
}
