import type { BridgeEventData } from '@torrent-vibe/main'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button/Button'
import { useBridgeEvent } from '~/hooks/common'
import { ipcServices } from '~/lib/ipc-client'

type UpdaterStatus = BridgeEventData<'updater:status'>

export const UpdateSection = () => {
  const { t } = useTranslation('setting')
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<UpdaterStatus>({ kind: 'unknown' })

  useBridgeEvent('updater:status', (next) => {
    setChecking(false)
    setStatus(next)
  })

  useEffect(() => {
    ipcServices?.updater.getStatus().then(setStatus)
  }, [])

  const onCheck = () => {
    setChecking(true)
    ipcServices?.updater.check()
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={onCheck}
          disabled={checking}
          className="h-7 px-3 text-xs"
        >
          {checking ? t('about.update.checking') : t('about.update.check')}
        </Button>

        {!checking && status.kind === 'available' && (
          <span className="inline-flex items-center gap-2 text-green">
            <i className="i-mingcute-check-circle-line" />
            {t('about.update.ready', { version: status.version })}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => ipcServices?.app.openUrl(status.htmlUrl)}
            >
              {t('about.update.downloadLatest')}
            </Button>
          </span>
        )}
        {!checking && status.kind === 'up-to-date' && (
          <span className="inline-flex items-center gap-2 text-text-secondary">
            <i className="i-mingcute-information-line" />
            {t('about.update.uptodate')}
          </span>
        )}
        {!checking && status.kind === 'error' && (
          <span className="inline-flex items-center gap-2 text-red">
            <i className="i-mingcute-alert-circle-line" />
            {t('about.update.failed', { message: status.message })}
          </span>
        )}
      </div>
    </div>
  )
}
