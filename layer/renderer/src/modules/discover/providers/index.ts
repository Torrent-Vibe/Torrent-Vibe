import type { DiscoverProviderId } from '~/atoms/settings/discover'

import type { AnyDiscoverProvider } from '../types'
import { MTeamDiscoverProvider } from './mteam'

const registry: Record<DiscoverProviderId, AnyDiscoverProvider> = {
  mteam: MTeamDiscoverProvider,
}

export const getDiscoverProvider = <T extends DiscoverProviderId>(id: T) =>
  registry[id]

export const getDiscoverProviders = (): AnyDiscoverProvider[] =>
  Object.values(registry)

export const isProviderRegistered = (id: DiscoverProviderId): boolean =>
  Boolean(registry[id])

export { type AnyDiscoverProvider } from '../types'
