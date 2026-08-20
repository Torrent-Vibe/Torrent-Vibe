import { discoverHelper } from '../helper-client/api'
import { getHelperBinding } from '../helper-client/bindings'
import type { HelperCapabilities } from '../helper-client/capabilities'
import { helperCapabilities } from '../helper-client/capabilities'
import type { SubscriptionsState } from './store'
import { subscriptionStore } from './store'

export type DiscoverServerCapabilities = (serverId: string) => Promise<string[]>

export const liveDiscoverServerCapabilities: DiscoverServerCapabilities =
  async (serverId) => {
    const binding = getHelperBinding(serverId)
    if (!binding) {
      return []
    }
    const info = await discoverHelper(binding.url)
    return info.capabilities
  }

export const ensureServerCapabilities = async (
  serverIds: string[],
  discover: DiscoverServerCapabilities = liveDiscoverServerCapabilities,
): Promise<void> => {
  const known = subscriptionStore.getState().capabilitiesByServer
  const pending = [...new Set(serverIds.filter(Boolean))].filter(
    (serverId) => !(serverId in known),
  )
  if (pending.length === 0) {
    return
  }

  await Promise.all(
    pending.map(async (serverId) => {
      let capabilities: string[] = []
      try {
        capabilities = await discover(serverId)
      } catch {
        capabilities = []
      }
      subscriptionStore.setState((draft) => {
        draft.capabilitiesByServer[serverId] = capabilities
      })
    }),
  )
}

export const capabilitiesForServer = (
  serverId: string,
  state: Pick<SubscriptionsState, 'capabilitiesByServer'>,
): HelperCapabilities =>
  helperCapabilities(state.capabilitiesByServer[serverId])
