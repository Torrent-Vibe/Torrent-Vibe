import type {
  MikanBangumiExtra,
  MikanEpisodeExtra,
} from '~/modules/discover/providers/mikan/utils'

export type HeaderActionSubscribeTrigger =
  'noSubgroups' | 'openPairing' | 'subscribe'

export type HeaderActionMode =
  | { type: 'manage' }
  | { trigger: HeaderActionSubscribeTrigger; type: 'subscribe' }

export const resolveHeaderActionMode = ({
  hasSubgroups,
  paired,
  subscribed,
}: {
  hasSubgroups: boolean
  paired: boolean
  subscribed: boolean
}): HeaderActionMode => {
  if (subscribed) {
    return { type: 'manage' }
  }
  if (!paired) {
    return { type: 'subscribe', trigger: 'openPairing' }
  }
  if (!hasSubgroups) {
    return { type: 'subscribe', trigger: 'noSubgroups' }
  }
  return { type: 'subscribe', trigger: 'subscribe' }
}

export type HeaderActionMenuItem = 'checkNow' | 'editTargets' | 'unsubscribe'

export const resolveHeaderActionMenuItems = ({
  checkSupportByServerId,
  targetServerIds,
}: {
  checkSupportByServerId: Record<string, boolean>
  targetServerIds: string[]
}): HeaderActionMenuItem[] => {
  const items: HeaderActionMenuItem[] = ['editTargets']
  if (targetServerIds.some((serverId) => checkSupportByServerId[serverId])) {
    items.push('checkNow')
  }
  items.push('unsubscribe')
  return items
}

export interface PresentBangumiSubscribeInput {
  bangumiId: string
  bangumiSubjectId?: string
  coverUrl?: string
  episodes: MikanEpisodeExtra[]
  initialIds: string[]
  subgroupId: string
  subgroupName: string
  title: string
}

export const buildSubscribeInput = ({
  bangumiId,
  currentServerId,
  currentTargetServerIds,
  extra,
  subgroupId,
  title,
}: {
  bangumiId: string
  currentServerId: string | null
  currentTargetServerIds: string[] | null
  extra: MikanBangumiExtra | null
  subgroupId: string
  title: string
}): PresentBangumiSubscribeInput => {
  const subgroups = extra?.subgroups ?? []
  const episodes = extra?.episodes ?? []
  const group = subgroups.find((entry) => entry.id === subgroupId)
  return {
    bangumiId,
    title,
    coverUrl: extra?.coverUrl,
    bangumiSubjectId: extra?.bangumiSubjectId,
    subgroupId,
    subgroupName: group?.name || subgroupId,
    initialIds:
      currentTargetServerIds ?? (currentServerId ? [currentServerId] : []),
    episodes: episodes.filter((episode) => episode.subgroupId === subgroupId),
  }
}
