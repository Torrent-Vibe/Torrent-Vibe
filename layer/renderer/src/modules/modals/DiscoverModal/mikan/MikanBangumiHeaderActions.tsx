import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu/DropdownMenu'
import { asMikanBangumiExtra } from '~/modules/discover/providers/mikan/utils'
import {
  useCurrentHelperPaired,
  useCurrentServerId,
} from '~/modules/helper-client/hooks'
import { capabilitiesForServer, subscriptionFor } from '~/modules/subscriptions'
import type { SubscriptionsState } from '~/modules/subscriptions/store'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

import { useDiscoverModalStore } from '../store'
import {
  checkSubscriptionNow,
  presentBangumiSubscribe,
  presentBangumiUnsubscribe,
  runHeaderSubscribeTrigger,
} from './bangumi-actions'
import type { HeaderActionMenuItem } from './header-actions-model'
import {
  resolveHeaderActionMenuItems,
  resolveHeaderActionMode,
} from './header-actions-model'

const MENU_ITEM_LABEL_KEYS: Record<HeaderActionMenuItem, I18nKeys> = {
  editTargets: 'discover.modal.mikan.editTargets',
  checkNow: 'discover.modal.mikan.checkNow',
  unsubscribe: 'discover.modal.mikan.unsubscribe',
}

export const MikanBangumiHeaderActions = () => {
  const { t } = useTranslation('app')
  const items = useDiscoverModalStore((state) => state.items)
  const bangumiId = useDiscoverModalStore((state) => state.mikanBangumiId)
  const detail = useDiscoverModalStore((state) => state.mikanDetail)
  const subgroupId = useDiscoverModalStore((state) => state.mikanSubgroupId)
  const helperPaired = useCurrentHelperPaired()
  const currentServerId = useCurrentServerId()

  const subscriptionItems = useSubscriptionsStore((state) => state.items)
  const optimistic = useSubscriptionsStore((state) => state.optimistic)
  const statusByServer = useSubscriptionsStore((state) => state.statusByServer)
  const capabilitiesByServer = useSubscriptionsStore(
    (state) => state.capabilitiesByServer,
  )

  const item = detail ?? items.find((entry) => entry.id === bangumiId) ?? null
  const extra = asMikanBangumiExtra(item?.extra)
  const subgroups = extra?.subgroups ?? []
  const allEpisodes = extra?.episodes ?? []
  const episodes = subgroupId
    ? allEpisodes.filter((episode) => episode.subgroupId === subgroupId)
    : allEpisodes

  const subscriptionsState: SubscriptionsState = {
    items: subscriptionItems,
    optimistic,
    statusByServer,
    capabilitiesByServer,
    syncing: false,
  }
  const resolved =
    bangumiId && subgroupId
      ? subscriptionFor(bangumiId, subgroupId, subscriptionsState)
      : null

  const mode = resolveHeaderActionMode({
    paired: helperPaired,
    subscribed: resolved !== null,
    hasSubgroups: subgroups.length > 0,
  })

  const handleSubscribe = () => {
    if (!bangumiId || !subgroupId || !item) {
      return
    }
    const group = subgroups.find((entry) => entry.id === subgroupId)
    presentBangumiSubscribe({
      bangumiId,
      title: item.title,
      coverUrl: extra?.coverUrl,
      bangumiSubjectId: extra?.bangumiSubjectId,
      subgroupId,
      subgroupName: group?.name || subgroupId,
      initialIds:
        resolved?.record.targetServerIds ??
        (currentServerId ? [currentServerId] : []),
      episodes,
    })
  }

  if (resolved) {
    const checkSupportByServerId = Object.fromEntries(
      resolved.record.targetServerIds.map((serverId) => [
        serverId,
        capabilitiesForServer(serverId, { capabilitiesByServer }).check,
      ]),
    )
    const menuItems = resolveHeaderActionMenuItems({
      targetServerIds: resolved.record.targetServerIds,
      checkSupportByServerId,
    })
    const menuHandlers: Record<HeaderActionMenuItem, () => void> = {
      editTargets: handleSubscribe,
      checkNow: () => {
        void checkSubscriptionNow(resolved.record)
      },
      unsubscribe: () =>
        presentBangumiUnsubscribe(
          resolved.record,
          item?.title ?? resolved.record.title,
        ),
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary">
            {t('discover.modal.mikan.manageSubscription')}
            <i className="i-mingcute-down-line ml-1 text-xs opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {menuItems.map((menuItem) => (
            <DropdownMenuItem key={menuItem} onClick={menuHandlers[menuItem]}>
              {t(MENU_ITEM_LABEL_KEYS[menuItem])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (mode.type === 'subscribe') {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => runHeaderSubscribeTrigger(mode.trigger, handleSubscribe)}
      >
        {t('discover.modal.mikan.subscribe')}
      </Button>
    )
  }

  return null
}
