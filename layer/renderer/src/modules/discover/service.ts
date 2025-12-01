import type { DiscoverProviderId } from '~/atoms/settings/discover'
import { getDiscoverProviderConfig } from '~/atoms/settings/discover'

import { getDiscoverProvider } from './providers'
import type {
  DiscoverDownloadInfo,
  DiscoverDownloadParams,
  DiscoverItemDetail,
  DiscoverSearchParams,
  DiscoverSearchResponse,
} from './types'

export class DiscoverService {
  private static assertProvider(providerId: DiscoverProviderId) {
    const provider = getDiscoverProvider(providerId)
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`)
    }

    const config = getDiscoverProviderConfig(providerId)
    if (!config.enabled) {
      throw new Error('Provider is disabled')
    }

    if (!provider.isConfigReady(config as never)) {
      throw new Error('Provider configuration is incomplete')
    }

    return { provider, config }
  }

  static async search(
    providerId: DiscoverProviderId,
    params: DiscoverSearchParams,
  ): Promise<DiscoverSearchResponse> {
    const { provider, config } = this.assertProvider(providerId)
    return provider.search(params, config as never)
  }

  static async detail(
    providerId: DiscoverProviderId,
    params: DiscoverDownloadParams,
  ): Promise<DiscoverItemDetail> {
    const { provider, config } = this.assertProvider(providerId)
    if (!provider.getItemDetail) {
      throw new Error('Detail lookup is not supported for this provider')
    }

    return provider.getItemDetail(params, config as never)
  }

  static async downloadUrl(
    providerId: DiscoverProviderId,
    params: DiscoverDownloadParams,
  ): Promise<DiscoverDownloadInfo> {
    const { provider, config } = this.assertProvider(providerId)
    return provider.getDownloadUrl(params, config as never)
  }
}
