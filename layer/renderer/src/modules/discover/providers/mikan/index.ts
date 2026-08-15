import type { DiscoverProviderId } from '~/atoms/settings/discover'

import type { DiscoverProviderImplementation } from '../../types'
import { getItemDetail } from './detail'
import { getDownloadUrl } from './download'
import { search } from './search'
import { ensureConfigReady } from './utils'

export const MikanDiscoverProvider: DiscoverProviderImplementation<'mikan'> = {
  id: 'mikan',
  label: 'Mikan 蜜柑计划',
  isConfigReady: (config) => {
    try {
      ensureConfigReady(config)
      return true
    }
    catch {
      return false
    }
  },
  search,
  getItemDetail,
  getDownloadUrl,
}

export type MikanProviderId = Extract<DiscoverProviderId, 'mikan'>
