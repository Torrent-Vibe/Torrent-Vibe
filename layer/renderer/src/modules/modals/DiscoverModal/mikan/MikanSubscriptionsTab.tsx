import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Prompt } from '~/components/ui/prompts'
import type { DiscoverItem } from '~/modules/discover'
import { useServerHelperTargets } from '~/modules/helper-client/hooks'
import { presentSettingsModal } from '~/modules/modals/SettingsModal'
import { SubscriptionActions } from '~/modules/subscriptions'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

import { DiscoverModalActions } from '../actions'
import { DiscoverEmptyState } from '../components'
import { resolveMikanCoverUrl } from './helpers'
import { presentSubscribeTargets } from './subscribe-flow'
import {
  latestEpisodeForSubscription,
  serverNamesForIds,
} from './subscription-view'

export const MikanSubscriptionsTab = () => {
  const { t } = useTranslation('app')
  const items = useSubscriptionsStore(state => state.items)
  const statusByServer = useSubscriptionsStore(state => state.statusByServer)
  const targets = useServerHelperTargets()
  const { mikan } = DiscoverModalActions.shared.slices

  const rows = useMemo(
    () => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  )

  if (rows.length === 0) {
    return (
      <DiscoverEmptyState
        icon="i-mingcute-notify-line"
        title={t('discover.modal.mikan.noSubscriptionsTitle')}
        description={t('discover.modal.mikan.noSubscriptionsDescription')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {rows.map((item) => {
        const names = serverNamesForIds(item.targetServerIds, targets)
        const reachable = item.targetServerIds.some(id =>
          targets.some(target => target.id === id && target.paired))
        const latest = latestEpisodeForSubscription(item, statusByServer)
        const cover = resolveMikanCoverUrl(item.coverUrl)

        return (
          <div
            key={item.id}
            className="flex gap-3 rounded-lg border border-border bg-background p-3"
          >
            <button
              type="button"
              className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-fill-secondary"
              onClick={() => {
                const discoverItem: DiscoverItem = {
                  id: item.bangumiId,
                  providerId: 'mikan',
                  title: item.title,
                  extra: {
                    kind: 'bangumi',
                    coverUrl: item.coverUrl,
                    bangumiSubjectId: item.bangumiSubjectId,
                    subgroups: [
                      { id: item.subgroupId, name: item.subgroupName },
                    ],
                  },
                }
                mikan.openBangumi(discoverItem)
              }}
            >
              {cover
                ? (
                    <img
                      src={cover}
                      alt={item.title}
                      className="size-full object-cover"
                    />
                  )
                : (
                    <div className="flex size-full items-center justify-center text-text-tertiary">
                      <i className="i-mingcute-movie-line text-lg" />
                    </div>
                  )}
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-text">
                {item.title}
              </p>
              <p className="truncate text-xs text-text-secondary">
                {item.subgroupName}
              </p>
              <p className="text-xs text-text-secondary">
                {t('discover.modal.mikan.targetServers')}
                {': '}
                {names.join(', ') || '—'}
              </p>
              <p className="text-xs text-text-tertiary">
                {item.targetServerIds
                  .map((id) => {
                    const sync = item.syncByServer[id]
                    const name
                      = targets.find(target => target.id === id)?.name ?? id
                    if (!sync || sync.status === 'pending') {
                      return `${name}: ${t('discover.modal.mikan.syncPending')}`
                    }
                    if (sync.status === 'error') {
                      return `${name}: ${t('discover.modal.mikan.syncError')}`
                    }
                    return `${name}: ${t('discover.modal.mikan.syncOk')}`
                  })
                  .join(' · ')}
              </p>
              {latest && (
                <p className="text-xs text-text-tertiary">
                  {t('discover.modal.mikan.latestEpisode')}
                  {': '}
                  {latest.title}
                  {latest.state === 'failed' || latest.state === 'needs-manual'
                    ? ` · ${t('discover.modal.mikan.lastRename')}: ${latest.state}`
                    : ''}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    presentSubscribeTargets({
                      initialIds: item.targetServerIds,
                      onConfirm: async (serverIds) => {
                        await SubscriptionActions.shared.retarget(
                          item.id,
                          serverIds,
                        )
                      },
                    })
                  }}
                >
                  {t('discover.modal.mikan.editTargets')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    Prompt.prompt({
                      title: t('discover.modal.mikan.unsubscribeTitle'),
                      description: t(
                        'discover.modal.mikan.unsubscribeConfirm',
                        { title: item.title },
                      ),
                      variant: 'danger',
                      onConfirmText: t('discover.modal.mikan.unsubscribe'),
                      onConfirm: async () => {
                        await SubscriptionActions.shared.unsubscribe(item.id)
                      },
                    })
                  }}
                >
                  {t('discover.modal.mikan.unsubscribe')}
                </Button>
                {!reachable && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      presentSettingsModal({
                        tab: ELECTRON ? 'servers' : 'appConnection',
                      })}
                  >
                    {t('discover.modal.mikan.bindHelper')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
