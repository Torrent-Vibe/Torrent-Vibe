import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'

import {
  clearHelperBinding,
  discoverHelper,
  normalizeHelperBaseUrl,
  pairHelper,
  sameHostDiscoverUrl,
  setHelperBinding,
  useHelperBindingsStore,
} from '.'
import type { HelperDiscoverInfo } from './types'

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
  const bindings = useHelperBindingsStore(state => state.bindings)
  const binding = bindings[serverId]
  const probeUrl = useMemo(() => sameHostDiscoverUrl(host), [host])
  const [manualUrl, setManualUrl] = useState(binding?.url ?? probeUrl)
  const [code, setCode] = useState('')
  const [discover, setDiscover] = useState<HelperDiscoverInfo | null>(null)
  const [busy, setBusy] = useState<'probe' | 'pair' | 'unbind' | null>(null)

  const handleProbe = async (url: string) => {
    setBusy('probe')
    try {
      const info = await discoverHelper(url)
      setDiscover(info)
      setManualUrl(normalizeHelperBaseUrl(url))
    }
    catch {
      setDiscover(null)
      toast.error(t('servers.helper.discoverFailed'))
    }
    finally {
      setBusy(null)
    }
  }

  const handlePair = async () => {
    const url = normalizeHelperBaseUrl(manualUrl)
    if (!url || !code.trim()) {
      return
    }
    setBusy('pair')
    try {
      const { token } = await pairHelper(url, code.trim())
      setHelperBinding(serverId, { url, token })
      const { SubscriptionActions } = await import('../subscriptions')
      void SubscriptionActions.shared.syncServers([serverId]).then(() => {
        void SubscriptionActions.shared.refreshStatus([serverId])
      })
      toast.success(t('servers.helper.pairOk'))
    }
    catch {
      toast.error(t('servers.helper.pairFailed'))
    }
    finally {
      setBusy(null)
    }
  }

  const handleUnbind = () => {
    setBusy('unbind')
    clearHelperBinding(serverId)
    setDiscover(null)
    setBusy(null)
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">{name || host}</p>
          <p className="text-xs text-text-secondary">
            {binding
              ? t('servers.helper.paired', { url: binding.url })
              : t('servers.helper.unbound')}
          </p>
        </div>
        {binding && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleUnbind}
            disabled={busy !== null}
          >
            {t('servers.helper.unbind')}
          </Button>
        )}
      </div>

      <p className="text-xs text-text-secondary">
        {t('servers.helper.probeHint', { url: probeUrl })}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => {
            void handleProbe(probeUrl)
          }}
        >
          {busy === 'probe' && (
            <i className="i-mingcute-loading-3-line mr-1 animate-spin" />
          )}
          {t('servers.helper.probe')}
        </Button>
      </div>

      <div className="space-y-1">
        <Label variant="form">{t('servers.helper.manualUrl')}</Label>
        <div className="flex gap-2">
          <Input
            value={manualUrl}
            onChange={event => setManualUrl(event.target.value)}
            placeholder={probeUrl}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy !== null || !manualUrl.trim()}
            onClick={() => {
              void handleProbe(manualUrl)
            }}
          >
            {t('servers.helper.confirm')}
          </Button>
        </div>
      </div>

      {discover && (
        <div className="space-y-1 text-xs text-text-secondary">
          <p>
            {t('servers.helper.version', { version: discover.version || '—' })}
          </p>
          {discover.advertisedQbitUrl && <p>{discover.advertisedQbitUrl}</p>}
        </div>
      )}

      <div className="space-y-1">
        <Label variant="form">{t('servers.helper.codeLabel')}</Label>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={event => setCode(event.target.value)}
            placeholder="ABCDEF"
          />
          <Button
            size="sm"
            disabled={busy !== null || !manualUrl.trim() || !code.trim()}
            onClick={() => {
              void handlePair()
            }}
          >
            {busy === 'pair' && (
              <i className="i-mingcute-loading-3-line mr-1 animate-spin" />
            )}
            {binding ? t('servers.helper.rebind') : t('servers.helper.pair')}
          </Button>
        </div>
      </div>
    </div>
  )
}
