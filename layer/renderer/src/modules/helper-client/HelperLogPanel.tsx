import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SegmentTab } from '~/components/ui/segment-tab'

import type { HelperCapabilities } from './capabilities'
import { HelperLogEventsTab } from './HelperLogEventsTab'
import { HelperLogRawTab } from './HelperLogRawTab'

type HelperLogTab = 'events' | 'raw'

export interface HelperLogPanelProps {
  baseUrl: string
  capabilities: HelperCapabilities
  replicaId?: string
  token: string
}

export const HelperLogPanel = ({
  baseUrl,
  token,
  capabilities,
  replicaId,
}: HelperLogPanelProps) => {
  const { t } = useTranslation('app')
  const [tab, setTab] = useState<HelperLogTab>('events')

  if (!capabilities.events) {
    return (
      <p className="text-sm text-text-secondary">{t('helper.logs.tooOld')}</p>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SegmentTab<HelperLogTab>
        containerClassName="w-full max-w-52"
        size="sm"
        value={tab}
        items={[
          { value: 'events', label: t('helper.logs.tabEvents') },
          { value: 'raw', label: t('helper.logs.tabRaw') },
        ]}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1">
        {tab === 'events' ? (
          <HelperLogEventsTab
            baseUrl={baseUrl}
            replicaId={replicaId}
            token={token}
          />
        ) : (
          <HelperLogRawTab baseUrl={baseUrl} token={token} />
        )}
      </div>
    </div>
  )
}
