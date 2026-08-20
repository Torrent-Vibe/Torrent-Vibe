import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '~/lib/cn'
import { useHelperBindingsStore } from '~/modules/helper-client/bindings'
import { HelperLogPanel } from '~/modules/helper-client/HelperLogPanel'
import { capabilitiesForServer } from '~/modules/subscriptions/capability-cache'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

export const HelperLogSection = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation('app')
  const binding = useHelperBindingsStore((state) => state.bindings[serverId])
  const capabilities = useSubscriptionsStore((state) =>
    capabilitiesForServer(serverId, state),
  )
  const [open, setOpen] = useState(false)

  if (!binding) {
    return null
  }

  return (
    <div className="rounded-md border border-border p-3">
      <button
        className="flex w-full items-center gap-1 text-left text-xs font-medium text-text"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <i
          className={cn(
            'i-mingcute-down-line text-sm transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
        {t('helper.logs.title')}
      </button>
      {open && (
        <div className="mt-3 ml-1 h-80 border-l border-border/60 pl-4">
          <HelperLogPanel
            baseUrl={binding.url}
            capabilities={capabilities}
            token={binding.token}
          />
        </div>
      )}
    </div>
  )
}
