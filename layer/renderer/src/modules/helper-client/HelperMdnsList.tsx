import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { ipcServices } from '~/lib/ipc-client'

import { useHelperBindings, useServerHelperTargets } from './hooks'
import type { MdnsRow } from './mdns-rows'
import { decorateMdnsRows } from './mdns-rows'

export const HelperMdnsList = ({
  serverId,
  onSelect,
}: {
  serverId: string
  onSelect: (url: string) => void
}) => {
  const { t } = useTranslation('app')
  const bindings = useHelperBindings()
  const targets = useServerHelperTargets()
  const [rows, setRows] = useState<MdnsRow[]>([])

  useEffect(() => {
    const helperMdns = ipcServices?.helperMdns
    if (!helperMdns) {
      return
    }
    helperMdns.startBrowse()
    const tick = () => {
      void helperMdns.list().then((next) => {
        setRows(next ?? [])
      })
    }
    tick()
    const id = window.setInterval(tick, 2000)
    return () => {
      window.clearInterval(id)
      helperMdns.stopBrowse()
    }
  }, [])

  if (!ipcServices?.helperMdns) {
    return null
  }

  const names = Object.fromEntries(
    targets.map((target) => [target.id, target.name]),
  )
  const decorated = decorateMdnsRows(rows, bindings, serverId, names)

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-text">
        {t('servers.helper.mdnsTitle')}
      </p>
      {decorated.length === 0 && (
        <p className="text-xs text-text-tertiary">
          {t('servers.helper.mdnsEmpty')}
        </p>
      )}
      {decorated.map((row) => (
        <Button
          className="w-full justify-start"
          disabled={row.disabled}
          key={`${row.host}:${row.port}`}
          size="sm"
          variant="secondary"
          onClick={() => onSelect(row.url)}
        >
          <span className="truncate">
            {row.host}:{row.port}
            {row.disabled && row.ownerName
              ? ` · ${t('servers.helper.mdnsBoundOther', { name: row.ownerName })}`
              : ''}
          </span>
        </Button>
      ))}
    </div>
  )
}
