import { useMemo } from 'react'

import type {
  DiscoverProviderConfigMap,
  DiscoverProviderId,
} from '~/atoms/settings/discover'
import { useDiscoverProvidersConfig } from '~/atoms/settings/discover'

import { getDiscoverProvider } from '../providers'

export interface DiscoverProviderEntry {
  id: DiscoverProviderId
  config: DiscoverProviderConfigMap[DiscoverProviderId]
  ready: boolean
  implementation: NonNullable<ReturnType<typeof getDiscoverProvider>>
}

export const useDiscoverProviders = () => {
  const config = useDiscoverProvidersConfig()

  return useMemo(() => {
    const entries = Object.entries(config.providers) as Array<
      [DiscoverProviderId, DiscoverProviderConfigMap[DiscoverProviderId]]
    >

    return entries
      .map((entry) => {
        const [id, providerConfig] = entry
        const implementation = getDiscoverProvider(id)
        if (!implementation) return null

        const typedImplementation =
          implementation as DiscoverProviderEntry['implementation']

        return {
          id,
          config: providerConfig,
          ready: typedImplementation.isConfigReady(providerConfig as never),
          implementation: typedImplementation,
        }
      })
      .filter((entry): entry is DiscoverProviderEntry => entry !== null)
  }, [config.providers])
}

export const useEnabledDiscoverProviders = () => {
  const providers = useDiscoverProviders()
  return useMemo(
    () =>
      providers.filter((provider) => provider.config.enabled && provider.ready),
    [providers],
  )
}
