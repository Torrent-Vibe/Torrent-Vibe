import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

import { sameHostDiscoverUrl } from './api'
import { useHelperBindingsStore } from './bindings'
import { connectHelper, helperOwnerName } from './connect'
import { HelperConfigForm } from './HelperConfigForm'
import { HelperInstallSnippet } from './HelperInstallSnippet'
import { HelperMdnsList } from './HelperMdnsList'
import { HelperPairingCodeHelp } from './HelperPairingCodeHelp'
import { HelperProfileSyncPanel } from './HelperProfileSyncPanel'

export const HelperPairingPanel = ({
  serverId,
  host,
  name,
}: {
  serverId: string
  host: string
  name?: string
}) => {
  const { t } = useTranslation('app')
  const binding = useHelperBindingsStore((state) => state.bindings[serverId])
  const probeUrl = useMemo(() => sameHostDiscoverUrl(host), [host])
  const [manualUrl, setManualUrl] = useState(binding?.url ?? probeUrl)
  const [pairingCode, setPairingCode] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const urlFieldId = useId()
  const codeFieldId = useId()
  const electron = typeof ELECTRON !== 'undefined' && ELECTRON

  const connect = async (url: string, code: string) => {
    if (busyRef.current) {
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      const result = await connectHelper(serverId, url, code)
      if (result.ok) {
        setManualUrl(result.url)
        setPairingCode('')
        const { SubscriptionActions } = await import('../subscriptions')
        void SubscriptionActions.shared.syncServers([serverId]).then(() => {
          void SubscriptionActions.shared.refreshStatus([serverId])
        })
        toast.success(t('servers.helper.pairOk'))
        return
      }
      if (result.error === 'urlInUse') {
        toast.error(
          t('servers.helper.urlInUse', { name: helperOwnerName(result.owner) }),
        )
        return
      }
      if (result.error === 'tooManyAttempts') {
        toast.error(t('servers.helper.tooManyAttempts'))
        return
      }
      toast.error(
        t(
          result.error === 'discoverFailed'
            ? 'servers.helper.discoverFailed'
            : 'servers.helper.pairFailed',
        ),
      )
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const handleUnbind = async () => {
    if (busyRef.current) {
      return
    }
    busyRef.current = true
    setBusy(true)
    const { SubscriptionActions } = await import('../subscriptions')
    const result = await SubscriptionActions.shared.unbindHelper(serverId)
    if (result.error === 'unreachable') {
      toast.error(t('servers.helper.unbindLocalOnly'))
    }
    busyRef.current = false
    setBusy(false)
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">{name || host}</p>
          <p className="truncate text-xs text-text-secondary">
            {binding
              ? t('servers.helper.paired', { url: binding.url })
              : t('servers.helper.unbound')}
          </p>
        </div>
        {binding && (
          <Button
            disabled={busy}
            size="sm"
            variant="ghost"
            onClick={() => {
              void handleUnbind()
            }}
          >
            {t('servers.helper.unbind')}
          </Button>
        )}
      </div>

      {binding ? (
        <>
          <HelperProfileSyncPanel serverId={serverId} />
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-text [&::-webkit-details-marker]:hidden">
              <i className="i-mingcute-down-line text-sm transition-transform duration-200 group-open:rotate-180" />
              {t('servers.helper.configTitle')}
            </summary>
            <div className="mt-3 ml-1 border-l border-border/60 pl-4">
              <HelperConfigForm serverId={serverId} />
            </div>
          </details>
        </>
      ) : (
        <>
          {electron && (
            <HelperMdnsList
              serverId={serverId}
              onSelect={(url) => {
                setManualUrl(url)
              }}
            />
          )}

          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-text"
              htmlFor={urlFieldId}
            >
              {t('servers.helper.manualUrl')}
            </label>
            <Input
              id={urlFieldId}
              placeholder={probeUrl}
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-text"
              htmlFor={codeFieldId}
            >
              {t('servers.helper.pairingCode')}
            </label>
            <div className="flex items-center gap-2">
              <Input
                autoComplete="one-time-code"
                className="w-44 shrink-0"
                id={codeFieldId}
                inputClassName="text-center font-mono text-base uppercase tracking-[0.35em]"
                maxLength={6}
                placeholder={t('servers.helper.pairingCodePlaceholder')}
                value={pairingCode}
                onChange={(event) => {
                  setPairingCode(
                    event.target.value
                      .toUpperCase()
                      .replaceAll(/[^\dA-Z]/g, ''),
                  )
                }}
              />
              <Button
                size="sm"
                disabled={
                  busy || !manualUrl.trim() || pairingCode.trim().length !== 6
                }
                onClick={() => {
                  void connect(manualUrl, pairingCode)
                }}
              >
                {busy && (
                  <i className="i-mingcute-loading-3-line mr-1 animate-spin" />
                )}
                {busy
                  ? t('servers.helper.connecting')
                  : t('servers.helper.connect')}
              </Button>
            </div>
          </div>

          <HelperPairingCodeHelp />

          {electron && <HelperInstallSnippet />}
        </>
      )}
    </div>
  )
}
