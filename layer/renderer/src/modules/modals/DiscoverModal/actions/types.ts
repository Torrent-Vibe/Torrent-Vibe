import type { DiscoverProviderId } from '~/atoms/settings/discover'
import type {
  DiscoverFilterDefinition,
  DiscoverPreviewDescriptionRenderer,
} from '~/modules/discover'

import type { DiscoverFilterState } from '../types'

export interface ConfigureProviderOptions {
  providerId: DiscoverProviderId
  providerReady: boolean
  pageSize: number
  descriptionRenderer: DiscoverPreviewDescriptionRenderer
  filterDefinitions: DiscoverFilterDefinition[]
  defaultFilters: DiscoverFilterState
  initialKeyword?: string
}

export interface ActionResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}
