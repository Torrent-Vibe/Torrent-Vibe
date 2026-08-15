import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import { bangumiRssUrl } from '@torrent-vibe/mikan'
import { toast } from 'sonner'

import { getDiscoverProviderConfig } from '~/atoms/settings/discover'
import { Prompt } from '~/components/ui/prompts'
import { getI18n } from '~/i18n'
import type { MikanEpisodeExtra } from '~/modules/discover/providers/mikan/utils'
import { presentSettingsModal } from '~/modules/modals/SettingsModal'
import { SubscriptionActions } from '~/modules/subscriptions'

import { presentSubscribeTargets } from './subscribe-flow'

export const openHelperSettings = () => {
  presentSettingsModal({
    tab: ELECTRON ? 'servers' : 'appConnection',
  })
}

export const presentBangumiSubscribe = (input: {
  bangumiId: string
  title: string
  coverUrl?: string
  bangumiSubjectId?: string
  subgroupId: string
  subgroupName: string
  initialIds: string[]
}) => {
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
  Prompt.prompt({
    title: t('discover.modal.mikan.unsubscribeTitle'),
    description: t('discover.modal.mikan.unsubscribeConfirm', { title }),
    variant: 'danger',
    onConfirmText: t('discover.modal.mikan.unsubscribe'),
    onConfirm: async () => {
      await SubscriptionActions.shared.unsubscribe(subscription.id)
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
    episodes: episodes.map(episode => ({
      episodeId: episode.episodeId,
      title: episode.title,
      torrentUrl: episode.torrentUrl,
      ...(episode.publishedAt ? { publishedAt: episode.publishedAt } : {}),
      ...(typeof episode.sizeBytes === 'number'
        ? { sizeBytes: episode.sizeBytes }
        : {}),
    })),
  })
  if (result.ok) {
    toast.success(t('discover.modal.mikan.bulkImportOk'))
    return
  }
  toast.error(t('discover.modal.mikan.bulkImportFailed'))
}

export const episodeStateLabelKey = (state: string): I18nKeys => {
  switch (state) {
    case 'added': {
      return 'discover.modal.mikan.episodeState.added'
    }
    case 'downloading': {
      return 'discover.modal.mikan.episodeState.downloading'
    }
    case 'renaming': {
      return 'discover.modal.mikan.episodeState.renaming'
    }
    case 'done': {
      return 'discover.modal.mikan.episodeState.done'
    }
    case 'failed': {
      return 'discover.modal.mikan.episodeState.failed'
    }
    case 'needs-manual': {
      return 'discover.modal.mikan.episodeState.needsManual'
    }
    default: {
      return 'discover.modal.mikan.episodeState.pending'
    }
  }
}
