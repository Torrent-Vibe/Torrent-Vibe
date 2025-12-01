import { APP_LATEST_RELEASE_URL,AppErrorCode } from '@torrent-vibe/shared'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button/Button'
import { useBridgeEvent } from '~/hooks/common'
import { ipcServices } from '~/lib/ipc-client'

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'uptodate'
  | 'downloading'
  | 'ready'
  | 'error'

export const UpdateSection = () => {
  const { t } = useTranslation('setting')
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [progress, setProgress] = useState<number | undefined>()
  const [version, setVersion] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  const canCheck = useMemo(
    () => status !== 'checking' && status !== 'downloading',
    [status],
  )

  // Bridge events wiring
  useBridgeEvent('update:checking', () => {
    setStatus('checking')
    setProgress(undefined)
    setError(undefined)
    setVersion(undefined)
  })
  useBridgeEvent('update:uptodate', () => {
    setStatus('uptodate')
    setProgress(undefined)
    setVersion(undefined)
    setError(undefined)
  })
  useBridgeEvent('update:progress', (data) => {
    setStatus('downloading')
    setProgress(data.percent)
  })
  useBridgeEvent('update:ready', (data) => {
    setStatus('ready')
    setVersion(data.version)
    setProgress(undefined)
  })
  useBridgeEvent('update:error', (data) => {
    setStatus('error')
    setProgress(undefined)

    const isVersionTooLow =
      data.code === AppErrorCode.AppVersionTooLow ||
      data.code === AppErrorCode.MainHashMissing
    const message = isVersionTooLow
      ? t('about.update.versionTooLow')
      : data.message
    setError(message)
  })

  useEffect(() => {
    // Reset transient error on status change away from error
    if (status !== 'error' && error) setError(undefined)
  }, [status])

  const onCheck = () => {
    setStatus('checking')
    setProgress(undefined)
    setError(undefined)
    setVersion(undefined)

    ipcServices?.app.checkForUpdate()
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={onCheck}
          disabled={!canCheck}
          className="h-7 px-3 text-xs"
        >
          {status === 'checking'
            ? t('about.update.checking')
            : t('about.update.check')}
        </Button>

        {status === 'downloading' && (
          <span className="inline-flex items-center gap-2 text-text">
            <i className="i-mingcute-download-line text-accent" />
            {t('about.update.downloading')}{' '}
            {progress ? `${Math.round(progress)}%` : ''}
          </span>
        )}
        {status === 'ready' && (
          <span className="inline-flex items-center gap-2 text-green">
            <i className="i-mingcute-check-circle-line" />
            {t('about.update.ready', { version: version ?? '' })}
          </span>
        )}
        {status === 'uptodate' && (
          <span className="inline-flex items-center gap-2 text-text-secondary">
            <i className="i-mingcute-information-line" />
            {t('about.update.uptodate')}
          </span>
        )}
        {status === 'error' && (
          <span className="inline-flex items-center gap-2 text-red">
            <i className="i-mingcute-alert-circle-line" />
            {t('about.update.failed', { message: error ?? '' })}
            {error === t('about.update.versionTooLow') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => ipcServices?.app.openUrl(APP_LATEST_RELEASE_URL)}
              >
                {t('about.update.downloadLatest')}
              </Button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
