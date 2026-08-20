import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { VirtualList } from '~/components/ui/virtual-list/VirtualList'

import type { HelperLogLevel } from './events-filter'
import {
  DEFAULT_HELPER_LOG_LEVEL,
  filterHelperEvents,
  HELPER_LOG_LEVELS,
} from './events-filter'
import { formatHelperEventsForCopy } from './events-format'
import { HelperLogEventRow } from './HelperLogEventRow'
import { useHelperEventsFeed } from './use-helper-events-feed'

interface HelperLogEventsTabProps {
  baseUrl: string
  replicaId?: string
  token: string
}

export const HelperLogEventsTab = ({
  baseUrl,
  token,
  replicaId,
}: HelperLogEventsTabProps) => {
  const { t } = useTranslation('app')
  const events = useHelperEventsFeed({ baseUrl, token, replicaId })
  const [level, setLevel] = useState<HelperLogLevel>(DEFAULT_HELPER_LOG_LEVEL)
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => filterHelperEvents(events, { level, search }),
    [events, level, search],
  )

  const copyAll = () => {
    void navigator.clipboard
      .writeText(formatHelperEventsForCopy(filtered))
      .then(() => {
        toast.success(t('messages.copiedToClipboard'))
      })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span>{t('helper.logs.levelFilter')}</span>
          <Select
            value={level}
            onValueChange={(value) => setLevel(value as HelperLogLevel)}
          >
            <SelectTrigger className="w-24" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HELPER_LOG_LEVELS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          className="max-w-xs"
          placeholder={t('helper.logs.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button className="ml-auto" size="sm" variant="ghost" onClick={copyAll}>
          <i className="i-mingcute-copy-2-line mr-1" />
          {t('helper.logs.copyAll')}
        </Button>
      </div>
      {filtered.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-sm text-text-tertiary">
          {t('helper.logs.empty')}
        </p>
      ) : (
        <VirtualList
          className="min-h-0 flex-1 rounded-md border border-border"
          data={filtered}
          estimateSize={40}
          getItemKey={(event) => event.seq}
          renderItem={(event) => <HelperLogEventRow event={event} />}
        />
      )}
    </div>
  )
}
