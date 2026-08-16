import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { asMikanBangumiExtra } from '~/modules/discover/providers/mikan/utils'
import {
  useCurrentHelperPaired,
  useCurrentServerId,
} from '~/modules/helper-client/hooks'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

import { useDiscoverModalStore } from '../store'
import {
  backfillReleasedEpisodes,
  openHelperSettings,
  presentBangumiSubscribe,
} from './bangumi-actions'

export const MikanBangumiHeaderActions = () => {
  const { t } = useTranslation('app')
  const items = useDiscoverModalStore(state => state.items)
  const bangumiId = useDiscoverModalStore(state => state.mikanBangumiId)
  const detail = useDiscoverModalStore(state => state.mikanDetail)
  const subgroupId = useDiscoverModalStore(state => state.mikanSubgroupId)
  const helperPaired = useCurrentHelperPaired()
  const currentServerId = useCurrentServerId()
  const subscriptions = useSubscriptionsStore(state => state.items)
  const [backfilling, setBackfilling] = useState(false)

  const item = detail ?? items.find(entry => entry.id === bangumiId) ?? null
  const extra = asMikanBangumiExtra(item?.extra)
  const subgroups = extra?.subgroups ?? []
  const helperHint = t('discover.modal.mikan.helperNotBound')
  const subscription = subscriptions.find(
    entry =>
      entry.bangumiId === bangumiId
      && entry.subgroupId === (subgroupId ?? entry.subgroupId),
  )

  const allEpisodes = extra?.episodes ?? []
  const episodes = subgroupId
    ? allEpisodes.filter(episode => episode.subgroupId === subgroupId)
    : allEpisodes

  const handleSubscribe = () => {
    if (!helperPaired || !bangumiId || !subgroupId || !item) {
      return
    }
    const group = subgroups.find(entry => entry.id === subgroupId)
    presentBangumiSubscribe({
      bangumiId,
      title: item.title,
      coverUrl: extra?.coverUrl,
      bangumiSubjectId: extra?.bangumiSubjectId,
      subgroupId,
      subgroupName: group?.name || subgroupId,
      initialIds:
        subscription?.targetServerIds
        ?? (currentServerId ? [currentServerId] : []),
    })
  }

  const handleBackfill = async () => {
    if (!helperPaired || !bangumiId || !subgroupId || episodes.length === 0) {
      return
    }
    setBackfilling(true)
    try {
      await backfillReleasedEpisodes(bangumiId, subgroupId, episodes)
    }
    finally {
      setBackfilling(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span title={helperPaired ? undefined : helperHint}>
        <Button
          size="sm"
          variant="secondary"
          disabled={!helperPaired || backfilling || !subgroupId}
          onClick={() => {
            void handleBackfill()
          }}
        >
          {backfilling && (
            <i className="i-mingcute-loading-3-line mr-1 animate-spin" />
          )}
          {t('discover.modal.mikan.importReleased')}
        </Button>
      </span>
      <span title={helperPaired ? undefined : helperHint}>
        <Button
          size="sm"
          variant="secondary"
          disabled={!helperPaired || !subgroupId}
          onClick={handleSubscribe}
        >
          {subscription
            ? t('discover.modal.mikan.editTargets')
            : t('discover.modal.mikan.subscribe')}
        </Button>
      </span>
      {!helperPaired && (
        <button
          type="button"
          className="text-xs text-accent hover:underline"
          onClick={openHelperSettings}
        >
          {t('discover.modal.mikan.bindHelper')}
        </button>
      )}
    </div>
  )
}
