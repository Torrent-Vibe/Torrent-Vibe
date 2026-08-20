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
