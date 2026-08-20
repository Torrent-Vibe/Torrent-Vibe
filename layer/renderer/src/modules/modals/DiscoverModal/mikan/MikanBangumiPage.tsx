import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/cn'
import { asMikanBangumiExtra } from '~/modules/discover/providers/mikan/utils'
import { subscriptionFor } from '~/modules/subscriptions'
import type { SubscriptionsState } from '~/modules/subscriptions/store'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { openHelperLogsDrawer } from './bangumi-actions'
import { resolveMikanCoverUrl, weekdayLabelKey } from './helpers'
import { MikanEpisodeList } from './MikanEpisodeList'
import { MikanSubscriptionBar } from './MikanSubscriptionBar'
import {
  findOtherSubscribedSubgroup,
  subscribedSubgroupIds,
} from './subgroup-subscription'

export const MikanBangumiPage = () => {
  const { t } = useTranslation('app')
  const actions = DiscoverModalActions.shared
  const { mikan, importing } = actions.slices

  const items = useDiscoverModalStore((state) => state.items)
  const bangumiId = useDiscoverModalStore((state) => state.mikanBangumiId)
  const detail = useDiscoverModalStore((state) => state.mikanDetail)
  const loading = useDiscoverModalStore((state) => state.mikanDetailLoading)
  const error = useDiscoverModalStore((state) => state.mikanDetailError)
  const subgroupId = useDiscoverModalStore((state) => state.mikanSubgroupId)
  const importingFlag = useDiscoverModalStore((state) => state.importing)
  const subscriptions = useSubscriptionsStore((state) => state.items)
  const optimistic = useSubscriptionsStore((state) => state.optimistic)
  const statusByServer = useSubscriptionsStore((state) => state.statusByServer)
  const capabilitiesByServer = useSubscriptionsStore(
    (state) => state.capabilitiesByServer,
  )

  const item = detail ?? items.find((entry) => entry.id === bangumiId) ?? null
  const extra = asMikanBangumiExtra(item?.extra)
  const cover = resolveMikanCoverUrl(extra?.coverUrl)
  const subgroups = extra?.subgroups ?? []

  const subscriptionsState: SubscriptionsState = {
    items: subscriptions,
    optimistic,
    statusByServer,
    capabilitiesByServer,
    syncing: false,
  }
  const resolvedSubscription =
    bangumiId && subgroupId
      ? subscriptionFor(bangumiId, subgroupId, subscriptionsState)
      : null

  const subscribedSubgroups = bangumiId
    ? subscribedSubgroupIds(subscriptions, bangumiId)
    : new Set<string>()
  const otherSubscribed = bangumiId
    ? findOtherSubscribedSubgroup(subscriptions, bangumiId, subgroupId)
    : null

  const allEpisodes = extra?.episodes ?? []
  const episodes = subgroupId
    ? allEpisodes.filter((episode) => episode.subgroupId === subgroupId)
    : allEpisodes

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-48 w-36 shrink-0 overflow-hidden rounded-lg bg-fill-secondary sm:h-56 sm:w-40">
          {cover ? (
            <img
              alt={item?.title ?? ''}
              className="size-full object-cover"
              src={cover}
            />
          ) : (
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
                  className="text-accent hover:underline"
                  href={`https://bgm.tv/subject/${extra.bangumiSubjectId}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t('discover.modal.mikan.bangumiTv')}
                </a>
              )}
            </div>
          </div>

          {subgroups.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {subgroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition',
                    subgroupId === group.id
                      ? 'bg-accent text-white'
                      : 'bg-fill-secondary text-text-secondary hover:bg-fill-tertiary hover:text-text',
                  )}
                  onClick={() => mikan.selectSubgroup(group.id)}
                >
                  {subscribedSubgroups.has(group.id) && (
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        subgroupId === group.id ? 'bg-white' : 'bg-accent',
                      )}
                    />
                  )}
                  {group.name || group.id}
                </button>
              ))}
            </div>
          ) : (
            !loading && (
              <p className="text-sm text-text-tertiary">
                {t('discover.modal.mikan.noSubgroups')}
              </p>
            )
          )}

          {bangumiId && subgroupId && (
            <MikanSubscriptionBar
              bangumiId={bangumiId}
              subgroupId={subgroupId}
              onOpenLogs={openHelperLogsDrawer}
            />
          )}

          {otherSubscribed && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background-secondary/60 px-3 py-2 text-sm text-text-secondary">
              <span>{t('discover.modal.mikan.otherSubgroupSubscribed')}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => mikan.selectSubgroup(otherSubscribed.subgroupId)}
              >
                {t('discover.modal.mikan.switchToSubscribed')}
              </Button>
            </div>
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
          episodes={episodes}
          importing={importingFlag}
          statusByServer={statusByServer}
          subgroupId={subgroupId}
          subscribed={Boolean(resolvedSubscription)}
          targetServerIds={resolvedSubscription?.record.targetServerIds ?? []}
          onImport={(episodeId) => {
            void importing.importMikanEpisode(episodeId)
          }}
        />
      )}
    </div>
  )
}
