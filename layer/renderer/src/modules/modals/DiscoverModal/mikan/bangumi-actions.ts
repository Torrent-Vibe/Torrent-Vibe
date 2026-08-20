import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import type { RssEpisode } from '@torrent-vibe/mikan'
import { bangumiRssUrl } from '@torrent-vibe/mikan'
import { toast } from 'sonner'

import { getDiscoverProviderConfig } from '~/atoms/settings/discover'
import { getI18n } from '~/i18n'
import type { MikanEpisodeExtra } from '~/modules/discover/providers/mikan/utils'
import { checkHelper, getHelperBinding } from '~/modules/helper-client'
import { presentSettingsModal } from '~/modules/modals/SettingsModal'
import { SubscriptionActions } from '~/modules/subscriptions'

import type {
  HeaderActionSubscribeTrigger,
  PresentBangumiSubscribeInput,
} from './header-actions-model'
import { presentSubscribeTargets } from './subscribe-flow'
import { UnsubscribePrompt } from './UnsubscribePrompt'

export const openHelperSettings = () => {
  presentSettingsModal({
    tab: ELECTRON ? 'servers' : 'appConnection',
  })
}

const toRssEpisodes = (episodes: MikanEpisodeExtra[]): RssEpisode[] =>
  episodes.map((episode) => ({
    episodeId: episode.episodeId,
    title: episode.title,
    torrentUrl: episode.torrentUrl,
    ...(episode.publishedAt ? { publishedAt: episode.publishedAt } : {}),
    ...(typeof episode.sizeBytes === 'number'
      ? { sizeBytes: episode.sizeBytes }
      : {}),
  }))

export const presentBangumiSubscribe = (
  input: PresentBangumiSubscribeInput,
) => {
  const t = getI18n().t
  presentSubscribeTargets({
    initialIds: input.initialIds,
    onConfirm: async (serverIds) => {
      const result = await SubscriptionActions.shared.subscribe({
        bangumiId: input.bangumiId,
        title: input.title,
        coverUrl: input.coverUrl,
        bangumiSubjectId: input.bangumiSubjectId,
        subgroupId: input.subgroupId,
        subgroupName: input.subgroupName,
        rssUrl: bangumiRssUrl(
          getDiscoverProviderConfig('mikan').baseUrl,
          input.bangumiId,
          input.subgroupId,
        ),
        targetServerIds: serverIds,
        episodes: toRssEpisodes(input.episodes),
      })
      if (result.ok) {
        toast.success(t('discover.modal.mikan.subscribeOk'))
        return
      }
      toast.error(t('discover.modal.mikan.subscribeFailed'))
    },
  })
}

export const presentBangumiUnsubscribe = (
  subscription: SubscriptionRecord,
  title: string,
) => {
  const t = getI18n().t
  UnsubscribePrompt.show({
    title,
    onConfirm: async (deleteFiles) => {
      const result = await SubscriptionActions.shared.unsubscribe(
        subscription.id,
        { deleteFiles },
      )
      if (!result.ok) {
        toast.error(t('discover.modal.mikan.unsubscribeFailed'))
      }
    },
  })
}

export const backfillReleasedEpisodes = async (
  bangumiId: string,
  subgroupId: string,
  episodes: MikanEpisodeExtra[],
) => {
  const t = getI18n().t
  const result = await SubscriptionActions.shared.backfill({
    bangumiId,
    subgroupId,
    episodes: toRssEpisodes(episodes),
  })
  if (result.ok) {
    toast.success(t('discover.modal.mikan.bulkImportOk'))
    return
  }
  toast.error(t('discover.modal.mikan.bulkImportFailed'))
}

export const checkSubscriptionNow = async (
  subscription: SubscriptionRecord,
): Promise<void> => {
  await Promise.all(
    subscription.targetServerIds.map(async (serverId) => {
      const binding = getHelperBinding(serverId)
      if (!binding) {
        return
      }
      try {
        await checkHelper(binding.url, binding.token)
      } catch {
        // The subscription bar reflects the failure via replica checkError once refreshStatus below lands.
      }
    }),
  )
  await SubscriptionActions.shared.refreshStatus(subscription.targetServerIds)
}

export const runHeaderSubscribeTrigger = (
  trigger: HeaderActionSubscribeTrigger,
  subscribe: () => void,
) => {
  if (trigger === 'openPairing') {
    openHelperSettings()
    return
  }
  if (trigger === 'noSubgroups') {
    toast.error(getI18n().t('discover.modal.mikan.noSubgroups'))
    return
  }
  subscribe()
}
