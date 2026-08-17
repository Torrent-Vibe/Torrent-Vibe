import type { DiscoverProviderId } from '~/atoms/settings/discover'
import type {
  DiscoverFilterDefinition,
  DiscoverPreviewDescriptionRenderer,
} from '~/modules/discover'

import type { DiscoverFilterState } from '../types'

export interface ConfigureProviderOptions {
  defaultFilters: DiscoverFilterState
  descriptionRenderer: DiscoverPreviewDescriptionRenderer
  filterDefinitions: DiscoverFilterDefinition[]
  initialKeyword?: string
  pageSize: number
  providerId: DiscoverProviderId
  providerReady: boolean
}

export interface ActionResult<T = void> {
  data?: T
  error?: string
  ok: boolean
}
