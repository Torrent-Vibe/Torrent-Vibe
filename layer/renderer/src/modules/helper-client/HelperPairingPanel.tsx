import { useMemo, useRef, useState } from 'react'
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

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <Input
              aria-label={t('servers.helper.manualUrl')}
              placeholder={probeUrl}
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
            />
            <Input
              aria-label={t('servers.helper.pairingCode')}
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={t('servers.helper.pairingCode')}
              value={pairingCode}
              onChange={(event) => {
                setPairingCode(
                  event.target.value.toUpperCase().replaceAll(/[^\dA-Z]/g, ''),
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
          <p className="text-xs text-text-tertiary">
            {t('servers.helper.pairingCodeHint')}
          </p>

          {electron && <HelperInstallSnippet />}
        </>
      )}
    </div>
  )
}
