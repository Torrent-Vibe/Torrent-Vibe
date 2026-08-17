import { getStableRouterNavigate } from '~/atoms/route'
import type { DiscoverProviderId } from '~/atoms/settings/discover'
import {
  DISCOVER_PROVIDER_IDS,
  getDiscoverConfig,
} from '~/atoms/settings/discover'
import { getDiscoverProvider } from '~/modules/discover/providers'

import { resolveLastProvider } from './actions/lastProvider'
import { readLastProvider } from './actions/lastProviderPersist'

export const isDiscoverProviderId = (
  value: string | undefined,
): value is DiscoverProviderId =>
  Boolean(value && (DISCOVER_PROVIDER_IDS as readonly string[]).includes(value))

export const resolveDiscoverProviderId = (): DiscoverProviderId => {
  const config = getDiscoverConfig()
  const readyIds = DISCOVER_PROVIDER_IDS.filter((id) => {
    const implementation = getDiscoverProvider(id)
    return implementation.isConfigReady(config.providers[id] as never)
  })
  return resolveLastProvider(readLastProvider(), readyIds) ?? 'mteam'
}

export const discoverPath = (id: DiscoverProviderId) => `/discover/${id}`

export const openDiscover = (id?: DiscoverProviderId) => {
  const target = id ?? resolveDiscoverProviderId()
  getStableRouterNavigate()?.(discoverPath(target))
}
