import type { ReactNode } from 'react'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { RelativeTime } from '~/components/ui/typography'
import { cn } from '~/lib/cn'
import { useServerHelperTargets } from '~/modules/helper-client/hooks'
import {
  capabilitiesForServer,
  subscriptionFor,
  subscriptionProgress,
} from '~/modules/subscriptions'
import type { SubscriptionsState } from '~/modules/subscriptions/store'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

import {
  buildSubscriptionBarModel,
  showFailedCount,
  showSubscriptionBarDetails,
} from './subscription-bar-model'
import { serverNamesForIds } from './subscription-view'

interface MikanSubscriptionBarProps {
  bangumiId: string
  onOpenLogs?: () => void
  subgroupId: string
}

const isoToSeconds = (iso: string) => new Date(iso).getTime() / 1000

const RelativeLabel = ({
  i18nKey,
  iso,
}: {
  i18nKey: I18nKeys
  iso: string
}) => {
  const { t } = useTranslation('app')
  const [before, after] = t(i18nKey).split('{{relative}}')
  return (
    <>
      {before}
      <RelativeTime timestampSeconds={isoToSeconds(iso)} />
      {after}
    </>
  )
}

export const MikanSubscriptionBar = ({
  bangumiId,
  subgroupId,
  onOpenLogs,
}: MikanSubscriptionBarProps) => {
  const { t } = useTranslation('app')
  const items = useSubscriptionsStore((store) => store.items)
  const optimistic = useSubscriptionsStore((store) => store.optimistic)
  const statusByServer = useSubscriptionsStore((store) => store.statusByServer)
  const capabilitiesByServer = useSubscriptionsStore(
    (store) => store.capabilitiesByServer,
  )
  const targets = useServerHelperTargets()

  const variant = useMemo(() => {
    const state: SubscriptionsState = {
      items,
      optimistic,
      statusByServer,
      capabilitiesByServer,
      syncing: false,
    }
    const resolved = subscriptionFor(bangumiId, subgroupId, state)
    if (!resolved) return null
    const checkSupportByServerId = Object.fromEntries(
      resolved.record.targetServerIds.map((serverId) => [
        serverId,
        capabilitiesForServer(serverId, state).check,
      ]),
    )
    return buildSubscriptionBarModel({
      source: resolved.source,
      targets: resolved.targets,
      progress: subscriptionProgress(resolved.record, state),
      serverNames: serverNamesForIds(resolved.record.targetServerIds, targets),
      syncedAtIso: resolved.record.updatedAt,
      checkSupportByServerId,
    })
  }, [
    bangumiId,
    subgroupId,
    items,
    optimistic,
    statusByServer,
    capabilitiesByServer,
    targets,
  ])

  if (!variant) return null

  const showDetails = showSubscriptionBarDetails(variant, Boolean(onOpenLogs))

  const segments: { key: string; node: ReactNode }[] = [
    { key: 'servers', node: variant.serverLabel },
  ]

  if (variant.type === 'healthy') {
    segments.push({
      key: 'ready',
      node: t('discover.modal.mikan.subscriptionBar.ready', {
        ready: variant.ready,
        total: variant.total,
      }),
    })
    if (showFailedCount(variant)) {
      segments.push({
        key: 'failed',
        node: t('discover.modal.mikan.subscriptionBar.failed', {
          count: variant.failed,
        }),
      })
    }
    if (variant.checkedAt.type === 'checked') {
      segments.push({
        key: 'checked-at',
        node: (
          <RelativeLabel
            i18nKey="discover.modal.mikan.subscriptionBar.checkedAt"
            iso={variant.checkedAt.checkedAtIso}
          />
        ),
      })
    } else if (variant.checkedAt.type === 'never') {
      segments.push({
        key: 'never-checked',
        node: t('discover.modal.mikan.subscriptionBar.neverChecked'),
      })
    }
  } else if (variant.type === 'check-failed') {
    segments.push({
      key: 'check-failed',
      node: t('discover.modal.mikan.subscriptionBar.checkFailed', {
        count: variant.consecutiveFailures,
      }),
    })
  } else {
    segments.push({
      key: 'synced-at',
      node: (
        <RelativeLabel
          i18nKey="discover.modal.mikan.subscriptionBar.offline"
          iso={variant.syncedAtIso}
        />
      ),
    })
  }

  const dotClassName =
    variant.type === 'check-failed'
      ? 'bg-red'
      : variant.type === 'offline'
        ? 'bg-text-tertiary'
        : 'bg-green'

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary/60 px-3 py-2 text-sm text-text-secondary">
      <span className={cn('size-2 shrink-0 rounded-full', dotClassName)} />
      <span className="min-w-0 flex-1 truncate">
        {segments.map(({ key, node }, index) => (
          <Fragment key={key}>
            {index > 0 && ' · '}
            {node}
          </Fragment>
        ))}
      </span>
      {showDetails && (
        <Button size="sm" variant="ghost" onClick={onOpenLogs}>
          {t('discover.modal.mikan.subscriptionBar.details')}
        </Button>
      )}
    </div>
  )
}
