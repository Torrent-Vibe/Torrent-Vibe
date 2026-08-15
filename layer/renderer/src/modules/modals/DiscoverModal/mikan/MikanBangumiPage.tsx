import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/cn'
import { asMikanBangumiExtra } from '~/modules/discover/providers/mikan/utils'
import {
  useCurrentHelperPaired,
  useCurrentServerId,
} from '~/modules/helper-client/hooks'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import {
  backfillReleasedEpisodes,
  openHelperSettings,
  presentBangumiSubscribe,
  presentBangumiUnsubscribe,
} from './bangumi-actions'
import { resolveMikanCoverUrl, weekdayLabelKey } from './helpers'
import { MikanEpisodeList } from './MikanEpisodeList'

export const MikanBangumiPage = () => {
  const { t } = useTranslation('app')
  const actions = DiscoverModalActions.shared
  const { mikan, importing } = actions.slices

  const items = useDiscoverModalStore(state => state.items)
  const bangumiId = useDiscoverModalStore(state => state.mikanBangumiId)
  const detail = useDiscoverModalStore(state => state.mikanDetail)
  const loading = useDiscoverModalStore(state => state.mikanDetailLoading)
  const error = useDiscoverModalStore(state => state.mikanDetailError)
  const subgroupId = useDiscoverModalStore(state => state.mikanSubgroupId)
  const importingFlag = useDiscoverModalStore(state => state.importing)
  const helperPaired = useCurrentHelperPaired()
  const currentServerId = useCurrentServerId()
  const subscriptions = useSubscriptionsStore(state => state.items)
  const statusByServer = useSubscriptionsStore(state => state.statusByServer)
  const [backfilling, setBackfilling] = useState(false)

  const item = detail ?? items.find(entry => entry.id === bangumiId) ?? null
  const extra = asMikanBangumiExtra(item?.extra)
  const cover = resolveMikanCoverUrl(extra?.coverUrl)
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
    <div className="flex flex-col gap-4 px-4 py-4">
      <div>
        <Button variant="ghost" size="sm" onClick={() => mikan.closeBangumi()}>
          <i className="i-mingcute-arrow-left-line mr-1" />
          <span>{t('discover.modal.mikan.back')}</span>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-48 w-36 shrink-0 overflow-hidden rounded-lg bg-fill-secondary sm:h-56 sm:w-40">
          {cover
            ? (
                <img
                  src={cover}
                  alt={item?.title ?? ''}
                  className="size-full object-cover"
                />
              )
            : (
                <div className="flex size-full items-center justify-center text-text-tertiary">
                  <i className="i-mingcute-movie-line text-3xl" />
                </div>
              )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold leading-tight text-text">
              {item?.title ?? bangumiId}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              {extra?.weekday !== undefined && (
                <span>{t(weekdayLabelKey(extra.weekday))}</span>
              )}
              {extra?.bangumiSubjectId && (
                <a
                  href={`https://bgm.tv/subject/${extra.bangumiSubjectId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  {t('discover.modal.mikan.bangumiTv')}
                </a>
              )}
            </div>
          </div>

          {subgroups.length > 0
            ? (
                <div className="flex flex-wrap gap-1.5">
                  {subgroups.map(group => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => mikan.selectSubgroup(group.id)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs transition',
                        subgroupId === group.id
                          ? 'bg-accent text-white'
                          : 'bg-fill-secondary text-text-secondary hover:bg-fill-tertiary hover:text-text',
                      )}
                    >
                      {group.name || group.id}
                    </button>
                  ))}
                </div>
              )
            : (
                !loading && (
                  <p className="text-sm text-text-tertiary">
                    {t('discover.modal.mikan.noSubgroups')}
                  </p>
                )
              )}

          <div className="flex flex-wrap items-center gap-1.5">
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
            {subscription && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  presentBangumiUnsubscribe(
                    subscription,
                    item?.title ?? subscription.title,
                  )}
              >
                {t('discover.modal.mikan.unsubscribe')}
              </Button>
            )}
          </div>
          {!helperPaired && (
            <button
              type="button"
              className="text-left text-xs text-accent hover:underline"
              onClick={openHelperSettings}
            >
              {helperHint}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-1.5 text-sm text-text-tertiary">
          <i className="i-mingcute-loading-3-line animate-spin text-lg" />
          <span>{t('discover.modal.loading')}</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background-secondary/60 px-3 py-2 text-sm text-text-secondary">
          <span>{t('discover.modal.mikan.detailFailed')}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => mikan.retryBangumiDetail()}
          >
            {t('discover.modal.mikan.retry')}
          </Button>
        </div>
      )}

      {!loading && !error && episodes.length === 0 && (
        <p className="text-sm text-text-tertiary">
          {t('discover.modal.mikan.noEpisodes')}
        </p>
      )}

      {episodes.length > 0 && bangumiId && (
        <MikanEpisodeList
          bangumiId={bangumiId}
          subgroupId={subgroupId}
          episodes={episodes}
          importing={importingFlag}
          statusByServer={statusByServer}
          onImport={(episodeId) => {
            void importing.importMikanEpisode(episodeId)
          }}
        />
      )}
    </div>
  )
}
